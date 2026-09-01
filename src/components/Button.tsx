import { ButtonHTMLAttributes, forwardRef } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "success";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
}

const base =
  "inline-flex items-center justify-center gap-1.5 rounded font-medium transition-all " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-55 select-none";

const variants: Record<ButtonVariant, string> = {
  primary:
    "text-white shadow-sm hover:shadow-md active:scale-[0.98]",
  secondary:
    "bg-white border text-[#0F172A] hover:bg-[#F4F6FA] active:bg-[#E2E8F0] active:scale-[0.98]",
  danger:
    "text-white shadow-sm hover:shadow-md active:scale-[0.98]",
  ghost:
    "bg-transparent hover:bg-[#F4F6FA] active:bg-[#E2E8F0]",
  success:
    "text-white shadow-sm hover:shadow-md active:scale-[0.98]",
};

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: { background: "#3B6FD4" },
  secondary: { borderColor: "#CBD5E1" },
  danger: { background: "#DC2626" },
  ghost: { color: "#3B6FD4" },
  success: { background: "#16A34A" },
};

const sizes: Record<ButtonSize, string> = {
  xs: "h-7 px-2.5 text-[12px]",
  sm: "h-8 px-3 text-[13px]",
  md: "h-9 px-4 text-[13px]",
  lg: "h-10 px-5 text-sm",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      loading = false,
      icon,
      className,
      children,
      disabled,
      style,
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        className={`${base} ${variants[variant]} ${sizes[size]} ${className ?? ""}`}
        style={{ ...variantStyles[variant], ...style }}
        disabled={disabled || loading}
        {...rest}
      >
        {loading ? <Spinner className="h-3.5 w-3.5" /> : icon}
        {children}
      </button>
    );
  },
);

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className ?? "h-4 w-4"}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ color: "inherit" }}
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
