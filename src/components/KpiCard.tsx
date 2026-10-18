import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type KpiTone =
  | "primary"
  | "cyan"
  | "green"
  | "purple"
  | "amber"
  | "red"
  | "navy";

export interface KpiCardProps {
  title: string;
  value: ReactNode;
  valueTitle?: string;
  tonedValue?: boolean;
  sub?: ReactNode;
  icon?: LucideIcon;
  tone?: KpiTone;
  trend?: { label: string; direction: "up" | "down" | "flat"; positive?: boolean };
  onClick?: () => void;
  compact?: boolean;
}

const TONES: Record<KpiTone, { bg: string; color: string; surface: string; border: string }> = {
  primary: { bg: "#DBEAFE", color: "#1769FF", surface: "#F5F9FF", border: "#BDD7FF" },
  cyan: { bg: "#D9F8F6", color: "#0E9F9A", surface: "#F1FCFC", border: "#B6ECE9" },
  green: { bg: "#DCFCE7", color: "#12B76A", surface: "#F2FCF7", border: "#B7EBD0" },
  purple: { bg: "#EDE9FE", color: "#7C3AED", surface: "#F8F6FF", border: "#DDD4FF" },
  amber: { bg: "#FEF3C7", color: "#F79009", surface: "#FFFAF0", border: "#F6DEAA" },
  red: { bg: "#FEE2E2", color: "#F04438", surface: "#FFF5F5", border: "#FFC7C7" },
  navy: { bg: "#E0E7FF", color: "#2E4B8F", surface: "#F5F7FF", border: "#CAD4F5" },
};

export function KpiCard({
  title,
  value,
  valueTitle,
  sub,
  icon: Icon,
  tone = "primary",
  trend,
  onClick,
  compact = true,
}: KpiCardProps) {
  const t = TONES[tone];

  return (
    <div
      onClick={onClick}
      className={`kpi-card rounded-xl ${compact ? "kpi-card--dashboard" : ""} ${onClick ? "cursor-pointer" : ""}`}
      style={{
        border: `1px solid ${t.border}`,
        background: `linear-gradient(115deg, ${t.surface} 0%, #FFFFFF 84%)`,
      }}
    >
      {compact ? (
        <div className="flex h-full items-center gap-3.5 px-4 py-3">
          {Icon && (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: t.bg, color: t.color }}>
              <Icon style={{ width: 22, height: 22 }} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] font-semibold text-[#475569]">{title}</div>
            <div title={valueTitle} className="kpi-card-value mt-0.5 truncate text-[22px] font-bold leading-tight tracking-[-0.45px] text-[#0F172A]">{value}</div>
            {sub && <div className="mt-0.5 truncate text-[11px] text-[#64748B]">{sub}</div>}
          </div>
          {trend && (
            <span className="self-start rounded-md px-1.5 py-0.5 text-[10px] font-bold" style={{ background: trend.positive === false ? "#FEE2E2" : "#DCFCE7", color: trend.positive === false ? "#DC2626" : "#16A34A" }}>
              {trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→"} {trend.label}
            </span>
          )}
        </div>
      ) : (
        <>
      <div className="flex items-start justify-between px-4 pt-4">
        <span
            className="text-[11px] font-semibold"
            style={{ color: "#64748B" }}
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
          title={valueTitle}
          className="amount-large leading-tight"
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
        </>
      )}
    </div>
  );
}
