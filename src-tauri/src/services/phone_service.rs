use rusqlite::Connection;

use crate::errors::AppError;
use crate::models::phone::{AddPhoneImeiInput, CreatePhoneInput, Phone, PhoneImei};
use crate::repositories::phone_repository;
use crate::services;
use crate::services::product_category_service;

fn validate_category(conn: &Connection, category: &str) -> Result<(), AppError> {
    if !product_category_service::category_exists(conn, category)? {
        return Err(AppError::validation(
            "Selected category does not exist. Add it under 'Manage Categories'.",
        ));
    }
    Ok(())
}

fn normalize(input: CreatePhoneInput) -> Result<CreatePhoneInput, AppError> {
    let brand = input.brand.trim().to_string();
    if brand.is_empty() {
        return Err(AppError::validation("Brand is required"));
    }
    let model = input.model.trim().to_string();
    if model.is_empty() {
        return Err(AppError::validation("Model is required"));
    }
    if input.cost_price < 0.0 || input.sale_price < 0.0 {
        return Err(AppError::validation("Prices cannot be negative"));
    }
    if input.quantity < 0 {
        return Err(AppError::validation("Quantity cannot be negative"));
    }
    let trim = |v: Option<String>| v.map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
    let imei = trim(input.imei.clone()).map(|s| s.to_uppercase());
    if let Some(imei) = &imei {
        if imei.len() < 8 {
            return Err(AppError::validation("IMEI must be at least 8 characters"));
        }
    }
    Ok(CreatePhoneInput {
        brand,
        model,
        color: trim(input.color),
        storage: trim(input.storage),
        ram: trim(input.ram),
        processor: trim(input.processor),
        chipset: trim(input.chipset),
        network_type: trim(input.network_type),
        battery_capacity: trim(input.battery_capacity),
        imei,
        category: trim(input.category),
        cost_price: input.cost_price,
        sale_price: input.sale_price,
        quantity: input.quantity,
        supplier_id: input.supplier_id,
        low_stock_threshold: input.low_stock_threshold.max(0),
    })
}

pub fn create(conn: &Connection, input: CreatePhoneInput) -> Result<Phone, AppError> {
    let normalized = normalize(input)?;
    if let Some(cat) = normalized.category.as_deref() {
        validate_category(conn, cat)?;
    }
    if let Some(imei) = &normalized.imei {
        if phone_repository::imei_taken(conn, imei, None)? {
            return Err(AppError::validation(format!("IMEI {imei} is already in use")));
        }
    }
    let id = phone_repository::insert(conn, &normalized)?;
    services::record_activity(conn, None, "phone", "create", Some(id))?;
    phone_repository::get_by_id(conn, id)?
        .ok_or_else(|| AppError::Internal("Created phone could not be retrieved".into()))
}

pub fn list(conn: &Connection, search: Option<String>) -> Result<Vec<Phone>, AppError> {
    phone_repository::list(conn, search.as_deref())
}

pub fn get(conn: &Connection, id: i64) -> Result<Phone, AppError> {
    phone_repository::get_by_id(conn, id)?
        .ok_or_else(|| AppError::validation("Phone not found"))
}

pub fn update(conn: &Connection, id: i64, input: CreatePhoneInput) -> Result<Phone, AppError> {
    let normalized = normalize(input)?;
    if let Some(cat) = normalized.category.as_deref() {
        validate_category(conn, cat)?;
    }
    if let Some(imei) = &normalized.imei {
        if phone_repository::imei_taken(conn, imei, Some(id))? {
            return Err(AppError::validation(format!("IMEI {imei} is already in use")));
        }
    }
    let updated = phone_repository::update(conn, id, &normalized)?;
    if !updated {
        return Err(AppError::validation("Phone not found"));
    }
    services::record_activity(conn, None, "phone", "update", Some(id))?;
    phone_repository::get_by_id(conn, id)?
        .ok_or_else(|| AppError::Internal("Updated phone could not be retrieved".into()))
}

pub fn soft_delete(conn: &Connection, id: i64, actor: Option<i64>) -> Result<(), AppError> {
    let deleted = phone_repository::soft_delete(conn, id)?;
    if !deleted {
        return Err(AppError::validation("Phone not found"));
    }
    services::record_activity(conn, actor, "phone", "delete", Some(id))
}

/// Add stock quantity and optionally register IMEI units, atomically.
pub fn restock(
    conn: &Connection,
    id: i64,
    quantity: i64,
    imeis: Vec<String>,
    actor: Option<i64>,
) -> Result<(), AppError> {
    if quantity < 0 {
        return Err(AppError::validation("Restock quantity cannot be negative"));
    }
    let tx = conn.unchecked_transaction()?;
    phone_repository::add_quantity(&tx, id, quantity)?;

    for imei in imeis.iter().map(|s| s.trim().to_string()).filter(|s| !s.is_empty()) {
        if phone_repository::imei_exists(&tx, &imei)? {
            return Err(AppError::validation(format!("IMEI {imei} is already in use")));
        }
        phone_repository::insert_imei(
            &tx,
            &AddPhoneImeiInput { phone_id: id, imei },
        )?;
    }
    tx.commit()?;
    services::record_activity(conn, actor, "phone", "restock", Some(id))
}

