import { useEffect, useState } from "react";
import { Printer, Save, RefreshCw } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Select } from "../components/Select";
import { Input } from "../components/Input";
import { Alert } from "../components/Alert";
import { useReceiptSettingsStore } from "../store/receiptSettings";
import { useSettingsStore } from "../store/settings";
import { useSessionStore } from "../store/session";
import { buildReceiptData } from "../lib/receiptLayout";
import { ReceiptView } from "../components/receipt/ReceiptView";
import { FONT_SIZES, PAPER_WIDTHS } from "../types/receipt";
import type { ReceiptPaperWidth, ReceiptSettings } from "../types/receipt";
import type { Sale } from "../types/sale";

const PREVIEW_WIDTH_BY_PAPER: Record<ReceiptPaperWidth, number> = {
  "80mm": 440,
  "58mm": 320,
};

const PREVIEW_SALE: Sale = {
  id: 0,
  receipt_no: "INV-000001",
  member_id: 1,
  member_name: "Tahir Shah",
  member_phone: "0345 6789101",
  total_amount: 155000,
  discount: 2000,
  paid_amount: 155000,
  payment_method: "cash",
  notes: null,
  created_by: null,
  created_at: new Date().toISOString(),
  items: [
    {
      id: 1,
      sale_id: 0,
      item_type: "phone",
      item_id: 1,
      imei_id: 1,
      quantity: 1,
      unit_price: 150000,
      product_name: "iPhone 13 Pro Max",
      variant: "512GB · Sierra Blue",
      serial_no: "DX3XK1ABC123",
      imei: "356789101112131",
    },
    {
      id: 2,
      sale_id: 0,
      item_type: "accessory",
      item_id: 2,
      imei_id: null,
      quantity: 2,
      unit_price: 3500,
      product_name: "Tempered Glass",
      variant: null,
      serial_no: null,
      imei: null,
    },
  ],
};

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between py-1.5"
      style={{ background: "transparent" }}
    >
      <span style={{ fontSize: "13px", color: "#0F172A" }}>{label}</span>
      <span
        className="flex h-5 w-9 shrink-0 items-center rounded-full px-0.5 transition-colors"
        style={{
          background: checked ? "#3B6FD4" : "#CBD5E1",
          justifyContent: checked ? "flex-end" : "flex-start",
        }}
      >
        <span
          className="h-4 w-4 rounded-full bg-white shadow"
          style={{
            boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
          }}
        />
      </span>
    </button>
  );
}

