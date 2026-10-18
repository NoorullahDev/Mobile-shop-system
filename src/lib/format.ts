/**
 * Central formatting utilities for the Mobile Shop Manager Pro frontend.
 * Offline-first, PKR (Pakistani Rupee) is the default currency per the SRS.
 */

export type Currency = "PKR" | "USD";

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  PKR: "Rs.",
  USD: "$",
};

const CURRENCY_LOCALES: Record<Currency, string> = {
  PKR: "en-PK",
  USD: "en-US",
};

const DEFAULT_CURRENCY: Currency = "PKR";

let currentCurrency: Currency = DEFAULT_CURRENCY;

/** Set the active currency (e.g. loaded from settings). */
export function setCurrency(c: Currency) {
  currentCurrency = c;
}

/** Round to 2 decimal places (consistent with backend money math). */
export function roundMoney(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Format a numeric amount as the active currency, e.g. "Rs. 250,000". */
export function formatMoney(n: number, currency: Currency = currentCurrency): string {
  if (!Number.isFinite(n)) return formatMoney(0, currency);
  const symbol = CURRENCY_SYMBOLS[currency];
  const locale = CURRENCY_LOCALES[currency];
  return `${symbol} ${n.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Compact money, no decimals — "Rs. 250,000". */
export function formatMoneyCompact(n: number, currency: Currency = currentCurrency): string {
  if (!Number.isFinite(n)) return formatMoneyCompact(0, currency);
  const symbol = CURRENCY_SYMBOLS[currency];
  const locale = CURRENCY_LOCALES[currency];
  return `${symbol} ${n.toLocaleString(locale, {
    maximumFractionDigits: 0,
  })}`;
}

/** Compact KPI money, e.g. "Rs. 250K" or "Rs. 1.5M". */
export function formatMoneyKpi(n: number, currency: Currency = currentCurrency): string {
  if (!Number.isFinite(n)) return formatMoneyKpi(0, currency);
  const symbol = CURRENCY_SYMBOLS[currency];
  const locale = CURRENCY_LOCALES[currency];
  const absolute = Math.abs(n);
  const [divisor, suffix] = absolute >= 1_000_000_000
    ? [1_000_000_000, "B"]
    : absolute >= 1_000_000
      ? [1_000_000, "M"]
      : absolute >= 1_000
        ? [1_000, "K"]
        : [1, ""];
  const formatted = (n / divisor).toLocaleString(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: suffix ? 1 : 0,
  });
  return `${symbol} ${formatted}${suffix}`;
}

/** Dashboard/Reports KPI money: full below 100K, then K/M notation. */
export function formatDashboardReportKpiMoney(
  n: number,
  currency: Currency = currentCurrency,
): string {
  if (!Number.isFinite(n)) return formatDashboardReportKpiMoney(0, currency);
  const absolute = Math.abs(n);
  if (absolute < 100_000) return formatMoneyCompact(n, currency);

  const symbol = CURRENCY_SYMBOLS[currency];
  const locale = CURRENCY_LOCALES[currency];
  const [divisor, suffix] = absolute >= 1_000_000
    ? [1_000_000, "M"]
    : [1_000, "K"];
  const formatted = (n / divisor).toLocaleString(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
  return `${symbol} ${formatted}${suffix}`;
}

/** Short date, e.g. "26 Aug 2026". */
export function formatDate(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Date + time, e.g. "26 Aug 2026, 02:30 PM". */
export function formatDateTime(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input;
  if (isNaN(d.getTime())) return "—";
  return `${formatDate(d)}, ${d.toLocaleTimeString("en-PK", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

/** Convert a Date to a local YYYY-MM-DD string (avoids UTC offset issues). */
export function toLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Shared payment method labels used across pages. */
export const methodLabels: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  jazzcash: "JazzCash",
  easypaisa: "EasyPaisa",
  card: "Card",
  cheque: "Cheque",
  credit: "Credit",
  exchange_credit: "Exchange Credit",
  other: "Other",
};
