import { invoke } from "@tauri-apps/api/core";
import type {
  CreatePurchaseInput,
  CreateSupplierPaymentInput,
  Purchase,
  SupplierBalance,
  SupplierPayment,
} from "../types/purchase";

export async function createPurchase(
  input: CreatePurchaseInput,
  actor?: number | null,
): Promise<Purchase> {
  return invoke<Purchase>("create_purchase", { input, actor: actor ?? null });
}

export async function listPurchases(search?: string): Promise<Purchase[]> {
  return invoke<Purchase[]>("list_purchases", { search: search ?? null });
}

export async function getPurchase(id: number): Promise<Purchase> {
  return invoke<Purchase>("get_purchase", { id });
}

export async function createSupplierPayment(
  input: CreateSupplierPaymentInput,
  actor?: number | null,
): Promise<SupplierPayment> {
  return invoke<SupplierPayment>("create_supplier_payment", { input, actor: actor ?? null });
}

export async function listSupplierPayments(search?: string): Promise<SupplierPayment[]> {
  return invoke<SupplierPayment[]>("list_supplier_payments", { search: search ?? null });
}

export async function listSupplierPaymentsBySupplier(supplierId: number): Promise<SupplierPayment[]> {
  return invoke<SupplierPayment[]>("list_supplier_payments_by_supplier", { supplierId });
}

export async function deleteSupplierPayment(id: number, actor?: number | null): Promise<void> {
  return invoke<void>("delete_supplier_payment", { id, actor: actor ?? null });
}

export async function getSupplierBalance(supplierId: number): Promise<SupplierBalance> {
  return invoke<SupplierBalance>("get_supplier_balance", { supplierId });
}

export async function listSupplierBalances(search?: string): Promise<SupplierBalance[]> {
  return invoke<SupplierBalance[]>("list_supplier_balances", { search: search ?? null });
}

export async function listSupplierDues(search?: string): Promise<SupplierBalance[]> {
  return invoke<SupplierBalance[]>("list_supplier_dues", { search: search ?? null });
}
