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
