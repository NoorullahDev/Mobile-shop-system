import { invoke } from "@tauri-apps/api/core";
import type { SalaryInput, SalaryRecord, StaffInput, StaffMember } from "../types/staff";

export async function createStaff(input: StaffInput, actor?: number | null): Promise<StaffMember> {
  return invoke<StaffMember>("create_staff_member", { input, actor: actor ?? null });
}

export async function listStaff(search?: string, status?: string): Promise<StaffMember[]> {
  return invoke<StaffMember[]>("list_staff_members", {
    search: search ?? null,
    status: status ?? null,
  });
}

export async function updateStaff(id: number, input: StaffInput, actor?: number | null): Promise<StaffMember> {
  return invoke<StaffMember>("update_staff_member", { id, input, actor: actor ?? null });
}

export async function deleteStaff(id: number, actor?: number | null): Promise<void> {
  return invoke<void>("delete_staff_member", { id, actor: actor ?? null });
}

export async function createSalary(input: SalaryInput, actor?: number | null): Promise<SalaryRecord> {
  return invoke<SalaryRecord>("create_salary_record", { input, actor: actor ?? null });
}

export async function listSalaries(filters?: {
  search?: string;
  month?: string;
  status?: string;
  staff_id?: number | null;
}): Promise<SalaryRecord[]> {
  return invoke<SalaryRecord[]>("list_salary_records", {
    search: filters?.search ?? null,
    month: filters?.month ?? null,
    status: filters?.status ?? null,
    staffId: filters?.staff_id ?? null,
  });
}

export async function updateSalary(id: number, input: SalaryInput, actor?: number | null): Promise<SalaryRecord> {
  return invoke<SalaryRecord>("update_salary_record", { id, input, actor: actor ?? null });
}

export async function deleteSalary(id: number, actor?: number | null): Promise<void> {
  return invoke<void>("delete_salary_record", { id, actor: actor ?? null });
}
