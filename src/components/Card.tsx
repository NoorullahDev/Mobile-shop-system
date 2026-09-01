import { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  noPadding?: boolean;
}

export function Card({
  title,
  subtitle,
  actions,
  children,
  className,
  noPadding,
  ...rest
}: CardProps) {
  return (
    <div
      className={`rounded-lg bg-white ${className ?? ""}`}
      style={{
        border: "1px solid #E2E8F0",
        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
      }}
      {...rest}
    >
      {(title || actions) && (
        <div
          className="flex items-center justify-between px-4 py-3.5"
          style={{ borderBottom: "1px solid #E2E8F0" }}
        >
          <div>
            {title && (
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
            )}
            {subtitle && (
              <p
                style={{
                  fontSize: "12px",
                  color: "#64748B",
                  margin: "2px 0 0",
                }}
              >
                {subtitle}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-2">{actions}</div>
          )}
        </div>
      )}
      <div className={noPadding ? "" : "p-4"}>{children}</div>
    </div>
  );
}
