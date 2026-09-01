import { useState } from "react";
import { Search, LogOut, ChevronDown } from "lucide-react";
import { Dropdown } from "../components/Dropdown";
import { useSessionStore } from "../store/session";

export function Header() {
  const user = useSessionStore((s) => s.user);
  const logout = useSessionStore((s) => s.logout);
  const [loggingOut, setLoggingOut] = useState(false);
  const [query, setQuery] = useState("");

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  };

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

      {/* Right — user profile */}
      <div className="ml-auto flex items-center">
        <Dropdown
          align="right"
          width="w-56"
          items={[
            {
              label: user ? `${user.username} (${user.role})` : "Account",
              icon: <LogOut className="h-3.5 w-3.5" style={{ color: "#3B6FD4" }} />,
              disabled: true,
            },
            { divider: true },
            {
              label: loggingOut ? "Signing out..." : "Sign Out",
              icon: <LogOut className="h-3.5 w-3.5" />,
              danger: true,
              onClick: () => handleLogout(),
            },
          ]}
          trigger={
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] transition-colors hover:bg-slate-100"
              style={{ color: "#0F172A" }}
            >
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white"
                style={{ background: "#3B6FD4" }}
              >
                {(user?.username || "U").charAt(0).toUpperCase()}
              </div>
              <span className="hidden font-semibold md:inline">{user?.username}</span>
              <ChevronDown className="h-3.5 w-3.5" style={{ color: "#64748B" }} />
            </button>
          }
        />
      </div>
    </header>
  );
}

