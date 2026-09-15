import { useEffect, useState } from "react";
import { Save, Info } from "lucide-react";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Alert } from "../components/Alert";
import * as settingsService from "../services/settingsService";
import { useSessionStore } from "../store/session";
import { useSettingsStore } from "../store/settings";

const PLACEHOLDERS = [
  { key: "{customer_name}", desc: "Customer's name" },
  { key: "{shop_name}", desc: "Business / shop name" },
  { key: "{due_amount}", desc: "Outstanding amount" },
];

export function WhatsAppReminderSettings() {
  const actor = useSessionStore((s) => s.user?.id ?? null);
  const { whatsappTemplate, applyChanges } = useSettingsStore();
  const [template, setTemplate] = useState(whatsappTemplate);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTemplate(whatsappTemplate);
  }, [whatsappTemplate]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await settingsService.updateSetting("whatsapp_template", template, actor);
      applyChanges({ whatsappTemplate: template });
      setMessage("WhatsApp reminder template saved.");
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const preview = template
    .split("{customer_name}").join("Ahmed Khan")
    .split("{shop_name}").join(useSettingsStore.getState().businessName || "Your Shop")
    .split("{due_amount}").join("5,000");

  return (
    <div className="space-y-5">
      {error && <Alert message={error} variant="error" />}
      {message && <Alert message={message} variant="success" />}

      <Card
        title="WhatsApp Dues Reminder Template"
        subtitle="Customize the message sent when you click the WhatsApp icon beside a customer with outstanding dues."
        actions={
          <Button
            size="sm"
            onClick={handleSave}
            loading={saving}
            icon={<Save className="h-3.5 w-3.5" />}
          >
            {saving ? "Saving..." : "Save Template"}
          </Button>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium" style={{ color: "#334155" }}>
              Message Template
            </label>
            <textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              rows={6}
              className="w-full rounded-md border px-3 py-2 text-[13px] focus:outline-none focus:ring-2"
              style={{ borderColor: "#CBD5E1", background: "#FFFFFF", color: "#0F172A" }}
              placeholder="Type your reminder message..."
            />
          </div>

          <div
            className="rounded-md p-3"
            style={{ background: "#F0F9FF", border: "1px solid #BAE6FD" }}
          >
            <div className="mb-2 flex items-center gap-2">
              <Info className="h-4 w-4" style={{ color: "#0284C7" }} />
              <span className="text-[12px] font-semibold" style={{ color: "#0369A1" }}>
                Available Placeholders
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {PLACEHOLDERS.map(({ key, desc }) => (
                <span
                  key={key}
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
                  style={{ background: "#E0F2FE", color: "#0369A1" }}
                >
                  <code className="font-mono">{key}</code>
                  <span style={{ color: "#64748B" }}>— {desc}</span>
                </span>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium" style={{ color: "#334155" }}>
              Preview
            </label>
            <div
              className="rounded-md p-3 text-[13px] whitespace-pre-wrap"
              style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#166534" }}
            >
              {preview}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
