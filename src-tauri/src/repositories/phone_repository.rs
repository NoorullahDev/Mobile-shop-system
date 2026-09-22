use rusqlite::{params, Connection, OptionalExtension};

use crate::errors::AppError;
use crate::models::phone::{AddPhoneImeiInput, ColorCount, CreatePhoneInput, Phone, PhoneImei};

fn phone_from_row(r: &rusqlite::Row) -> rusqlite::Result<Phone> {
    Ok(Phone {
        id: r.get("id")?,
        brand: r.get("brand")?,
        model: r.get("model")?,
        color: r.get("color")?,
        storage: r.get("storage")?,
        ram: r.get("ram")?,
        processor: r.get("processor")?,
        chipset: r.get("chipset")?,
        network_type: r.get("network_type")?,
        battery_capacity: r.get("battery_capacity")?,
        imei: r.get("imei")?,
        imei2: r.get("imei2")?,
        serial_number: r.get("serial_number")?,
        image_paths: serde_json::from_str(&r.get::<_, String>("image_paths")?).unwrap_or_default(),
        category: r.get("category")?,
        condition: r.get("condition")?,
        variant: r.get("variant")?,
        sku: r.get("sku")?,
        condition_rating: r.get("condition_rating")?,
        body_condition: r.get("body_condition")?,
        screen_condition: r.get("screen_condition")?,
        battery_health: r.get("battery_health")?,
        pta_status: r.get("pta_status")?,
        battery_health_pct: r.get("battery_health_pct")?,
        camera_condition: r.get("camera_condition")?,
        face_id: r.get("face_id")?,
        speaker: r.get("speaker")?,
        charger: r.get("charger")?,
        box_condition: r.get("box_condition")?,
        warranty: r.get("warranty")?,
        condition_notes: r.get("condition_notes")?,
        cost_price: r.get("cost_price")?,
        sale_price: r.get("sale_price")?,
        quantity: r.get("quantity")?,
        supplier_id: r.get("supplier_id")?,
        supplier_name: r.get::<_, Option<String>>("supplier_name")?,
        low_stock_threshold: r.get("low_stock_threshold")?,
        is_deleted: r.get::<_, i64>("is_deleted")? != 0,
        created_at: r.get("created_at")?,
        updated_at: r.get("updated_at")?,
        stock_by_color: Vec::new(),
    })
}

fn imei_from_row(r: &rusqlite::Row) -> rusqlite::Result<PhoneImei> {
    Ok(PhoneImei {
        id: r.get("id")?,
        phone_id: r.get("phone_id")?,
        imei: r.get("imei")?,
        imei2: r.get("imei2")?,
        status: r.get("status")?,
        color: r.get("color")?,
        pta_status: r.get("pta_status")?,
        storage: r.get("storage")?,
        battery_health_pct: r.get("battery_health_pct")?,
        cost_price: r.get("cost_price")?,
        sale_price: r.get("sale_price")?,
        sold_at: r.get("sold_at")?,
        created_at: r.get("created_at")?,
    })
}

const COLS: &str = "p.id, p.brand, p.model, p.color, p.storage, p.ram, p.processor, \
     p.chipset, p.network_type, p.battery_capacity, p.imei, p.imei2, p.serial_number, p.image_paths, p.category, p.condition, p.variant, p.sku, \
     p.condition_rating, p.body_condition, p.screen_condition, p.battery_health, p.pta_status, p.battery_health_pct, p.camera_condition, p.face_id, p.speaker, p.charger, p.box_condition, p.warranty, p.condition_notes, \
     p.cost_price, p.sale_price, \
     p.quantity, p.supplier_id, s.name AS supplier_name, p.low_stock_threshold, p.is_deleted, \
     p.created_at, p.updated_at";

