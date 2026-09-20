export const WARRANTY_OPTIONS = [
  { value: "", label: "No Warranty" },
  { value: "7 Days", label: "7 Days" },
  { value: "15 Days", label: "15 Days" },
  { value: "1 Month", label: "1 Month" },
  { value: "3 Months", label: "3 Months" },
  { value: "6 Months", label: "6 Months" },
  { value: "1 Year", label: "1 Year" },
  { value: "custom", label: "Custom…" },
] as const;

/** Compute warranty expiry ISO date from sale date + warranty label. */
export function computeWarrantyExpiry(saleDateStr: string, warranty: string): string | null {
  if (!warranty || warranty === "custom") return null;
  const saleDate = new Date(saleDateStr);
  if (isNaN(saleDate.getTime())) return null;

  const expiry = new Date(saleDate);
  switch (warranty) {
    case "7 Days":
      expiry.setDate(expiry.getDate() + 7);
      break;
    case "15 Days":
      expiry.setDate(expiry.getDate() + 15);
      break;
    case "1 Month":
      expiry.setMonth(expiry.getMonth() + 1);
      break;
    case "3 Months":
      expiry.setMonth(expiry.getMonth() + 3);
      break;
    case "6 Months":
      expiry.setMonth(expiry.getMonth() + 6);
      break;
    case "1 Year":
      expiry.setFullYear(expiry.getFullYear() + 1);
      break;
    default:
      return null;
  }
  return expiry.toISOString().slice(0, 10);
}

/** Check whether a warranty is still active as of today. */
export function isWarrantyActive(warrantyExpiry: string | null | undefined): boolean {
  if (!warrantyExpiry) return false;
  const expiry = new Date(warrantyExpiry);
  if (isNaN(expiry.getTime())) return false;
  return expiry.getTime() >= Date.now();
}
