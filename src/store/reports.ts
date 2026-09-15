import { create } from "zustand";
import type { ActivityLog, DashboardSummary, MonthlyPoint } from "../types/report";
import * as reportService from "../services/reportService";

function localToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface DashboardState {
  summary: DashboardSummary | null;
  revenueSeries: MonthlyPoint[];
  expenseSeries: MonthlyPoint[];
  activity: ActivityLog[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
}

export const useReportStore = create<DashboardState>((set) => ({
  summary: null,
  revenueSeries: [],
  expenseSeries: [],
  activity: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const today = localToday();
      const [summary, revenueSeries, expenseSeries, activity] = await Promise.all([
        reportService.getDashboardSummary(12, today),
        reportService.getRevenueSeries(),
        reportService.getExpenseSeries(),
        reportService.getRecentActivity(10),
      ]);
      set({ summary, revenueSeries, expenseSeries, activity, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },
}));
