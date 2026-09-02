use rusqlite::Connection;

use crate::errors::AppError;
use crate::models::product_category::{CreateProductCategoryInput, ProductCategory};
use crate::repositories::product_category_repository;
use crate::services::record_activity;

fn validate_name(name: &str) -> Result<(), AppError> {
    if name.trim().is_empty() {
        return Err(AppError::validation("Category name is required"));
    }
    Ok(())
}

/// True when a product category with the given (exact) name exists.
/// Used to validate the category picked for phones and accessories.
pub fn category_exists(conn: &Connection, name: &str) -> Result<bool, AppError> {
    product_category_repository::get_by_name(conn, name).map(|c| c.is_some())
}

pub fn create_category(
    conn: &Connection,
    input: &CreateProductCategoryInput,
    user_id: Option<i64>,
) -> Result<i64, AppError> {
    validate_name(&input.name)?;
    let id = product_category_repository::insert(conn, input)?;
    record_activity(conn, user_id, "inventory", "category_create", Some(id))?;
    Ok(id)
}

pub fn list_categories(conn: &Connection) -> Result<Vec<ProductCategory>, AppError> {
    product_category_repository::list(conn)
}

pub fn update_category(
    conn: &Connection,
    id: i64,
    input: &CreateProductCategoryInput,
    user_id: Option<i64>,
) -> Result<ProductCategory, AppError> {
    validate_name(&input.name)?;
    if product_category_repository::get_by_id(conn, id)?.is_none() {
        return Err(AppError::validation("Category not found"));
    }
    product_category_repository::update(conn, id, input)?;
    record_activity(conn, user_id, "inventory", "category_update", Some(id))?;
    product_category_repository::get_by_id(conn, id)?
        .ok_or_else(|| AppError::validation("Category not found"))
}

pub fn delete_category(conn: &Connection, id: i64, user_id: Option<i64>) -> Result<(), AppError> {
    let category = product_category_repository::get_by_id(conn, id)?
        .ok_or_else(|| AppError::validation("Category not found"))?;
    if product_category_repository::in_use(conn, &category.name)? {
        return Err(AppError::validation(
            "Cannot delete this category because accessories or mobile phones reference it",
        ));
    }
    product_category_repository::delete(conn, id)?;
    record_activity(conn, user_id, "inventory", "category_delete", Some(id))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::accessory::CreateAccessoryInput;
    use crate::repositories::accessory_repository;
    use crate::repositories::phone_repository;
    use crate::services::test_utils::{in_memory_conn, seed_product_categories};

    fn cat_input(name: &str) -> CreateProductCategoryInput {
        CreateProductCategoryInput { name: name.to_string() }
    }

    #[test]
    fn create_and_list() {
        let conn = in_memory_conn();
        let id = create_category(&conn, &cat_input("Earphones"), None).unwrap();
        let all = list_categories(&conn).unwrap();
        assert_eq!(all.len(), 1);
        assert_eq!(all[0].id, id);
        assert_eq!(all[0].name, "Earphones");
        assert!(category_exists(&conn, "Earphones").unwrap());
        assert!(!category_exists(&conn, "Missing").unwrap());
    }

    #[test]
    fn reject_duplicate_and_blank_names() {
        let conn = in_memory_conn();
        create_category(&conn, &cat_input("Charger"), None).unwrap();
        assert!(create_category(&conn, &cat_input("Charger"), None).is_err());
        let err = create_category(&conn, &cat_input("   "), None).unwrap_err();
        assert!(matches!(err, AppError::Validation(_)));
    }

    #[test]
    fn update_renames() {
        let conn = in_memory_conn();
        let id = create_category(&conn, &cat_input("Old Name"), None).unwrap();
        let updated = update_category(&conn, id, &cat_input("New Name"), None).unwrap();
        assert_eq!(updated.name, "New Name");
        assert!(update_category(&conn, 9999, &cat_input("X"), None).is_err());
    }

    #[test]
    fn delete_when_unused() {
        let conn = in_memory_conn();
        let id = create_category(&conn, &cat_input("Screen Protector"), None).unwrap();
        delete_category(&conn, id, None).unwrap();
        assert!(list_categories(&conn).unwrap().is_empty());
        assert!(delete_category(&conn, id, None).is_err());
    }

    #[test]
    fn delete_locked_by_accessory() {
        let conn = in_memory_conn();
        seed_product_categories(&conn);
        let id = create_category(&conn, &cat_input("Travel Bundle"), None).unwrap();
        accessory_repository::insert(
            &conn,
            &CreateAccessoryInput {
                accessory_type: "Travel Bundle".into(),
                brand: "Spigen".into(),
                product_name: "Fast Charger".into(),
                compatible_models: None,
                color: None,
                condition: None,
                connector_type: None,
                warranty: None,
                features: None,
                description: None,
                sku: None,
                cost_price: 10.0,
                sale_price: 25.0,
                quantity: 5,
                supplier_id: None,
                low_stock_threshold: 0,
            },
        )
        .unwrap();
        let err = delete_category(&conn, id, None).unwrap_err();
        assert!(matches!(err, AppError::Validation(_)));
    }

    #[test]
    fn delete_locked_by_phone() {
        let conn = in_memory_conn();
        seed_product_categories(&conn);
        let id = create_category(&conn, &cat_input("Flagship"), None).unwrap();
        phone_repository::insert(
            &conn,
            &crate::models::phone::CreatePhoneInput {
                brand: "Samsung".into(),
                model: "Galaxy S24".into(),
                category: Some("Flagship".into()),
                cost_price: 600.0,
                sale_price: 750.0,
                quantity: 3,
                supplier_id: None,
                low_stock_threshold: 0,
                ..Default::default()
            },
        )
        .unwrap();
        let err = delete_category(&conn, id, None).unwrap_err();
        assert!(matches!(err, AppError::Validation(_)));
    }
}