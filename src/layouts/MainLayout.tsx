import { useEffect, useState } from "react";
import { Outlet, Link } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { useSessionStore } from "../store/session";
import * as licenseService from "../services/licenseService";

export function MainLayout() {
  const user = useSessionStore((s) => s.user);
  const [dismissed, setDismissed] = useState(false);
  const [unlicensed, setUnlicensed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    licenseService
      .getLicenseStatus()
      .then((s) => {
        if (!cancelled) setUnlicensed(!s.activated);
      })
      .catch(() => {
        if (!cancelled) setUnlicensed(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const showDefaultPasswordHint = !!user?.default_password && !dismissed;

  return (
    <div className="app-shell">
      <Sidebar username="" role="" />
      <div className="app-main">
        <Header />
        {unlicensed && (
          <div
            className="flex items-center justify-between gap-3 border-b px-6 py-2.5 text-[13px]"
            style={{
              background: "#FFF5F5",
              borderColor: "#FECACA",
              color: "#7F1D1D",
            }}
          >
            <span>
              This copy of Mobile Shop Pro is not activated.{" "}
              <Link to="/license" style={{ textDecoration: "underline", fontWeight: 600, color: "#7F1D1D" }}>
                Activate your license
              </Link>
              .
            </span>
            <button
              type="button"
              onClick={() => setUnlicensed(false)}
              className="shrink-0 rounded px-2 text-[12px] font-semibold"
              style={{ color: "#7F1D1D", background: "#FECACA" }}
              aria-label="Dismiss license banner"
            >
              Dismiss
            </button>
          </div>
        )}
        {showDefaultPasswordHint && (
          <div
            className="flex items-center justify-between gap-3 border-b px-6 py-2.5 text-[13px]"
            style={{
              background: "#FFFBEB",
              borderColor: "#FDE68A",
              color: "#92400E",
            }}
          >
            <span>
              You are signed in with the default password. For security, please{" "}
              <Link to="/settings" style={{ textDecoration: "underline", fontWeight: 600, color: "#92400E" }}>
                change your password in Settings
              </Link>
              .
            </span>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="shrink-0 rounded px-2 text-[12px] font-semibold"
              style={{ color: "#92400E", background: "#FDE68A" }}
              aria-label="Dismiss password hint"
            >
              Dismiss
            </button>
          </div>
        )}
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}