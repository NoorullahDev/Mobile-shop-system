import { useEffect, useState } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { MainLayout } from "./layouts/MainLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { MembersPage } from "./pages/MembersPage";
import { LoginPage } from "./pages/LoginPage";
import { InventoryPage } from "./pages/InventoryPage";
import { AccessoriesPage } from "./pages/AccessoriesPage";
import { SuppliersPage } from "./pages/SuppliersPage";
import { PurchasesPage } from "./pages/PurchasesPage";
import { SupplierDuesPage } from "./pages/SupplierDuesPage";
import { PaymentsPage } from "./pages/PaymentsPage";
import { OnlinePaymentsPage } from "./pages/OnlinePaymentsPage";
import { SalesPage } from "./pages/SalesPage";
import { ReturnsPage } from "./pages/ReturnsPage";
import { POSPage } from "./pages/POSPage";
import { ExpensesPage } from "./pages/ExpensesPage";
import { ReportsPage } from "./pages/ReportsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ReceiptSettingsPage } from "./pages/ReceiptSettingsPage";
import { UsersPage } from "./pages/UsersPage";
import { ActivityLogsPage } from "./pages/ActivityLogsPage";
import { LicensePage } from "./pages/LicensePage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { BackupManagerPage } from "./pages/BackupManagerPage";
import { AccountPage } from "./pages/AccountPage";
import { Spinner } from "./components/Button";
import { Toaster } from "./components/Toaster";
import { LicenseGate } from "./components/LicenseGate";
import { useSessionStore } from "./store/session";
import { useSettingsStore } from "./store/settings";
import { can } from "./lib/permissions";
import * as licenseService from "./services/licenseService";
import type { LicenseStatus } from "./types/license";

const landingRoutes = Object.entries({
  "/": "dashboard:view",
  "/sales/new": "sales:create",
  "/sales": "sales:view",
  "/members": "members:view",
  "/inventory": "phones:view",
  "/accessories": "accessories:view",
  "/purchases": "purchases:view",
  "/suppliers": "suppliers:view",
  "/reports": "reports:view",
  "/staff": "staff:view",
  "/settings": "settings:view",
  "/users": "users:manage",
});

function RequirePermission({ permission, children }: { permission: string; children: React.ReactNode }) {
  const permissions = useSessionStore((s) => s.user?.permissions ?? []);
  if (!can(permissions, permission)) {
    const fallback = landingRoutes.find(([, required]) => can(permissions, required))?.[0];
    return fallback ? <Navigate to={fallback} replace /> : (
      <div className="rounded-lg border border-red-200 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Access denied</h1>
        <p className="mt-2 text-sm text-slate-500">Your role does not grant access to this page.</p>
      </div>
    );
  }
  return <>{children}</>;
}

function RequireAnyPermission({ permissions: required, children }: { permissions: string[]; children: React.ReactNode }) {
  const permissions = useSessionStore((s) => s.user?.permissions ?? []);
  if (!required.some((permission) => can(permissions, permission))) {
    const fallback = landingRoutes.find(([, permission]) => can(permissions, permission))?.[0];
    return fallback ? <Navigate to={fallback} replace /> : (
      <div className="rounded-lg border border-red-200 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Access denied</h1>
        <p className="mt-2 text-sm text-slate-500">Your role does not grant access to this page.</p>
      </div>
    );
  }
  return <>{children}</>;
}

