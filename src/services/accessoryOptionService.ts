import { invoke } from "@tauri-apps/api/core";
import type { PhoneOption, CreatePhoneOptionInput } from "../types/inventory";

export async function listAccessoryOptions(option_type?: string): Promise<PhoneOption[]> {
  return await invoke("list_accessory_options", { optionType: option_type });
}

export async function createAccessoryOption(
  input: CreatePhoneOptionInput,
  actor?: number | null
): Promise<PhoneOption> {
  return await invoke("create_accessory_option", { input, actor });
}

export async function updateAccessoryOption(
  id: number,
  input: CreatePhoneOptionInput,
  actor?: number | null
): Promise<PhoneOption> {
  return await invoke("update_accessory_option", { id, input, actor });
}

export async function deleteAccessoryOption(
  id: number,
  actor?: number | null
): Promise<void> {
  return await invoke("delete_accessory_option", { id, actor });
}
