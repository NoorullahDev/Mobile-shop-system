import { invoke } from "@tauri-apps/api/core";
import type { CreatePaymentInput, MemberBalance, Payment } from "../types/payment";

export async function createPayment(
  input: CreatePaymentInput,
  actor?: number | null,
): Promise<Payment> {
  return invoke<Payment>("create_payment", { input, actor: actor ?? null });
}

export async function listPayments(search?: string): Promise<Payment[]> {
  return invoke<Payment[]>("list_payments", { search: search ?? null });
}

export async function listMemberPayments(memberId: number): Promise<Payment[]> {
  return invoke<Payment[]>("list_member_payments", { memberId });
}

export async function getPayment(id: number): Promise<Payment> {
  return invoke<Payment>("get_payment", { id });
}

export async function deletePayment(id: number, actor?: number | null): Promise<void> {
  return invoke<void>("delete_payment", { id, actor: actor ?? null });
}

export async function getMemberBalance(memberId: number): Promise<MemberBalance> {
  return invoke<MemberBalance>("get_member_balance", { memberId });
}

export async function listMemberBalances(search?: string): Promise<MemberBalance[]> {
  return invoke<MemberBalance[]>("list_member_balances", { search: search ?? null });
}

export async function listCustomerDues(search?: string): Promise<MemberBalance[]> {
  return invoke<MemberBalance[]>("list_customer_dues", { search: search ?? null });
}
