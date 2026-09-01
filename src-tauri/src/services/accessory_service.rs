use rusqlite::Connection;

use crate::errors::AppError;
use crate::models::accessory::{Accessory, CreateAccessoryInput};
use crate::repositories::accessory_repository;
use crate::services;
use crate::services::product_category_service;

fn normalize(input: CreateAccessoryInput) -> Result<CreateAccessoryInput, AppError> {
    let brand = input.brand.trim().to_string();
    if brand.is_empty() {
        return Err(AppError::validation("Brand is required"));
    }
    let product_name = input.product_name.trim().to_string();
    if product_name.is_empty() {
        return Err(AppError::validation("Product name is required"));
    }
    let accessory_type = input.accessory_type.trim().to_string();
    if accessory_type.is_empty() {
        return Err(AppError::validation("Category is required"));
    }
    if input.cost_price < 0.0 || input.sale_price < 0.0 {
        return Err(AppError::validation("Prices cannot be negative"));
    }
    if input.quantity < 0 {
        return Err(AppError::validation("Quantity cannot be negative"));
    }
    let trim = |v: Option<String>| v.map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
    Ok(CreateAccessoryInput {
        accessory_type,
        brand,
        product_name,
        compatible_models: trim(input.compatible_models),
        color: trim(input.color),
        cost_price: input.cost_price,
        sale_price: input.sale_price,
        quantity: input.quantity,
        supplier_id: input.supplier_id,
        low_stock_threshold: input.low_stock_threshold.max(0),
    })
}

fn validate_category(conn: &Connection, category: &str) -> Result<(), AppError> {
    if !product_category_service::category_exists(conn, category)? {
        return Err(AppError::validation(
            "Selected category does not exist. Add it under 'Manage Categories'.",
        ));
    }
    Ok(())
}

pub fn create(conn: &Connection, input: CreateAccessoryInput) -> Result<Accessory, AppError> {
    let normalized = normalize(input)?;
    validate_category(conn, &normalized.accessory_type)?;
    let id = accessory_repository::insert(conn, &normalized)?;
    services::record_activity(conn, None, "accessory", "create", Some(id))?;
    accessory_repository::get_by_id(conn, id)?
        .ok_or_else(|| AppError::Internal("Created accessory could not be retrieved".into()))
}

pub fn list(conn: &Connection, search: Option<String>) -> Result<Vec<Accessory>, AppError> {
    accessory_repository::list(conn, search.as_deref())
}

pub fn get(conn: &Connection, id: i64) -> Result<Accessory, AppError> {
    accessory_repository::get_by_id(conn, id)?
        .ok_or_else(|| AppError::validation("Accessory not found"))
}

pub fn update(
    conn: &Connection,
    id: i64,
    input: CreateAccessoryInput,
) -> Result<Accessory, AppError> {
    let normalized = normalize(input)?;
    validate_category(conn, &normalized.accessory_type)?;
    let updated = accessory_repository::update(conn, id, &normalized)?;
    if !updated {
        return Err(AppError::validation("Accessory not found"));
    }
    services::record_activity(conn, None, "accessory", "update", Some(id))?;
    accessory_repository::get_by_id(conn, id)?
        .ok_or_else(|| AppError::Internal("Updated accessory could not be retrieved".into()))
}

pub fn soft_delete(conn: &Connection, id: i64, actor: Option<i64>) -> Result<(), AppError> {
    let deleted = accessory_repository::soft_delete(conn, id)?;
    if !deleted {
        return Err(AppError::validation("Accessory not found"));
    }
    services::record_activity(conn, actor, "accessory", "delete", Some(id))
}

/// Add stock quantity, atomically (accessories have no IMEIs).
pub fn restock(
    conn: &Connection,
    id: i64,
    quantity: i64,
    actor: Option<i64>,
) -> Result<(), AppError> {
    if quantity < 0 {
        return Err(AppError::validation("Restock quantity cannot be negative"));
    }
    accessory_repository::add_quantity(conn, id, quantity)?;
    services::record_activity(conn, actor, "accessory", "restock", Some(id))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::test_utils::{in_memory_conn, seed_product_categories};

    fn sample() -> CreateAccessoryInput {
        CreateAccessoryInput {
            accessory_type: "Charger".into(),
            brand: "Spigen".into(),
            product_name: "Fast Charger".into(),
            compatible_models: Some("iPhone, Samsung".into()),
            color: Some("White".into()),
            cost_price: 10.0,
            sale_price: 25.0,
            quantity: 10,
            supplier_id: None,
            low_stock_threshold: 2,
        }
    }

    #[test]
    fn create_and_get() {
        let conn = in_memory_conn();
        seed_product_categories(&conn);
        let a = create(&conn, sample()).unwrap();
        let got = get(&conn, a.id).unwrap();
        assert_eq!(got.product_name, "Fast Charger");
        assert_eq!(got.accessory_type, "Charger");
    }

    #[test]
    fn requires_brand_product_and_type() {
        let conn = in_memory_conn();
        seed_product_categories(&conn);
        let mut i = sample();
        i.brand = "  ".into();
        assert!(matches!(create(&conn, i).unwrap_err(), AppError::Validation(_)));
        let mut i = sample();
        i.product_name = "".into();
        assert!(matches!(create(&conn, i).unwrap_err(), AppError::Validation(_)));
        let mut i = sample();
        i.accessory_type = "  ".into();
        assert!(matches!(create(&conn, i).unwrap_err(), AppError::Validation(_)));
    }

    #[test]
    fn trims_fields() {
        let conn = in_memory_conn();
        seed_product_categories(&conn);
        let mut i = sample();
        i.accessory_type = "  Power Bank ".into();
        i.compatible_models = Some("  Samsung  ".into());
        let a = create(&conn, i).unwrap();
        assert_eq!(a.accessory_type, "Power Bank");
        assert_eq!(a.compatible_models.as_deref(), Some("Samsung"));
    }

    #[test]
    fn list_filters_by_search() {
        let conn = in_memory_conn();
        seed_product_categories(&conn);
        create(&conn, sample()).unwrap();
        let mut c = sample();
        c.product_name = "USB Cable".into();
        c.brand = "Anker".into();
        create(&conn, c).unwrap();
        assert_eq!(list(&conn, Some("Anker".into())).unwrap().len(), 1);
    }

    #[test]
    fn soft_delete_hides() {
        let conn = in_memory_conn();
        seed_product_categories(&conn);
        let a = create(&conn, sample()).unwrap();
        soft_delete(&conn, a.id, None).unwrap();
        assert!(get(&conn, a.id).is_err());
        assert!(list(&conn, None).unwrap().is_empty());
    }

    #[test]
    fn restock_adds_quantity() {
        let conn = in_memory_conn();
        seed_product_categories(&conn);
        let a = create(&conn, sample()).unwrap();
        restock(&conn, a.id, 5, None).unwrap();
        assert_eq!(get(&conn, a.id).unwrap().quantity, 15);
    }

    #[test]
    fn unknown_category_rejected() {
        let conn = in_memory_conn();
        seed_product_categories(&conn);
        let mut i = sample();
        i.accessory_type = "Gadget Hub".into();
        let err = create(&conn, i).unwrap_err();
        assert!(matches!(err, AppError::Validation(_)));
    }
}
