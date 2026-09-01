import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

interface AlertProps {
  message: string;
  variant?: "error" | "warning" | "success" | "info";
  title?: string;
}

const config = {
  error: {
    bg: "#FFF5F5",
    border: "#DC2626",
    iconColor: "#DC2626",
    textColor: "#7F1D1D",
    Icon: XCircle,
    defaultTitle: "Error",
  },
  warning: {
    bg: "#FFFBEB",
    border: "#D97706",
    iconColor: "#D97706",
    textColor: "#78350F",
    Icon: AlertTriangle,
    defaultTitle: "Warning",
  },
  success: {
    bg: "#F0FDF4",
    border: "#16A34A",
    iconColor: "#16A34A",
    textColor: "#14532D",
    Icon: CheckCircle2,
    defaultTitle: "Success",
  },
  info: {
    bg: "#EFF6FF",
    border: "#3B6FD4",
    iconColor: "#3B6FD4",
    textColor: "#1E3A8A",
    Icon: Info,
    defaultTitle: "Info",
  },
};

export function Alert({ message, variant = "error", title }: AlertProps) {
  const c = config[variant];
  const { Icon } = c;

  return (
    <div
      className="flex items-start gap-3 rounded px-3.5 py-3"
      style={{
        background: c.bg,
        borderLeft: `3px solid ${c.border}`,
      }}
    >
      <Icon
        className="mt-0.5 h-4 w-4 shrink-0"
        style={{ color: c.iconColor }}
      />
      <div>
        {title && (
          <p
            className="font-semibold"
            style={{ fontSize: "13px", color: c.textColor }}
          >
            {title}
          </p>
        )}
        <p style={{ fontSize: "13px", color: c.textColor, margin: 0 }}>
          {message}
        </p>
      </div>
    </div>
  );
}
