import { invoke } from "@tauri-apps/api/core";
import type { CreateSaleInput, Sale } from "../types/sale";

export async function createSale(input: CreateSaleInput, actor?: number | null): Promise<Sale> {
  return invoke<Sale>("create_sale", { input, actor: actor ?? null });
}

export async function listSales(search?: string): Promise<Sale[]> {
  return invoke<Sale[]>("list_sales", { search: search ?? null });
}

export async function getSale(id: number): Promise<Sale> {
  return invoke<Sale>("get_sale", { id });
}
