use rusqlite::{params, Connection, OptionalExtension, Row};

use crate::errors::AppError;
use crate::models::member::{CreateMemberInput, Member};

fn member_from_row(row: &Row) -> rusqlite::Result<Member> {
    Ok(Member {
        id: row.get("id")?,
        name: row.get("name")?,
        phone: row.get("phone")?,
        cnic: row.get("cnic")?,
        address: row.get("address")?,
        image_path: row.get("image_path")?,
        status: row.get("status")?,
        notes: row.get("notes")?,
        is_deleted: row.get::<_, i64>("is_deleted")? != 0,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

pub fn insert(conn: &Connection, input: &CreateMemberInput) -> Result<i64, AppError> {
    conn.execute(
        "INSERT INTO members (name, phone, cnic, address, notes)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            input.name,
            input.phone,
            input.cnic,
            input.address,
            input.notes
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn get_by_id(conn: &Connection, id: i64) -> Result<Option<Member>, AppError> {
    let row = conn
        .query_row(
            "SELECT id, name, phone, cnic, address, image_path, status, notes, is_deleted, created_at, updated_at
             FROM members WHERE id = ?1 AND is_deleted = 0",
            [id],
            member_from_row,
        )
        .optional()?;
    Ok(row)
}

pub fn find_by_phone(conn: &Connection, phone: &str) -> Result<Option<Member>, AppError> {
    if phone.trim().is_empty() {
        return Ok(None);
    }
    let row = conn
        .query_row(
            "SELECT id, name, phone, cnic, address, image_path, status, notes, is_deleted, created_at, updated_at
             FROM members WHERE phone = ?1 AND is_deleted = 0",
            [phone],
            member_from_row,
        )
        .optional()?;
    Ok(row)
}

pub fn list(conn: &Connection, search: Option<&str>, limit: i64) -> Result<Vec<Member>, AppError> {
    let mut members = Vec::new();
    let has_search = search.map(|s| !s.trim().is_empty()).unwrap_or(false);

    if has_search {
        let pattern = format!("%{}%", search.unwrap_or("").trim());
        let mut stmt = conn.prepare(
            "SELECT id, name, phone, cnic, address, image_path, status, notes, is_deleted, created_at, updated_at
             FROM members
             WHERE is_deleted = 0 AND (name LIKE ?1 OR phone LIKE ?1 OR cnic LIKE ?1)
             ORDER BY created_at DESC
             LIMIT ?2",
        )?;
        let rows = stmt.query_map(params![pattern, limit], member_from_row)?;
        for row in rows {
            members.push(row?);
        }
    } else {
        let mut stmt = conn.prepare(
            "SELECT id, name, phone, cnic, address, image_path, status, notes, is_deleted, created_at, updated_at
             FROM members
             WHERE is_deleted = 0
             ORDER BY created_at DESC
             LIMIT ?1",
        )?;
        let rows = stmt.query_map([limit], member_from_row)?;
        for row in rows {
            members.push(row?);
        }
    }
    Ok(members)
}

pub fn soft_delete(conn: &Connection, id: i64) -> Result<bool, AppError> {
    let affected = conn.execute(
        "UPDATE members SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?1 AND is_deleted = 0",
        [id],
    )?;
    Ok(affected > 0)
}

pub fn update(conn: &Connection, id: i64, input: &CreateMemberInput) -> Result<bool, AppError> {
    let affected = conn.execute(
        "UPDATE members SET name = ?1, phone = ?2, cnic = ?3, address = ?4, notes = ?5, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?6 AND is_deleted = 0",
        params![
            input.name,
            input.phone,
            input.cnic,
            input.address,
            input.notes,
            id
        ],
    )?;
    Ok(affected > 0)
}

pub fn find_by_phone_excluding(
    conn: &Connection,
    phone: &str,
    exclude_id: i64,
) -> Result<Option<Member>, AppError> {
    if phone.trim().is_empty() {
        return Ok(None);
    }
    let row = conn
        .query_row(
            "SELECT id, name, phone, cnic, address, image_path, status, notes, is_deleted, created_at, updated_at
             FROM members WHERE phone = ?1 AND is_deleted = 0 AND id <> ?2",
            params![phone, exclude_id],
            member_from_row,
        )
        .optional()?;
    Ok(row)
}
