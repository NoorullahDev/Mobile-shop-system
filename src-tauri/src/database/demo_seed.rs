//! Development/testing-only connected demo data.
//!
//! Every call here drives the **same production services** the UI uses, so the
//! seeded records are fully connected: Purchase → Stock/IMEI → POS → Sales →
//! Dues/Payments → Returns → Reports. Deleting or editing a seeded record on
//! any page consequently updates the related pages exactly like real usage.
//!
//! ## Production safety
//! This whole module is gated by `#[cfg(debug_assertions)]` at the module
//! declaration in `database/mod.rs`. Release (`cargo build --release`, the
//! only profile used for shipped EXEs) strips the module and its call site, so
//! a production EXE cannot contain or reach this code. `database::seed::seed`
//! (roles/admin/settings) is untouched; fresh production clients still start
//! with zero business data, as required by
//! `database::mod::tests::fresh_migration_creates_no_business_data`.
//!
//! ## Exactly-once semantics
//! Seeding runs once per fresh development database, and only when the
//! database is empty of business records AND the `demo_data_seeded` setting
//! marker is absent. Once seeded, the marker is stored so that a developer who
//! later wipes their data is not silently re-seeded while testing "delete
//! everything" flows. On any mid-seed error the seeder rolls back everything
//! it created (the database was empty when it started), so the database is
//! left exactly as it was found.

use chrono::{Duration, Utc};
use rusqlite::{Connection, OptionalExtension};

use crate::models::accessory::CreateAccessoryInput;
use crate::models::expense::{CreateCategoryInput, CreateExpenseInput};
use crate::models::inventory::CreateSupplierInput;
use crate::models::member::CreateMemberInput;
use crate::models::payment::CreatePaymentInput;
use crate::models::phone::CreatePhoneInput;
use crate::models::product_return::{CreateReturnInput, ReturnItemInput};
use crate::models::purchase::{CreatePurchaseInput, CreateSupplierPaymentInput, PurchaseItemInput};
use crate::models::sale::{CreateSaleInput, SaleItemInput};
use crate::services::{
    accessory_service, expense_service, member_service, payment_service, phone_service,
    product_return_service, purchase_service, sale_service, supplier_service,
};

/// Default admin user created by `database::seed::seed`.
const ACTOR: Option<i64> = Some(1);

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/// Synthetic IMEI: 15 numeric digits, globally unique across the seed.
fn next_imei(counter: &mut i64) -> String {
    *counter += 1;
    format!("{:015}", 358_200_000_000_000 + *counter)
}

fn date_days_ago(days: i64) -> String {
    (Utc::now() - Duration::days(days)).format("%Y-%m-%d").to_string()
}

fn datetime_days_ago(days: i64) -> String {
    (Utc::now() - Duration::days(days)).format("%Y-%m-%d %H:%M:%S").to_string()
}

fn has_business_data(conn: &Connection) -> Result<bool, rusqlite::Error> {
    let total: i64 = conn.query_row(
        "SELECT
            (SELECT COUNT(*) FROM suppliers)
          + (SELECT COUNT(*) FROM members)
          + (SELECT COUNT(*) FROM phones)
          + (SELECT COUNT(*) FROM accessories)
          + (SELECT COUNT(*) FROM purchases)
          + (SELECT COUNT(*) FROM sales)
          + (SELECT COUNT(*) FROM returns)",
        [],
        |r| r.get(0),
    )?;
    Ok(total > 0)
}

/// Backdate the `created_at` of a freshly-inserted record so period/date views
/// look like the record happened on the intended day.
fn backdate(conn: &Connection, table: &str, id: i64, days_ago: i64) -> Result<(), rusqlite::Error> {
    conn.execute(
        &format!("UPDATE {table} SET created_at = ?1 WHERE id = ?2"),
        rusqlite::params![datetime_days_ago(days_ago), id],
    )?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

pub fn seed_demo(conn: &Connection) -> Result<(), Box<dyn std::error::Error>> {
    // Exactly once: no marker AND no existing business records.
    let marker: Option<String> = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'demo_data_seeded'",
            [],
            |r| r.get(0),
        )
        .optional()?;
    if marker.is_some() || has_business_data(conn)? {
        return Ok(());
    }

    match seed_all(conn) {
        Ok(()) => {
            conn.execute(
                "INSERT INTO settings (key, value) VALUES ('demo_data_seeded', '1')",
                [],
            )?;
            log::info!("Seeded realistic connected demo data (development build)");
            Ok(())
        }
        Err(e) => {
            // The database was empty of business data when seeding started, so
            // every business row present right now is demo data we created.
            log::error!("Demo seeding failed, rolling back all demo records: {e}");
            rollback_demo(conn)?;
            Err(e)
        }
    }
}