pub fn insert(conn: &Connection, input: &CreatePhoneInput) -> Result<i64, AppError> {
    conn.execute(
        "INSERT INTO phones (brand, model, color, storage, ram, processor, chipset, network_type, battery_capacity, imei, imei2, serial_number, image_paths, category, condition, variant, sku, condition_rating, body_condition, screen_condition, battery_health, pta_status, battery_health_pct, camera_condition, face_id, speaker, charger, box_condition, warranty, condition_notes, cost_price, sale_price, quantity, supplier_id, low_stock_threshold)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28, ?29, ?30, ?31, ?32, ?33, ?34, ?35)",
        params![
            input.brand, input.model, input.color, input.storage, input.ram, input.processor,
            input.chipset, input.network_type, input.battery_capacity, input.imei, input.imei2, input.serial_number, serde_json::to_string(&input.image_paths).unwrap_or_else(|_| "[]".into()), input.category,
            input.condition, input.variant, input.sku,
            input.condition_rating, input.body_condition, input.screen_condition, input.battery_health,
            input.pta_status, input.battery_health_pct,
            input.camera_condition, input.face_id, input.speaker, input.charger, input.box_condition,
            input.warranty, input.condition_notes,
            input.cost_price, input.sale_price, input.quantity, input.supplier_id,
            input.low_stock_threshold
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn get_by_id(conn: &Connection, id: i64) -> Result<Option<Phone>, AppError> {
    let sql = format!(
        "SELECT {COLS} FROM phones p LEFT JOIN suppliers s ON s.id = p.supplier_id \
         WHERE p.id = ?1 AND p.is_deleted = 0"
    );
    let row = conn.query_row(&sql, [id], phone_from_row).optional()?;
    if let Some(mut phone) = row {
        phone.stock_by_color = stock_by_color(conn, id)?;
        return Ok(Some(phone));
    }
    Ok(None)
}

pub fn list(conn: &Connection, search: Option<&str>) -> Result<Vec<Phone>, AppError> {
    let base = format!(
        "SELECT {COLS} FROM phones p LEFT JOIN suppliers s ON s.id = p.supplier_id \
         WHERE p.is_deleted = 0"
    );
    let mut clauses: Vec<String> = Vec::new();
    let mut values: Vec<String> = Vec::new();
    if let Some(s) = search {
        let s = s.trim();
        if !s.is_empty() {
            let p = format!("%{s}%");
            clauses.push(format!(
                "(p.brand LIKE ?{0} OR p.model LIKE ?{0} OR p.imei LIKE ?{0} OR p.imei2 LIKE ?{0} OR p.serial_number LIKE ?{0} OR p.sku LIKE ?{0} OR EXISTS (SELECT 1 FROM phone_imeis pi WHERE pi.phone_id=p.id AND (pi.imei LIKE ?{0} OR pi.imei2 LIKE ?{0})))",
                values.len() + 1,
            ));
            values.push(p);
        }
    }
    let sql = if clauses.is_empty() {
        format!("{base} ORDER BY p.brand, p.model LIMIT 1000")
    } else {
        format!(
            "{base} AND {} ORDER BY p.brand, p.model LIMIT 1000",
            clauses.join(" AND ")
        )
    };
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(
        rusqlite::params_from_iter(values.iter().map(|v| v.as_str())),
        phone_from_row,
    )?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    let colors = stock_by_color_map(conn, &out.iter().map(|p| p.id).collect::<Vec<_>>())?;
    for phone in out.iter_mut() {
        if let Some(cc) = colors.get(&phone.id) {
            phone.stock_by_color = cc.clone();
        }
    }
    Ok(out)
}

pub fn update(conn: &Connection, id: i64, input: &CreatePhoneInput) -> Result<bool, AppError> {
    let affected = conn.execute(
        "UPDATE phones SET brand=?1, model=?2, color=?3, storage=?4, ram=?5, processor=?6, chipset=?7, network_type=?8, battery_capacity=?9, imei=?10, imei2=?11, serial_number=?12, image_paths=?13, category=?14, condition=?15, variant=?16, sku=?17,
         condition_rating=?18, body_condition=?19, screen_condition=?20, battery_health=?21, pta_status=?22, battery_health_pct=?23, camera_condition=?24, face_id=?25, speaker=?26, charger=?27, box_condition=?28, warranty=?29, condition_notes=?30,
         cost_price=?31, sale_price=?32, quantity=?33, supplier_id=?34, low_stock_threshold=?35, updated_at=CURRENT_TIMESTAMP
         WHERE id=?36 AND is_deleted=0",
        params![
            input.brand, input.model, input.color, input.storage, input.ram, input.processor,
            input.chipset, input.network_type, input.battery_capacity, input.imei, input.imei2, input.serial_number, serde_json::to_string(&input.image_paths).unwrap_or_else(|_| "[]".into()), input.category,
            input.condition, input.variant, input.sku,
            input.condition_rating, input.body_condition, input.screen_condition, input.battery_health,
            input.pta_status, input.battery_health_pct,
            input.camera_condition, input.face_id, input.speaker, input.charger, input.box_condition,
            input.warranty, input.condition_notes,
            input.cost_price, input.sale_price, input.quantity, input.supplier_id,
            input.low_stock_threshold, id
        ],
    )?;
    Ok(affected > 0)
}

pub fn serial_taken(
    conn: &Connection,
    serial: &str,
    exclude_id: Option<i64>,
) -> Result<bool, AppError> {
    let sql = if exclude_id.is_some() {
        "SELECT 1 FROM phones WHERE serial_number=?1 AND id!=?2 AND is_deleted=0"
    } else {
        "SELECT 1 FROM phones WHERE serial_number=?1 AND is_deleted=0"
    };
    let found = if let Some(id) = exclude_id {
        conn.query_row(sql, params![serial, id], |_| Ok(true))
            .optional()?
    } else {
        conn.query_row(sql, [serial], |_| Ok(true)).optional()?
    };
    Ok(found.is_some())
}

pub fn imei_taken(
    conn: &Connection,
    imei: &str,
    exclude_id: Option<i64>,
) -> Result<bool, AppError> {
    let exists: Option<bool> = match exclude_id {
        Some(id) => conn
            .query_row(
                "SELECT 1 WHERE
                   EXISTS (SELECT 1 FROM phones WHERE (imei = ?1 OR imei2 = ?1) AND id != ?2 AND is_deleted = 0)
                   OR EXISTS (SELECT 1 FROM phone_imeis WHERE imei = ?1 OR imei2 = ?1)",
                params![imei, id],
                |_| Ok(true),
            )
            .optional()?,
        None => conn
            .query_row(
                "SELECT 1 WHERE
                   EXISTS (SELECT 1 FROM phones WHERE (imei = ?1 OR imei2 = ?1) AND is_deleted = 0)
                   OR EXISTS (SELECT 1 FROM phone_imeis WHERE imei = ?1 OR imei2 = ?1)",
                [imei],
                |_| Ok(true),
            )
            .optional()?,
    };
    Ok(exists.is_some())
}

pub fn soft_delete(conn: &Connection, id: i64) -> Result<bool, AppError> {
    let affected = conn.execute(
        "UPDATE phones SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?1 AND is_deleted = 0",
        [id],
    )?;
    Ok(affected > 0)
}

pub fn add_quantity(conn: &Connection, id: i64, amount: i64) -> Result<bool, AppError> {
    let affected = conn.execute(
        "UPDATE phones SET quantity = quantity + ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2 AND is_deleted = 0",
        params![amount, id],
    )?;
    Ok(affected > 0)
}

// ---- Phone IMEI ----

pub fn imei_exists(conn: &Connection, imei: &str) -> Result<bool, AppError> {
    let exists: Option<bool> = conn
        .query_row(
            "SELECT 1 WHERE EXISTS (SELECT 1 FROM phone_imeis WHERE imei = ?1 OR imei2 = ?1)
               OR EXISTS (SELECT 1 FROM phones WHERE (imei = ?1 OR imei2 = ?1) AND is_deleted = 0)",
            [imei],
            |_| Ok(true),
        )
        .optional()?;
    Ok(exists.is_some())
}

pub fn insert_imei(conn: &Connection, input: &AddPhoneImeiInput) -> Result<i64, AppError> {
    conn.execute(
        "INSERT INTO phone_imeis (phone_id, imei, imei2, color, pta_status, storage, battery_health_pct, cost_price, sale_price)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7,
                 (SELECT cost_price FROM phones WHERE id = ?1),
                 (SELECT sale_price FROM phones WHERE id = ?1))",
        params![input.phone_id, input.imei, input.imei2, input.color, input.pta_status, input.storage, input.battery_health_pct],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn list_imei(conn: &Connection, phone_id: i64) -> Result<Vec<PhoneImei>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, phone_id, imei, imei2, status, color, pta_status, storage, battery_health_pct,
                cost_price, sale_price, sold_at, created_at
         FROM phone_imeis WHERE phone_id = ?1 ORDER BY id",
    )?;
    let rows = stmt.query_map([phone_id], imei_from_row)?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

/// In-stock units grouped by colour for a single phone.
pub fn stock_by_color(conn: &Connection, phone_id: i64) -> Result<Vec<ColorCount>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT color, COUNT(*) AS count FROM phone_imeis
         WHERE phone_id = ?1 AND status = 'in_stock'
         GROUP BY color ORDER BY color",
    )?;
    let rows = stmt.query_map([phone_id], |r| {
        Ok(ColorCount {
            color: r.get("color")?,
            count: r.get("count")?,
        })
    })?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

/// In-stock units grouped by colour for many phones at once, to avoid the
/// N+1 pattern when loading a phone list. The map only contains phones that
/// actually have in-stock IMEI units.
pub fn stock_by_color_map(
    conn: &Connection,
    phone_ids: &[i64],
) -> Result<std::collections::HashMap<i64, Vec<ColorCount>>, AppError> {
    let mut map: std::collections::HashMap<i64, Vec<ColorCount>> = std::collections::HashMap::new();
    if phone_ids.is_empty() {
        return Ok(map);
    }
    const BATCH: usize = 400;
    for ids in phone_ids.chunks(BATCH) {
        let placeholders = vec!["?"; ids.len()].join(",");
        let sql = format!(
            "SELECT phone_id, color, COUNT(*) AS count FROM phone_imeis
             WHERE phone_id IN ({placeholders}) AND status = 'in_stock'
             GROUP BY phone_id, color ORDER BY color"
        );
        let mut stmt = conn.prepare(&sql)?;
        let rows = stmt.query_map(rusqlite::params_from_iter(ids.iter()), |r| {
            Ok((
                r.get::<_, i64>("phone_id")?,
                ColorCount {
                    color: r.get("color")?,
                    count: r.get("count")?,
                },
            ))
        })?;
        for r in rows {
            let (phone_id, cc) = r?;
            map.entry(phone_id).or_default().push(cc);
        }
    }
    Ok(map)
}
