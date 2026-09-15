import { openUrl } from "@tauri-apps/plugin-opener";
import { formatMoneyCompact } from "./format";

/**
 * Validate and normalize a Pakistani phone number for WhatsApp.
 * Returns the cleaned number with country code, or null if invalid.
 */
function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;

  // Strip all non-digit characters
  let clean = phone.replace(/\D/g, "");

  // Must have at least 10 digits to be a valid PK number
  if (clean.length < 10) return null;

  // Handle 03xx local format → 923xx
  if (clean.startsWith("0") && clean.length >= 11) {
    clean = "92" + clean.slice(1);
  }

  // Handle +92xxx format (already has country code)
  if (clean.startsWith("92") && clean.length >= 12) {
    return clean;
  }

  // Handle 3xx without leading 0 (rare but possible)
  if (clean.startsWith("3") && clean.length >= 10) {
    return "92" + clean;
  }

  // If it already starts with 92 and is long enough, accept it
  if (clean.startsWith("92")) return clean;

  return null;
}

const FALLBACK_TEMPLATE =
  "Assalam-o-Alaikum {customer_name},\n{shop_name} mein aapki Rs. {due_amount} payment baqi hai.\nBaraye meherbani jald ada karein.\nShukriya.";

/**
 * Build the WhatsApp deep link URL with a pre-filled dues reminder.
 * Uses the saved template if provided, otherwise falls back to the default message.
 */
export function duesReminderUrl(
  phone: string | null | undefined,
  amount: number,
  businessName?: string,
  template?: string,
  customerName?: string,
): string | null {
  const cleanPhone = normalizePhone(phone);
  if (!cleanPhone) return null;
  if (amount <= 0) return null;

  const formattedAmount = formatMoneyCompact(amount);
  const resolvedTemplate = template || FALLBACK_TEMPLATE;

  const message = resolvedTemplate
    .split("{customer_name}").join(customerName || "Customer")
    .split("{shop_name}").join(businessName || "Shop")
    .split("{due_amount}").join(formattedAmount);

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Open WhatsApp dues reminder in the system's default browser / WhatsApp app.
 * Returns true on success, false if phone was invalid.
 */
export async function openDuesReminder(
  phone: string | null | undefined,
  amount: number,
  businessName?: string,
  template?: string,
  customerName?: string,
): Promise<boolean> {
  const url = duesReminderUrl(phone, amount, businessName, template, customerName);
  if (!url) return false;
  try {
    await openUrl(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a phone number is valid for WhatsApp.
 */
export function isPhoneValid(phone: string | null | undefined): boolean {
  return normalizePhone(phone) !== null;
}
