import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import * as licenseService from "../services/licenseService";

export function MainLayout() {
  const location = useLocation();
  const contentRef = useRef<HTMLElement>(null);
  const previousPathRef = useRef(location.pathname);
  const pageAnimationRef = useRef<Animation | null>(null);
  const [licenseDismissed, setLicenseDismissed] = useState(() => localStorage.getItem("licenseDismissed") === "true");
  const [unlicensed, setUnlicensed] = useState(false);

  useLayoutEffect(() => {
    if (previousPathRef.current === location.pathname) return;
    previousPathRef.current = location.pathname;

    pageAnimationRef.current?.cancel();
    pageAnimationRef.current = null;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const content = contentRef.current;
    if (!content) return;

    const animation = content.animate(
      [{ transform: "translateX(8px)" }, { transform: "translateX(0)" }],
      { duration: 180, easing: "ease-out" },
    );
    pageAnimationRef.current = animation;
    animation.onfinish = () => {
      if (pageAnimationRef.current === animation) pageAnimationRef.current = null;
    };

    return () => {
      animation.cancel();
      if (pageAnimationRef.current === animation) pageAnimationRef.current = null;
    };
  }, [location.pathname]);

  useEffect(() => {
    let cancelled = false;
    licenseService
      .getLicenseStatus()
      .then((s) => {
        if (!cancelled) {
          const isUnlicensed = !s.activated || s.expired;
          setUnlicensed(isUnlicensed);
          // If the license is active and valid, clear any previous dismissal
          // so that if it expires in the future, the warning will appear again.
          if (!isUnlicensed) {
            localStorage.removeItem("licenseDismissed");
            setLicenseDismissed(false);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setUnlicensed(false);
      });
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  const showLicenseWarning = unlicensed && !licenseDismissed;

  const handleDismissLicense = () => {
    setLicenseDismissed(true);
    localStorage.setItem("licenseDismissed", "true");
  };

  return (
    <div className="app-shell">
      <Sidebar username="" role="" />
      <div className="app-main">
        <Header />
        {showLicenseWarning && (
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
              onClick={handleDismissLicense}
              className="shrink-0 rounded px-2 text-[12px] font-semibold"
              style={{ color: "#7F1D1D", background: "#FECACA" }}
              aria-label="Dismiss license banner"
            >
              Dismiss
            </button>
          </div>
        )}
        <main ref={contentRef} className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
