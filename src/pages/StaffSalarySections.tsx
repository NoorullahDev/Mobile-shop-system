import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Banknote, BriefcaseBusiness, CalendarClock, Pencil, Plus, Trash2, Users } from "lucide-react";
import { Alert } from "../components/Alert";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { EmptyState } from "../components/EmptyState";
import { Input } from "../components/Input";
import { Modal } from "../components/Modal";
import { Select } from "../components/Select";
import { Spinner } from "../components/Button";
import { StatusBadge } from "../components/StatusBadge";
import { useToast } from "../components/Toaster";
import { formatDate, formatMoneyCompact } from "../lib/format";
import * as staffService from "../services/staffService";
import type { SalaryInput, SalaryRecord, StaffInput, StaffMember } from "../types/staff";
import type { UserDetail } from "../types/user";

const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);
const money = (value: string) => Number(value || 0);

function formatMonth(month: string) {
  const d = new Date(`${month}-01T00:00:00`);
  if (Number.isNaN(d.getTime())) return month;
  return d.toLocaleDateString("en-PK", { month: "long", year: "numeric" });
}

export function StaffSection({ users, actor }: { users: UserDetail[]; actor: number | null }) {
  const { toast } = useToast();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [deleting, setDeleting] = useState<StaffMember | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setStaff(await staffService.listStaff(search, status));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [search, status]);

  const handleDelete = async () => {
    if (!deleting) return;
    await staffService.deleteStaff(deleting.id, actor);
    toast("Staff member removed", { title: "Deleted" });
    setDeleting(null);
    load();
  };

  return (
    <>
      {error && <div className="mb-4"><Alert variant="error" message={error} /></div>}
      <Card
        title={`Staff (${staff.length})`}
        subtitle="Staff records are separate from login users. Link a user account only when needed."
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search staff..." className="w-52" />
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={[
                { value: "", label: "All Statuses" },
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ]}
              className="w-40"
            />
            <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => { setEditing(null); setModal("create"); }}>
              Add Staff
            </Button>
          </div>
        }
        noPadding
      >
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16" style={{ color: "#64748B" }}>
            <Spinner className="h-5 w-5" />
            <span className="text-[13px]">Loading staff...</span>
          </div>
        ) : staff.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={Users} title="No staff found" description="Add staff to track employment and salary history." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>Position</th>
                  <th>Joining Date</th>
                  <th className="text-right">Monthly Salary</th>
                  <th>Status</th>
                  <th>Linked User</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div className="font-medium" style={{ color: "#0F172A" }}>{s.name}</div>
                      <div className="text-[12px]" style={{ color: "#64748B" }}>{s.phone}</div>
                    </td>
                    <td>{s.position}</td>
                    <td style={{ color: "#64748B", fontSize: "12px" }}>{formatDate(s.joining_date)}</td>
                    <td className="text-right amount font-semibold">{formatMoneyCompact(s.monthly_salary)}</td>
                    <td><StatusBadge status={s.status} /></td>
                    <td style={{ color: "#64748B", fontSize: "12px" }}>{s.username ?? "Not linked"}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <IconButton title="Edit staff" onClick={() => { setEditing(s); setModal("edit"); }}><Pencil className="h-3.5 w-3.5" /></IconButton>
                        <IconButton title="Delete staff" danger onClick={() => setDeleting(s)}><Trash2 className="h-3.5 w-3.5" /></IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <StaffModal
        open={!!modal}
        mode={modal ?? "create"}
        staff={editing}
        users={users}
        actor={actor}
        onClose={() => setModal(null)}
        onSaved={() => { setModal(null); load(); }}
      />
      <Modal
        open={!!deleting}
        title="Delete Staff"
        onClose={() => setDeleting(null)}
        size="sm"
        footer={<><Button variant="secondary" size="sm" onClick={() => setDeleting(null)}>Cancel</Button><Button variant="danger" size="sm" onClick={handleDelete}>Delete</Button></>}
      >
        <Alert variant="warning" message={`Delete ${deleting?.name ?? "this staff member"}? Existing salary records remain in history.`} />
      </Modal>
    </>
  );
}

