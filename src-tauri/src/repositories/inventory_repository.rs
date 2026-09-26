use rusqlite::Connection;
use rusqlite::OptionalExtension;

use crate::errors::AppError;

/// Returns Some(current_quantity) if the phone/accessory item exists and is not deleted.
pub fn item_quantity(conn: &Connection, item_type: &str, id: i64) -> Result<Option<i64>, AppError> {
    let table = if item_type == "phone" {
        "phones"
    } else {
        "accessories"
    };
    let q: Option<i64> = conn
        .query_row(
            &format!("SELECT quantity FROM {table} WHERE id = ?1 AND is_deleted = 0"),
            [id],
            |r| r.get(0),
        )
        .optional()?;
    Ok(q)
}

/// Add quantity back to sellable stock.
pub fn increment_stock(
    conn: &Connection,
    item_type: &str,
    item_id: i64,
    qty: i64,
) -> Result<(), AppError> {
    let table = if item_type == "phone" {
        "phones"
    } else {
        "accessories"
    };
    conn.execute(
        &format!(
            "UPDATE {table} SET quantity = quantity + ?1, updated_at = CURRENT_TIMESTAMP \
             WHERE id = ?2 AND is_deleted = 0"
        ),
        rusqlite::params![qty, item_id],
    )?;
    Ok(())
}

/// Remove quantity from sellable stock.
pub fn decrement_stock(
    conn: &Connection,
    item_type: &str,
    item_id: i64,
    qty: i64,
) -> Result<bool, AppError> {
    let table = if item_type == "phone" {
        "phones"
    } else {
        "accessories"
    };
    let affected = conn.execute(
        &format!(
            "UPDATE {table} SET quantity = quantity - ?1, updated_at = CURRENT_TIMESTAMP \
             WHERE id = ?2 AND is_deleted = 0 AND quantity >= ?1"
        ),
        rusqlite::params![qty, item_id],
    )?;
    Ok(affected > 0)
}

/// Reverses a purchase's stock increment when the purchase is deleted or
/// edited. Unlike `decrement_stock` it never fails on an inventory deficit:
/// any legacy quantity drift (a phone that was soft-deleted or edited while
/// its purchased units still existed) is clamped at zero so the reversal is
/// always consistent instead of leaving an un-deletable purchase behind.
pub fn reverse_stock(
    conn: &Connection,
    item_type: &str,
    item_id: i64,
    qty: i64,
) -> Result<(), AppError> {
    let table = if item_type == "phone" {
        "phones"
    } else {
        "accessories"
    };
    conn.execute(
        &format!(
            "UPDATE {table} SET quantity = MAX(0, quantity - ?1), updated_at = CURRENT_TIMESTAMP \
             WHERE id = ?2"
        ),
        rusqlite::params![qty, item_id],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::test_utils::in_memory_conn;

    #[test]
    fn test_item_quantity() {
        let conn = in_memory_conn();
        conn.execute(
            "INSERT INTO phones (brand, model, quantity) VALUES ('Apple', 'iPhone 13', 5)",
            [],
        )
        .unwrap();
        let phone_id = conn.last_insert_rowid();

        assert_eq!(item_quantity(&conn, "phone", phone_id).unwrap(), Some(5));

        // Soft-deleted item returns None
        conn.execute(
            "UPDATE phones SET is_deleted = 1 WHERE id = ?1",
            [phone_id],
        )
        .unwrap();
        assert_eq!(item_quantity(&conn, "phone", phone_id).unwrap(), None);

        // Non-existent item returns None
        assert_eq!(item_quantity(&conn, "phone", 9999).unwrap(), None);
    }

    #[test]
    fn test_increment_stock() {
        let conn = in_memory_conn();
        conn.execute(
            "INSERT INTO accessories (brand, product_name, quantity) VALUES ('Samsung', 'Case', 2)",
            [],
        )
        .unwrap();
        let id = conn.last_insert_rowid();

        increment_stock(&conn, "accessory", id, 3).unwrap();
        assert_eq!(item_quantity(&conn, "accessory", id).unwrap(), Some(5));
    }

    #[test]
    fn test_decrement_stock() {
        let conn = in_memory_conn();
        conn.execute(
            "INSERT INTO phones (brand, model, quantity) VALUES ('Apple', 'iPhone 12', 3)",
            [],
        )
        .unwrap();
        let id = conn.last_insert_rowid();

        // Successful decrement
        let success = decrement_stock(&conn, "phone", id, 2).unwrap();
        assert!(success);
        assert_eq!(item_quantity(&conn, "phone", id).unwrap(), Some(1));

        // Insufficient stock returns false and does not decrement
        let fail = decrement_stock(&conn, "phone", id, 5).unwrap();
        assert!(!fail);
        assert_eq!(item_quantity(&conn, "phone", id).unwrap(), Some(1));
    }

    #[test]
    fn test_reverse_stock_clamps_at_zero() {
        let conn = in_memory_conn();
        conn.execute(
            "INSERT INTO accessories (brand, product_name, quantity) VALUES ('Anker', 'Cable', 5)",
            [],
        )
        .unwrap();
        let id = conn.last_insert_rowid();

        reverse_stock(&conn, "accessory", id, 3).unwrap();
        assert_eq!(item_quantity(&conn, "accessory", id).unwrap(), Some(2));

        // Reversal with quantity greater than stock clamps at 0
        reverse_stock(&conn, "accessory", id, 10).unwrap();
        assert_eq!(item_quantity(&conn, "accessory", id).unwrap(), Some(0));
    }
}
