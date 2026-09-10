use rusqlite::Connection;

use crate::errors::AppError;
use crate::models::inventory::{CreateSupplierInput, Supplier};
use crate::repositories::supplier_repository;
use crate::services;

pub fn create(conn: &Connection, input: CreateSupplierInput) -> Result<Supplier, AppError> {
    let name = input.name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::validation("Supplier name is required"));
    }
    let normalized = CreateSupplierInput {
        name,
        phone: input
            .phone
            .map(|p| p.trim().to_string())
            .filter(|v| !v.is_empty()),
        email: input
            .email
            .map(|e| e.trim().to_string())
            .filter(|v| !v.is_empty()),
        address: input
            .address
            .map(|a| a.trim().to_string())
            .filter(|v| !v.is_empty()),
    };
    let id = supplier_repository::insert(conn, &normalized)?;
    services::record_activity(conn, None, "supplier", "create", Some(id))?;
    supplier_repository::get_by_id(conn, id)?
        .ok_or_else(|| AppError::Internal("Created supplier could not be retrieved".into()))
}

pub fn list(conn: &Connection) -> Result<Vec<Supplier>, AppError> {
    supplier_repository::list(conn)
}

pub fn update(
    conn: &Connection,
    id: i64,
    input: CreateSupplierInput,
) -> Result<Supplier, AppError> {
    let name = input.name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::validation("Supplier name is required"));
    }
    let normalized = CreateSupplierInput {
        name,
        phone: input
            .phone
            .map(|p| p.trim().to_string())
            .filter(|v| !v.is_empty()),
        email: input
            .email
            .map(|e| e.trim().to_string())
            .filter(|v| !v.is_empty()),
        address: input
            .address
            .map(|a| a.trim().to_string())
            .filter(|v| !v.is_empty()),
    };
    let updated = supplier_repository::update(conn, id, &normalized)?;
    if !updated {
        return Err(AppError::validation("Supplier not found"));
    }
    services::record_activity(conn, None, "supplier", "update", Some(id))?;
    supplier_repository::get_by_id(conn, id)?
        .ok_or_else(|| AppError::Internal("Updated supplier could not be retrieved".into()))
}

pub fn soft_delete(conn: &Connection, id: i64, actor: Option<i64>) -> Result<(), AppError> {
    let deleted = supplier_repository::soft_delete(conn, id)?;
    if !deleted {
        return Err(AppError::validation("Supplier not found"));
    }
    services::record_activity(conn, actor, "supplier", "delete", Some(id))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::inventory::CreateSupplierInput;
    use crate::services::test_utils::in_memory_conn;

    fn sample() -> CreateSupplierInput {
        CreateSupplierInput {
            name: "Test Supplier".into(),
            phone: Some("123".into()),
            email: Some("sup@test.com".into()),
            address: None,
        }
    }

    #[test]
    fn create_and_list() {
        let conn = in_memory_conn();
        let s = create(&conn, sample()).unwrap();
        assert_eq!(s.name, "Test Supplier");
        assert_eq!(list(&conn).unwrap().len(), 1);
    }

    #[test]
    fn create_requires_name() {
        let conn = in_memory_conn();
        let mut input = sample();
        input.name = "   ".into();
        let err = create(&conn, input).unwrap_err();
        assert!(matches!(err, AppError::Validation(_)));
    }

    #[test]
    fn update_changes_fields() {
        let conn = in_memory_conn();
        let s = create(&conn, sample()).unwrap();
        let mut input = sample();
        input.name = "Updated".into();
        input.phone = None;
        let updated = update(&conn, s.id, input).unwrap();
        assert_eq!(updated.name, "Updated");
        assert_eq!(updated.phone, None);
    }

    #[test]
    fn update_missing_errors() {
        let conn = in_memory_conn();
        let err = update(&conn, 999, sample()).unwrap_err();
        assert!(matches!(err, AppError::Validation(_)));
    }

    #[test]
    fn soft_delete_removes_from_list() {
        let conn = in_memory_conn();
        let s = create(&conn, sample()).unwrap();
        soft_delete(&conn, s.id, None).unwrap();
        assert!(list(&conn).unwrap().is_empty());
        assert!(soft_delete(&conn, s.id, None).is_err());
    }
}