export function SalarySection({ actor }: { actor: number | null }) {
  const { toast } = useToast();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [salaries, setSalaries] = useState<SalaryRecord[]>([]);
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState("");
  const [status, setStatus] = useState("");
  const [staffId, setStaffId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<SalaryRecord | null>(null);
  const [deleting, setDeleting] = useState<SalaryRecord | null>(null);

  const loadStaff = async () => setStaff(await staffService.listStaff("", ""));
  const loadSalaries = async () => {
    setLoading(true);
    setError(null);
    try {
      setSalaries(await staffService.listSalaries({
        search,
        month,
        status,
        staff_id: staffId ? Number(staffId) : null,
      }));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStaff(); }, []);
  useEffect(() => { loadSalaries(); }, [search, month, status, staffId]);

  const totals = useMemo(() => salaries.reduce(
    (acc, s) => ({
      net: acc.net + s.net_salary,
      paid: acc.paid + s.amount_paid,
      remaining: acc.remaining + s.remaining_balance,
    }),
    { net: 0, paid: 0, remaining: 0 },
  ), [salaries]);

  const handleDelete = async () => {
    if (!deleting) return;
    await staffService.deleteSalary(deleting.id, actor);
    toast("Salary record removed and related expense reversed", { title: "Deleted" });
    setDeleting(null);
    loadSalaries();
  };

  return (
    <>
      {error && <div className="mb-4"><Alert variant="error" message={error} /></div>}
      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <Summary label="Net Salary" value={totals.net} />
        <Summary label="Amount Paid" value={totals.paid} />
        <Summary label="Remaining" value={totals.remaining} danger />
      </div>
      <Card
        title={`Salary History (${salaries.length})`}
        subtitle="Paid salary is synced to business expenses and Profit & Loss."
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search salary..." className="w-48" />
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" />
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-36" options={[
              { value: "", label: "All" },
              { value: "Paid", label: "Paid" },
              { value: "Partial", label: "Partial" },
              { value: "Unpaid", label: "Unpaid" },
            ]} />
            <Select value={staffId} onChange={(e) => setStaffId(e.target.value)} className="w-44" options={[
              { value: "", label: "All Staff" },
              ...staff.map((s) => ({ value: String(s.id), label: s.name })),
            ]} />
            <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => { setEditing(null); setModal("create"); }}>
              Record Salary
            </Button>
          </div>
        }
        noPadding
      >
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16" style={{ color: "#64748B" }}>
            <Spinner className="h-5 w-5" />
            <span className="text-[13px]">Loading salary history...</span>
          </div>
        ) : salaries.length === 0 ? (
          <div className="p-6"><EmptyState icon={Banknote} title="No salary records" description="Record monthly salaries to build staff history." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Staff / Month</th>
                  <th className="text-right">Base</th>
                  <th className="text-right">Bonus</th>
                  <th className="text-right">Deduction</th>
                  <th className="text-right">Net</th>
                  <th className="text-right">Paid</th>
                  <th className="text-right">Balance</th>
                  <th>Status</th>
                  <th>Paid On</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {salaries.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div className="font-medium">{s.staff_name}</div>
                      <div className="text-[12px]" style={{ color: "#64748B" }}>{formatMonth(s.salary_month)}</div>
                    </td>
                    <td className="text-right amount">{formatMoneyCompact(s.base_salary)}</td>
                    <td className="text-right amount">{formatMoneyCompact(s.bonus)}</td>
                    <td className="text-right amount">{formatMoneyCompact(s.deduction)}</td>
                    <td className="text-right amount font-semibold">{formatMoneyCompact(s.net_salary)}</td>
                    <td className="text-right amount" style={{ color: "#15803D" }}>{formatMoneyCompact(s.amount_paid)}</td>
                    <td className="text-right amount" style={{ color: s.remaining_balance > 0 ? "#B91C1C" : "#64748B" }}>{formatMoneyCompact(s.remaining_balance)}</td>
                    <td><StatusBadge status={s.payment_status} /></td>
                    <td style={{ color: "#64748B", fontSize: "12px" }}>
                      {s.payment_date ? `${formatDate(s.payment_date)}${s.payment_time ? `, ${s.payment_time}` : ""}` : "Not paid"}
                      {s.payment_method ? <div>{s.payment_method}</div> : null}
                    </td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <IconButton title="Edit salary" onClick={() => { setEditing(s); setModal("edit"); }}><Pencil className="h-3.5 w-3.5" /></IconButton>
                        <IconButton title="Delete salary" danger onClick={() => setDeleting(s)}><Trash2 className="h-3.5 w-3.5" /></IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <SalaryModal
        open={!!modal}
        mode={modal ?? "create"}
        salary={editing}
        staff={staff}
        actor={actor}
        onClose={() => setModal(null)}
        onSaved={() => { setModal(null); loadSalaries(); loadStaff(); }}
      />
      <Modal
        open={!!deleting}
        title="Delete Salary"
        onClose={() => setDeleting(null)}
        size="sm"
        footer={<><Button variant="secondary" size="sm" onClick={() => setDeleting(null)}>Cancel</Button><Button variant="danger" size="sm" onClick={handleDelete}>Delete</Button></>}
      >
        <Alert variant="warning" message="Delete this salary record? Any linked salary expense will be removed from Profit & Loss." />
      </Modal>
    </>
  );
}

