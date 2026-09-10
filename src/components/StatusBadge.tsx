/**
 * StatusBadge — renders a styled pill badge based on a status string.
 * Supports: paid, credit, partial, unpaid, returned, pta approved, non-pta,
 *           grey, low stock, out of stock, in stock, active, inactive,
 *           basic, professional, enterprise, admin, sales staff, accountant
 */

type BadgeColor = "green" | "red" | "amber" | "blue" | "purple" | "orange" | "gray";

interface StatusBadgeProps {
  status: string;
  className?: string;
  label?: string;
}

function resolveColor(status: string): BadgeColor {
  switch (status.toLowerCase().trim()) {
    case "paid":
    case "in stock":
    case "active":
    case "success":
    case "verified":
    case "sellable":
    case "processed":
    case "good":
    case "full":
      return "green";
    case "credit":
    case "professional":
    case "pro":
    case "accountant":
      return "purple";
    case "partial":
    case "low stock":
    case "basic":
    case "warning":
    case "enterprise":
    case "mixed":
    case "used":
    case "pending":
      return "amber";
    case "pta approved":
    case "approved":
    case "admin":
      return "blue";
    case "non-pta":
    case "unpaid":
    case "out of stock":
    case "overdue":
    case "failed":
    case "damaged":
    case "defective":
    case "nonsellable":
      return "red";
    case "grey":
    case "returned":
    case "voided":
    case "inactive":
    case "sales staff":
    case "employee":
      return "gray";
    default:
      return "gray";
  }
}

const colorMap: Record<BadgeColor, { bg: string; color: string }> = {
  green:  { bg: "#DCFCE7", color: "#15803D" },
  red:    { bg: "#FEE2E2", color: "#B91C1C" },
  amber:  { bg: "#FEF3C7", color: "#B45309" },
  blue:   { bg: "#DBEAFE", color: "#1D4ED8" },
  purple: { bg: "#EDE9FE", color: "#6D28D9" },
  orange: { bg: "#FFEDD5", color: "#EA580C" },
  gray:   { bg: "#E2E8F0", color: "#475569" },
};

export function StatusBadge({ status, className, label }: StatusBadgeProps) {
  const color = resolveColor(status);
  const { bg, color: textColor } = colorMap[color];

  return (
    <span
      className={`inline-flex items-center whitespace-nowrap ${className ?? ""}`}
      style={{
        background: bg,
        color: textColor,
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.02em",
        padding: "2px 8px",
        borderRadius: "9999px",
        textTransform: "uppercase",
      }}
    >
      {label ?? status}
    </span>
  );
}
