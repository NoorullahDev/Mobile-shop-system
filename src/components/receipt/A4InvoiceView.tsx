import type { ReceiptData } from "../../types/receipt";
import { buildA4InvoiceInner } from "../../lib/a4InvoiceHtml";

interface A4InvoiceViewProps {
  data: ReceiptData;
  scale?: number;
}

export function A4InvoiceView({ data, scale = 0.5 }: A4InvoiceViewProps) {
  const inner = buildA4InvoiceInner(data);
  const pxScale = scale ?? 0.5;

  return (
    <div
      style={{
        width: `${210 * (96 / 25.4) * pxScale}px`,
        margin: "0 auto",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          transform: `scale(${pxScale})`,
          transformOrigin: "top center",
          width: `${210 * (96 / 25.4)}px`,
        }}
        dangerouslySetInnerHTML={{ __html: inner }}
      />
    </div>
  );
}