function StaffModal({ open, mode, staff, users, actor, onClose, onSaved }: {
  open: boolean;
  mode: "create" | "edit";
  staff: StaffMember | null;
  users: UserDetail[];
  actor: number | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    user_id: "",
    name: "",
    phone: "",
    position: "",
    joining_date: today(),
    monthly_salary: "",
    status: "active",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm({
      user_id: staff?.user_id ? String(staff.user_id) : "",
      name: staff?.name ?? "",
      phone: staff?.phone ?? "",
      position: staff?.position ?? "",
      joining_date: staff?.joining_date ?? today(),
      monthly_salary: staff ? String(staff.monthly_salary) : "",
      status: staff?.status ?? "active",
      notes: staff?.notes ?? "",
    });
  }, [open, staff]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const input: StaffInput = {
        user_id: form.user_id ? Number(form.user_id) : null,
        name: form.name,
        phone: form.phone,
        position: form.position,
        joining_date: form.joining_date,
        monthly_salary: money(form.monthly_salary),
        status: form.status,
        notes: form.notes || null,
      };
      if (mode === "edit" && staff) await staffService.updateStaff(staff.id, input, actor);
      else await staffService.createStaff(input, actor);
      toast(mode === "edit" ? "Staff updated" : "Staff created", { title: "Success" });
      onSaved();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={mode === "edit" ? "Edit Staff" : "Add Staff"}
      subtitle="Staff records do not create login access by themselves"
      onClose={onClose}
      size="lg"
      footer={<><Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" loading={saving} onClick={save}>Save Staff</Button></>}
    >
      <div className="flex flex-col gap-4">
        {error && <Alert variant="error" message={error} />}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Staff Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Phone Number" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label="Position / Role" required value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
          <Input label="Joining Date" type="date" required value={form.joining_date} onChange={(e) => setForm({ ...form, joining_date: e.target.value })} />
          <Input label="Monthly Salary" type="number" min="0" step="0.01" required prefix="Rs." value={form.monthly_salary} onChange={(e) => setForm({ ...form, monthly_salary: e.target.value })} />
          <Select label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={[
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
          ]} />
          <Select
            label="Optional User Account"
            value={form.user_id}
            onChange={(e) => setForm({ ...form, user_id: e.target.value })}
            options={[
              { value: "", label: "Not linked" },
              ...users.map((u) => ({ value: String(u.id), label: `${u.username}${u.full_name ? ` - ${u.full_name}` : ""}` })),
            ]}
          />
        </div>
        <TextArea label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
      </div>
    </Modal>
  );
}

