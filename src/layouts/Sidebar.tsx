import { NavLink } from "react-router-dom";
import { useSessionStore } from "../store/session";
import { useSettingsStore } from "../store/settings";
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  Smartphone,
  Headphones,
  Users,
  CreditCard,
  Building2,
  PackagePlus,
  TrendingDown,
  BarChart3,
  FileText,
  UserCog,
  ClipboardList,
  Settings,
  Shield,
  Bell,
  DatabaseBackup,
  Store,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  pos?: boolean;
  shortcut?: string;
  end?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

interface SidebarProps {
  username: string;
  role: string;
  onNavigate?: () => void;
}

/* Approved navigation — ERP/POS structure. Routes not yet built are shown but
   resolved through the layout in later phases. */
const navSections: NavSection[] = [
  {
    title: "Overview",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
      { to: "/sales/new", label: "New Sale", icon: ShoppingCart, pos: true, shortcut: "F2" },
      { to: "/sales", label: "Sales History", icon: Receipt, end: true },
    ],
  },
  {
    title: "Products & Stock",
    items: [
      { to: "/inventory", label: "Mobile Phones", icon: Smartphone },
      { to: "/accessories", label: "Accessories", icon: Headphones },
      { to: "/purchases", label: "Purchases", icon: PackagePlus },
    ],
  },
  {
    title: "Customers & Credit",
    items: [
      { to: "/members", label: "Customers", icon: Users },
      { to: "/payments", label: "Customer Dues", icon: CreditCard },
    ],
  },
  {
    title: "Suppliers",
    items: [
      { to: "/suppliers", label: "Suppliers", icon: Building2 },
      { to: "/supplier-dues", label: "Supplier Dues", icon: CreditCard },
    ],
  },
  {
    title: "Finance & Reports",
    items: [
      { to: "/expenses", label: "Expenses", icon: TrendingDown },
      { to: "/reports", label: "Reports", icon: FileText, end: true },
      { to: "/reports/profit", label: "Profit & Loss", icon: BarChart3 },
    ],
  },
  {
    title: "System",
    items: [
      { to: "/users", label: "Users & Roles", icon: UserCog },
      { to: "/activity", label: "Activity Logs", icon: ClipboardList },
      { to: "/notifications", label: "Notifications", icon: Bell },
      { to: "/backups", label: "Backups", icon: DatabaseBackup },
      { to: "/settings", label: "Settings", icon: Settings },
      { to: "/license", label: "License", icon: Shield },
    ],
  },
];

function getInitials(name: string) {
  return (name || "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getRoleColor(role: string): string {
  switch ((role || "").toLowerCase()) {
    case "admin":
    case "owner":
      return "#F59E0B";
    case "accountant":
      return "#8B5CF6";
    default:
      return "#3B6FD4";
  }
}

function SideLogo() {
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
      style={{ background: "linear-gradient(135deg, #3B6FD4, #2E4B8F)", boxShadow: "0 2px 6px rgba(59,111,212,0.4)" }}
    >
      <Store className="h-4 w-4 text-white" />
    </div>
  );
}

export function Sidebar({ username, role, onNavigate }: SidebarProps) {
  const user = useSessionStore((s) => s.user);
  const displayName = username || user?.username || "User";
  const displayRole = role || user?.role || "Staff";
  const shopName = useSettingsStore((s) => s.businessName);
  const shopLogo = useSettingsStore((s) => s.logo);
  return (
    <aside className="flex w-64 shrink-0 flex-col" style={{ background: "#0F1B32", borderRight: "1px solid #1E2E4F" }}>
      {/* Brand */}
      <div className="flex h-16 shrink-0 items-center gap-3 px-5" style={{ borderBottom: "1px solid #1E2E4F" }}>
        {shopLogo ? (
          <img
            src={shopLogo}
            alt={shopName || "Shop logo"}
            className="h-8 w-8 shrink-0 rounded-md object-cover"
            style={{ background: "#FFFFFF" }}
          />
        ) : (
          <SideLogo />
        )}
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[15px] font-bold tracking-tight text-white">
            {shopName || "Mobile Shop Pro"}
          </div>
          <div className="text-[10px] font-medium uppercase tracking-widest" style={{ color: "#5A6B8C" }}>
            ERP · Offline
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navSections.map((section) => (
          <div key={section.title} className="mb-5">
            <div className="section-label mb-1.5 px-2" style={{ color: "#4B5B7C" }}>
              {section.title}
            </div>
            <ul className="space-y-0.5">
              {section.items.map((item) =>
                item.pos ? (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      onClick={onNavigate}
                      className="relative flex items-center gap-2.5 rounded px-2.5 py-2 text-[13px] font-semibold text-white nav-pos-item"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.shortcut && (
                        <span className="rounded px-1.5 text-[10px] font-bold" style={{ background: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.9)" }}>
                          {item.shortcut}
                        </span>
                      )}
                    </NavLink>
                  </li>
                ) : (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        `side-link ${isActive ? "font-medium" : ""}`
                      }
                      style={({ isActive }) => ({
                        background: isActive ? "#1E3356" : "transparent",
                        color: isActive ? "#FFFFFF" : "#AEBBD1",
                      })}
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && (
                            <span
                              className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r"
                              style={{ background: "#5B8FE8" }}
                            />
                          )}
                          <item.icon className="h-4 w-4 shrink-0" style={{ opacity: 0.9 }} />
                          <span className="flex-1 truncate">{item.label}</span>
                        </>
                      )}
                    </NavLink>
                  </li>
                ),
              )}
            </ul>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="shrink-0 p-3" style={{ borderTop: "1px solid #1E2E4F" }}>
        <div className="flex items-center gap-3 rounded-lg px-2.5 py-2" style={{ background: "rgba(255,255,255,0.03)" }}>
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white ring-2 ring-white/10"
            style={{ background: getRoleColor(displayRole) }}
          >
            {getInitials(displayName)}
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[13px] font-semibold text-white">{displayName}</div>
            <div className="truncate text-[11px] capitalize" style={{ color: "#5A6B8C" }}>
              {displayRole}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
