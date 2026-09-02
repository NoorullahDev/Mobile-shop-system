import { invoke } from "@tauri-apps/api/core";
import type { PhoneOption, CreatePhoneOptionInput } from "../types/inventory";

export async function listPhoneOptions(option_type?: string): Promise<PhoneOption[]> {
  return await invoke("list_phone_options", { optionType: option_type });
}

export async function createPhoneOption(
  input: CreatePhoneOptionInput,
  actor?: number | null
): Promise<PhoneOption> {
  return await invoke("create_phone_option", { input, actor });
}

export async function updatePhoneOption(
  id: number,
  input: CreatePhoneOptionInput,
  actor?: number | null
): Promise<PhoneOption> {
  return await invoke("update_phone_option", { id, input, actor });
}

export async function deletePhoneOption(
  id: number,
  actor?: number | null
): Promise<void> {
  return await invoke("delete_phone_option", { id, actor });
}