pub fn add_imei(conn: &Connection, input: AddPhoneImeiInput) -> Result<PhoneImei, AppError> {
    let imei = input.imei.trim().to_uppercase();
    if imei.is_empty() {
        return Err(AppError::validation("IMEI is required"));
    }
    if phone_repository::get_by_id(conn, input.phone_id)?.is_none() {
        return Err(AppError::validation("Phone not found"));
    }
    if phone_repository::imei_exists(conn, &imei)? {
        return Err(AppError::validation(format!("IMEI {imei} is already in use")));
    }

    let tx = conn.unchecked_transaction()?;
    let imei_id = phone_repository::insert_imei(
        &tx,
        &AddPhoneImeiInput { phone_id: input.phone_id, imei: imei.clone() },
    )?;
    phone_repository::add_quantity(&tx, input.phone_id, 1)?;
    tx.commit()?;

    services::record_activity(conn, None, "phone", "add_imei", Some(imei_id))?;
    Ok(PhoneImei {
        id: imei_id,
        phone_id: input.phone_id,
        imei,
        status: "in_stock".into(),
        sold_at: None,
        created_at: String::new(),
    })
}

pub fn list_imei(conn: &Connection, phone_id: i64) -> Result<Vec<PhoneImei>, AppError> {
    phone_repository::list_imei(conn, phone_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::test_utils::in_memory_conn;

    fn sample() -> CreatePhoneInput {
        CreatePhoneInput {
            brand: "Samsung".into(),
            model: "Galaxy S24".into(),
            color: Some("Black".into()),
            storage: Some("256GB".into()),
            ram: Some("8GB".into()),
            processor: Some("Snapdragon".into()),
            cost_price: 600.0,
            sale_price: 750.0,
            quantity: 5,
            supplier_id: None,
            low_stock_threshold: 2,
            ..Default::default()
        }
    }

    #[test]
    fn create_and_get() {
        let conn = in_memory_conn();
        let p = create(&conn, sample()).unwrap();
        let got = get(&conn, p.id).unwrap();
        assert_eq!(got.brand, "Samsung");
        assert_eq!(got.quantity, 5);
    }

    #[test]
    fn create_defaults_low_stock_and_requires_brand() {
        let conn = in_memory_conn();
        let mut input = sample();
        input.brand = "   ".into();
        assert!(matches!(create(&conn, input).unwrap_err(), AppError::Validation(_)));
    }

    #[test]
    fn phone_fields_persisted_and_imei_uppercased() {
        let conn = in_memory_conn();
        let mut input = sample();
        input.imei = Some(" 123456789012345 ".into());
        let p = create(&conn, input).unwrap();
        let got = get(&conn, p.id).unwrap();
        assert_eq!(got.ram.as_deref(), Some("8GB"));
        assert_eq!(got.imei.as_deref(), Some("123456789012345"));
    }

    #[test]
    fn duplicate_imei_rejected() {
        let conn = in_memory_conn();
        let mut a = sample();
        a.imei = Some("111222333444555".into());
        create(&conn, a).unwrap();
        let mut b = sample();
        b.model = "S25".into();
        b.imei = Some("111222333444555".into());
        assert!(matches!(create(&conn, b).unwrap_err(), AppError::Validation(_)));
    }

    #[test]
    fn list_filters_by_search() {
        let conn = in_memory_conn();
        create(&conn, sample()).unwrap();
        let mut apple = sample();
        apple.brand = "Apple".into();
        apple.model = "iPhone 15".into();
        create(&conn, apple).unwrap();
        assert_eq!(list(&conn, Some("iPhone".into())).unwrap().len(), 1);
    }

    #[test]
    fn soft_delete_hides() {
        let conn = in_memory_conn();
        let p = create(&conn, sample()).unwrap();
        soft_delete(&conn, p.id, None).unwrap();
        assert!(get(&conn, p.id).is_err());
        assert!(list(&conn, None).unwrap().is_empty());
    }

    #[test]
    fn restock_adds_quantity_and_imei() {
        let conn = in_memory_conn();
        let p = create(&conn, sample()).unwrap();
        restock(&conn, p.id, 3, vec!["111111111111111".into(), "222222222222222".into()], None).unwrap();
        assert_eq!(get(&conn, p.id).unwrap().quantity, 8);
        assert_eq!(list_imei(&conn, p.id).unwrap().len(), 2);
    }

    #[test]
    fn restock_rejects_duplicate_imei_atomically() {
        let conn = in_memory_conn();
        let p = create(&conn, sample()).unwrap();
        restock(&conn, p.id, 2, vec!["111111111111111".into(), "111111111111111".into()], None).unwrap_err();
        assert_eq!(get(&conn, p.id).unwrap().quantity, 5);
        assert!(list_imei(&conn, p.id).unwrap().is_empty());
    }

    #[test]
    fn add_imei_increments_quantity() {
        let conn = in_memory_conn();
        let p = create(&conn, sample()).unwrap();
        let imei = add_imei(&conn, AddPhoneImeiInput { phone_id: p.id, imei: "999999999999999".into() }).unwrap();
        assert_eq!(imei.status, "in_stock");
        assert_eq!(get(&conn, p.id).unwrap().quantity, 6);
    }

    #[test]
    fn record_imei_too_short_rejected() {
        let conn = in_memory_conn();
        let mut input = sample();
        input.imei = Some("12345".into());
        assert!(matches!(create(&conn, input).unwrap_err(), AppError::Validation(_)));
    }

    #[test]
    fn unknown_category_rejected_and_valid_category_persisted() {
        use crate::services::test_utils::seed_product_categories;
        let conn = in_memory_conn();
        seed_product_categories(&conn);

        let mut bad = sample();
        bad.category = Some("Not Real".into());
        assert!(matches!(create(&conn, bad).unwrap_err(), AppError::Validation(_)));

        let mut good = sample();
        good.category = Some("Charger".into());
        let p = create(&conn, good).unwrap();
        assert_eq!(get(&conn, p.id).unwrap().category.as_deref(), Some("Charger"));
    }
}
