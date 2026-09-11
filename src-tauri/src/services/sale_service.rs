use rusqlite::Connection;

use crate::errors::AppError;
use crate::models::sale::{CreateSaleInput, Sale};
use crate::repositories::{member_repository, product_return_repository, sale_repository};
use crate::services;
use crate::utils;

pub fn create(
    conn: &Connection,
    input: CreateSaleInput,
    actor: Option<i64>,
) -> Result<Sale, AppError> {
    if input.items.is_empty() {
        return Err(AppError::validation(
            "A sale must contain at least one item",
        ));
    }
    if input.discount < 0.0 {
        return Err(AppError::validation("Discount cannot be negative"));
    }

    if let Some(mid) = input.member_id {
        if member_repository::get_by_id(conn, mid)?.is_none() {
            return Err(AppError::validation("Member not found"));
        }
    }

    // ----- Validate all line items up front (Rule 1, 3, 4) -----
    struct Line {
        item_type: String,
        item_id: i64,
        quantity: i64,
        imei_id: Option<i64>,
        unit_price: f64,
    }

    let mut lines: Vec<Line> = Vec::new();
    let mut subtotal = 0.0;

    for item in &input.items {
        let item_type = match item.item_type.as_str() {
            "phone" | "accessory" => item.item_type.clone(),
            _ => {
                return Err(AppError::validation(
                    "Item type must be 'phone' or 'accessory'",
                ))
            }
        };
        if item.quantity < 1 {
            return Err(AppError::validation("Item quantity must be at least 1"));
        }
        let Some(stock) = sale_repository::item_quantity(conn, &item_type, item.item_id)? else {
            return Err(AppError::validation(if item_type == "phone" {
                "Phone not found"
            } else {
                "Accessory not found"
            }));
        };
        if item.quantity > stock {
            return Err(AppError::validation("Not enough stock for this item"));
        }

        let unit_price = match item.unit_price {
            Some(p) if p > 0.0 => p,
            _ => {
                let p = sale_repository::item_price(conn, &item_type, item.item_id)?.ok_or_else(
                    || {
                        AppError::validation(if item_type == "phone" {
                            "Phone not found"
                        } else {
                            "Accessory not found"
                        })
                    },
                )?;
                if p > 0.0 {
                    p
                } else {
                    return Err(AppError::validation(
                        "Cannot sell an item with a zero price; set a sale price first",
                    ));
                }
            }
        };

        if item_type == "phone" {
            if let Some(imei_id) = item.imei_id {
                if !sale_repository::imei_available(conn, imei_id, item.item_id)? {
                    return Err(AppError::validation("IMEI is not available for this item"));
                }
            }
        }

        let line_imei = if item_type == "phone" {
            item.imei_id
        } else {
            None
        };

        let line_total = utils::round2(unit_price * item.quantity as f64);
        subtotal += line_total;
        lines.push(Line {
            item_type,
            item_id: item.item_id,
            quantity: item.quantity,
            imei_id: line_imei,
            unit_price: utils::round2(unit_price),
        });
    }

    let total_amount = utils::round2(subtotal - input.discount);
    if total_amount < 0.0 {
        return Err(AppError::validation("Discount cannot exceed subtotal"));
    }
    let paid_amount = match input.paid_amount {
        Some(p) => {
            if p < 0.0 {
                return Err(AppError::validation("Paid amount cannot be negative"));
            }
            utils::round2(p)
        }
        None => total_amount,
    };

    let payment_method = input
        .payment_method
        .as_deref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .unwrap_or("cash")
        .to_lowercase();

    let receipt_no = sale_repository::next_receipt_no(conn)?;
    let notes = input
        .notes
        .as_deref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty());

    // ----- Apply in a single transaction (Rule 6) -----
    let tx = conn.unchecked_transaction()?;
    let sale_id = sale_repository::insert_sale(
        &tx,
        &receipt_no,
        input.member_id,
        total_amount,
        utils::round2(input.discount),
        paid_amount,
        &payment_method,
        notes,
        actor,
    )?;

    for line in &lines {
        sale_repository::insert_sale_item(
            &tx,
            sale_id,
            &line.item_type,
            line.item_id,
            line.imei_id,
            line.quantity,
            line.unit_price,
        )?;

        // Rule 2: reduce inventory
        if !sale_repository::decrement_stock(&tx, &line.item_type, line.item_id, line.quantity)? {
            return Err(AppError::validation("Not enough stock for this item"));
        }
        // Rule 3: mark IMEI sold (phones only)
        if line.item_type == "phone" {
            if let Some(imei_id) = line.imei_id {
                if !sale_repository::mark_imei_sold(&tx, imei_id, line.item_id)? {
                    return Err(AppError::validation("IMEI is not available for this item"));
                }
            }
        }
    }
    tx.commit()?;

    services::record_activity(conn, actor, "sale", "create", Some(sale_id))?;

    sale_repository::get_sale_with_items(conn, sale_id)?
        .ok_or_else(|| AppError::Internal("Created sale could not be retrieved".into()))
}

