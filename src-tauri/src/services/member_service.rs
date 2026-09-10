use rusqlite::Connection;

use crate::errors::AppError;
use crate::models::member::{CreateMemberInput, Member};
use crate::repositories::member_repository;
use crate::services;

pub fn create(conn: &Connection, input: CreateMemberInput) -> Result<Member, AppError> {
    let name = input.name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::validation("Member name is required"));
    }
    if matches!(input.phone.as_deref(), Some(p) if p.trim().is_empty()) {
        return Err(AppError::validation("Phone number cannot be blank"));
    }

    if let Some(phone) = input.phone.as_deref() {
        if member_repository::find_by_phone(conn, phone)?.is_some() {
            return Err(AppError::validation(
                "A member with this phone number already exists",
            ));
        }
    }

    let normalized = CreateMemberInput {
        name,
        phone: input.phone.map(|p| p.trim().to_string()),
        cnic: input
            .cnic
            .map(|e| e.trim().to_string())
            .filter(|e| !e.is_empty()),
        address: input
            .address
            .map(|a| a.trim().to_string())
            .filter(|a| !a.is_empty()),
        notes: input
            .notes
            .map(|n| n.trim().to_string())
            .filter(|n| !n.is_empty()),
    };

    let id = member_repository::insert(conn, &normalized)?;
    services::record_activity(conn, None, "member", "create", Some(id))?;

    member_repository::get_by_id(conn, id)?
        .ok_or_else(|| AppError::Internal("Created member could not be retrieved".into()))
}

pub fn list(conn: &Connection, search: Option<String>) -> Result<Vec<Member>, AppError> {
    member_repository::list(conn, search.as_deref(), 500)
}

pub fn get(conn: &Connection, id: i64) -> Result<Member, AppError> {
    member_repository::get_by_id(conn, id)?.ok_or_else(|| AppError::validation("Member not found"))
}

pub fn update(conn: &Connection, id: i64, input: CreateMemberInput) -> Result<Member, AppError> {
    let name = input.name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::validation("Member name is required"));
    }
    if matches!(input.phone.as_deref(), Some(p) if p.trim().is_empty()) {
        return Err(AppError::validation("Phone number cannot be blank"));
    }

    if let Some(phone) = input.phone.as_deref() {
        if member_repository::find_by_phone_excluding(conn, phone, id)?.is_some() {
            return Err(AppError::validation(
                "A member with this phone number already exists",
            ));
        }
    }

    let normalized = CreateMemberInput {
        name,
        phone: input.phone.map(|p| p.trim().to_string()),
        cnic: input
            .cnic
            .map(|e| e.trim().to_string())
            .filter(|e| !e.is_empty()),
        address: input
            .address
            .map(|a| a.trim().to_string())
            .filter(|a| !a.is_empty()),
        notes: input
            .notes
            .map(|n| n.trim().to_string())
            .filter(|n| !n.is_empty()),
    };

    let updated = member_repository::update(conn, id, &normalized)?;
    if !updated {
        return Err(AppError::validation("Member not found"));
    }
    services::record_activity(conn, None, "member", "update", Some(id))?;

    member_repository::get_by_id(conn, id)?
        .ok_or_else(|| AppError::Internal("Updated member could not be retrieved".into()))
}

pub fn soft_delete(conn: &Connection, id: i64, actor: Option<i64>) -> Result<(), AppError> {
    let deleted = member_repository::soft_delete(conn, id)?;
    if !deleted {
        return Err(AppError::validation("Member not found"));
    }
    services::record_activity(conn, actor, "member", "delete", Some(id))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::member::CreateMemberInput;
    use rusqlite::Connection;

    fn test_conn() -> Connection {
        let conn = Connection::open_in_memory().expect("in-memory db");
        conn.execute_batch(
            "CREATE TABLE members (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                phone TEXT,
                cnic TEXT,
                address TEXT,
                image_path TEXT,
                status TEXT NOT NULL DEFAULT 'active',
                notes TEXT,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE activity_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                module TEXT NOT NULL,
                action TEXT NOT NULL,
                record_id INTEGER,
                old_value TEXT,
                new_value TEXT,
                timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            );",
        )
        .expect("test schema");
        conn
    }

    #[test]
    fn creates_valid_member() {
        let conn = test_conn();
        let input = CreateMemberInput {
            name: "Ali Khan".into(),
            phone: Some("03001234567".into()),
            cnic: None,
            address: None,
            notes: None,
        };
        let member = create(&conn, input).expect("create");
        assert!(member.id > 0);
        assert_eq!(member.name, "Ali Khan");
    }

    #[test]
    fn rejects_empty_name() {
        let conn = test_conn();
        let input = CreateMemberInput {
            name: "   ".into(),
            phone: None,
            cnic: None,
            address: None,
            notes: None,
        };
        let err = create(&conn, input).unwrap_err();
        assert!(matches!(err, AppError::Validation(_)));
    }

    #[test]
    fn rejects_duplicate_phone() {
        let conn = test_conn();
        let base = CreateMemberInput {
            name: "A".into(),
            phone: Some("03000000000".into()),
            cnic: None,
            address: None,
            notes: None,
        };
        create(&conn, base.clone()).expect("first");
        let err = create(&conn, base).unwrap_err();
        assert!(matches!(err, AppError::Validation(_)));
    }

    #[test]
    fn soft_deletes_member() {
        let conn = test_conn();
        let input = CreateMemberInput {
            name: "To Delete".into(),
            phone: None,
            cnic: None,
            address: None,
            notes: None,
        };
        let member = create(&conn, input).expect("create");
        soft_delete(&conn, member.id, None).expect("delete");
        assert!(get(&conn, member.id).is_err());
    }

    #[test]
    fn updates_member() {
        let conn = test_conn();
        let input = CreateMemberInput {
            name: "Original".into(),
            phone: Some("03000000001".into()),
            cnic: None,
            address: None,
            notes: None,
        };
        let member = create(&conn, input).expect("create");
        let updated_input = CreateMemberInput {
            name: "Changed".into(),
            phone: Some("03000000002".into()),
            cnic: Some("12345-6789012-3".into()),
            address: None,
            notes: None,
        };
        let updated = update(&conn, member.id, updated_input).expect("update");
        assert_eq!(updated.name, "Changed");
        assert_eq!(updated.cnic.as_deref(), Some("12345-6789012-3"));
    }

    #[test]
    fn update_rejects_phone_used_by_another_member() {
        let conn = test_conn();
        let first = create(
            &conn,
            CreateMemberInput {
                name: "First".into(),
                phone: Some("03001111111".into()),
                cnic: None,
                address: None,
                notes: None,
            },
        )
        .expect("first");
        let second = create(
            &conn,
            CreateMemberInput {
                name: "Second".into(),
                phone: Some("03002222222".into()),
                cnic: None,
                address: None,
                notes: None,
            },
        )
        .expect("second");

        let err = update(
            &conn,
            second.id,
            CreateMemberInput {
                name: "Second".into(),
                phone: Some("03001111111".into()),
                cnic: None,
                address: None,
                notes: None,
            },
        )
        .unwrap_err();
        assert!(matches!(err, AppError::Validation(_)));
        assert_eq!(
            get(&conn, first.id).unwrap().phone.as_deref(),
            Some("03001111111")
        );
        assert_eq!(
            get(&conn, second.id).unwrap().phone.as_deref(),
            Some("03002222222")
        );
    }
}
