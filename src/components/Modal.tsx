import { ReactNode, useEffect } from "react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeMap: Record<string, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  size = "md",
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: "rgba(15, 23, 42, 0.55)", backdropFilter: "blur(2px)" }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={`modal-panel relative z-10 flex w-full flex-col overflow-hidden rounded-lg bg-white ${sizeMap[size]}`}
        style={{ boxShadow: "0 16px 40px rgba(0,0,0,0.14)" }}
      >
        {/* Header */}
        <div
          className="flex shrink-0 items-start justify-between px-5 py-4"
          style={{ borderBottom: "1px solid #E2E8F0" }}
        >
          <div>
            <h3
              style={{
                fontSize: "16px",
                fontWeight: 600,
                color: "#0F172A",
                margin: 0,
              }}
            >
              {title}
            </h3>
            {subtitle && (
              <p
                style={{
                  fontSize: "13px",
                  color: "#64748B",
                  margin: "2px 0 0",
                }}
              >
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-4 flex h-7 w-7 shrink-0 items-center justify-center rounded transition-colors hover:bg-slate-100"
            style={{ color: "#64748B" }}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-5 py-4" style={{ maxHeight: "70vh" }}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            className="flex shrink-0 items-center justify-end gap-2 px-5 py-3"
            style={{ borderTop: "1px solid #E2E8F0" }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
