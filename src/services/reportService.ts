import { invoke } from "@tauri-apps/api/core";
import type {
  ActivityLog,
  DashboardSummary,
  MonthlyPoint,
  PaymentBreakdown,
  PeriodSummary,
  ProfitLoss,
  SalePoint,
  TopSeller,
} from "../types/report";

export async function getDashboardSummary(months?: number): Promise<DashboardSummary> {
  return invoke<DashboardSummary>("get_dashboard_summary", { months: months ?? 12 });
}

export async function getRevenueSeries(months?: number): Promise<MonthlyPoint[]> {
  return invoke<MonthlyPoint[]>("get_revenue_series", { months: months ?? 12 });
}

export async function getExpenseSeries(months?: number): Promise<MonthlyPoint[]> {
  return invoke<MonthlyPoint[]>("get_expense_series", { months: months ?? 12 });
}

export async function getRecentActivity(limit?: number): Promise<ActivityLog[]> {
  return invoke<ActivityLog[]>("get_recent_activity", { limit: limit ?? 10 });
}

export async function getPeriodSummary(from: string, to: string): Promise<PeriodSummary> {
  return invoke<PeriodSummary>("get_period_summary", { from, to });
}

export async function getSalesSeries(from: string, to: string): Promise<SalePoint[]> {
  return invoke<SalePoint[]>("get_sales_series", { from, to });
}

export async function getTopSellers(from: string, to: string, limit?: number): Promise<TopSeller[]> {
  return invoke<TopSeller[]>("get_top_sellers", { from, to, limit: limit ?? 5 });
}

export async function getPaymentBreakdown(from: string, to: string): Promise<PaymentBreakdown[]> {
  return invoke<PaymentBreakdown[]>("get_payment_breakdown", { from, to });
}

export async function getProfitLoss(from: string, to: string): Promise<ProfitLoss> {
  return invoke<ProfitLoss>("get_profit_loss", { from, to });
}