export default function App() {
  const { user, checking, init } = useSessionStore();
  const businessName = useSettingsStore((s) => s.businessName);
  const [licenseLoading, setLicenseLoading] = useState(true);
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | null>(null);
  const [licenseError, setLicenseError] = useState<string | null>(null);

  const loadLicenseStatus = () => {
    setLicenseLoading(true);
    setLicenseError(null);
    licenseService
      .getLicenseStatus()
      .then(setLicenseStatus)
      .catch((error) => {
        setLicenseStatus(null);
        setLicenseError(String(error));
      })
      .finally(() => setLicenseLoading(false));
  };

  useEffect(() => {
    init();
    loadLicenseStatus();
    // Initial desktop startup only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [init]);

  useEffect(() => {
    if (user) {
      useSettingsStore.getState().load().catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    if (businessName) document.title = businessName;
  }, [businessName]);

  if (checking || licenseLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "#F4F6FA" }}>
        <div className="flex items-center gap-2" style={{ color: "#64748B" }}>
          <Spinner className="h-5 w-5" /> Loading Mobile Shop Pro...
        </div>
      </div>
    );
  }

  if (licenseError || !licenseStatus) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "#F4F6FA" }}>
        <div className="max-w-md rounded-lg border bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-semibold text-slate-900">License status could not be loaded.</p>
          <p className="mt-2 text-xs text-slate-500">{licenseError ?? "Please try again."}</p>
          <button
            type="button"
            onClick={loadLicenseStatus}
            className="mt-4 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── License gate: block the ERP until the license is active ──
  const pendingActivation = !licenseStatus.activated;

  return (
    <Toaster>
      <HashRouter>
        <Routes>
          {/* License activation / expired screen — shown whenever the license is not active */}
          <Route
            path="/activation"
            element={
              pendingActivation ? (
                <LicenseGate status={licenseStatus} onActivated={setLicenseStatus} />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />

          <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
          <Route
            element={
              pendingActivation ? (
                <Navigate to="/activation" replace />
              ) : user ? (
                <MainLayout />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          >
            <Route index element={<RequirePermission permission="dashboard:view"><DashboardPage /></RequirePermission>} />
            <Route path="members" element={<RequirePermission permission="members:view"><MembersPage /></RequirePermission>} />
            <Route path="inventory" element={<RequirePermission permission="phones:view"><InventoryPage /></RequirePermission>} />
            <Route path="suppliers" element={<RequirePermission permission="suppliers:view"><SuppliersPage /></RequirePermission>} />
            <Route path="sales" element={<RequirePermission permission="sales:view"><SalesPage /></RequirePermission>} />
            <Route path="returns" element={<RequirePermission permission="returns:view"><ReturnsPage /></RequirePermission>} />
            <Route path="payments" element={<RequirePermission permission="payments:view"><PaymentsPage /></RequirePermission>} />
            <Route path="online-payments" element={<RequirePermission permission="online_payments:view"><OnlinePaymentsPage /></RequirePermission>} />
            <Route path="expenses" element={<RequirePermission permission="expenses:view"><ExpensesPage /></RequirePermission>} />
            <Route path="reports" element={<RequirePermission permission="reports:view"><ReportsPage /></RequirePermission>} />
            <Route path="settings" element={<RequireAnyPermission permissions={["settings:view", "staff:view", "users:manage", "activity:view", "backup:view", "license:view"]}><SettingsPage /></RequireAnyPermission>} />
            <Route path="settings/receipt" element={<RequirePermission permission="settings:view"><ReceiptSettingsPage /></RequirePermission>} />
            <Route path="license" element={<RequirePermission permission="license:view"><LicensePage /></RequirePermission>} />
            <Route path="sales/new" element={<RequirePermission permission="sales:create"><POSPage /></RequirePermission>} />
            <Route path="accessories" element={<RequirePermission permission="accessories:view"><AccessoriesPage /></RequirePermission>} />
            <Route path="purchases" element={<RequirePermission permission="purchases:view"><PurchasesPage /></RequirePermission>} />
            <Route path="supplier-dues" element={<RequirePermission permission="supplier_dues:view"><SupplierDuesPage /></RequirePermission>} />
            <Route path="users" element={<RequirePermission permission="users:manage"><UsersPage /></RequirePermission>} />
            <Route path="staff" element={<RequirePermission permission="staff:view"><UsersPage initialTab="staff" /></RequirePermission>} />
            <Route path="activity" element={<RequirePermission permission="activity:view"><ActivityLogsPage /></RequirePermission>} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="account" element={<AccountPage />} />
            <Route path="backups" element={<RequirePermission permission="backup:view"><BackupManagerPage /></RequirePermission>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </Toaster>
  );
}
