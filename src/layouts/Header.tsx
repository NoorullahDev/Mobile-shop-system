import { useState } from "react";
import { Search } from "lucide-react";

export function Header() {
  const [query, setQuery] = useState("");

  return (
    <header
      className="flex h-14 shrink-0 items-center gap-4 px-6"
      style={{ background: "#FFFFFF", borderBottom: "1px solid #E2E8F0" }}
    >
      {/* Global search */}
      <div className="relative w-full max-w-md flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "#94A3B8" }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products, customers, receipts..."
          className="h-9 w-full rounded-lg border pl-9 pr-3 text-[13px] outline-none transition-all focus:bg-white"
          style={{ borderColor: "#E2E8F0", color: "#0F172A", background: "#F8FAFC" }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "#3B6FD4";
            e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59,111,212,0.08)";
            e.currentTarget.style.background = "#FFFFFF";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "#E2E8F0";
            e.currentTarget.style.boxShadow = "none";
            e.currentTarget.style.background = "#F8FAFC";
          }}
        />
      </div>
    </header>
  );
}
