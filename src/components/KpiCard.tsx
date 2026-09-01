import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type KpiTone =
  | "primary"
  | "green"
  | "purple"
  | "amber"
  | "red"
  | "navy";

export interface KpiCardProps {
  title: string;
  value: ReactNode;
  tonedValue?: boolean;
  sub?: ReactNode;
  icon?: LucideIcon;
  tone?: KpiTone;
  trend?: { label: string; direction: "up" | "down" | "flat"; positive?: boolean };
  onClick?: () => void;
}

const TONES: Record<KpiTone, { bg: string; color: string }> = {
  primary: { bg: "#DBEAFE", color: "#2563EB" },
  green: { bg: "#DCFCE7", color: "#16A34A" },
  purple: { bg: "#EDE9FE", color: "#7C3AED" },
  amber: { bg: "#FEF3C7", color: "#D97706" },
  red: { bg: "#FEE2E2", color: "#DC2626" },
  navy: { bg: "#E0E7FF", color: "#2E4B8F" },
};

export function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  tone = "primary",
  trend,
  onClick,
}: KpiCardProps) {
  const t = TONES[tone];

  return (
    <div
      onClick={onClick}
      className={`rounded-lg bg-white ${onClick ? "cursor-pointer transition-shadow hover:shadow-md" : ""}`}
      style={{
        border: "1px solid #E2E8F0",
        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
      }}
    >
      <div className="flex items-start justify-between px-4 pt-4">
        <span
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: "#64748B", letterSpacing: "0.06em" }}
        >
          {title}
        </span>
        {Icon && (
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
            style={{ background: t.bg, color: t.color }}
          >
            <Icon style={{ width: 15, height: 15 }} />
          </span>
        )}
      </div>

      <div className="px-4 pb-4 pt-1.5">
        <div
          className="amount text-[22px] font-bold leading-tight"
          style={{ color: "#0F172A", letterSpacing: "-0.3px" }}
        >
          {value}
        </div>

        {(sub || trend) && (
          <div className="mt-2 flex items-center gap-2">
            {trend && (
              <span
                className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-semibold"
                style={{
                  background: trend.positive === false ? "#FEF2F2" : "#F0FDF4",
                  color: trend.positive === false ? "#B91C1C" : "#15803D",
                }}
              >
                {trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→"} {trend.label}
              </span>
            )}
            {sub && (
              <span className="text-[12px]" style={{ color: "#64748B" }}>
                {sub}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
