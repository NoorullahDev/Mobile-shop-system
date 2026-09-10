import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { buildReceiptInner, mmToPx } from "../../lib/receiptHtml";
import { PAPER_RULES } from "../../lib/receiptLayout";
import type { ReceiptData, ReceiptSettings } from "../../types/receipt";

interface ReceiptViewProps {
  data: ReceiptData;
  settings: ReceiptSettings;
  /** Small physical-scale view (used by the print modal). Used as the target when displayWidthPx is omitted. */
  scale?: number;
  /** Desired on-screen preview width in px. The receipt is scaled to this width when space allows, and scaled down proportionally when the container is narrower so nothing is ever clipped. */
  displayWidthPx?: number;
  /** When set, long receipts scroll vertically inside the preview. */
  maxHeightPx?: number;
}

const BOX_PADDING = 12;

export function ReceiptView({
  data,
  settings,
  scale = 0.8,
  displayWidthPx,
  maxHeightPx,
}: ReceiptViewProps) {
  const inner = useMemo(() => buildReceiptInner(data, settings), [data, settings]);
  const contentWpx = mmToPx(PAPER_RULES[settings.paperWidth].contentMm);
  const targetWpx =
    displayWidthPx && displayWidthPx > 0 ? displayWidthPx : contentWpx * scale;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [availableWpx, setAvailableWpx] = useState<number>(targetWpx + BOX_PADDING * 2);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const avail = el.clientWidth - BOX_PADDING * 2;
      if (avail > 0) setAvailableWpx(avail);
    };
    update();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    if (ro) ro.observe(el);
    return () => ro?.disconnect();
  }, []);

  const fittedWpx = Math.min(targetWpx, availableWpx);
  const zoom = fittedWpx / contentWpx;
  const boxWpx = contentWpx * zoom + BOX_PADDING * 2;

  return (
    <div ref={containerRef} style={{ width: "100%" }}>
      <div
        style={{
          width: boxWpx,
          margin: "0 auto",
          padding: BOX_PADDING,
          background: "#fff",
          borderRadius: 6,
          boxShadow: "0 1px 3px rgba(0,0,0,0.14), 0 4px 14px rgba(0,0,0,0.08)",
          maxHeight: maxHeightPx,
          overflowY: maxHeightPx ? "auto" : "visible",
          overflowX: "visible",
        }}
      >
        <div style={{ width: contentWpx, zoom, lineHeight: 0 }}>
          <div dangerouslySetInnerHTML={{ __html: inner }} />
        </div>
      </div>
    </div>
  );
}