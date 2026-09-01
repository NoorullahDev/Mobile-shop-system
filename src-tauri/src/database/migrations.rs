use rusqlite::Connection;

use crate::errors::AppError;

/// Each migration is a named SQL batch applied once, tracked in `schema_migrations`.
const MIGRATIONS: &[(&str, &str)] = &[
    (
        "0001_initial_schema",
        r#"
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version TEXT PRIMARY KEY,
            applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS roles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS permissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT
        );

        CREATE TABLE IF NOT EXISTS role_permissions (
            role_id INTEGER NOT NULL,
            permission_id INTEGER NOT NULL,
            PRIMARY KEY (role_id, permission_id),
            FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
            FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role_id INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'active',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (role_id) REFERENCES roles(id)
        );

        CREATE TABLE IF NOT EXISTS members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT,
            email TEXT,
            address TEXT,
            image_path TEXT,
            status TEXT NOT NULL DEFAULT 'active',
            notes TEXT,
            is_deleted INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            member_id INTEGER,
            amount REAL NOT NULL,
            payment_method TEXT NOT NULL,
            reference TEXT,
            notes TEXT,
            payment_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_by INTEGER,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (member_id) REFERENCES members(id),
            FOREIGN KEY (created_by) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            type TEXT NOT NULL DEFAULT 'expense'
        );

        CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            description TEXT,
            receipt_path TEXT,
            expense_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_by INTEGER,
            is_deleted INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES categories(id),
            FOREIGN KEY (created_by) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS report_templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            columns TEXT,
            filters TEXT,
            created_by INTEGER,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT NOT NULL UNIQUE,
            value TEXT
        );

        CREATE TABLE IF NOT EXISTS activity_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            module TEXT NOT NULL,
            action TEXT NOT NULL,
            record_id INTEGER,
            old_value TEXT,
            new_value TEXT,
            timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE INDEX IF NOT EXISTS idx_members_name ON members(name);
        CREATE INDEX IF NOT EXISTS idx_members_phone ON members(phone);
        CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);
        CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date);
        CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON expenses(expense_date);
        "#,
    ),
    (
        "0002_phone_shop_schema",
        r#"
        CREATE TABLE IF NOT EXISTS suppliers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT,
            email TEXT,
            address TEXT,
            is_deleted INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            brand TEXT NOT NULL,
            model TEXT NOT NULL,
            color TEXT,
            storage TEXT,
            cost_price REAL NOT NULL DEFAULT 0,
            sale_price REAL NOT NULL DEFAULT 0,
            quantity INTEGER NOT NULL DEFAULT 0,
            supplier_id INTEGER,
            low_stock_threshold INTEGER NOT NULL DEFAULT 0,
            is_deleted INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
        );

        CREATE TABLE IF NOT EXISTS inventory_imei (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            inventory_id INTEGER NOT NULL,
            imei TEXT NOT NULL UNIQUE,
            status TEXT NOT NULL DEFAULT 'in_stock',
            sold_at DATETIME,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (inventory_id) REFERENCES inventory(id)
        );

        CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            receipt_no TEXT NOT NULL UNIQUE,
            member_id INTEGER,
            total_amount REAL NOT NULL DEFAULT 0,
            discount REAL NOT NULL DEFAULT 0,
            paid_amount REAL NOT NULL DEFAULT 0,
            payment_method TEXT NOT NULL DEFAULT 'cash',
            notes TEXT,
            created_by INTEGER,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (member_id) REFERENCES members(id),
            FOREIGN KEY (created_by) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS sale_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_id INTEGER NOT NULL,
            inventory_id INTEGER NOT NULL,
            imei_id INTEGER,
            quantity INTEGER NOT NULL DEFAULT 1,
            unit_price REAL NOT NULL DEFAULT 0,
            FOREIGN KEY (sale_id) REFERENCES sales(id),
            FOREIGN KEY (inventory_id) REFERENCES inventory(id),
            FOREIGN KEY (imei_id) REFERENCES inventory_imei(id)
        );

        CREATE INDEX IF NOT EXISTS idx_inventory_brand ON inventory(brand);
        CREATE INDEX IF NOT EXISTS idx_inventory_model ON inventory(model);
        CREATE INDEX IF NOT EXISTS idx_inventory_imei_inventory ON inventory_imei(inventory_id);
        CREATE INDEX IF NOT EXISTS idx_sales_receipt_no ON sales(receipt_no);
        CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
        CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
        "#,
    ),
    (
        "0003_payments_refinement",
        r#"
        -- Recreate payments with nullable member_id and specification fields
        -- (handles databases created by migration 0001 with NOT NULL member_id).
        PRAGMA foreign_keys = OFF;

        CREATE TABLE payments_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            member_id INTEGER,
            amount REAL NOT NULL,
            payment_method TEXT NOT NULL,
            payment_type TEXT,
            status TEXT NOT NULL DEFAULT 'completed',
            reference TEXT,
            notes TEXT,
            payment_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_by INTEGER,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            is_deleted INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (member_id) REFERENCES members(id),
            FOREIGN KEY (created_by) REFERENCES users(id)
        );

        INSERT INTO payments_new (id, member_id, amount, payment_method, reference, notes, payment_date, created_by, created_at)
            SELECT id, member_id, amount, payment_method, reference, notes, payment_date, created_by, created_at FROM payments;

        DROP TABLE payments;
        ALTER TABLE payments_new RENAME TO payments;

        CREATE INDEX IF NOT EXISTS idx_payments_member ON payments(member_id);
        CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
        CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date);

        PRAGMA foreign_keys = ON;
        "#,
    ),
    (
        "0004_purchases",
        r#"
        CREATE TABLE IF NOT EXISTS purchases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            purchase_no TEXT NOT NULL UNIQUE,
            supplier_id INTEGER,
            total_amount REAL NOT NULL DEFAULT 0,
            discount REAL NOT NULL DEFAULT 0,
            paid_amount REAL NOT NULL DEFAULT 0,
            payment_method TEXT NOT NULL DEFAULT 'cash',
            notes TEXT,
            created_by INTEGER,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
            FOREIGN KEY (created_by) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS purchase_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            purchase_id INTEGER NOT NULL,
            inventory_id INTEGER NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 1,
            unit_cost REAL NOT NULL DEFAULT 0,
            FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
            FOREIGN KEY (inventory_id) REFERENCES inventory(id)
        );

        CREATE TABLE IF NOT EXISTS supplier_payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            supplier_id INTEGER,
            amount REAL NOT NULL,
            payment_method TEXT NOT NULL DEFAULT 'cash',
            status TEXT NOT NULL DEFAULT 'completed',
            reference TEXT,
            notes TEXT,
            payment_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_by INTEGER,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            is_deleted INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
            FOREIGN KEY (created_by) REFERENCES users(id)
        );

        CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id);
        CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);
        CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier ON supplier_payments(supplier_id);
        "#,
    ),
    (
        "0005_user_management",
        r#"
        ALTER TABLE users ADD COLUMN full_name TEXT;
        ALTER TABLE users ADD COLUMN email TEXT;
        ALTER TABLE users ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE roles ADD COLUMN is_builtin INTEGER NOT NULL DEFAULT 0;

        UPDATE roles SET is_builtin = 1 WHERE name IN ('Admin', 'Staff', 'Accountant');

        CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
        "#,
    ),
    (
        "0006_performance_indexes",
        r#"
        CREATE INDEX IF NOT EXISTS idx_sales_member_id ON sales(member_id);
        CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
        CREATE INDEX IF NOT EXISTS idx_expenses_category_id ON expenses(category_id);
        CREATE INDEX IF NOT EXISTS idx_purchases_created_at ON purchases(created_at);
        CREATE INDEX IF NOT EXISTS idx_supplier_payments_payment_date ON supplier_payments(payment_date);
        CREATE INDEX IF NOT EXISTS idx_sale_items_inventory ON sale_items(inventory_id);
        CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON activity_logs(timestamp);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_members_phone_active
            ON members(phone) WHERE phone IS NOT NULL AND is_deleted = 0;
        "#,
    ),
    (
        "0007_notifications",
        r#"
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            message TEXT NOT NULL DEFAULT '',
            type TEXT NOT NULL DEFAULT 'general',
            priority TEXT NOT NULL DEFAULT 'normal',
            is_read INTEGER NOT NULL DEFAULT 0,
            read_at DATETIME,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
        CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
        CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
        "#,
    ),
    (
        "0008_backups",
        r#"
        CREATE TABLE IF NOT EXISTS backups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_name TEXT NOT NULL,
            backup_type TEXT NOT NULL DEFAULT 'database',
            file_path TEXT NOT NULL,
            size INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'success',
            created_by INTEGER,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(id)
        );

        CREATE INDEX IF NOT EXISTS idx_backups_created_at ON backups(created_at);
        "#,
    ),
    (
        "0009_inventory_category",
        r#"
        ALTER TABLE inventory ADD COLUMN category TEXT NOT NULL DEFAULT 'phone';
        CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory(category);
        "#,
    ),
    (
        "0010_inventory_product_fields",
        r#"
        -- Phone-specific fields (only meaningful for category = 'phone')
        ALTER TABLE inventory ADD COLUMN ram TEXT;
        ALTER TABLE inventory ADD COLUMN processor TEXT;
        ALTER TABLE inventory ADD COLUMN chipset TEXT;
        ALTER TABLE inventory ADD COLUMN network_type TEXT;
        ALTER TABLE inventory ADD COLUMN battery_capacity TEXT;
        -- One unique IMEI per phone line (nullable so existing rows migrate cleanly)
        ALTER TABLE inventory ADD COLUMN imei TEXT;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_imei_unique ON inventory(imei) WHERE imei IS NOT NULL;
        -- Accessory-specific category (only meaningful for category = 'accessory')
        ALTER TABLE inventory ADD COLUMN accessory_type TEXT;
        CREATE INDEX IF NOT EXISTS idx_inventory_accessory_type ON inventory(accessory_type);
        "#,
    ),
    (
        "0011_inventory_split",
        r#"
        -- =====================================================================
        -- Split the unified `inventory` table into two dedicated tables:
        --   `phones`      -> mobile phone products only
        --   `accessories` -> mobile accessories only
        -- and move IMEI tracking to `phone_imeis` (phones only).
        -- Dependent sale_items / purchase_items get two nullable FKs
        -- (phone_id + accessory_id) so a product is never mixed.
        -- =====================================================================
        PRAGMA foreign_keys = OFF;

        -- 1) Phones table ------------------------------------------------------
        CREATE TABLE phones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            brand TEXT NOT NULL,
            model TEXT NOT NULL,
            color TEXT,
            storage TEXT,
            ram TEXT,
            processor TEXT,
            chipset TEXT,
            network_type TEXT,
            battery_capacity TEXT,
            imei TEXT,
            cost_price REAL NOT NULL DEFAULT 0,
            sale_price REAL NOT NULL DEFAULT 0,
            quantity INTEGER NOT NULL DEFAULT 0,
            supplier_id INTEGER,
            low_stock_threshold INTEGER NOT NULL DEFAULT 0,
            is_deleted INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_phones_imei_unique ON phones(imei) WHERE imei IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_phones_brand ON phones(brand);
        CREATE INDEX IF NOT EXISTS idx_phones_model ON phones(model);

        -- 2) Accessories table -------------------------------------------------
        CREATE TABLE accessories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            accessory_type TEXT NOT NULL DEFAULT 'other',
            brand TEXT NOT NULL,
            product_name TEXT NOT NULL,
            compatible_models TEXT,
            color TEXT,
            cost_price REAL NOT NULL DEFAULT 0,
            sale_price REAL NOT NULL DEFAULT 0,
            quantity INTEGER NOT NULL DEFAULT 0,
            supplier_id INTEGER,
            low_stock_threshold INTEGER NOT NULL DEFAULT 0,
            is_deleted INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
        );
        CREATE INDEX IF NOT EXISTS idx_accessories_type ON accessories(accessory_type);
        CREATE INDEX IF NOT EXISTS idx_accessories_brand ON accessories(brand);

        -- 3) Phone IMEI table (phones only) ------------------------------------
        CREATE TABLE phone_imeis (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone_id INTEGER NOT NULL,
            imei TEXT NOT NULL UNIQUE,
            status TEXT NOT NULL DEFAULT 'in_stock',
            sold_at DATETIME,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (phone_id) REFERENCES phones(id)
        );
        CREATE INDEX IF NOT EXISTS idx_phone_imeis_phone ON phone_imeis(phone_id);

        -- 4) Migrate existing inventory rows by category -----------------------
        -- Phone IMEIs (from the phone record and inventory_imei) are moved to phone_imeis.
        INSERT INTO phones
            (id, brand, model, color, storage, ram, processor, chipset, network_type,
             battery_capacity, imei, cost_price, sale_price, quantity, supplier_id,
             low_stock_threshold, is_deleted, created_at, updated_at)
        SELECT id, brand, model, color, storage, ram, processor, chipset, network_type,
               battery_capacity, imei, cost_price, sale_price, quantity, supplier_id,
               low_stock_threshold, is_deleted, created_at, updated_at
        FROM inventory
        WHERE category = 'phone';

        INSERT INTO accessories
            (id, accessory_type, brand, product_name, color, cost_price, sale_price,
             quantity, supplier_id, low_stock_threshold, is_deleted, created_at, updated_at)
        SELECT id, COALESCE(NULLIF(accessory_type, ''), 'other'), brand, model, color,
               cost_price, sale_price, quantity, supplier_id,
               low_stock_threshold, is_deleted, created_at, updated_at
        FROM inventory
        WHERE category = 'accessory';

        INSERT INTO phone_imeis (id, phone_id, imei, status, sold_at, created_at)
        SELECT id, inventory_id, imei, status, sold_at, created_at
        FROM inventory_imei;

        -- Optionally backfill one IMEI per phone record that has an imei but no
        -- inventory_imei row (legacy single-IMEI rows).
        INSERT INTO phone_imeis (phone_id, imei, status)
        SELECT p.id, p.imei, 'in_stock'
        FROM phones p
        WHERE p.imei IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM phone_imeis pi WHERE pi.imei = p.imei);

        -- 5) Rebuild sale_items with phone_id + accessory_id -------------------
        CREATE TABLE sale_items_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_id INTEGER NOT NULL,
            phone_id INTEGER,
            accessory_id INTEGER,
            imei_id INTEGER,
            quantity INTEGER NOT NULL DEFAULT 1,
            unit_price REAL NOT NULL DEFAULT 0,
            FOREIGN KEY (sale_id) REFERENCES sales(id),
            FOREIGN KEY (phone_id) REFERENCES phones(id),
            FOREIGN KEY (accessory_id) REFERENCES accessories(id),
            FOREIGN KEY (imei_id) REFERENCES phone_imeis(id)
        );
        INSERT INTO sale_items_new (id, sale_id, phone_id, accessory_id, imei_id, quantity, unit_price)
        SELECT si.id, si.sale_id,
               CASE WHEN i.category = 'phone' THEN si.inventory_id ELSE NULL END,
               CASE WHEN i.category = 'accessory' THEN si.inventory_id ELSE NULL END,
               si.imei_id, si.quantity, si.unit_price
        FROM sale_items si
        LEFT JOIN inventory i ON i.id = si.inventory_id;
        DROP TABLE sale_items;
        ALTER TABLE sale_items_new RENAME TO sale_items;
        CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
        CREATE INDEX IF NOT EXISTS idx_sale_items_phone ON sale_items(phone_id);
        CREATE INDEX IF NOT EXISTS idx_sale_items_accessory ON sale_items(accessory_id);

        -- 6) Rebuild purchase_items with phone_id + accessory_id ---------------
        CREATE TABLE purchase_items_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            purchase_id INTEGER NOT NULL,
            phone_id INTEGER,
            accessory_id INTEGER,
            quantity INTEGER NOT NULL DEFAULT 1,
            unit_cost REAL NOT NULL DEFAULT 0,
            FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
            FOREIGN KEY (phone_id) REFERENCES phones(id),
            FOREIGN KEY (accessory_id) REFERENCES accessories(id)
        );
        INSERT INTO purchase_items_new (id, purchase_id, phone_id, accessory_id, quantity, unit_cost)
        SELECT pi.id, pi.purchase_id,
               CASE WHEN i.category = 'phone' THEN pi.inventory_id ELSE NULL END,
               CASE WHEN i.category = 'accessory' THEN pi.inventory_id ELSE NULL END,
               pi.quantity, pi.unit_cost
        FROM purchase_items pi
        LEFT JOIN inventory i ON i.id = pi.inventory_id;
        DROP TABLE purchase_items;
        ALTER TABLE purchase_items_new RENAME TO purchase_items;
        CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);
        CREATE INDEX IF NOT EXISTS idx_purchase_items_phone ON purchase_items(phone_id);
        CREATE INDEX IF NOT EXISTS idx_purchase_items_accessory ON purchase_items(accessory_id);

        -- 7) Drop old unified tables -------------------------------------------
        DROP TABLE inventory_imei;
        DROP TABLE inventory;

        PRAGMA foreign_keys = ON;
        "#,
    ),
];

pub fn run(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version TEXT PRIMARY KEY,
            applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );",
    )?;

    let applied: Vec<String> = conn
        .prepare("SELECT version FROM schema_migrations")?
        .query_map([], |row| row.get(0))?
        .collect::<Result<_, _>>()?;

    for (version, sql) in MIGRATIONS {
        if applied.contains(&version.to_string()) {
            continue;
        }
        conn.execute_batch(sql)?;
        conn.execute(
            "INSERT INTO schema_migrations (version) VALUES (?1)",
            [version],
        )?;
        log::info!("Applied migration: {}", version);
    }

    Ok(())
}
