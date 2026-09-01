import { XCircle } from "lucide-react";
import type { ReactNode } from "react";

export interface ErrorStateProps {
  title?: string;
  message: string;
  action?: ReactNode;
}

export function ErrorState({
  title = "Something went wrong",
  message,
  action,
}: ErrorStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center px-6 py-14 text-center"
      style={{
        border: "1.5px dashed #FECACA",
        borderRadius: "8px",
        background: "#FFF5F5",
      }}
    >
      <div
        className="mb-4 flex h-12 w-12 items-center justify-center rounded-full"
        style={{ background: "#FEE2E2", color: "#DC2626" }}
      >
        <XCircle className="h-5 w-5" />
      </div>
      <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#0F172A", margin: 0 }}>{title}</h3>
      <p className="mt-1 max-w-sm text-[13px]" style={{ color: "#7F1D1D" }}>
        {message}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
