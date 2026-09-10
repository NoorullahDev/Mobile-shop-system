import { create } from "zustand";
import * as settingsService from "../services/settingsService";
import { getPrinters } from "../services/printingService";
import { DEFAULT_RECEIPT_SETTINGS } from "../types/receipt";
import type { ReceiptPaperWidth, ReceiptSettings } from "../types/receipt";

const KEYS: [keyof ReceiptSettings, string][] = [
  ["paperWidth", "receipt_paper_width"],
  ["fontSize", "receipt_font_size"],
  ["printer", "receipt_printer"],
  ["useSystemPrintDialog", "receipt_use_system_print_dialog"],
  ["footerText", "receipt_footer_text"],
  ["tagline", "receipt_tagline"],
  ["showLogo", "receipt_show_logo"],
  ["showShopName", "receipt_show_shop_name"],
  ["showTagline", "receipt_show_tagline"],
  ["showAddress", "receipt_show_address"],
  ["showPhone", "receipt_show_phone"],
  ["showEmail", "receipt_show_email"],
  ["showTitle", "receipt_show_title"],
  ["showInvoice", "receipt_show_invoice"],
  ["showDatetime", "receipt_show_datetime"],
  ["showCustomer", "receipt_show_customer"],
  ["showCustomerPhone", "receipt_show_customer_phone"],
  ["showVariant", "receipt_show_variant"],
  ["showSerial", "receipt_show_serial"],
  ["showImei", "receipt_show_imei"],
  ["showPaymentDetails", "receipt_show_payment_details"],
  ["showFooter", "receipt_show_footer"],
  ["showSoftwareCredit", "receipt_show_software_credit"],
];

interface ReceiptSettingsStoreState extends ReceiptSettings {
  loaded: boolean;
  printers: string[];
  printersLoading: boolean;
  printersError: string | null;
  load: () => Promise<void>;
  set: (patch: Partial<ReceiptSettings>) => void;
  save: (actor?: number | null) => Promise<void>;
  refreshPrinters: () => Promise<void>;
}

function parseBool(v: string | undefined, def: boolean): boolean {
  if (v === "1") return true;
  if (v === "0") return false;
  return def;
}

export const useReceiptSettingsStore = create<ReceiptSettingsStoreState>((set, get) => ({
  ...DEFAULT_RECEIPT_SETTINGS,
  loaded: false,
  printers: [],
  printersLoading: false,
  printersError: null,

  load: async () => {
    try {
      const settings = await settingsService.getAllSettings();
      const map = new Map(settings.map((s) => [s.key, s.value ?? ""]));

      const paper = map.get("receipt_paper_width") as ReceiptPaperWidth | undefined;
      const fontSize = Number(map.get("receipt_font_size") ?? "11") || 11;

      set({
        paperWidth: paper === "58mm" ? "58mm" : "80mm",
        fontSize: Math.min(14, Math.max(9, Math.round(fontSize))),
        printer: map.get("receipt_printer") ?? "",
        useSystemPrintDialog: parseBool(map.get("receipt_use_system_print_dialog"), DEFAULT_RECEIPT_SETTINGS.useSystemPrintDialog),
        footerText: map.get("receipt_footer_text") ?? DEFAULT_RECEIPT_SETTINGS.footerText,
        tagline: map.get("receipt_tagline") ?? "",
        showLogo: parseBool(map.get("receipt_show_logo"), DEFAULT_RECEIPT_SETTINGS.showLogo),
        showShopName: parseBool(map.get("receipt_show_shop_name"), DEFAULT_RECEIPT_SETTINGS.showShopName),
        showTagline: parseBool(map.get("receipt_show_tagline"), DEFAULT_RECEIPT_SETTINGS.showTagline),
        showAddress: parseBool(map.get("receipt_show_address"), DEFAULT_RECEIPT_SETTINGS.showAddress),
        showPhone: parseBool(map.get("receipt_show_phone"), DEFAULT_RECEIPT_SETTINGS.showPhone),
        showEmail: parseBool(map.get("receipt_show_email"), DEFAULT_RECEIPT_SETTINGS.showEmail),
        showTitle: parseBool(map.get("receipt_show_title"), DEFAULT_RECEIPT_SETTINGS.showTitle),
        showInvoice: parseBool(map.get("receipt_show_invoice"), DEFAULT_RECEIPT_SETTINGS.showInvoice),
        showDatetime: parseBool(map.get("receipt_show_datetime"), DEFAULT_RECEIPT_SETTINGS.showDatetime),
        showCustomer: parseBool(map.get("receipt_show_customer"), DEFAULT_RECEIPT_SETTINGS.showCustomer),
        showCustomerPhone: parseBool(map.get("receipt_show_customer_phone"), DEFAULT_RECEIPT_SETTINGS.showCustomerPhone),
        showVariant: parseBool(map.get("receipt_show_variant"), DEFAULT_RECEIPT_SETTINGS.showVariant),
        showSerial: parseBool(map.get("receipt_show_serial"), DEFAULT_RECEIPT_SETTINGS.showSerial),
        showImei: parseBool(map.get("receipt_show_imei"), DEFAULT_RECEIPT_SETTINGS.showImei),
        showPaymentDetails: parseBool(map.get("receipt_show_payment_details"), DEFAULT_RECEIPT_SETTINGS.showPaymentDetails),
        showFooter: parseBool(map.get("receipt_show_footer"), DEFAULT_RECEIPT_SETTINGS.showFooter),
        showSoftwareCredit: parseBool(map.get("receipt_show_software_credit"), DEFAULT_RECEIPT_SETTINGS.showSoftwareCredit),
        loaded: true,
      });
    } catch (e) {
      set({ loaded: true });
      throw e;
    }
  },

  set: (patch) => set(patch),

  save: async (actor) => {
    const s = get();
    for (const [k, key] of KEYS) {
      const v = s[k];
      let value: string;
      if (typeof v === "boolean") value = v ? "1" : "0";
      else if (typeof v === "number") value = String(v);
      else value = String(v ?? "");
      await settingsService.updateSetting(key, value, actor ?? null);
    }
  },

  refreshPrinters: async () => {
    set({ printersLoading: true, printersError: null });
    try {
      const list = await getPrinters();
      set({ printers: list.map((p) => p.name), printersLoading: false });
    } catch (e) {
      set({ printers: [], printersLoading: false, printersError: String(e) });
    }
  },
}));