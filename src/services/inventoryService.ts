import { invoke } from "@tauri-apps/api/core";
import type {
  Accessory,
  AddPhoneImeiInput,
  CreateAccessoryInput,
  CreatePhoneInput,
  Phone,
  PhoneImei,
  Product,
} from "../types/inventory";

// ---- Phones ----

export async function createPhone(input: CreatePhoneInput): Promise<Phone> {
  return invoke<Phone>("create_phone", { input });
}

export async function saveProductImage(file: File): Promise<string> {
  const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  return invoke<string>("save_product_image", { bytes, extension });
}

export async function readProductImage(relativePath: string): Promise<string> {
  return invoke<string>("read_product_image", { relativePath });
}

export async function listPhones(search?: string): Promise<Phone[]> {
  return invoke<Phone[]>("list_phones", { search: search ?? null });
}

export async function getPhone(id: number): Promise<Phone> {
  return invoke<Phone>("get_phone", { id });
}

export async function updatePhone(id: number, input: CreatePhoneInput): Promise<Phone> {
  return invoke<Phone>("update_phone", { id, input });
}

export async function deletePhone(id: number, actor?: number | null): Promise<void> {
  return invoke<void>("delete_phone", { id, actor: actor ?? null });
}

export async function restockPhone(
  id: number,
  quantity: number,
  imeis: string[],
  actor?: number | null,
): Promise<void> {
  return invoke<void>("restock_phone", { id, quantity, imeis, actor: actor ?? null });
}

export async function addPhoneImei(input: AddPhoneImeiInput): Promise<PhoneImei> {
  return invoke<PhoneImei>("add_phone_imei", { input });
}

export async function listPhoneImeis(phoneId: number): Promise<PhoneImei[]> {
  return invoke<PhoneImei[]>("list_phone_imeis", { phoneId });
}

// ---- Accessories ----

export async function createAccessory(input: CreateAccessoryInput): Promise<Accessory> {
  return invoke<Accessory>("create_accessory", { input });
}

export async function listAccessories(search?: string): Promise<Accessory[]> {
  return invoke<Accessory[]>("list_accessories", { search: search ?? null });
}

export async function getAccessory(id: number): Promise<Accessory> {
  return invoke<Accessory>("get_accessory", { id });
}

export async function updateAccessory(id: number, input: CreateAccessoryInput): Promise<Accessory> {
  return invoke<Accessory>("update_accessory", { id, input });
}

export async function deleteAccessory(id: number, actor?: number | null): Promise<void> {
  return invoke<void>("delete_accessory", { id, actor: actor ?? null });
}

export async function restockAccessory(
  id: number,
  quantity: number,
  actor?: number | null,
): Promise<void> {
  return invoke<void>("restock_accessory", { id, quantity, actor: actor ?? null });
}

// ---- Unified product list (phones + accessories) for POS / Sales / Purchases ----

function phoneToProduct(p: Phone): Product {
  return {
    item_type: "phone",
    item_id: p.id,
    brand: p.brand,
    model: p.model,
    display_name: `${p.brand} ${p.model}${p.storage ? ` (${p.storage})` : ""}`,
    sale_price: p.sale_price,
    quantity: p.quantity,
    storage: p.storage ?? null,
    color: p.color ?? null,
  };
}

function accessoryToProduct(a: Accessory): Product {
  const display = `${a.brand || ""} ${a.product_name}`.trim();
  return {
    item_type: "accessory",
    item_id: a.id,
    brand: a.brand,
    model: a.product_name,
    display_name: display,
    sale_price: a.sale_price,
    quantity: a.quantity,
    color: a.color ?? null,
  };
}

export async function listProducts(): Promise<Product[]> {
  const [phones, accessories] = await Promise.all([listPhones(), listAccessories()]);
  return [...phones.map(phoneToProduct), ...accessories.map(accessoryToProduct)];
}
