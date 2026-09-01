import type { ReactNode } from "react";

export type BadgeVariant =
  | "default"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "purple"
  | "orange";

export interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const VARIANTS: Record<BadgeVariant, { bg: string; color: string; border: string }> = {
  default: { bg: "#F1F5F9", color: "#475569", border: "#E2E8F0" },
  primary: { bg: "#EFF6FF", color: "#1D4ED8", border: "#DBEAFE" },
  success: { bg: "#F0FDF4", color: "#15803D", border: "#BBF7D0" },
  warning: { bg: "#FFFBEB", color: "#B45309", border: "#FDE68A" },
  danger: { bg: "#FEF2F2", color: "#B91C1C", border: "#FECACA" },
  info: { bg: "#F0F9FF", color: "#0369A1", border: "#BAE6FD" },
  purple: { bg: "#F5F3FF", color: "#6D28D9", border: "#E9D5FF" },
  orange: { bg: "#FFF7ED", color: "#C2410C", border: "#FFEDD5" },
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  const v = VARIANTS[variant];
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full ${className ?? ""}`}
      style={{
        background: v.bg,
        color: v.color,
        border: `1px solid ${v.border}`,
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.02em",
        padding: "2px 9px",
      }}
    >
      {children}
    </span>
  );
}