fn rollback_demo(conn: &Connection) -> Result<(), Box<dyn std::error::Error>> {
    for table in [
        "return_items",
        "returns",
        "sale_items",
        "sales",
        "purchase_items",
        "purchases",
        "supplier_payments",
        "payments",
        "phone_imeis",
        "accessories",
        "phones",
        "members",
        "suppliers",
        "expenses",
        "categories",
        "product_categories",
    ] {
        conn.execute(&format!("DELETE FROM {table}"), [])?;
    }
    conn.execute("DELETE FROM settings WHERE key = 'demo_data_seeded'", [])?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Data plan
// ---------------------------------------------------------------------------

struct PhoneSpec {
    brand: &'static str,
    model: &'static str,
    color: &'static str,
    storage: &'static str,
    ram: &'static str,
    cost: f64,
    sale: f64,
}

const PHONES: &[PhoneSpec] = &[
    PhoneSpec { brand: "Apple", model: "iPhone 15 Pro", color: "Natural Titanium", storage: "256GB", ram: "8GB", cost: 390_000.0, sale: 425_000.0 },
    PhoneSpec { brand: "Apple", model: "iPhone 14", color: "Midnight", storage: "128GB", ram: "6GB", cost: 245_000.0, sale: 268_000.0 },
    PhoneSpec { brand: "Samsung", model: "Galaxy S24 Ultra", color: "Titanium Gray", storage: "256GB", ram: "12GB", cost: 330_000.0, sale: 360_000.0 },
    PhoneSpec { brand: "Samsung", model: "Galaxy A55", color: "Awesome Navy", storage: "128GB", ram: "8GB", cost: 98_000.0, sale: 110_000.0 },
    PhoneSpec { brand: "Redmi", model: "Note 13 Pro", color: "Midnight Black", storage: "256GB", ram: "8GB", cost: 52_000.0, sale: 59_000.0 },
    PhoneSpec { brand: "OnePlus", model: "12", color: "Silky Black", storage: "512GB", ram: "16GB", cost: 280_000.0, sale: 308_000.0 },
    PhoneSpec { brand: "Oppo", model: "Reno 11", color: "Silk Blue", storage: "256GB", ram: "8GB", cost: 95_000.0, sale: 106_000.0 },
    PhoneSpec { brand: "Vivo", model: "V30", color: "Silver", storage: "256GB", ram: "12GB", cost: 88_000.0, sale: 99_000.0 },
    PhoneSpec { brand: "Infinix", model: "Hot 40i", color: "Sapphire Blue", storage: "128GB", ram: "8GB", cost: 27_000.0, sale: 32_000.0 },
];

struct AccessorySpec {
    kind: &'static str,
    brand: &'static str,
    name: &'static str,
    cost: f64,
    sale: f64,
}

const ACCESSORY_SPECS: &[AccessorySpec] = &[
    AccessorySpec { kind: "Charger", brand: "Anker", name: "65W Fast Charger", cost: 4_500.0, sale: 7_000.0 },
    AccessorySpec { kind: "Charger", brand: "Samsung", name: "25W USB-C Charger", cost: 2_000.0, sale: 3_500.0 },
    AccessorySpec { kind: "Cover", brand: "Apple", name: "iPhone 15 Silicone Case", cost: 3_000.0, sale: 5_500.0 },
    AccessorySpec { kind: "Cover", brand: "Samsung", name: "Galaxy A55 Clear Case", cost: 600.0, sale: 1_500.0 },
    AccessorySpec { kind: "Cable", brand: "Baseus", name: "Type-C Cable 2m (2-pack)", cost: 500.0, sale: 1_200.0 },
    AccessorySpec { kind: "Earphones", brand: "SoundCore", name: "Wireless Earbuds A20i", cost: 3_200.0, sale: 6_000.0 },
    AccessorySpec { kind: "Power Bank", brand: "Anker", name: "PowerCore 20000mAh", cost: 5_500.0, sale: 9_000.0 },
];

const MEMBER_NAMES: &[&str] = &[
    "Ahmed Raza",
    "Bilal Sheikh",
    "Hassan Qureshi",
    "Fatima Noor",
    "Usman Tariq",
    "Ayesha Khan",
    "Ali Hamza",
];

const MEMBER_PHONES: &[&str] = &[
    "03001234567",
    "03019876543",
    "03216008001",
    "03330112233",
    "03129880099",
    "03451122330",
    "03008765432",
];

/// One purchase transaction carrying one or more lines.
struct BuyBatch {
    supplier: usize, // 0 = Atlas, 1 = GadgetHub
    days_ago: i64,
    paid: Option<f64>,
    method: &'static str,
    phone_lines: &'static [(usize, i64)],
    accessory_lines: &'static [(usize, i64)],
}

const BUY_BATCHES: &[BuyBatch] = &[
    BuyBatch { supplier: 0, days_ago: 58, paid: None, method: "bank_transfer", phone_lines: &[(0, 3), (1, 4)], accessory_lines: &[] },
    BuyBatch { supplier: 0, days_ago: 45, paid: Some(1_000_000.0), method: "cash", phone_lines: &[(2, 4), (3, 5)], accessory_lines: &[] },
    BuyBatch { supplier: 1, days_ago: 40, paid: Some(200_000.0), method: "cash", phone_lines: &[(4, 6)], accessory_lines: &[] },
    BuyBatch { supplier: 0, days_ago: 30, paid: None, method: "bank_transfer", phone_lines: &[(5, 4)], accessory_lines: &[] },
    BuyBatch { supplier: 1, days_ago: 25, paid: None, method: "cash", phone_lines: &[(6, 4)], accessory_lines: &[] },
    BuyBatch { supplier: 0, days_ago: 18, paid: Some(200_000.0), method: "cash", phone_lines: &[(7, 5)], accessory_lines: &[] },
    BuyBatch { supplier: 1, days_ago: 10, paid: None, method: "cash", phone_lines: &[(8, 8)], accessory_lines: &[] },
    BuyBatch { supplier: 1, days_ago: 8, paid: None, method: "cash", phone_lines: &[], accessory_lines: &[(0, 4), (1, 4), (2, 4), (3, 10), (4, 10), (5, 4), (6, 3)] },
];

/// One POS sale step: an exact phone unit, optionally alongside accessory lines.
struct SaleStep {
    phone: usize,
    days_ago: i64,
    member: Option<usize>, // index into MEMBER_NAMES
    paid: Option<f64>,     // None = paid in full
    accessories: &'static [(usize, i64)],
}

const SALE_STEPS: &[SaleStep] = &[
    SaleStep { phone: 0, days_ago: 3, member: Some(1), paid: Some(200_000.0), accessories: &[(0, 1)] },
    SaleStep { phone: 0, days_ago: 0, member: None, paid: None, accessories: &[] },
    SaleStep { phone: 1, days_ago: 28, member: Some(0), paid: None, accessories: &[] },
    SaleStep { phone: 1, days_ago: 6, member: None, paid: None, accessories: &[] },
    SaleStep { phone: 1, days_ago: 0, member: Some(0), paid: None, accessories: &[(2, 1)] },
    SaleStep { phone: 2, days_ago: 26, member: None, paid: None, accessories: &[] },
    SaleStep { phone: 2, days_ago: 12, member: Some(2), paid: Some(180_000.0), accessories: &[] },
    SaleStep { phone: 2, days_ago: 2, member: None, paid: None, accessories: &[(5, 1)] },
    SaleStep { phone: 3, days_ago: 24, member: Some(0), paid: None, accessories: &[] },
    SaleStep { phone: 3, days_ago: 9, member: None, paid: None, accessories: &[] },
    SaleStep { phone: 3, days_ago: 3, member: Some(3), paid: Some(50_000.0), accessories: &[] },
    SaleStep { phone: 3, days_ago: 0, member: None, paid: None, accessories: &[(3, 2)] },
    SaleStep { phone: 4, days_ago: 22, member: None, paid: None, accessories: &[] },
    SaleStep { phone: 4, days_ago: 8, member: Some(4), paid: Some(30_000.0), accessories: &[] },
    SaleStep { phone: 4, days_ago: 4, member: None, paid: None, accessories: &[(4, 2)] },
    SaleStep { phone: 4, days_ago: 1, member: None, paid: None, accessories: &[] },
    SaleStep { phone: 5, days_ago: 20, member: Some(1), paid: Some(200_000.0), accessories: &[] },
    SaleStep { phone: 5, days_ago: 5, member: None, paid: None, accessories: &[(6, 1)] },
    SaleStep { phone: 6, days_ago: 18, member: Some(2), paid: Some(60_000.0), accessories: &[] },
    SaleStep { phone: 6, days_ago: 2, member: None, paid: None, accessories: &[(4, 1)] },
    SaleStep { phone: 7, days_ago: 14, member: None, paid: None, accessories: &[] },
    SaleStep { phone: 7, days_ago: 1, member: Some(5), paid: Some(60_000.0), accessories: &[] },
    SaleStep { phone: 8, days_ago: 16, member: None, paid: None, accessories: &[] },
    SaleStep { phone: 8, days_ago: 1, member: Some(6), paid: None, accessories: &[] },
    SaleStep { phone: 8, days_ago: 0, member: None, paid: None, accessories: &[] },
    SaleStep { phone: 8, days_ago: 0, member: None, paid: None, accessories: &[] },
];

struct SupplierPaymentStep {
    supplier: usize,
    amount: f64,
    days_ago: i64,
    method: &'static str,
}

const SUPPLIER_PAYMENTS: &[SupplierPaymentStep] = &[
    SupplierPaymentStep { supplier: 0, amount: 300_000.0, days_ago: 20, method: "cash" },
    SupplierPaymentStep { supplier: 1, amount: 60_000.0, days_ago: 12, method: "cash" },
    SupplierPaymentStep { supplier: 0, amount: 150_000.0, days_ago: 4, method: "bank_transfer" },
];

/// Member payments received against a sale's balance: (sale step index, amount,
/// days_ago, method). Each amount stays within that sale's invoice balance.
const MEMBER_PAYMENTS: &[(usize, f64, i64, &str)] = &[
    (0, 100_000.0, 10, "cash"),
    (6, 80_000.0, 8, "bank_transfer"),
    (10, 60_000.0, 6, "cash"),
    (13, 20_000.0, 3, "cash"),
];

const EXPENSE_CATEGORIES: &[&str] = &["Rent", "Utilities", "Marketing"];
const EXPENSES: &[(f64, usize, i64)] = &[
    (150_000.0, 0, 28),
    (22_000.0, 1, 12),
    (8_000.0, 1, 5),
    (15_000.0, 2, 3),
];

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

fn seed_all(conn: &Connection) -> Result<(), Box<dyn std::error::Error>> {
    // Product categories already exist: migration 0012 seeds Charger, Cover,
    // Cable, Earphones, Power Bank (plus Screen Protector, Holder, Other) and
    // accessory_service::validate_category requires them.

    // Expense categories.
    let mut expense_cat_ids: Vec<i64> = Vec::new();
    for name in EXPENSE_CATEGORIES {
        let id = expense_service::create_category(
            conn,
            &CreateCategoryInput {
                name: name.to_string(),
                category_type: Some("expense".into()),
            },
            ACTOR,
        )?;
        expense_cat_ids.push(id);
    }

    // Suppliers.
    let supplier_names = ["Atlas Mobiles", "GadgetHub Traders"];
    let mut supplier_ids: Vec<i64> = Vec::new();
    for (name, phone, address) in [
        ("Atlas Mobiles", "021-3456789", "Zainab Market, Saddar, Karachi"),
        ("GadgetHub Traders", "042-3678901", "Hafeez Centre, Lahore"),
    ] {
        let s = supplier_service::create(
            conn,
            CreateSupplierInput {
                name: name.into(),
                phone: Some(phone.into()),
                email: None,
                address: Some(address.into()),
            },
        )?;
        supplier_ids.push(s.id);
    }
    debug_assert_eq!(supplier_ids.len(), supplier_names.len());

    // Members.
    let mut member_ids: Vec<i64> = Vec::new();
    for i in 0..MEMBER_NAMES.len() {
        let m = member_service::create(
            conn,
            CreateMemberInput {
                name: MEMBER_NAMES[i].into(),
                phone: Some(MEMBER_PHONES[i].into()),
                cnic: None,
                address: Some("Demo client address".into()),
                notes: None,
            },
        )?;
        member_ids.push(m.id);
    }

    // Phone masters start empty; purchases bring physical units + stock.
    let mut phone_ids: Vec<i64> = Vec::new();
    for spec in PHONES {
        let p = phone_service::create(
            conn,
            CreatePhoneInput {
                brand: spec.brand.into(),
                model: spec.model.into(),
                color: Some(spec.color.into()),
                storage: Some(spec.storage.into()),
                ram: Some(spec.ram.into()),
                warranty: Some("1 Year".into()),
                pta_status: Some("approved".into()),
                cost_price: spec.cost,
                sale_price: spec.sale,
                quantity: 0,
                supplier_id: Some(supplier_ids[0]),
                low_stock_threshold: 2,
                variant: Some(format!("{} {}", spec.storage, spec.color)),
                ..Default::default()
            },
        )?;
        phone_ids.push(p.id);
    }
    debug_assert_eq!(phone_ids.len(), PHONES.len());

    // Accessories.
    let mut accessory_ids: Vec<i64> = Vec::new();
    for spec in ACCESSORY_SPECS {
        let a = accessory_service::create(
            conn,
            CreateAccessoryInput {
                accessory_type: spec.kind.into(),
                brand: spec.brand.into(),
                product_name: spec.name.into(),
                cost_price: spec.cost,
                sale_price: spec.sale,
                quantity: 0,
                supplier_id: Some(supplier_ids[1]),
                low_stock_threshold: 3,
                ..Default::default()
            },
        )?;
        accessory_ids.push(a.id);
    }
    debug_assert_eq!(accessory_ids.len(), ACCESSORY_SPECS.len());

    // Purchases (Purchase → Stock/IMEI).
    let mut imei_counter: i64 = 0;
    let mut purchases_created = 0;
    for batch in BUY_BATCHES {
        let mut lines: Vec<PurchaseItemInput> = Vec::new();
        let total_qty: i64 = batch
            .phone_lines
            .iter()
            .map(|(_, qty)| *qty)
            .chain(batch.accessory_lines.iter().map(|(_, qty)| *qty))
            .sum();

        for (phone_idx, qty) in batch.phone_lines {
            let spec = &PHONES[*phone_idx];
            let mut imeis = Vec::with_capacity(*qty as usize);
            let colors = vec![spec.color.to_string(); *qty as usize];
            for _ in 0..*qty {
                imeis.push(next_imei(&mut imei_counter));
            }
            lines.push(PurchaseItemInput {
                item_type: "phone".into(),
                item_id: phone_ids[*phone_idx],
                quantity: *qty,
                unit_cost: Some(spec.cost),
                selling_price: Some(spec.sale),
                warranty: Some("1 Year".into()),
                condition: Some("New".into()),
                imeis,
                imei2s: Vec::new(),
                imei_colors: colors,
                imei_pta_statuses: vec!["approved".to_string(); *qty as usize],
                imei_storages: vec![spec.storage.to_string(); *qty as usize],
                imei_battery_healths: vec![Some(100); *qty as usize],
                imei_unit_costs: Vec::new(),
                imei_sale_prices: Vec::new(),
            });
        }

        for (acc_idx, qty) in batch.accessory_lines {
            let spec = &ACCESSORY_SPECS[*acc_idx];
            lines.push(PurchaseItemInput {
                item_type: "accessory".into(),
                item_id: accessory_ids[*acc_idx],
                quantity: *qty,
                unit_cost: Some(spec.cost),
                selling_price: Some(spec.sale),
                warranty: None,
                condition: None,
                imeis: Vec::new(),
                imei2s: Vec::new(),
                imei_colors: Vec::new(),
                imei_pta_statuses: Vec::new(),
                imei_storages: Vec::new(),
                imei_battery_healths: Vec::new(),
                imei_unit_costs: Vec::new(),
                imei_sale_prices: Vec::new(),
            });
        }

        let supplier = batch.supplier;
        let purchase = purchase_service::create_purchase(
            conn,
            CreatePurchaseInput {
                supplier_id: Some(supplier_ids[supplier]),
                discount: 0.0,
                paid_amount: batch.paid,
                payment_method: Some(batch.method.into()),
                purchase_date: Some(date_days_ago(batch.days_ago)),
                invoice_reference: Some(format!("DEMO-SUP-{purchases_created:03}")),
                notes: None,
                items: lines,
            },
            ACTOR,
        )?;
        debug_assert_eq!(purchase.items.iter().map(|i| i.quantity).sum::<i64>(), total_qty);
        backdate(conn, "purchases", purchase.id, batch.days_ago)?;
        purchases_created += 1;
    }

    // Sales (POS → Sales). Each phone unit is one sale line with its IMEI.
    let mut sale_ids: Vec<i64> = Vec::new();
    for step in SALE_STEPS {
        let units = phone_service::list_imei(conn, phone_ids[step.phone])?;
        let mut in_stock: Vec<i64> = units
            .iter()
            .filter(|u| u.status == "in_stock")
            .map(|u| u.id)
            .collect();
        in_stock.sort_unstable();
        debug_assert!(
            !in_stock.is_empty(),
            "no in-stock unit left for phone {}",
            step.phone
        );
        let unit_id = in_stock[0];

        let mut items = vec![SaleItemInput {
            sale_item_id: None,
            item_type: "phone".into(),
            item_id: phone_ids[step.phone],
            quantity: 1,
            imei_id: Some(unit_id),
            unit_price: None,
            warranty: Some("1 Year".into()),
            warranty_expiry: None,
        }];

        for (acc_idx, qty) in step.accessories {
            items.push(SaleItemInput {
                sale_item_id: None,
                item_type: "accessory".into(),
                item_id: accessory_ids[*acc_idx],
                quantity: *qty,
                imei_id: None,
                unit_price: None,
                warranty: None,
                warranty_expiry: None,
            });
        }

        let sale = sale_service::create(
            conn,
            CreateSaleInput {
                member_id: step.member.map(|i| member_ids[i]),
                discount: 0.0,
                paid_amount: step.paid,
                payment_method: Some("cash".into()),
                notes: None,
                items,
                payments: Vec::new(),
            },
            ACTOR,
        )?;
        if step.days_ago > 0 {
            backdate(conn, "sales", sale.id, step.days_ago)?;
        }
        sale_ids.push(sale.id);
    }

    // Returns (one sale gets a defective phone returned without restock, and a
    // used case returned with a 10% restocking charge → restocked). This feeds
    // the Returns page and re-drives stock + refunds through the real service.
    let returned_sale_index = 4; // step 4 sold iPhone 14 + silicone case
    let returned_sale = sale_service::get(conn, sale_ids[returned_sale_index])?;
    let phone_line = returned_sale
        .items
        .iter()
        .find(|i| i.item_type == "phone")
        .expect("seed sale has a phone line");
    let case_line = returned_sale
        .items
        .iter()
        .find(|i| i.item_type == "accessory")
        .expect("seed sale has an accessory line");

    product_return_service::create(
        conn,
        CreateReturnInput {
            sale_id: returned_sale.id,
            return_type: "return".into(),
            return_charge_percent: 10.0,
            fixed_deduction: None,
            refund_method: Some("cash".into()),
            return_date: Some(date_days_ago(1)),
            reference: Some("Customer returned within warranty".into()),
            notes: None,
            items: vec![
                ReturnItemInput {
                    sale_item_id: phone_line.id,
                    quantity: 1,
                    imei_id: phone_line.imei_id,
                    reason: Some("Defective display".into()),
                    condition: "defective".into(), // no restock
                },
                ReturnItemInput {
                    sale_item_id: case_line.id,
                    quantity: 1,
                    imei_id: None,
                    reason: Some("No longer needed".into()),
                    condition: "used".into(), // restocks
                },
            ],
            exchange_item: None,
        },
        ACTOR,
    )?;

    // Supplier payments (Supplier Dues page).
    for sp in SUPPLIER_PAYMENTS {
        purchase_service::create_supplier_payment(
            conn,
            CreateSupplierPaymentInput {
                supplier_id: Some(supplier_ids[sp.supplier]),
                amount: sp.amount,
                payment_method: Some(sp.method.into()),
                status: Some("completed".into()),
                reference: Some(format!("DEMO-SPP-{}-{}", sp.supplier, sp.amount)),
                notes: None,
                payment_date: Some(date_days_ago(sp.days_ago)),
            },
            ACTOR,
        )?;
    }

    // Member payments against sale balances (Dues / Payments pages).
    for (sale_step_idx, amount, days_ago, method) in MEMBER_PAYMENTS {
        let step = &SALE_STEPS[*sale_step_idx];
        let member = step.member.expect("member payment is on a member sale");
        let sale_id = sale_ids[*sale_step_idx];
        payment_service::create(
            conn,
            CreatePaymentInput {
                member_id: Some(member_ids[member]),
                amount: *amount,
                payment_method: method.to_string(),
                payment_type: None,
                status: Some("completed".into()),
                reference: Some(format!("DEMO-PMT-{}", sale_step_idx)),
                account_details: None,
                notes: None,
                payment_date: Some(date_days_ago(*days_ago)),
                sale_id: Some(sale_id),
            },
            ACTOR,
        )?;
    }

    // Expenses (Expenses + Reports pages).
    for (amount, cat_idx, days_ago) in EXPENSES {
        expense_service::create_expense(
            conn,
            &CreateExpenseInput {
                category_id: expense_cat_ids[*cat_idx],
                amount: *amount,
                description: Some("Demo operating expense".into()),
                receipt_path: None,
                expense_date: Some(date_days_ago(*days_ago)),
            },
            ACTOR,
        )?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::{migrations, seed as system_seed};

    fn fresh_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        migrations::run(&conn).unwrap();
        system_seed::seed(&conn).unwrap();
        conn
    }

    fn count(conn: &Connection, table: &str) -> i64 {
        conn.query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |r| r.get(0))
            .unwrap()
    }

    #[test]
    fn demo_seed_creates_connected_data_once() {
        let conn = fresh_conn();
        seed_demo(&conn).unwrap();

        assert!(count(&conn, "suppliers") >= 2);
        assert!(count(&conn, "members") >= 2);
        assert!(count(&conn, "phones") >= 3);
        assert!(count(&conn, "accessories") >= 3);
        assert!(count(&conn, "purchases") >= 1);
        assert!(count(&conn, "sales") >= 1);
        assert!(count(&conn, "returns") == 1);
        assert!(count(&conn, "expenses") >= 3);
        assert!(count(&conn, "payments") >= 1);
        assert!(count(&conn, "supplier_payments") >= 1);

        // Physical units exist and phones own them.
        assert!(count(&conn, "phone_imeis") >= count(&conn, "phones"));
        // Sold units were recorded as sold.
        let sold: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM phone_imeis WHERE status = 'sold'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert!(sold > 0, "seeded sales must mark sold units");

        // Idempotent: second run must not duplicate anything.
        let (sales_before, phones_before, purchases_before) = (
            count(&conn, "sales"),
            count(&conn, "phones"),
            count(&conn, "purchases"),
        );
        seed_demo(&conn).unwrap();
        assert_eq!(count(&conn, "sales"), sales_before);
        assert_eq!(count(&conn, "phones"), phones_before);
        assert_eq!(count(&conn, "purchases"), purchases_before);
    }

    #[test]
    fn demo_seed_maintains_stock_consistency_invariants() {
        let conn = fresh_conn();
        seed_demo(&conn).unwrap();

        // Every phone's aggregate quantity must equal its in-stock physical
        // units (the invariant guaranteed by the purchase/sale flows).
        let bad: Vec<(i64, i64, i64)> = conn
            .prepare(
                "SELECT id, quantity,
                   (SELECT COUNT(*) FROM phone_imeis
                    WHERE phone_id = phones.id AND status = 'in_stock')
                 FROM phones",
            )
            .unwrap()
            .query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))
            .unwrap()
            .filter_map(Result::ok)
            .filter(|(_, qty, in_stock)| qty != in_stock)
            .collect();
        assert!(
            bad.is_empty(),
            "phones with quantity != in_stock units: {bad:?}"
        );

        // IMEIs must be globally unique.
        let dup: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM (
                    SELECT imei FROM phone_imeis GROUP BY imei HAVING COUNT(*) > 1
                 )",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(dup, 0, "duplicate IMEIs seeded");

        // Dues exist for some members (credit sales minus payments).
        let dues: f64 = conn
            .query_row(
                "SELECT COALESCE(SUM(MAX((s.total_amount - s.paid_amount) - COALESCE(
                    (SELECT SUM(r.refund_amount) FROM returns r WHERE r.sale_id = s.id), 0), 0)), 0)
                 FROM sales s",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert!(dues > 0.0, "seeded credit sales must leave member dues");

        // Supplier balances exist too.
        let sup_bal: f64 = conn
            .query_row(
                "SELECT COALESCE(SUM(
                    (SELECT COALESCE(SUM(total_amount),0) FROM purchases WHERE supplier_id = s.id)
                  - ((SELECT COALESCE(SUM(paid_amount),0) FROM purchases WHERE supplier_id = s.id)
                     + (SELECT COALESCE(SUM(amount),0) FROM supplier_payments
                        WHERE supplier_id = s.id AND is_deleted = 0 AND status = 'completed'))), 0)
                 FROM suppliers s",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert!(sup_bal > 0.0, "seeded purchases must leave supplier balances");
    }

    #[test]
    fn demo_seed_never_touches_a_database_with_business_data() {
        let conn = fresh_conn();
        // A real client record exists → the seeder must not run.
        member_service::create(
            &conn,
            CreateMemberInput {
                name: "Real Client".into(),
                phone: Some("03000000000".into()),
                cnic: None,
                address: None,
                notes: None,
            },
        )
        .unwrap();
        seed_demo(&conn).unwrap();
        assert_eq!(count(&conn, "sales"), 0);
        assert_eq!(count(&conn, "purchases"), 0);
        assert_eq!(count(&conn, "phones"), 0);
        assert_eq!(count(&conn, "members"), 1);
    }

    #[test]
    fn demo_seed_respects_marker_after_manual_wipe() {
        let conn = fresh_conn();
        seed_demo(&conn).unwrap();
        let sales = count(&conn, "sales");
        assert!(sales > 0);

        // Developer wipes all business records; marker remains → no re-seed.
        conn.execute_batch(
            "DELETE FROM return_items; DELETE FROM returns; DELETE FROM sale_items;
             DELETE FROM sales; DELETE FROM purchase_items; DELETE FROM purchases;
             DELETE FROM supplier_payments; DELETE FROM payments; DELETE FROM phone_imeis;
             DELETE FROM accessories; DELETE FROM phones; DELETE FROM members;
             DELETE FROM suppliers; DELETE FROM expenses;",
        )
        .unwrap();
        seed_demo(&conn).unwrap();
        assert_eq!(count(&conn, "sales"), 0, "marker must block re-seeding");
        assert_eq!(count(&conn, "phones"), 0);
    }

    #[test]
    fn deleting_a_seeded_sale_reconciles_stock_on_related_pages() {
        let conn = fresh_conn();
        seed_demo(&conn).unwrap();

        // Pick the sale that included a returned (restocked) iPhone 14 case.
        let sale_id: i64 = conn
            .query_row("SELECT sale_id FROM returns ORDER BY id DESC LIMIT 1", [], |r| {
                r.get(0)
            })
            .unwrap();
        let sale = sale_service::get(&conn, sale_id).unwrap();
        let phone_line = sale
            .items
            .iter()
            .find(|i| i.item_type == "phone")
            .expect("seed sale has a phone line");
        let phone_id = phone_line.item_id;
        let qty_before: i64 = conn
            .query_row(
                "SELECT quantity FROM phones WHERE id = ?1",
                [phone_id],
                |r| r.get(0),
            )
            .unwrap();

        sale_service::delete(&conn, sale_id, ACTOR).unwrap();

        // Deleting a sale restores its units: the returned defective phone had
        // never been restocked, so its unit comes back into stock.
        let qty_after: i64 = conn
            .query_row(
                "SELECT quantity FROM phones WHERE id = ?1",
                [phone_id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(qty_after, qty_before + 1, "deleting a sale restores its units");

        // The aggregate/unit invariant still holds for that phone.
        let in_stock: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM phone_imeis
                 WHERE phone_id = ?1 AND status = 'in_stock'",
                [phone_id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(qty_after, in_stock);
    }

    #[test]
    fn deleting_a_seeded_purchase_keeps_every_phone_reconciled() {
        let conn = fresh_conn();
        seed_demo(&conn).unwrap();

        // Every seeded purchase carried units that were later sold, so only a
        // forced delete is allowed. It rolls back the physical units still in
        // stock and syncs the aggregate quantity — sold units and their sale
        // history must remain untouched.
        let target: i64 = conn
            .query_row("SELECT id FROM purchases ORDER BY id ASC LIMIT 1", [], |r| {
                r.get(0)
            })
            .unwrap();
        purchase_service::delete_purchase(
            &conn,
            target,
            ACTOR,
            Some("test-invariant".into()),
            true,
        )
        .unwrap();

        let bad: Vec<(i64, i64, i64)> = conn
            .prepare(
                "SELECT id, quantity,
                   (SELECT COUNT(*) FROM phone_imeis
                    WHERE phone_id = phones.id AND status = 'in_stock')
                 FROM phones",
            )
            .unwrap()
            .query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))
            .unwrap()
            .filter_map(Result::ok)
            .filter(|(_, qty, in_stock)| qty != in_stock)
            .collect();
        assert!(
            bad.is_empty(),
            "phone quantity must equal in-stock units after forced purchase delete: {bad:?}"
        );
    }
}