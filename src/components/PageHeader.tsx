import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumb?: { label: string; href?: string }[];
  actions?: ReactNode;
  meta?: string;
}

export function PageHeader({
  title,
  description,
  breadcrumb,
  actions,
  meta,
}: PageHeaderProps) {
  return (
    <div
      className="mb-5 flex items-start justify-between"
    >
      <div>
        {/* Breadcrumb */}
        {breadcrumb && breadcrumb.length > 0 && (
          <div className="mb-1 flex items-center gap-1">
            {breadcrumb.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && (
                  <span style={{ color: "#94A3B8", fontSize: "12px" }}>/</span>
                )}
                <span
                  style={{
                    fontSize: "12px",
                    color: i === breadcrumb.length - 1 ? "#0F172A" : "#64748B",
                    fontWeight: i === breadcrumb.length - 1 ? 500 : 400,
                  }}
                >
                  {crumb.label}
                </span>
              </span>
            ))}
          </div>
        )}

        {/* Title row */}
        <div className="flex items-center gap-3">
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#0F172A", letterSpacing: "-0.3px" }}>
            {title}
          </h1>
          {meta && (
            <span
              className="rounded px-2 py-0.5 text-[12px] font-medium"
              style={{ background: "#F4F6FA", color: "#64748B" }}
            >
              {meta}
            </span>
          )}
        </div>

        {/* Description */}
        {description && (
          <p
            className="mt-0.5"
            style={{ fontSize: "13px", color: "#64748B" }}
          >
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  );
}
