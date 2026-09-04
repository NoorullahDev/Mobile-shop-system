import { create } from "zustand";
import * as settingsService from "../services/settingsService";
import type { Currency } from "../lib/format";

export type ReceiptPaperSize = "58mm" | "80mm";

export interface BusinessProfile {
  businessName: string;
  logo: string | null;
  phone: string;
  email: string;
  address: string;
  currency: Currency;
  receiptPaperSize: ReceiptPaperSize;
}

interface SettingsState extends BusinessProfile {
  loaded: boolean;
  load: () => Promise<void>;
  applyChanges: (patch: Partial<BusinessProfile>) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  businessName: "",
  logo: null,
  phone: "",
  email: "",
  address: "",
  currency: "PKR",
  receiptPaperSize: "80mm",
  loaded: false,

  load: async () => {
    const settings = await settingsService.getAllSettings();
    const map = new Map(settings.map((s) => [s.key, s.value ?? ""]));
    set({
      businessName: map.get("business_name") ?? "",
      logo: map.get("shop_logo") || null,
      phone: map.get("phone") ?? "",
      email: map.get("email") ?? "",
      address: map.get("address") ?? "",
      currency: (map.get("currency") as Currency | undefined) ?? "PKR",
      receiptPaperSize: map.get("receipt_paper_size") === "58mm" ? "58mm" : "80mm",
      loaded: true,
    });
  },

  applyChanges: (patch) => set(patch),
}));