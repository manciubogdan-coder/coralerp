import React from "react";
import { createPortal } from "react-dom";
import { QRCodeSVG } from "qrcode.react";

export interface TransferLabelData {
  inventory_item_id: string;
  product_name: string;
  lot_number?: string | null;
  quantity: number;
  unit: string;
  destination?: string | null;
  transfer_date?: string | null;
  supplier?: string | null;
  manufacturer?: string | null;
  document_number?: string | null;
}

const formatDate = (d?: string | null) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("ro-RO"); } catch { return d; }
};

const SingleLabel: React.FC<{ data: TransferLabelData; pageBreak?: boolean }> = ({ data, pageBreak }) => {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = `${origin}/lot/${data.inventory_item_id}?lot=${data.inventory_item_id}`;
  return (
    <div className={`transfer-label ${pageBreak ? "pb" : ""}`}>
      <div className="qr">
        <QRCodeSVG value={url} size={96} level="M" includeMargin={false} />
      </div>
      <div className="info">
        <div className="name" title={data.product_name}>{data.product_name}</div>
        <div className="qty">
          {Number(data.quantity).toLocaleString("ro-RO", { maximumFractionDigits: 2 })} {data.unit}
        </div>
        <div className="row">
          <span className="badge">TRANSFER</span>
          {data.destination || "—"}
        </div>
        <div className="row">Lot: {data.lot_number || "—"}</div>
        {data.supplier && <div className="row">F: {data.supplier}</div>}
        {data.manufacturer && <div className="row">P: {data.manufacturer}</div>}
        <div className="row">
          {formatDate(data.transfer_date)}
          {data.document_number ? ` · Doc: ${data.document_number}` : ""}
        </div>
      </div>
    </div>
  );
};

export const TransferQRLabel: React.FC<{ labels: TransferLabelData[] }> = ({ labels }) => {
  const styleTag = (
    <style>{`
      .transfer-label {
        width: 50mm;
        height: 30mm;
        padding: 1.5mm;
        display: flex;
        gap: 2mm;
        font-family: ui-sans-serif, system-ui, sans-serif;
        color: #000;
        background: #fff;
        box-sizing: border-box;
        overflow: hidden;
        border: 1px dashed #ccc;
      }
      .transfer-label .qr { flex-shrink: 0; display:flex; align-items:center; }
      .transfer-label .info {
        flex: 1; min-width: 0; font-size: 6.5pt; line-height: 1.15;
        display: flex; flex-direction: column; gap: 0.4mm;
      }
      .transfer-label .info .name {
        font-size: 8pt; font-weight: 700;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .transfer-label .info .qty { font-size: 11pt; font-weight: 800; }
      .transfer-label .info .row {
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .transfer-label .info .badge {
        display: inline-block; font-size: 5.5pt; font-weight: 700;
        padding: 0.2mm 0.8mm; border: 0.3mm solid #000;
        border-radius: 0.6mm; margin-right: 1mm;
      }

      .transfer-label-stack { display: flex; flex-direction: column; gap: 8px; align-items: center; }
      .transfer-label-print-portal { display: none; }

      @media print {
        @page { margin: 0; }
        html, body {
          margin: 0 !important; padding: 0 !important;
          background: #fff !important;
          width: 100% !important; height: 100% !important;
        }
        body > *:not(.transfer-label-print-portal) { display: none !important; }
        .transfer-label-print-portal {
          display: block !important;
          position: fixed !important;
          inset: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
        }
        .transfer-label-print-portal .transfer-label {
          width: 100vw !important;
          height: 100vh !important;
          padding: 4vmin !important;
          gap: 4vmin !important;
          border: none !important;
          box-sizing: border-box !important;
          page-break-after: always;
          break-after: page;
        }
        .transfer-label-print-portal .transfer-label:last-child {
          page-break-after: auto;
          break-after: auto;
        }
        .transfer-label-print-portal .transfer-label .qr { width: 45vmin; height: 45vmin; }
        .transfer-label-print-portal .transfer-label .qr svg { width: 100% !important; height: 100% !important; }
        .transfer-label-print-portal .transfer-label .info { font-size: 4.5vmin !important; line-height: 1.25 !important; gap: 1.2vmin !important; }
        .transfer-label-print-portal .transfer-label .info .name { font-size: 6vmin !important; }
        .transfer-label-print-portal .transfer-label .info .qty  { font-size: 9vmin !important; }
        .transfer-label-print-portal .transfer-label .info .badge { font-size: 3.5vmin !important; padding: 0.4vmin 1.2vmin !important; border-width: 0.4vmin !important; border-radius: 1vmin !important; }
      }
    `}</style>
  );

  const portalTarget = typeof document !== "undefined" ? document.body : null;

  return (
    <>
      {styleTag}
      <div className="transfer-label-stack">
        {labels.map((l, i) => (
          <SingleLabel key={`${l.inventory_item_id}-${i}`} data={l} />
        ))}
      </div>
      {portalTarget &&
        createPortal(
          <div className="transfer-label-print-portal">
            {labels.map((l, i) => (
              <SingleLabel key={`p-${l.inventory_item_id}-${i}`} data={l} pageBreak />
            ))}
          </div>,
          portalTarget
        )}
    </>
  );
};

export default TransferQRLabel;
