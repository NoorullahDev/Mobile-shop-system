import { create } from "zustand";
import * as settingsService from "../services/settingsService";
import type { Currency } from "../lib/format";

export interface BusinessProfile {
  businessName: string;
  ownerName: string;
  logo: string | null;
  phone: string;
  email: string;
  address: string;
  currency: Currency;
  whatsappTemplate: string;
}

const DEFAULT_WHATSAPP_TEMPLATE =
  "Assalam-o-Alaikum {customer_name},\n{shop_name} mein aapki Rs. {due_amount} payment baqi hai.\nBaraye meherbani jald ada karein.\nShukriya.";

interface SettingsState extends BusinessProfile {
  loaded: boolean;
  load: () => Promise<void>;
  applyChanges: (patch: Partial<BusinessProfile>) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  businessName: "",
  ownerName: "",
  logo: null,
  phone: "",
  email: "",
  address: "",
  currency: "PKR",
  whatsappTemplate: DEFAULT_WHATSAPP_TEMPLATE,
  loaded: false,

  load: async () => {
    try {
      const settings = await settingsService.getAllSettings();
      const map = new Map(settings.map((s) => [s.key, s.value ?? ""]));
      set({
        businessName: map.get("business_name") ?? "",
        ownerName: map.get("owner_name") ?? "",
        logo: map.get("shop_logo") || null,
        phone: map.get("phone") ?? "",
        email: map.get("email") ?? "",
        address: map.get("address") ?? "",
        currency: (map.get("currency") as Currency | undefined) ?? "PKR",
        whatsappTemplate: map.get("whatsapp_template") || DEFAULT_WHATSAPP_TEMPLATE,
        loaded: true,
      });
    } catch (e) {
      console.error("Failed to load settings:", e);
      set({ loaded: true });
    }
  },

  applyChanges: (patch) => set(patch),
}));
