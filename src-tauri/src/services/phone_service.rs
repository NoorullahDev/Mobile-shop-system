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
    let imei2 = trim(input.imei2.clone()).map(|s| s.to_uppercase());
    if let Some(imei2) = &imei2 {
        if imei2.len() < 8 {
            return Err(AppError::validation("IMEI 2 must be at least 8 characters"));
        }
    }
    if let (Some(a), Some(b)) = (&imei, &imei2) {
        if a == b {
            return Err(AppError::validation("IMEI and IMEI 2 cannot be the same"));
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
        imei2,
        serial_number: trim(input.serial_number).map(|s| s.to_uppercase()),
        image_paths: input.image_paths,
        category: trim(input.category),
        condition: trim(input.condition),
        variant: trim(input.variant),
        sku: trim(input.sku),
        condition_rating: trim(input.condition_rating),
        body_condition: trim(input.body_condition),
        screen_condition: trim(input.screen_condition),
        battery_health: trim(input.battery_health),
        camera_condition: trim(input.camera_condition),
        face_id: trim(input.face_id),
        speaker: trim(input.speaker),
        charger: trim(input.charger),
        box_condition: trim(input.box_condition),
        warranty: trim(input.warranty),
        condition_notes: trim(input.condition_notes),
        cost_price: input.cost_price,
        sale_price: input.sale_price,
        quantity: input.quantity,
        supplier_id: input.supplier_id,
        low_stock_threshold: input.low_stock_threshold.max(0),
    })
}

fn reject_if_imei_taken(
    conn: &Connection,
    imei: &str,
    exclude_id: Option<i64>,
) -> Result<(), AppError> {
    if phone_repository::imei_taken(conn, imei, exclude_id)? {
        return Err(AppError::validation(format!(
            "IMEI {imei} is already in use"
        )));
    }
    Ok(())
}

