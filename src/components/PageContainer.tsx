import type { ReactNode } from "react";

export interface PageContainerProps {
  children: ReactNode;
  maxWidth?: string;
  className?: string;
}

/** Consistent page wrapper. Applies standard padding + optional max width. */
export function PageContainer({ children, maxWidth = "100%", className }: PageContainerProps) {
  return (
    <div className={className} style={{ maxWidth, margin: "0 auto" }}>
      {children}
    </div>
  );
}
