import React from "react";
import { QRCodeSVG } from "qrcode.react";

export interface LotLabelData {
  id: string;
  name: string;
  supplier?: string | null;
  manufacturer?: string | null;
  quantity: number;
  unit: string;
  lot_number?: string | null;
  receipt_date?: string | null;
  entry_number?: number | null;
  document_number?: string | null;
  inventory_type: "materii-prime" | "ambalaje" | "etichete";
}

const typeLabel = (t: string) =>
  t === "ambalaje" ? "AMB" : t === "etichete" ? "ETI" : "MP";

const formatDate = (d?: string | null) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("ro-RO");
  } catch {
    return d;
  }
};

/**
 * Etichetă printabilă (~50×30mm) pentru rolă termică.
 * Are clasa `lot-label` și este înconjurată într-un wrapper print-only.
 */
export const LotQRLabel: React.FC<{ data: LotLabelData }> = ({ data }) => {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = `${origin}/lot/${data.id}`;

  return (
    <div className="lot-label-wrapper">
      <style>{`
        .lot-label {
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
        .lot-label .qr { flex-shrink: 0; display:flex; align-items:center; }
        .lot-label .info {
          flex: 1;
          min-width: 0;
          font-size: 6.5pt;
          line-height: 1.15;
          display: flex;
          flex-direction: column;
          gap: 0.4mm;
        }
        .lot-label .info .name {
          font-size: 8pt;
          font-weight: 700;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .lot-label .info .qty {
          font-size: 9pt;
          font-weight: 700;
        }
        .lot-label .info .row {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .lot-label .info .badge {
          display: inline-block;
          font-size: 5.5pt;
          font-weight: 700;
          padding: 0.2mm 0.8mm;
          border: 0.3mm solid #000;
          border-radius: 0.6mm;
          margin-right: 1mm;
        }
        @media print {
          @page { size: 50mm 30mm; margin: 0; }
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          body * { visibility: hidden !important; }
          .lot-label-wrapper, .lot-label-wrapper * { visibility: visible !important; }
          .lot-label-wrapper {
            position: fixed !important;
            inset: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }
          .lot-label { border: none !important; }
        }
      `}</style>
      <div className="lot-label">
        <div className="qr">
          <QRCodeSVG value={url} size={96} level="M" includeMargin={false} />
        </div>
        <div className="info">
          <div className="name" title={data.name}>{data.name}</div>
          <div className="qty">
            {Number(data.quantity).toLocaleString("ro-RO", {
              maximumFractionDigits: 2,
            })} {data.unit}
          </div>
          <div className="row">
            <span className="badge">{typeLabel(data.inventory_type)}</span>
            Lot: {data.lot_number || "—"}
          </div>
          {data.supplier && <div className="row">F: {data.supplier}</div>}
          {data.manufacturer && <div className="row">P: {data.manufacturer}</div>}
          <div className="row">
            {formatDate(data.receipt_date)}
            {data.entry_number ? ` · #${data.entry_number}` : ""}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LotQRLabel;
