import { CheckCircle2, Circle, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { formatMoneyCompact } from "../lib/format";
import type { PhoneImei } from "../types/inventory";

interface PhysicalUnitPickerProps {
  name: string;
  units: PhoneImei[];
  selectedId: number | null;
  unitPrice: number;
  onChange: (unitId: number) => void;
  disabled?: boolean;
  loading?: boolean;
  allowSelectedSoldUnit?: boolean;
  compact?: boolean;
}

function unitSearchText(unit: PhoneImei) {
  return [
    unit.imei,
    unit.imei2,
    unit.color,
    unit.storage,
    unit.battery_health_pct,
    unit.pta_status,
    unit.sale_price,
  ]
    .filter((value) => value != null)
    .join(" ")
    .toLowerCase();
}

export function PhysicalUnitPicker({
  name,
  units,
  selectedId,
  unitPrice,
  onChange,
  disabled = false,
  loading = false,
  allowSelectedSoldUnit = false,
  compact = false,
}: PhysicalUnitPickerProps) {
  const [filter, setFilter] = useState("");
  const selectableUnits = useMemo(
    () =>
      units.filter(
        (unit) =>
          unit.status === "in_stock" ||
          (allowSelectedSoldUnit && unit.id === selectedId),
      ),
    [allowSelectedSoldUnit, selectedId, units],
  );
  const visibleUnits = useMemo(() => {
    const query = filter.trim().toLowerCase();
    return query
      ? selectableUnits.filter((unit) => unitSearchText(unit).includes(query))
      : selectableUnits;
  }, [filter, selectableUnits]);
  const availableCount = selectableUnits.filter((unit) => unit.status === "in_stock").length;
  const labelId = `${name}-label`;

  if (loading) {
    return (
      <div
        className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[12px]"
        style={{ color: "#64748B" }}
      >
        Loading available physical units...
      </div>
    );
  }

  if (selectableUnits.length === 0) return null;

  return (
    <div className="mt-2 min-w-0">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5">
        <span id={labelId} className="text-[12px] font-semibold" style={{ color: "#334155" }}>
          Select exact physical unit
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{ background: "#ECFDF5", color: "#047857" }}
        >
          {availableCount} available
        </span>
      </div>

      {selectableUnits.length > 4 && (
        <div className="relative mb-2">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
            style={{ color: "#94A3B8" }}
          />
          <input
            type="search"
            aria-label="Filter available physical units"
            className="h-8 w-full rounded border border-slate-300 bg-white pl-8 pr-2 text-[12px] outline-none focus:border-blue-500"
            placeholder="Filter by IMEI, color, storage, battery or PTA..."
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            disabled={disabled}
          />
        </div>
      )}

      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="flex max-h-64 min-w-0 flex-col gap-1.5 overflow-y-auto pr-0.5"
      >
        {visibleUnits.map((unit) => {
          const selected = unit.id === selectedId;
          const isCurrentSoldUnit = unit.status !== "in_stock";
          const effectivePrice = unit.sale_price ?? unitPrice;
          if (compact) {
            const details = [
              unit.color || "Color not set",
              unit.storage || "Storage not set",
              unit.battery_health_pct != null ? `${unit.battery_health_pct}%` : null,
              unit.pta_status,
            ].filter(Boolean);
            return (
              <button
                key={unit.id}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                onClick={() => onChange(unit.id)}
                className="flex min-w-0 items-start gap-2 rounded-md border p-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  borderColor: selected ? "#2563EB" : "#CBD5E1",
                  background: selected ? "#EFF6FF" : "#FFFFFF",
                  boxShadow: selected ? "0 0 0 1px #2563EB" : "none",
                }}
              >
                {selected ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#2563EB" }} />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#94A3B8" }} />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-medium leading-4" style={{ color: "#0F172A" }}>
                    {details.join(" · ")}
                  </span>
                  <span className="mt-0.5 block font-mono text-[10px] leading-4" style={{ color: "#64748B" }}>
                    IMEI 1: ...{unit.imei.slice(-4)}
                    {unit.imei2 ? ` · IMEI 2: ...${unit.imei2.slice(-4)}` : ""}
                  </span>
                  <span className="mt-0.5 block text-[11px] font-bold" style={{ color: "#0F172A" }}>
                    {formatMoneyCompact(effectivePrice)}
                  </span>
                </span>
              </button>
            );
          }
          return (
            <button
              key={unit.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(unit.id)}
              className="min-w-0 rounded-md border p-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                borderColor: selected ? "#2563EB" : "#CBD5E1",
                background: selected ? "#EFF6FF" : "#FFFFFF",
                boxShadow: selected ? "0 0 0 1px #2563EB" : "none",
              }}
            >
              <div className="flex min-w-0 items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] leading-4" style={{ color: "#334155" }}>
                    <span><strong>Color:</strong> {unit.color || "Not set"}</span>
                    <span><strong>Storage:</strong> {unit.storage || "Not set"}</span>
                    {unit.battery_health_pct != null && (
                      <span><strong>Battery:</strong> {unit.battery_health_pct}%</span>
                    )}
                    {unit.pta_status && <span><strong>PTA:</strong> {unit.pta_status}</span>}
                  </div>
                  <div className="mt-1 break-all font-mono text-[10px] leading-4" style={{ color: "#64748B" }}>
                    <div>IMEI 1: {unit.imei}</div>
                    {unit.imei2 && <div>IMEI 2: {unit.imei2}</div>}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="whitespace-nowrap text-[11px] font-bold" style={{ color: "#0F172A" }}>
                    {formatMoneyCompact(effectivePrice)}
                  </span>
                  {selected && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold" style={{ color: "#2563EB" }}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Selected
                    </span>
                  )}
                  {isCurrentSoldUnit && (
                    <span className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: "#64748B" }}>
                      Current unit
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
        {visibleUnits.length === 0 && (
          <div className="rounded-md border border-dashed border-slate-300 px-3 py-4 text-center text-[11px]" style={{ color: "#64748B" }}>
            No available unit matches this filter.
          </div>
        )}
      </div>
    </div>
  );
}
