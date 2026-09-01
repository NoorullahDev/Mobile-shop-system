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
