//! Test utilities: builds an in-memory SQLite schema for unit tests.
#![cfg(test)]

use rusqlite::Connection;

const SCHEMA: &str = r#"
CREATE TABLE roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE,
    description TEXT, is_builtin INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, description TEXT
);
CREATE TABLE role_permissions (
    role_id INTEGER NOT NULL, permission_id INTEGER NOT NULL,
    PRIMARY KEY (role_id, permission_id)
);
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL, role_id INTEGER NOT NULL,
    full_name TEXT, email TEXT, is_deleted INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE members (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT, cnic TEXT,
    address TEXT, image_path TEXT, status TEXT NOT NULL DEFAULT 'active', notes TEXT,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT, member_id INTEGER, amount REAL NOT NULL,
    payment_method TEXT NOT NULL, reference TEXT, notes TEXT,
    payment_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, created_by INTEGER,
    payment_type TEXT, status TEXT NOT NULL DEFAULT 'completed',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, is_deleted INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, type TEXT NOT NULL DEFAULT 'expense'
);
CREATE TABLE product_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT, category_id INTEGER NOT NULL, amount REAL NOT NULL,
    description TEXT, receipt_path TEXT, expense_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER, is_deleted INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE report_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, columns TEXT, filters TEXT,
    created_by INTEGER, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT NOT NULL UNIQUE, value TEXT
);
CREATE TABLE activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, module TEXT NOT NULL,
    action TEXT NOT NULL, record_id INTEGER, old_value TEXT, new_value TEXT,
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT, email TEXT,
    address TEXT, is_deleted INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE phones (
    id INTEGER PRIMARY KEY AUTOINCREMENT, brand TEXT NOT NULL, model TEXT NOT NULL,
    color TEXT, storage TEXT, ram TEXT, processor TEXT, chipset TEXT, network_type TEXT,
    battery_capacity TEXT, imei TEXT, imei2 TEXT, category TEXT, condition TEXT,
    variant TEXT, sku TEXT,
    condition_rating TEXT, body_condition TEXT, screen_condition TEXT, battery_health TEXT,
    camera_condition TEXT, face_id TEXT, speaker TEXT, charger TEXT, box_condition TEXT,
    condition_notes TEXT,
    cost_price REAL NOT NULL DEFAULT 0, sale_price REAL NOT NULL DEFAULT 0,
    quantity INTEGER NOT NULL DEFAULT 0, supplier_id INTEGER,
    low_stock_threshold INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE phone_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    option_type TEXT NOT NULL, value TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(option_type, value)
);
CREATE TABLE accessories (
    id INTEGER PRIMARY KEY AUTOINCREMENT, accessory_type TEXT NOT NULL DEFAULT 'other',
    brand TEXT NOT NULL, product_name TEXT NOT NULL, compatible_models TEXT, color TEXT,
    condition TEXT, connector_type TEXT, warranty TEXT, features TEXT, description TEXT, sku TEXT,
    cost_price REAL NOT NULL DEFAULT 0, sale_price REAL NOT NULL DEFAULT 0,
    quantity INTEGER NOT NULL DEFAULT 0, supplier_id INTEGER,
    low_stock_threshold INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE phone_imeis (
    id INTEGER PRIMARY KEY AUTOINCREMENT, phone_id INTEGER NOT NULL,
    imei TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'in_stock', sold_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT, receipt_no TEXT NOT NULL UNIQUE, member_id INTEGER,
    total_amount REAL NOT NULL DEFAULT 0, discount REAL NOT NULL DEFAULT 0,
    paid_amount REAL NOT NULL DEFAULT 0, payment_method TEXT NOT NULL DEFAULT 'cash',
    notes TEXT, created_by INTEGER, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT, sale_id INTEGER NOT NULL,
    phone_id INTEGER, accessory_id INTEGER,
    imei_id INTEGER, quantity INTEGER NOT NULL DEFAULT 1, unit_price REAL NOT NULL DEFAULT 0
);
CREATE TABLE purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT, purchase_no TEXT NOT NULL UNIQUE, supplier_id INTEGER,
    total_amount REAL NOT NULL DEFAULT 0, discount REAL NOT NULL DEFAULT 0,
    paid_amount REAL NOT NULL DEFAULT 0, payment_method TEXT NOT NULL DEFAULT 'cash',
    notes TEXT, created_by INTEGER, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE purchase_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT, purchase_id INTEGER NOT NULL,
    phone_id INTEGER, accessory_id INTEGER,
    quantity INTEGER NOT NULL DEFAULT 1, unit_cost REAL NOT NULL DEFAULT 0
);
CREATE TABLE supplier_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT, supplier_id INTEGER, amount REAL NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'cash', status TEXT NOT NULL DEFAULT 'completed',
    reference TEXT, notes TEXT, payment_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, is_deleted INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
    title TEXT NOT NULL, message TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL DEFAULT 'general', priority TEXT NOT NULL DEFAULT 'normal',
    is_read INTEGER NOT NULL DEFAULT 0, read_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE backups (
    id INTEGER PRIMARY KEY AUTOINCREMENT, file_name TEXT NOT NULL,
    backup_type TEXT NOT NULL DEFAULT 'database', file_path TEXT NOT NULL,
    size INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'success',
    created_by INTEGER, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX idx_members_phone_active
    ON members(phone) WHERE phone IS NOT NULL AND is_deleted = 0;
"#;

pub fn in_memory_conn() -> Connection {
    let conn = Connection::open_in_memory().unwrap();
    conn.execute_batch(SCHEMA).unwrap();
    conn
}

/// Seeds the default product categories (the values that replaced the former
/// hard-coded ACCESSORY_TYPES list). Tests only need to call this when they
/// create accessories or phones with a category.
pub fn seed_product_categories(conn: &Connection) {
    for name in [
        "Charger",
        "Cover",
        "Cable",
        "Earphones",
        "Power Bank",
        "Screen Protector",
        "Holder",
        "Other",
    ] {
        conn.execute(
            "INSERT OR IGNORE INTO product_categories (name) VALUES (?1)",
            [name],
        )
        .unwrap();
    }
}
