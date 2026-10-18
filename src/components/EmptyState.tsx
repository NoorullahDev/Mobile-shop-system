import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center px-6 py-14 text-center"
      style={{
        border: "1.5px dashed #D8E0EB",
        borderRadius: "10px",
        background: "#F8FAFD",
      }}
    >
      {Icon && (
        <div
          className="mb-4 flex h-12 w-12 items-center justify-center rounded-full"
          style={{ background: "#EAF2FF", color: "#1769FF" }}
        >
          <Icon className="h-5 w-5" />
        </div>
      )}
      <h3
        style={{
          fontSize: "14px",
          fontWeight: 600,
          color: "#0F172A",
          margin: 0,
        }}
      >
        {title}
      </h3>
      {description && (
        <p
          className="mt-1 max-w-xs"
          style={{ fontSize: "13px", color: "#64748B" }}
        >
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
