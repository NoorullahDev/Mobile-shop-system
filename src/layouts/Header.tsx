import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getNotificationCount } from "../services/notificationService";

export function Header() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();

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
      className="flex h-14 shrink-0 items-center justify-between gap-4 px-6"
      style={{ background: "#FFFFFF", borderBottom: "1px solid #E2E8F0" }}
    >
      <div className="flex items-center gap-6">
        <div 
          className="relative cursor-pointer mt-1" 
          onClick={() => navigate("/notifications")}
        >
          <Bell className="h-5 w-5 text-[#64748B] hover:text-[#0F172A] transition-colors" />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-[#EF4444] text-[10px] font-bold text-white border-2 border-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
        <div className="flex flex-col text-right">
          <span className="text-[13px] font-medium text-[#0F172A] leading-tight">{dateStr}</span>
          <span className="text-[11px] text-[#64748B]">{timeStr}</span>
        </div>
      </div>
    </header>
  );
}
