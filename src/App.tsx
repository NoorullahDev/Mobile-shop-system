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
import { SalesPage } from "./pages/SalesPage";
import { POSPage } from "./pages/POSPage";
import { ExpensesPage } from "./pages/ExpensesPage";
import { ReportsPage } from "./pages/ReportsPage";
import { ProfitLossPage } from "./pages/ProfitLossPage";
import { SettingsPage } from "./pages/SettingsPage";
import { UsersPage } from "./pages/UsersPage";
import { ActivityLogsPage } from "./pages/ActivityLogsPage";
import { LicensePage } from "./pages/LicensePage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { BackupManagerPage } from "./pages/BackupManagerPage";
import { Spinner } from "./components/Button";
import { Toaster } from "./components/Toaster";
import { LicenseGate } from "./components/LicenseGate";
import { useSessionStore } from "./store/session";
import { useSettingsStore } from "./store/settings";
import * as licenseService from "./services/licenseService";
import type { LicenseStatus } from "./types/license";

export default function App() {
  const { user, checking, init } = useSessionStore();
  const businessName = useSettingsStore((s) => s.businessName);
  const [licenseLoading, setLicenseLoading] = useState(true);
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | null>(null);

  useEffect(() => {
    init();
    useSettingsStore.getState().load().catch(() => {});
    licenseService
      .getLicenseStatus()
      .then(setLicenseStatus)
      .catch(() => setLicenseStatus(null))
      .finally(() => setLicenseLoading(false));
  }, [init]);

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

  // ── License gate: block the ERP until the license is active ──
  const pendingActivation = !licenseStatus?.activated;

  return (
    <Toaster>
      <HashRouter>
        <Routes>
          {/* License activation / expired screen — shown whenever the license is not active */}
          <Route
            path="/activation"
            element={
              pendingActivation ? (
                <LicenseGate status={licenseStatus!} onActivated={setLicenseStatus} />
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
            <Route index element={<DashboardPage />} />
            <Route path="members" element={<MembersPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="suppliers" element={<SuppliersPage />} />
            <Route path="sales" element={<SalesPage />} />
            <Route path="payments" element={<PaymentsPage />} />
            <Route path="expenses" element={<ExpensesPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="license" element={<LicensePage />} />
          </Route>

          {/* Placeholder routes for planned modules (built in later phases) */}
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
            <Route path="sales/new" element={<POSPage />} />
            <Route path="accessories" element={<AccessoriesPage />} />
            <Route path="purchases" element={<PurchasesPage />} />
            <Route path="supplier-dues" element={<SupplierDuesPage />} />
            <Route path="reports/profit" element={<ProfitLossPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="activity" element={<ActivityLogsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="backups" element={<BackupManagerPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </Toaster>
  );
}