pub fn list(conn: &Connection, search: Option<String>) -> Result<Vec<Sale>, AppError> {
    sale_repository::list_sales(conn, search.as_deref())
}

pub fn get(conn: &Connection, id: i64) -> Result<Sale, AppError> {
    let mut sale = sale_repository::get_sale_with_items(conn, id)?
        .ok_or_else(|| AppError::validation("Sale not found"))?;
    sale.returns = product_return_repository::returns_for_sale(conn, id)?;
    Ok(sale)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::phone::CreatePhoneInput;
    use crate::models::sale::SaleItemInput;
    use crate::services::{phone_service, test_utils::in_memory_conn};

    fn phone(conn: &Connection, qty: i64, price: f64) -> i64 {
        phone_service::create(
            conn,
            CreatePhoneInput {
                brand: "Samsung".into(),
                model: "S24".into(),
                color: None,
                storage: None,
                cost_price: 500.0,
                sale_price: price,
                quantity: qty,
                supplier_id: None,
                low_stock_threshold: 0,
                ..Default::default()
            },
        )
        .unwrap()
        .id
    }

    fn sale_input(item_id: i64, qty: i64) -> CreateSaleInput {
        CreateSaleInput {
            member_id: None,
            discount: 0.0,
            paid_amount: None,
            payment_method: Some("cash".into()),
            notes: None,
            items: vec![SaleItemInput {
                item_type: "phone".into(),
                item_id,
                quantity: qty,
                imei_id: None,
                unit_price: None,
            }],
        }
    }

    #[test]
    fn creates_sale_and_reduces_stock() {
        let conn = in_memory_conn();
        let id = phone(&conn, 5, 100.0);
        let sale = create(&conn, sale_input(id, 2), None).unwrap();
        assert!(sale.receipt_no.starts_with("INV-"));
        assert_eq!(sale.total_amount, 200.0);
        assert_eq!(sale.paid_amount, 200.0);
        assert_eq!(sale.items.len(), 1);
        let after = phone_service::get(&conn, id).unwrap();
        assert_eq!(after.quantity, 3);
    }

    #[test]
    fn rejects_insufficient_stock() {
        let conn = in_memory_conn();
        let id = phone(&conn, 1, 100.0);
        let err = create(&conn, sale_input(id, 2), None).unwrap_err();
        assert!(matches!(err, AppError::Validation(_)));
        assert_eq!(phone_service::get(&conn, id).unwrap().quantity, 1);
    }

    #[test]
    fn rejects_empty_items() {
        let conn = in_memory_conn();
        let err = create(&conn, CreateSaleInput::default(), None).unwrap_err();
        assert!(matches!(err, AppError::Validation(_)));
    }

    #[test]
    fn applies_discount_and_paid_amount() {
        let conn = in_memory_conn();
        let id = phone(&conn, 5, 100.0);
        let mut input = sale_input(id, 2);
        input.discount = 25.0;
        input.paid_amount = Some(50.0);
        let sale = create(&conn, input, None).unwrap();
        assert_eq!(sale.total_amount, 175.0);
        assert_eq!(sale.paid_amount, 50.0);
    }

    #[test]
    fn rejects_discount_exceeding_subtotal() {
        let conn = in_memory_conn();
        let id = phone(&conn, 5, 100.0);
        let mut input = sale_input(id, 1);
        input.discount = 500.0;
        let err = create(&conn, input, None).unwrap_err();
        assert!(matches!(err, AppError::Validation(_)));
    }

    #[test]
    fn marks_imei_sold_on_imei_sale() {
        use crate::models::phone::AddPhoneImeiInput;
        let conn = in_memory_conn();
        let id = phone(&conn, 1, 100.0);
        let imei = phone_service::add_imei(
            &conn,
            AddPhoneImeiInput {
                phone_id: id,
                imei: "111111111111111".into(),
            },
        )
        .unwrap();

        let mut input = sale_input(id, 1);
        input.items[0].imei_id = Some(imei.id);
        create(&conn, input, None).unwrap();

        let imeis = phone_service::list_imei(&conn, id).unwrap();
        assert_eq!(imeis[0].status, "sold");
    }

    #[test]
    fn cannot_sell_an_in_stock_imei_twice() {
        use crate::models::phone::AddPhoneImeiInput;
        let conn = in_memory_conn();
        let id = phone(&conn, 3, 100.0);
        let imei = phone_service::add_imei(
            &conn,
            AddPhoneImeiInput {
                phone_id: id,
                imei: "999999999999999".into(),
            },
        )
        .unwrap();

        let mut first = sale_input(id, 1);
        first.items[0].imei_id = Some(imei.id);
        create(&conn, first, None).unwrap();

        let mut second = sale_input(id, 1);
        second.items[0].imei_id = Some(imei.id);
        let err = create(&conn, second, None).unwrap_err();
        assert!(matches!(err, AppError::Validation(_)));
    }

    #[test]
    fn sells_accessory_and_reduces_stock() {
        use crate::models::accessory::CreateAccessoryInput;
        use crate::services::accessory_service;
        use crate::services::test_utils::seed_product_categories;
        let conn = in_memory_conn();
        seed_product_categories(&conn);
        let aid = accessory_service::create(
            &conn,
            CreateAccessoryInput {
                accessory_type: "Charger".into(),
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
                serial_number: None,
                image_paths: vec![],
                cost_price: 10.0,
                sale_price: 30.0,
                quantity: 5,
                supplier_id: None,
                low_stock_threshold: 0,
            },
        )
        .unwrap()
        .id;
        let sale = create(
            &conn,
            CreateSaleInput {
                member_id: None,
                discount: 0.0,
                paid_amount: None,
                payment_method: Some("cash".into()),
                notes: None,
                items: vec![SaleItemInput {
                    item_type: "accessory".into(),
                    item_id: aid,
                    quantity: 2,
                    imei_id: None,
                    unit_price: None,
                }],
            },
            None,
        )
        .unwrap();
        assert_eq!(sale.total_amount, 60.0);
        assert_eq!(sale.items[0].item_type, "accessory");
        assert_eq!(accessory_service::get(&conn, aid).unwrap().quantity, 3);
    }

    #[test]
    fn rejects_unknown_item_type() {
        let conn = in_memory_conn();
        let id = phone(&conn, 5, 100.0);
        let mut input = sale_input(id, 1);
        input.items[0].item_type = "gadget".into();
        let err = create(&conn, input, None).unwrap_err();
        assert!(matches!(err, AppError::Validation(_)));
    }

    #[test]
    fn lists_and_gets_sale() {
        let conn = in_memory_conn();
        let id = phone(&conn, 5, 100.0);
        let sale = create(&conn, sale_input(id, 1), None).unwrap();
        assert_eq!(list(&conn, None).unwrap().len(), 1);
        let got = get(&conn, sale.id).unwrap();
        assert_eq!(got.receipt_no, sale.receipt_no);
        assert_eq!(got.items[0].item_type, "phone");
        assert_eq!(got.items[0].item_id, id);
    }
}
