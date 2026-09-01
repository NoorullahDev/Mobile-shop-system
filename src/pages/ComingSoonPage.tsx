import { Construction } from "lucide-react";

interface ComingSoonPageProps {
  title?: string;
  description?: string;
}

export function ComingSoonPage({
  title = "Coming Soon",
  description = "This module is under development and will be available in the next release.",
}: ComingSoonPageProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div
        className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ background: "#F1F5F9" }}
      >
        <Construction className="h-8 w-8" style={{ color: "#94A3B8" }} />
      </div>
      <h2
        style={{
          fontSize: "20px",
          fontWeight: 700,
          color: "#0F172A",
          margin: "0 0 8px",
        }}
      >
        {title}
      </h2>
      <p
        className="max-w-md"
        style={{ fontSize: "14px", color: "#64748B" }}
      >
        {description}
      </p>
      <div
        className="mt-8 rounded-lg px-5 py-4"
        style={{ background: "#EFF6FF", border: "1px solid #DBEAFE" }}
      >
        <p className="text-[13px] font-medium" style={{ color: "#1D4ED8" }}>
          📋 This feature is part of Phase 2 development
        </p>
      </div>
    </div>
  );
}