export function ReceiptSettingsPage() {
  const rs = useReceiptSettingsStore();
  const business = useSettingsStore();
  const user = useSessionStore((s) => s.user);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const s = useReceiptSettingsStore.getState();
    if (!s.loaded) s.load().catch(() => {});
    s.refreshPrinters();
  }, []);

  const set = (patch: Partial<ReceiptSettings>) => rs.set(patch);

  const printerOptions = [
    { value: "", label: "System Default" },
    ...rs.printers.map((name) => ({ value: name, label: name })),
  ];
  if (rs.printer && !rs.printers.includes(rs.printer)) {
    printerOptions.push({ value: rs.printer, label: `${rs.printer} (offline)` });
  }

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await rs.save(user?.id ?? null);
      setMessage("Receipt settings saved successfully.");
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const sampleData = buildReceiptData(
    PREVIEW_SALE,
    {
      name: business.businessName,
      logo: business.logo,
      phone: business.phone,
      email: business.email,
      address: business.address,
      currency: business.currency,
    },
    rs,
  );

  return (
    <div>
      <PageHeader
        title="Receipt Settings"
        description="Configure thermal receipt printing: paper size, printer destination and visible fields"
        breadcrumb={[{ label: "System" }, { label: "Settings" }, { label: "Receipt" }]}
        actions={
          <Button
            size="sm"
            onClick={handleSave}
            loading={saving}
            icon={<Save className="h-3.5 w-3.5" />}
          >
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        }
      />

      {error && <div className="mb-4"><Alert message={error} variant="error" /></div>}
      {message && (
        <div className="mb-4">
          <Alert message={message} variant="success" title="Saved" />
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        {/* Left: controls */}
        <div className="flex flex-col gap-5 lg:col-span-2">
          {/* Print destination */}
          <Card
            title="Print Destination"
            subtitle={rs.useSystemPrintDialog ? "Receipts open in the system print dialog for printer selection" : "Receipts are sent silently to the selected thermal printer"}
            actions={
              rs.printersLoading ? (
                <Button size="xs" variant="ghost" loading>
                  Loading
                </Button>
              ) : (
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => rs.refreshPrinters()}
                  icon={<RefreshCw className="h-3.5 w-3.5" />}
                  title="Refresh printer list"
                />
              )
            }
          >
          <div className="flex flex-col gap-3">
              <Switch
                label="Open in Print Window"
                checked={rs.useSystemPrintDialog}
                onChange={(v) => set({ useSystemPrintDialog: v })}
              />
              <p style={{ fontSize: 12, color: "#64748B", margin: "-4px 0 0 0", lineHeight: 1.4 }}>
                {rs.useSystemPrintDialog
                  ? "Receipt will open in the system print dialog where you can choose a printer, copies, layout, etc."
                  : "Receipt is sent silently to the selected printer below without any dialog."}
              </p>
              {!rs.useSystemPrintDialog && (
                <>
                  <Select
                    label="Printer"
                    options={printerOptions}
                    value={rs.printer}
                    onChange={(e) => set({ printer: e.target.value })}
                    hint="System Default uses the Windows default printer. Choose your thermal printer (e.g. ...80) for best results."
                  />
                  {rs.printersError && !rs.printer && (
                    <Alert
                      variant="warning"
                      title="Printer list unavailable"
                      message="You can still print using the system default printer."
                    />
                  )}
                </>
              )}
            </div>
          </Card>

          {/* Paper & style */}
          <Card title="Paper & Style">
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Paper Width"
                options={PAPER_WIDTHS.map((w) => ({ value: w, label: w }))}
                value={rs.paperWidth}
                onChange={(e) => set({ paperWidth: e.target.value as "80mm" | "58mm" })}
              />
              <Select
                label="Font Size"
                options={FONT_SIZES.map((f) => ({ value: String(f), label: `${f} px` }))}
                value={String(rs.fontSize)}
                onChange={(e) => set({ fontSize: Number(e.target.value) })}
              />
              <div className="col-span-2">
                <Input
                  label="Shop Tagline (shown under shop name)"
                  value={rs.tagline}
                  onChange={(e) => set({ tagline: e.target.value })}
                  placeholder="e.g. Quality mobile solutions since 2010"
                />
              </div>
            </div>
          </Card>

          {/* Visibility */}
          <Card title="Visible Sections">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#94A3B8" }}>
              Business Information
            </div>
            <div className="mb-3 grid grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-2">
              <Switch label="Shop Name" checked={rs.showShopName} onChange={(v) => set({ showShopName: v })} />
              <Switch label="Logo" checked={rs.showLogo} onChange={(v) => set({ showLogo: v })} />
              <Switch label="Tagline" checked={rs.showTagline} onChange={(v) => set({ showTagline: v })} />
              <Switch label="Address" checked={rs.showAddress} onChange={(v) => set({ showAddress: v })} />
              <Switch label="Phone" checked={rs.showPhone} onChange={(v) => set({ showPhone: v })} />
              <Switch label="Email" checked={rs.showEmail} onChange={(v) => set({ showEmail: v })} />
            </div>

            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#94A3B8" }}>
              Receipt Information
            </div>
            <div className="mb-3 grid grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-2">
              <Switch label="Title" checked={rs.showTitle} onChange={(v) => set({ showTitle: v })} />
              <Switch label="Invoice Number" checked={rs.showInvoice} onChange={(v) => set({ showInvoice: v })} />
              <Switch label="Date & Time" checked={rs.showDatetime} onChange={(v) => set({ showDatetime: v })} />
              <Switch label="Customer Name" checked={rs.showCustomer} onChange={(v) => set({ showCustomer: v })} />
              <Switch label="Customer Phone" checked={rs.showCustomerPhone} onChange={(v) => set({ showCustomerPhone: v })} />
            </div>

            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#94A3B8" }}>
              Item Information
            </div>
            <div className="mb-3 grid grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-2">
              <Switch label="Variant / Specs" checked={rs.showVariant} onChange={(v) => set({ showVariant: v })} />
              <Switch label="Serial Number" checked={rs.showSerial} onChange={(v) => set({ showSerial: v })} />
              <Switch label="IMEI" checked={rs.showImei} onChange={(v) => set({ showImei: v })} />
            </div>

            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#94A3B8" }}>
              Payment & Footer
            </div>
            <div className="grid grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-2">
              <Switch label="Totals & Payment" checked={rs.showPaymentDetails} onChange={(v) => set({ showPaymentDetails: v })} />
              <Switch label="Footer Message" checked={rs.showFooter} onChange={(v) => set({ showFooter: v })} />
              <Switch label="Software Credit" checked={rs.showSoftwareCredit} onChange={(v) => set({ showSoftwareCredit: v })} />
            </div>
          </Card>

          {/* Footer text */}
          <Card title="Footer Message">
            <textarea
              value={rs.footerText}
              onChange={(e) => set({ footerText: e.target.value })}
              rows={2}
              placeholder="Thanks for coming in! Contact us for any issue."
              style={{
                width: "100%",
                borderRadius: 6,
                border: "1px solid #CBD5E1",
                padding: "8px 10px",
                fontSize: 13,
                color: "#0F172A",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </Card>
        </div>

        {/* Right: live preview */}
        <div className="lg:col-span-3">
          <Card
            title="Live Preview"
            subtitle={`${rs.paperWidth} layout — scaled up for screen readability (print stays true ${rs.paperWidth}) · updates instantly`}
          >
            <div className="py-2" style={{ background: "#F7F8FA", borderRadius: 8 }}>
              <ReceiptView
                data={sampleData}
                settings={rs}
                displayWidthPx={PREVIEW_WIDTH_BY_PAPER[rs.paperWidth]}
                maxHeightPx={540}
              />
            </div>
            <div className="mt-4 flex items-center gap-2" style={{ color: "#64748B" }}>
              <Printer className="h-4 w-4" />
              <span className="text-[12px]">
                Printing sends one exact-size job to the selected thermal printer — no A4, no blank pages.
              </span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}