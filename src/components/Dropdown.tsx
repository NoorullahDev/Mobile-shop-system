import { useEffect, useRef, useState, type ReactNode } from "react";

export interface DropdownItem {
  label?: string;
  icon?: ReactNode;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
}

export interface DropdownProps {
  trigger: ReactNode;
  items?: DropdownItem[];
  align?: "left" | "right";
  width?: string;
  children?: ReactNode;
  onOpen?: () => void;
}

export function Dropdown({
  trigger,
  items,
  align = "right",
  width = "w-52",
  children,
  onOpen,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) onOpen?.();
  };

  return (
    <div className="relative" ref={ref}>
      <div onClick={toggle} className="inline-flex">
        {trigger}
      </div>

      {open && (
        <div
          className={`absolute top-full z-30 mt-1 overflow-hidden rounded-md bg-white py-1 ${width} ${align === "right" ? "right-0" : "left-0"}`}
          style={{
            border: "1px solid #E2E8F0",
            boxShadow: "0 8px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06)",
          }}
        >
          {items?.map((item, i) =>
            item.divider ? (
              <div key={`div-${i}`} className="my-1 h-px" style={{ background: "#E2E8F0" }} />
            ) : (
              <button
                key={i}
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  item.onClick?.();
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  color: item.danger ? "#DC2626" : "#0F172A",
                  cursor: item.disabled ? "not-allowed" : "pointer",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = item.danger ? "#FEF2F2" : "#F4F6FA")
                }
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {item.icon}
                {item.label}
              </button>
            ),
          )}
          {children}
        </div>
      )}
    </div>
  );
}
