import { invoke } from "@tauri-apps/api/core";
import type { CreateReturnInput, ProductReturn, ReturnSummary } from "../types/return";

export async function createReturn(
  input: CreateReturnInput,
  actor?: number | null,
): Promise<ProductReturn> {
  return invoke<ProductReturn>("create_return", { input, actor: actor ?? null });
}

export async function listReturns(search?: string): Promise<ReturnSummary[]> {
  return invoke<ReturnSummary[]>("list_returns", { search: search ?? null });
}

export async function getReturn(id: number): Promise<ProductReturn> {
  return invoke<ProductReturn>("get_return", { id });
}