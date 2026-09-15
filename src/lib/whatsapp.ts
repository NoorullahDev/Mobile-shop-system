import { formatMoneyCompact } from "./format";

/**
 * Generate a WhatsApp deep link URL with a pre-filled dues reminder
 * message in Urdu. Opens in a new tab / WhatsApp app.
 */
export function duesReminderUrl(phone: string | null | undefined, amount: number, businessName?: string): string | null {
  if (!phone || amount <= 0) return null;

  // Clean phone: remove spaces, dashes, parentheses, leading +
  let clean = phone.replace(/[\s\-()+]/g, "");

  // If it starts with 0 (local PK format), prefix 92
  if (clean.startsWith("0")) {
    clean = "92" + clean.slice(1);
  }

  // If no country code, assume Pakistan (92)
  if (!clean.startsWith("92") && !clean.startsWith("1")) {
    clean = "92" + clean;
  }

  const formattedAmount = formatMoneyCompact(amount);
  const shopLine = businessName ? `${businessName} se` : "Aap ki dukaan se";

  const message =
    `Assalamu Alaikum! 🙏\n\n` +
    `${shopLine} Rs. ${formattedAmount} ki payment baqi hai.\n\n` +
    `Baraye meherbani jald se jald ada karein.\n` +
    `Shukriya! 🙏`;

  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}

/**
 * Open WhatsApp dues reminder in a new tab.
 */
export function openDuesReminder(phone: string | null | undefined, amount: number, businessName?: string): void {
  const url = duesReminderUrl(phone, amount, businessName);
  if (url) {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