function SalaryModal({ open, mode, salary, staff, actor, onClose, onSaved }: {
  open: boolean;
  mode: "create" | "edit";
  salary: SalaryRecord | null;
  staff: StaffMember[];
  actor: number | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    staff_id: "",
    salary_month: thisMonth(),
    base_salary: "",
    bonus: "",
    deduction: "",
    amount_paid: "",
    payment_date: today(),
    payment_time: "",
    payment_method: "Cash",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const selectedStaff = staff[0];
    setError(null);
    setForm({
      staff_id: salary ? String(salary.staff_id) : selectedStaff ? String(selectedStaff.id) : "",
      salary_month: salary?.salary_month ?? thisMonth(),
      base_salary: salary ? String(salary.base_salary) : selectedStaff ? String(selectedStaff.monthly_salary) : "",
      bonus: salary?.bonus ? String(salary.bonus) : "",
      deduction: salary?.deduction ? String(salary.deduction) : "",
      amount_paid: salary ? String(salary.amount_paid) : "0",
      payment_date: salary?.payment_date ?? today(),
      payment_time: salary?.payment_time ?? "",
      payment_method: salary?.payment_method ?? "Cash",
      notes: salary?.notes ?? "",
    });
  }, [open, salary, staff]);

  const staffOptions = staff.map((s) => ({ value: String(s.id), label: `${s.name} - ${formatMoneyCompact(s.monthly_salary)}` }));
  const selectedStaff = staff.find((s) => String(s.id) === form.staff_id);
  const base = money(form.base_salary);
  const bonus = money(form.bonus);
  const deduction = money(form.deduction);
  const paid = money(form.amount_paid);
  const net = base + bonus - deduction;
  const remaining = Math.max(net - paid, 0);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const input: SalaryInput = {
        staff_id: Number(form.staff_id),
        salary_month: form.salary_month,
        base_salary: base,
        bonus,
        deduction,
        amount_paid: paid,
        payment_date: paid > 0 ? form.payment_date : null,
        payment_time: paid > 0 ? form.payment_time || null : null,
        payment_method: paid > 0 ? form.payment_method : null,
        notes: form.notes || null,
      };
      if (mode === "edit" && salary) await staffService.updateSalary(salary.id, input, actor);
      else await staffService.createSalary(input, actor);
      toast(mode === "edit" ? "Salary updated" : "Salary recorded", { title: "Success" });
      onSaved();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={mode === "edit" ? "Edit Salary" : "Record Salary"}
      subtitle="Amount paid is posted once to Expenses and kept in sync when edited"
      onClose={onClose}
      size="xl"
      footer={<><Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" loading={saving} onClick={save}>Save Salary</Button></>}
    >
      <div className="flex flex-col gap-4">
        {error && <Alert variant="error" message={error} />}
        {staff.length === 0 && <Alert variant="warning" message="Add a staff member before recording salary." />}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label="Staff Member" required value={form.staff_id} onChange={(e) => {
            const next = staff.find((s) => String(s.id) === e.target.value);
            setForm({ ...form, staff_id: e.target.value, base_salary: next ? String(next.monthly_salary) : form.base_salary });
          }} options={staffOptions} placeholder="Select staff..." />
          <Input label="Salary Month" type="month" required value={form.salary_month} onChange={(e) => setForm({ ...form, salary_month: e.target.value })} />
          <Input label="Base Salary" type="number" min="0" step="0.01" required prefix="Rs." value={form.base_salary} onChange={(e) => setForm({ ...form, base_salary: e.target.value })} />
          <Input label="Bonus" type="number" min="0" step="0.01" prefix="Rs." value={form.bonus} onChange={(e) => setForm({ ...form, bonus: e.target.value })} />
          <Input label="Deduction" type="number" min="0" step="0.01" prefix="Rs." value={form.deduction} onChange={(e) => setForm({ ...form, deduction: e.target.value })} />
          <Input label="Amount Paid" type="number" min="0" step="0.01" prefix="Rs." value={form.amount_paid} onChange={(e) => setForm({ ...form, amount_paid: e.target.value })} />
          <Input label="Payment Date" type="date" value={form.payment_date} onChange={(e) => setForm({ ...form, payment_date: e.target.value })} />
          <Input label="Payment Time" type="time" value={form.payment_time} onChange={(e) => setForm({ ...form, payment_time: e.target.value })} />
          <Select label="Payment Method" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} options={[
            { value: "Cash", label: "Cash" },
            { value: "Bank Transfer", label: "Bank Transfer" },
            { value: "JazzCash", label: "JazzCash" },
            { value: "EasyPaisa", label: "EasyPaisa" },
            { value: "Cheque", label: "Cheque" },
          ]} />
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Summary label="Net Salary" value={net} />
          <Summary label="Paid" value={paid} />
          <Summary label="Remaining" value={remaining} danger={remaining > 0} />
        </div>
        {selectedStaff && (
          <div className="flex items-center gap-2 rounded-md px-3 py-2 text-[12px]" style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", color: "#64748B" }}>
            <CalendarClock className="h-3.5 w-3.5" />
            <span>{selectedStaff.name} joined on {formatDate(selectedStaff.joining_date)}</span>
          </div>
        )}
        <TextArea label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
      </div>
    </Modal>
  );
}

function Summary({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="rounded-md px-4 py-3" style={{ background: "#FFFFFF", border: "1px solid #E2E8F0" }}>
      <div className="flex items-center gap-2 text-[12px]" style={{ color: "#64748B" }}>
        {danger ? <Banknote className="h-3.5 w-3.5" /> : <BriefcaseBusiness className="h-3.5 w-3.5" />}
        {label}
      </div>
      <div className="amount mt-1 text-[18px] font-bold" style={{ color: danger ? "#B91C1C" : "#0F172A" }}>
        {formatMoneyCompact(value)}
      </div>
    </div>
  );
}

function IconButton({ title, danger, onClick, children }: { title: string; danger?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded transition-colors hover:bg-slate-100"
      style={{ color: danger ? "#DC2626" : "#64748B" }}
    >
      {children}
    </button>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label style={{ fontSize: "13px", fontWeight: 500, color: "#334155" }}>{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full rounded border bg-white px-3 py-2 text-[14px] outline-none transition-all placeholder:text-[#94A3B8]"
        style={{ borderColor: "#CBD5E1", color: "#0F172A", resize: "vertical" }}
      />
    </div>
  );
}
