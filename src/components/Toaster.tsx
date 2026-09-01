import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface Toast {
  id: number;
  title?: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (message: string, opts?: { title?: string; variant?: ToastVariant }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS = {
  success: { Icon: CheckCircle2, color: "#16A34A", border: "#16A34A" },
  error: { Icon: XCircle, color: "#DC2626", border: "#DC2626" },
  warning: { Icon: AlertTriangle, color: "#D97706", border: "#D97706" },
  info: { Icon: Info, color: "#3B6FD4", border: "#3B6FD4" },
};

export function Toaster({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
  }, []);

  const toast = useCallback<ToastContextValue["toast"]>(
    (message, opts) => {
      const id = ++idRef.current;
      const t: Toast = {
        id,
        message,
        title: opts?.title,
        variant: opts?.variant ?? "success",
      };
      setToasts((prev) => [...prev, t]);
      timers.current[id] = setTimeout(() => remove(id), 4000);
    },
    [remove],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => {
          const c = ICONS[t.variant];
          return (
            <div key={t.id} className="toast" style={{ borderLeftColor: c.border }}>
              <c.Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: c.color }} />
              <div className="flex-1">
                {t.title && (
                  <p className="font-semibold" style={{ fontSize: "13px", color: "#0F172A", margin: 0 }}>
                    {t.title}
                  </p>
                )}
                <p className="text-[13px]" style={{ color: "#334155", margin: 0 }}>
                  {t.message}
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove(t.id)}
                className="shrink-0 rounded p-0.5 hover:bg-slate-100"
                style={{ color: "#94A3B8" }}
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <Toaster>");
  return ctx;
}