pub fn create(conn: &Connection, input: CreatePhoneInput) -> Result<Phone, AppError> {
    let normalized = normalize(input)?;
    if let Some(cat) = normalized.category.as_deref() {
        validate_category(conn, cat)?;
    }
    if let Some(imei) = &normalized.imei {
        reject_if_imei_taken(conn, imei, None)?;
    }
    if let Some(imei2) = &normalized.imei2 {
        reject_if_imei_taken(conn, imei2, None)?;
    }
    if let Some(serial) = &normalized.serial_number {
        if phone_repository::serial_taken(conn, serial, None)? {
            return Err(AppError::validation(format!(
                "Serial Number {serial} is already in use"
            )));
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
    phone_repository::get_by_id(conn, id)?.ok_or_else(|| AppError::validation("Phone not found"))
}

pub fn update(conn: &Connection, id: i64, input: CreatePhoneInput) -> Result<Phone, AppError> {
    let normalized = normalize(input)?;
    if let Some(cat) = normalized.category.as_deref() {
        validate_category(conn, cat)?;
    }
    if let Some(imei) = &normalized.imei {
        reject_if_imei_taken(conn, imei, Some(id))?;
    }
    if let Some(imei2) = &normalized.imei2 {
        reject_if_imei_taken(conn, imei2, Some(id))?;
    }
    if let Some(serial) = &normalized.serial_number {
        if phone_repository::serial_taken(conn, serial, Some(id))? {
            return Err(AppError::validation(format!(
                "Serial Number {serial} is already in use"
            )));
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

    for imei in imeis
        .iter()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
    {
        if phone_repository::imei_exists(&tx, &imei)? {
            return Err(AppError::validation(format!(
                "IMEI {imei} is already in use"
            )));
        }
        phone_repository::insert_imei(&tx, &AddPhoneImeiInput { phone_id: id, imei })?;
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
        return Err(AppError::validation(format!(
            "IMEI {imei} is already in use"
        )));
    }

    let tx = conn.unchecked_transaction()?;
    let imei_id = phone_repository::insert_imei(
        &tx,
        &AddPhoneImeiInput {
            phone_id: input.phone_id,
            imei: imei.clone(),
        },
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
        assert!(matches!(
            create(&conn, input).unwrap_err(),
            AppError::Validation(_)
        ));
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
        assert!(matches!(
            create(&conn, b).unwrap_err(),
            AppError::Validation(_)
        ));
    }

    #[test]
    fn imei2_duplicate_rejected_across_phones() {
        let conn = in_memory_conn();
        let mut a = sample();
        a.imei = Some("111222333444555".into());
        create(&conn, a).unwrap();
        let mut b = sample();
        b.model = "S25".into();
        b.imei2 = Some("111222333444555".into());
        assert!(matches!(
            create(&conn, b).unwrap_err(),
            AppError::Validation(_)
        ));
    }

    #[test]
    fn imei_and_imei2_same_rejected() {
        let conn = in_memory_conn();
        let mut a = sample();
        a.imei = Some("111222333444555".into());
        a.imei2 = Some("111222333444555".into());
        assert!(matches!(
            create(&conn, a).unwrap_err(),
            AppError::Validation(_)
        ));
    }

    #[test]
    fn condition_details_persisted_and_trimmed() {
        let conn = in_memory_conn();
        let mut input = sample();
        input.condition = Some("Used".into());
        input.condition_rating = Some(" 8/10 ".into());
        input.body_condition = Some("Minor Scratches".into());
        input.screen_condition = Some("Flawless".into());
        input.battery_health = Some("86%".into());
        input.camera_condition = Some("Good".into());
        input.face_id = Some("Working".into());
        input.speaker = Some("Working".into());
        input.charger = Some("Original".into());
        input.box_condition = Some("Original Box".into());
        input.condition_notes = Some("  Charger cable slightly worn.  ".into());
        let p = create(&conn, input).unwrap();
        let got = get(&conn, p.id).unwrap();
        assert_eq!(got.condition.as_deref(), Some("Used"));
        assert_eq!(got.condition_rating.as_deref(), Some("8/10"));
        assert_eq!(got.body_condition.as_deref(), Some("Minor Scratches"));
        assert_eq!(got.battery_health.as_deref(), Some("86%"));
        assert_eq!(
            got.condition_notes.as_deref(),
            Some("Charger cable slightly worn.")
        );

        let updated = update(&conn, p.id, {
            let mut u = sample();
            u.condition = Some("Refurbished".into());
            u.battery_health = Some("90%".into());
            u
        })
        .unwrap();
        assert_eq!(updated.battery_health.as_deref(), Some("90%"));
        assert_eq!(updated.condition.as_deref(), Some("Refurbished"));
        assert_eq!(updated.condition_rating, None);
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
    fn serial_number_is_unique_and_searchable() {
        let conn = in_memory_conn();
        let mut first = sample();
        first.serial_number = Some(" sn-phone-001 ".into());
        create(&conn, first).unwrap();
        assert_eq!(list(&conn, Some("SN-PHONE-001".into())).unwrap().len(), 1);
        let mut duplicate = sample();
        duplicate.model = "Other".into();
        duplicate.serial_number = Some("sn-phone-001".into());
        assert!(matches!(
            create(&conn, duplicate).unwrap_err(),
            AppError::Validation(_)
        ));
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
        restock(
            &conn,
            p.id,
            3,
            vec!["111111111111111".into(), "222222222222222".into()],
            None,
        )
        .unwrap();
        assert_eq!(get(&conn, p.id).unwrap().quantity, 8);
        assert_eq!(list_imei(&conn, p.id).unwrap().len(), 2);
    }

    #[test]
    fn restock_rejects_duplicate_imei_atomically() {
        let conn = in_memory_conn();
        let p = create(&conn, sample()).unwrap();
        restock(
            &conn,
            p.id,
            2,
            vec!["111111111111111".into(), "111111111111111".into()],
            None,
        )
        .unwrap_err();
        assert_eq!(get(&conn, p.id).unwrap().quantity, 5);
        assert!(list_imei(&conn, p.id).unwrap().is_empty());
    }

    #[test]
    fn add_imei_increments_quantity() {
        let conn = in_memory_conn();
        let p = create(&conn, sample()).unwrap();
        let imei = add_imei(
            &conn,
            AddPhoneImeiInput {
                phone_id: p.id,
                imei: "999999999999999".into(),
            },
        )
        .unwrap();
        assert_eq!(imei.status, "in_stock");
        assert_eq!(get(&conn, p.id).unwrap().quantity, 6);
    }

    #[test]
    fn record_imei_too_short_rejected() {
        let conn = in_memory_conn();
        let mut input = sample();
        input.imei = Some("12345".into());
        assert!(matches!(
            create(&conn, input).unwrap_err(),
            AppError::Validation(_)
        ));
    }

    #[test]
    fn unknown_category_rejected_and_valid_category_persisted() {
        use crate::services::test_utils::seed_product_categories;
        let conn = in_memory_conn();
        seed_product_categories(&conn);

        let mut bad = sample();
        bad.category = Some("Not Real".into());
        assert!(matches!(
            create(&conn, bad).unwrap_err(),
            AppError::Validation(_)
        ));

        let mut good = sample();
        good.category = Some("Charger".into());
        let p = create(&conn, good).unwrap();
        assert_eq!(
            get(&conn, p.id).unwrap().category.as_deref(),
            Some("Charger")
        );
    }
}
