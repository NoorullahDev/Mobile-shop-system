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
      className={`ui-card rounded-xl bg-white ${className ?? ""}`}
      style={{
        border: "1px solid #E3E9F2",
        boxShadow: "0 2px 8px rgba(15, 23, 42, 0.045)",
      }}
      {...rest}
    >
      {(title || actions) && (
        <div
          className="ui-card-header flex items-center justify-between px-4 py-3"
          style={{ borderBottom: "1px solid #E8EDF4" }}
        >
          <div>
            {title && (
              <h3
                style={{
                  fontSize: "13px",
                  fontWeight: 700,
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
