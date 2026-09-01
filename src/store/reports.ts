import { create } from "zustand";
import type { ActivityLog, DashboardSummary, MonthlyPoint } from "../types/report";
import * as reportService from "../services/reportService";

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
      const [summary, revenueSeries, expenseSeries, activity] = await Promise.all([
        reportService.getDashboardSummary(),
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
