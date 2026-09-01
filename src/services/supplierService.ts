import { invoke } from "@tauri-apps/api/core";
import type { CreateSupplierInput, Supplier } from "../types/inventory";

export async function createSupplier(input: CreateSupplierInput): Promise<Supplier> {
  return invoke<Supplier>("create_supplier", { input });
}

export async function listSuppliers(): Promise<Supplier[]> {
  return invoke<Supplier[]>("list_suppliers");
}

export async function updateSupplier(id: number, input: CreateSupplierInput): Promise<Supplier> {
  return invoke<Supplier>("update_supplier", { id, input });
}

export async function deleteSupplier(id: number, actor?: number | null): Promise<void> {
  return invoke<void>("delete_supplier", { id, actor: actor ?? null });
}
