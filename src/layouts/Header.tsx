import { useState, useEffect } from "react";
import { Bell, CalendarDays, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getNotificationCount } from "../services/notificationService";
import { useSessionStore } from "../store/session";
import { useSettingsStore } from "../store/settings";

interface HeaderProps {
  dashboardStyle?: boolean;
}

function getInitials(name: string) {
  return (name || "U")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function Header({ dashboardStyle = false }: HeaderProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();
  const user = useSessionStore((state) => state.user);
  const ownerName = useSettingsStore((state) => state.ownerName);
  const displayName = user?.username || ownerName.trim() || "User";
  const displayRole = user?.role || "Staff";

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000); // update every second for accurate time
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchCount = () => {
      getNotificationCount().then(setUnreadCount).catch(console.error);
    };
    fetchCount();
    // Poll for notifications every 30 seconds
    const notifTimer = setInterval(fetchCount, 30000);
    return () => clearInterval(notifTimer);
  }, []);

  const dateStr = currentTime.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
  
  const timeStr = currentTime.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });

  return (
    <header
      className={`flex shrink-0 items-center justify-between gap-4 ${dashboardStyle ? "dashboard-header h-12 px-5" : "h-14 px-6"}`}
      style={{ background: "#FFFFFF", borderBottom: "1px solid #E3E9F2" }}
    >
      <div className="ml-auto flex items-center gap-5">
        {dashboardStyle && <CalendarDays className="h-4 w-4 text-[#475569]" />}
        <div className="flex flex-col text-right">
          <span className="text-[12px] font-semibold text-[#0F172A] leading-tight">{dateStr}</span>
          <span className="text-[10px] text-[#64748B]">{timeStr}</span>
        </div>
        <div 
          className="relative cursor-pointer"
          onClick={() => navigate("/notifications")}
        >
          <Bell className="h-5 w-5 text-[#64748B] hover:text-[#0F172A] transition-colors" />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-[#EF4444] text-[10px] font-bold text-white border-2 border-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
        {dashboardStyle && (
          <button
            type="button"
            onClick={() => navigate("/account")}
            className="flex items-center gap-2 border-l border-[#E2E8F0] pl-4 text-left"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#246BFD] text-[10px] font-bold text-white">
              {getInitials(displayName)}
            </span>
            <span className="hidden leading-tight xl:block">
              <span className="block max-w-32 truncate text-[12px] font-semibold text-[#0F172A]">{displayName}</span>
              <span className="block text-[10px] capitalize text-[#64748B]">{displayRole}</span>
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-[#64748B]" />
          </button>
        )}
      </div>
    </header>
  );
}
