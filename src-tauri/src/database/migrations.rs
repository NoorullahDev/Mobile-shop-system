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
    (
        "0012_product_categories",
        r#"
        -- =====================================================================
        -- Dynamic product categories for phones + accessories. Replaces the
        -- hard-coded ACCESSORY_TYPES list: categories now live in the database
        -- and are managed by the Owner/Admin (add / edit / delete).
        -- =====================================================================
        CREATE TABLE IF NOT EXISTS product_categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        -- Seed the categories that used to be hard-coded so existing accessory
        -- rows and first-run dropdowns stay coherent. They are ordinary rows:
        -- fully editable and deletable by the Owner/Admin.
        INSERT OR IGNORE INTO product_categories (name) VALUES
            ('Charger'),
            ('Cover'),
            ('Cable'),
            ('Earphones'),
            ('Power Bank'),
            ('Screen Protector'),
            ('Holder'),
            ('Other');

        -- Phones previously had no category; add an optional one now.
        ALTER TABLE phones ADD COLUMN category TEXT;
        CREATE INDEX IF NOT EXISTS idx_phones_category ON phones(category);
        "#,
    ),
    (
        "0013_member_cnic",
        r#"
        -- Rename email to cnic in members table
        ALTER TABLE members RENAME COLUMN email TO cnic;
        -- Create index on cnic (which used to be on email)
        DROP INDEX IF EXISTS idx_members_email;
        CREATE INDEX IF NOT EXISTS idx_members_cnic ON members(cnic);
        "#,
    ),
    (
        "0014_phone_options_and_fields",
        r#"
        -- Dynamic dropdown options for the phone form
        CREATE TABLE IF NOT EXISTS phone_options (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            option_type TEXT NOT NULL,
            value TEXT NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(option_type, value)
        );
        CREATE INDEX IF NOT EXISTS idx_phone_options_type ON phone_options(option_type);

        -- New phone fields
        ALTER TABLE phones ADD COLUMN condition TEXT;
        ALTER TABLE phones ADD COLUMN variant TEXT;
        ALTER TABLE phones ADD COLUMN sku TEXT;
        ALTER TABLE phones ADD COLUMN imei2 TEXT;

        -- Seed brands
        INSERT OR IGNORE INTO phone_options (option_type, value, sort_order) VALUES
            ('brand', 'Samsung', 1),
            ('brand', 'Apple', 2),
            ('brand', 'Xiaomi', 3),
            ('brand', 'OnePlus', 4),
            ('brand', 'Oppo', 5),
            ('brand', 'Vivo', 6),
            ('brand', 'Realme', 7),
            ('brand', 'Infinix', 8),
            ('brand', 'Techno', 9),
            ('brand', 'Nokia', 10);

        -- Seed RAM
        INSERT OR IGNORE INTO phone_options (option_type, value, sort_order) VALUES
            ('ram', '3 GB', 1),
            ('ram', '4 GB', 2),
            ('ram', '6 GB', 3),
            ('ram', '8 GB', 4),
            ('ram', '12 GB', 5),
            ('ram', '16 GB', 6);

        -- Seed Storage
        INSERT OR IGNORE INTO phone_options (option_type, value, sort_order) VALUES
            ('storage', '32 GB', 1),
            ('storage', '64 GB', 2),
            ('storage', '128 GB', 3),
            ('storage', '256 GB', 4),
            ('storage', '512 GB', 5),
            ('storage', '1 TB', 6);

        -- Seed Colors
        INSERT OR IGNORE INTO phone_options (option_type, value, sort_order) VALUES
            ('color', 'Black', 1),
            ('color', 'White', 2),
            ('color', 'Blue', 3),
            ('color', 'Green', 4),
            ('color', 'Red', 5),
            ('color', 'Gold', 6),
            ('color', 'Silver', 7),
            ('color', 'Purple', 8);

        -- Seed Network Types
        INSERT OR IGNORE INTO phone_options (option_type, value, sort_order) VALUES
            ('network_type', '3G', 1),
            ('network_type', '4G', 2),
            ('network_type', '5G', 3);

        -- Seed Conditions
        INSERT OR IGNORE INTO phone_options (option_type, value, sort_order) VALUES
            ('condition', 'New', 1),
            ('condition', 'Used', 2),
            ('condition', 'Refurbished', 3);
        "#,
    ),
    (
        "0015_phone_condition_fields",
        r#"
        -- =====================================================================
        -- Professional phone form: device-condition inspection fields + extra
        -- database-driven dropdown options. All dropdown values live in the
        -- phone_options table so the Owner/Admin can add/edit/delete them.
        -- =====================================================================

        -- Condition inspection fields (only meaningful for used/refurbished
        -- phones, but stored on the phone record regardless).
        ALTER TABLE phones ADD COLUMN condition_rating TEXT;
        ALTER TABLE phones ADD COLUMN body_condition TEXT;
        ALTER TABLE phones ADD COLUMN screen_condition TEXT;
        ALTER TABLE phones ADD COLUMN battery_health TEXT;
        ALTER TABLE phones ADD COLUMN camera_condition TEXT;
        ALTER TABLE phones ADD COLUMN face_id TEXT;
        ALTER TABLE phones ADD COLUMN speaker TEXT;
        ALTER TABLE phones ADD COLUMN charger TEXT;
        ALTER TABLE phones ADD COLUMN box_condition TEXT;
        ALTER TABLE phones ADD COLUMN condition_notes TEXT;

        -- Extra brand + condition requested in the spec.
        INSERT OR IGNORE INTO phone_options (option_type, value, sort_order) VALUES
            ('brand', 'Google', 11);

        INSERT OR IGNORE INTO phone_options (option_type, value, sort_order) VALUES
            ('condition', 'Open Box', 4);

        -- Condition rating scale
        INSERT OR IGNORE INTO phone_options (option_type, value, sort_order) VALUES
            ('condition_rating', '10/10', 1),
            ('condition_rating', '9/10', 2),
            ('condition_rating', '8/10', 3),
            ('condition_rating', '7/10', 4),
            ('condition_rating', '6/10', 5),
            ('condition_rating', '5/10', 6),
            ('condition_rating', '4/10', 7),
            ('condition_rating', '3/10', 8),
            ('condition_rating', '2/10', 9),
            ('condition_rating', '1/10', 10);

        -- Body condition
        INSERT OR IGNORE INTO phone_options (option_type, value, sort_order) VALUES
            ('body_condition', 'Excellent', 1),
            ('body_condition', 'Good', 2),
            ('body_condition', 'Minor Scratches', 3),
            ('body_condition', 'Major Scratches', 4),
            ('body_condition', 'Dented', 5);

        -- Screen condition
        INSERT OR IGNORE INTO phone_options (option_type, value, sort_order) VALUES
            ('screen_condition', 'Flawless', 1),
            ('screen_condition', 'Minor Scratches', 2),
            ('screen_condition', 'Deep Scratches', 3),
            ('screen_condition', 'Cracked', 4),
            ('screen_condition', 'Glass Replaced', 5);

        -- Battery health (%)
        INSERT OR IGNORE INTO phone_options (option_type, value, sort_order) VALUES
            ('battery_health', '100%', 1),
            ('battery_health', '95%', 2),
            ('battery_health', '90%', 3),
            ('battery_health', '85%', 4),
            ('battery_health', '80%', 5),
            ('battery_health', '75%', 6),
            ('battery_health', '70%', 7);

        -- Camera condition
        INSERT OR IGNORE INTO phone_options (option_type, value, sort_order) VALUES
            ('camera_condition', 'Excellent', 1),
            ('camera_condition', 'Good', 2),
            ('camera_condition', 'Minor Scratches', 3),
            ('camera_condition', 'Lens Replaced', 4),
            ('camera_condition', 'Faulty', 5);

        -- Face ID / Fingerprint
        INSERT OR IGNORE INTO phone_options (option_type, value, sort_order) VALUES
            ('face_id', 'Working', 1),
            ('face_id', 'Replaced', 2),
            ('face_id', 'Not Working', 3),
            ('face_id', 'Not Available', 4);

        -- Speaker
        INSERT OR IGNORE INTO phone_options (option_type, value, sort_order) VALUES
            ('speaker', 'Working', 1),
            ('speaker', 'Weak', 2),
            ('speaker', 'Replaced', 3),
            ('speaker', 'Not Working', 4);

        -- Charger (included with the device)
        INSERT OR IGNORE INTO phone_options (option_type, value, sort_order) VALUES
            ('charger', 'Original', 1),
            ('charger', 'Compatible', 2),
            ('charger', 'Not Included', 3);

        -- Box (included with the device)
        INSERT OR IGNORE INTO phone_options (option_type, value, sort_order) VALUES
            ('box_condition', 'Original Box', 1),
            ('box_condition', 'No Box', 2),
            ('box_condition', 'Generic Box', 3);
        "#,
    ),
    (
        "0016_accessory_fields_and_options",
        r#"
        -- =====================================================================
        -- Professional accessory form: new fields + DB-driven dropdown options.
        -- Dropdown values reuse the existing phone_options table (generic
        -- option store) with new option_type keys for accessories.
        -- =====================================================================

        -- New accessory fields
        ALTER TABLE accessories ADD COLUMN condition TEXT;
        ALTER TABLE accessories ADD COLUMN sku TEXT;
        ALTER TABLE accessories ADD COLUMN connector_type TEXT;
        ALTER TABLE accessories ADD COLUMN warranty TEXT;
        ALTER TABLE accessories ADD COLUMN features TEXT;
        ALTER TABLE accessories ADD COLUMN description TEXT;

        -- Accessory categories (stored as accessory_category option_type)
        INSERT OR IGNORE INTO phone_options (option_type, value, sort_order) VALUES
            ('accessory_category', 'Chargers', 1),
            ('accessory_category', 'Handsfree', 2),
            ('accessory_category', 'Earbuds', 3),
            ('accessory_category', 'Cables', 4),
            ('accessory_category', 'Covers', 5),
            ('accessory_category', 'Screen Protectors', 6),
            ('accessory_category', 'Power Banks', 7),
            ('accessory_category', 'Smart Watches', 8),
            ('accessory_category', 'Bluetooth Speakers', 9),
            ('accessory_category', 'Memory Cards', 10),
            ('accessory_category', 'Phone Holders', 11),
            ('accessory_category', 'Other', 12);

        -- Accessory-specific brands
        INSERT OR IGNORE INTO phone_options (option_type, value, sort_order) VALUES
            ('accessory_brand', 'Anker', 1),
            ('accessory_brand', 'Baseus', 2),
            ('accessory_brand', 'UGREEN', 3),
            ('accessory_brand', 'Audionic', 4),
            ('accessory_brand', 'Belkin', 5),
            ('accessory_brand', 'Spigen', 6),
            ('accessory_brand', 'Eiger', 7),
            ('accessory_brand', 'JBL', 8),
            ('accessory_brand', 'Samsung', 9),
            ('accessory_brand', 'Apple', 10),
            ('accessory_brand', 'Xiaomi', 11),
            ('accessory_brand', 'Generic', 12);

        -- Connector types
        INSERT OR IGNORE INTO phone_options (option_type, value, sort_order) VALUES
            ('connector_type', 'USB-C', 1),
            ('connector_type', 'Micro USB', 2),
            ('connector_type', 'Lightning', 3),
            ('connector_type', '3.5mm Jack', 4),
            ('connector_type', 'Bluetooth', 5),
            ('connector_type', 'No Connector', 6),
            ('connector_type', 'Type-C to Type-C', 7),
            ('connector_type', 'Type-C to Lightning', 8);

        -- Warranty options
        INSERT OR IGNORE INTO phone_options (option_type, value, sort_order) VALUES
            ('warranty', 'No Warranty', 1),
            ('warranty', '3 Months', 2),
            ('warranty', '6 Months', 3),
            ('warranty', '1 Year', 4),
            ('warranty', '2 Years', 5);

        -- Accessory-specific colors (extends the shared 'color' type)
        INSERT OR IGNORE INTO phone_options (option_type, value, sort_order) VALUES
            ('color', 'Pink', 9),
            ('color', 'Transparent', 10);

        -- Sample accessory products (only if the table is empty)
        INSERT INTO accessories (accessory_type, brand, product_name, compatible_models, color, connector_type, warranty, condition, sku, cost_price, sale_price, quantity, low_stock_threshold)
        SELECT 'Chargers', 'Anker', 'PowerIQ 3.0 Fast Charger', 'Universal', 'White', 'USB-C', '1 Year', 'New', 'ANK-CHG-001', 1200, 2500, 15, 3
        WHERE NOT EXISTS (SELECT 1 FROM accessories LIMIT 1);

        INSERT INTO accessories (accessory_type, brand, product_name, compatible_models, color, connector_type, warranty, condition, sku, cost_price, sale_price, quantity, low_stock_threshold)
        SELECT 'Cables', 'UGREEN', 'USB-C Fast Charging Cable 1m', 'Universal', 'Black', 'USB-C', '6 Months', 'New', 'UGR-CBL-001', 350, 800, 25, 5
        WHERE NOT EXISTS (SELECT 1 FROM accessories WHERE product_name = 'USB-C Fast Charging Cable 1m');

        INSERT INTO accessories (accessory_type, brand, product_name, compatible_models, color, connector_type, warranty, condition, sku, cost_price, sale_price, quantity, low_stock_threshold)
        SELECT 'Earbuds', 'Audionic', 'Air buds Pro', 'Universal', 'White', 'Bluetooth', '1 Year', 'New', 'AUD-EAR-001', 1800, 3500, 10, 2
        WHERE NOT EXISTS (SELECT 1 FROM accessories WHERE product_name = 'Air buds Pro');

        INSERT INTO accessories (accessory_type, brand, product_name, compatible_models, color, connector_type, warranty, condition, sku, cost_price, sale_price, quantity, low_stock_threshold)
        SELECT 'Covers', 'Spigen', 'Rugged Armor Case', 'Samsung Galaxy S24', 'Black', 'No Connector', 'No Warranty', 'New', 'SPG-CVR-001', 800, 1800, 8, 2
        WHERE NOT EXISTS (SELECT 1 FROM accessories WHERE product_name = 'Rugged Armor Case');

        INSERT INTO accessories (accessory_type, brand, product_name, compatible_models, color, connector_type, warranty, condition, sku, cost_price, sale_price, quantity, low_stock_threshold)
        SELECT 'Power Banks', 'Anker', 'PowerCore 10000mAh', 'Universal', 'Black', 'USB-C', '1 Year', 'New', 'ANK-PWR-001', 2500, 4500, 12, 3
        WHERE NOT EXISTS (SELECT 1 FROM accessories WHERE product_name = 'PowerCore 10000mAh');

        INSERT INTO accessories (accessory_type, brand, product_name, compatible_models, color, connector_type, warranty, condition, sku, cost_price, sale_price, quantity, low_stock_threshold)
        SELECT 'Screen Protectors', 'Eiger', 'Tempered Glass 9H', 'iPhone 15 Pro', 'Transparent', 'No Connector', 'No Warranty', 'New', 'EIG-SCR-001', 200, 600, 30, 10
        WHERE NOT EXISTS (SELECT 1 FROM accessories WHERE product_name = 'Tempered Glass 9H');

        INSERT INTO accessories (accessory_type, brand, product_name, compatible_models, color, connector_type, warranty, condition, sku, cost_price, sale_price, quantity, low_stock_threshold)
        SELECT 'Bluetooth Speakers', 'JBL', 'Go 2 Portable Speaker', 'Universal', 'Blue', 'Bluetooth', '1 Year', 'New', 'JBL-SPK-001', 3500, 6500, 5, 2
        WHERE NOT EXISTS (SELECT 1 FROM accessories WHERE product_name = 'Go 2 Portable Speaker');

        INSERT INTO accessories (accessory_type, brand, product_name, compatible_models, color, connector_type, warranty, condition, sku, cost_price, sale_price, quantity, low_stock_threshold)
        SELECT 'Handsfree', 'Baseus', 'Wired Earphone Type-C', 'Universal', 'White', 'Type-C to Type-C', '6 Months', 'New', 'BS-HF-001', 400, 900, 20, 5
        WHERE NOT EXISTS (SELECT 1 FROM accessories WHERE product_name = 'Wired Earphone Type-C');
        "#,
    ),
    (
        "0017_dynamic_options_activation",
        r#"
        -- =====================================================================
        -- Fully dynamic, database-driven dropdown options.
        --
        -- 1) Add soft activate/deactivate support to phone_options so the
        --    Owner/Admin can disable an option (hiding it from forms) without
        --    losing its data history.
        -- 2) Add a `warranty` column to phones (phones previously had no
        --    warranty field; accessories already do).
        -- 3) Seed additional realistic options (phone Category, extra shared
        --    Warranty, Ronin brand, 24GB RAM, 2TB Storage, and a new Accessory
        --    Category). These are stored in the same phone_options table as
        --    every other option so they behave exactly like user-created data.
        -- =====================================================================

        ALTER TABLE phone_options ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;

        ALTER TABLE phones ADD COLUMN warranty TEXT;

        -- Phone Categories
        INSERT OR IGNORE INTO phone_options (option_type, value, sort_order) VALUES
            ('category', 'Smartphone', 1),
            ('category', 'Feature Phone', 2),
            ('category', 'Tablet', 3),
            ('category', 'Smart Watch', 4);

        -- Shared Warranty options (phones + accessories now both use `warranty`)
        INSERT OR IGNORE INTO phone_options (option_type, value, sort_order) VALUES
            ('warranty', 'No Warranty', 1),
            ('warranty', '3 Months', 2),
            ('warranty', '6 Months', 3),
            ('warranty', '1 Year', 4),
            ('warranty', '2 Years', 5);

        -- Extra brand + spec values mentioned in the spec
        INSERT OR IGNORE INTO phone_options (option_type, value, sort_order) VALUES
            ('brand', 'Ronin', 12),
            ('ram', '24 GB', 7),
            ('storage', '2 TB', 7);

        -- New Accessory Category
        INSERT OR IGNORE INTO phone_options (option_type, value, sort_order) VALUES
            ('accessory_category', 'Gaming Accessories', 13);
        "#,
    ),
    (
        "0018_purchase_stock_in",
        r#"
        -- =====================================================================
        -- Treat purchases as a proper Supplier Purchase / Stock-In transaction.
        --
        -- 1) purchases: add purchase_date and supplier invoice/reference.
        -- 2) purchase_items: capture selling price, warranty, condition and
        --    the recorded IMEI/serial list for each purchased line (kept as a
        --    JSON text snapshot for traceability).
        -- 3) phones/accessories: track the last purchase cost for costing and
        --    profit reporting.
        --
        -- The existing phone_id/accessory_id columns are retained for backward
        -- compatibility; item_type + item_id already make the schema scalable
        -- to future product types.
        -- =====================================================================

        ALTER TABLE purchases ADD COLUMN purchase_date TEXT;
        ALTER TABLE purchases ADD COLUMN invoice_reference TEXT;

        ALTER TABLE purchase_items ADD COLUMN selling_price REAL;
        ALTER TABLE purchase_items ADD COLUMN warranty TEXT;
        ALTER TABLE purchase_items ADD COLUMN condition TEXT;
        ALTER TABLE purchase_items ADD COLUMN serials TEXT;

        ALTER TABLE phones ADD COLUMN last_purchase_cost REAL;
        ALTER TABLE accessories ADD COLUMN last_purchase_cost REAL;
        "#,
    ),
    (
        "0019_product_serials_images",
        r#"
        ALTER TABLE phones ADD COLUMN serial_number TEXT;
        ALTER TABLE phones ADD COLUMN image_paths TEXT NOT NULL DEFAULT '[]';
        ALTER TABLE accessories ADD COLUMN serial_number TEXT;
        ALTER TABLE accessories ADD COLUMN image_paths TEXT NOT NULL DEFAULT '[]';
        CREATE UNIQUE INDEX IF NOT EXISTS idx_phones_serial_active ON phones(serial_number) WHERE serial_number IS NOT NULL AND serial_number <> '' AND is_deleted = 0;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_accessories_serial_active ON accessories(serial_number) WHERE serial_number IS NOT NULL AND serial_number <> '' AND is_deleted = 0;
        CREATE INDEX IF NOT EXISTS idx_phones_sku ON phones(sku);
        CREATE INDEX IF NOT EXISTS idx_accessories_sku ON accessories(sku);
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
