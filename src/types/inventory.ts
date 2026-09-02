export interface Supplier {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  is_deleted: boolean;
  created_at: string;
}

export interface CreateSupplierInput {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

// ===========================================================================
// Dynamic product categories (phones & accessories)
// Stored in the database and managed by the Owner/Admin. The former
// hard-coded ACCESSORY_TYPES list was removed in favour of these rows.
// ===========================================================================

export interface ProductCategory {
  id: number;
  name: string;
  created_at: string;
}

export interface CreateProductCategoryInput {
  name: string;
}

// ===========================================================================
// Mobile Phones
// ===========================================================================

export interface Phone {
  id: number;
  brand: string;
  model: string;
  color?: string | null;
  storage?: string | null;
  ram?: string | null;
  processor?: string | null;
  chipset?: string | null;
  network_type?: string | null;
  battery_capacity?: string | null;
  imei?: string | null;
  imei2?: string | null;
  category?: string | null;
  condition?: string | null;
  variant?: string | null;
  sku?: string | null;
  condition_rating?: string | null;
  body_condition?: string | null;
  screen_condition?: string | null;
  battery_health?: string | null;
  camera_condition?: string | null;
  face_id?: string | null;
  speaker?: string | null;
  charger?: string | null;
  box_condition?: string | null;
  condition_notes?: string | null;
  cost_price: number;
  sale_price: number;
  quantity: number;
  supplier_id?: number | null;
  supplier_name?: string | null;
  low_stock_threshold: number;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreatePhoneInput {
  brand: string;
  model: string;
  color?: string | null;
  storage?: string | null;
  ram?: string | null;
  processor?: string | null;
  chipset?: string | null;
  network_type?: string | null;
  battery_capacity?: string | null;
  imei?: string | null;
  imei2?: string | null;
  category?: string | null;
  condition?: string | null;
  variant?: string | null;
  sku?: string | null;
  condition_rating?: string | null;
  body_condition?: string | null;
  screen_condition?: string | null;
  battery_health?: string | null;
  camera_condition?: string | null;
  face_id?: string | null;
  speaker?: string | null;
  charger?: string | null;
  box_condition?: string | null;
  condition_notes?: string | null;
  cost_price: number;
  sale_price: number;
  quantity: number;
  supplier_id?: number | null;
  low_stock_threshold: number;
}

export interface PhoneImei {
  id: number;
  phone_id: number;
  imei: string;
  status: string;
  sold_at?: string | null;
  created_at: string;
}

export interface AddPhoneImeiInput {
  phone_id: number;
  imei: string;
}

// ===========================================================================
// Accessories
// ===========================================================================

export interface Accessory {
  id: number;
  accessory_type: string;
  brand: string;
  product_name: string;
  compatible_models?: string | null;
  color?: string | null;
  cost_price: number;
  sale_price: number;
  quantity: number;
  supplier_id?: number | null;
  supplier_name?: string | null;
  low_stock_threshold: number;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateAccessoryInput {
  accessory_type: string;
  brand: string;
  product_name: string;
  compatible_models?: string | null;
  color?: string | null;
  cost_price: number;
  sale_price: number;
  quantity: number;
  supplier_id?: number | null;
  low_stock_threshold: number;
}

// ===========================================================================
// Phone Options (Dynamic Dropdowns)
// ===========================================================================

export interface PhoneOption {
  id: number;
  option_type: string;
  value: string;
  sort_order: number;
  created_at: string;
}

export interface CreatePhoneOptionInput {
  option_type: string;
  value: string;
  sort_order?: number;
}

// ===========================================================================
// Shared constants
// ===========================================================================

export const IMEI_STATUS = {
  IN_STOCK: "in_stock",
  SOLD: "sold",
} as const;

// ===========================================================================
// Unified product view (used by POS / Sales / Purchases where both phone and
// accessory stock are selectable within a single list).
// ===========================================================================

export type ItemType = "phone" | "accessory";

export interface Product {
  item_type: ItemType;
  item_id: number;
  brand: string;
  model: string;
  display_name: string;
  sale_price: number;
  quantity: number;
  storage?: string | null;
  color?: string | null;
  imei?: string | null;
}
