import React from "react";
import { createPortal } from "react-dom";
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
  try { return new Date(d).toLocaleDateString("ro-RO"); } catch { return d; }
};

/**
 * Etichetă printabilă (~50×30mm) pentru rolă termică.
 * Folosim un PORTAL direct pe <body> + `display:none` pe toți ceilalți copii
 * ai body-ului în print, ca să nu se mai pagineze conținutul real
 * (altfel imprimă ~16 pagini pentru că restul UI-ului rămâne în layout).
 */
export const LotQRLabel: React.FC<{ data: LotLabelData }> = ({ data }) => {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  // Includem și un query param `?lot=<id>` ca să fie 100% lipsit de ambiguitate
  // la scanare (host-ul preview-ului Lovable conține și el un UUID — project id).
  const url = `${origin}/lot/${data.id}?lot=${data.id}`;

  const labelMarkup = (
    <div className="lot-label">
      <div className="qr">
        <QRCodeSVG value={url} size={96} level="M" includeMargin={false} />
      </div>
      <div className="info">
        <div className="name" title={data.name}>{data.name}</div>
        <div className="qty">
          {Number(data.quantity).toLocaleString("ro-RO", { maximumFractionDigits: 2 })} {data.unit}
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
  );

  const styleTag = (
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
        flex: 1; min-width: 0; font-size: 6.5pt; line-height: 1.15;
        display: flex; flex-direction: column; gap: 0.4mm;
      }
      .lot-label .info .name {
        font-size: 8pt; font-weight: 700;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .lot-label .info .qty { font-size: 9pt; font-weight: 700; }
      .lot-label .info .row {
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .lot-label .info .badge {
        display: inline-block; font-size: 5.5pt; font-weight: 700;
        padding: 0.2mm 0.8mm; border: 0.3mm solid #000;
        border-radius: 0.6mm; margin-right: 1mm;
      }

      /* Portal-ul nu se vede pe ecran — doar la print */
      .lot-label-print-portal { display: none; }

      @media print {
        /* Lăsăm browser-ul să folosească formatul ales de utilizator în dialogul
           de print (A4, A5, sau termică 50×30mm). Nu mai forțăm @page size, ca să
           nu mai apară 16 pagini sau o etichetă minusculă într-un colț. */
        @page { margin: 6mm; }
        html, body {
          margin: 0 !important; padding: 0 !important;
          background: #fff !important;
        }
        /* Ascunde TOATĂ aplicația, mai puțin portalul nostru */
        body > *:not(.lot-label-print-portal) { display: none !important; }
        .lot-label-print-portal {
          display: flex !important;
          align-items: center;
          justify-content: center;
          position: static !important;
          width: 100%;
          min-height: 100vh;
        }
        /* Pe A4 / coală mare → scalăm eticheta x4 ca să umple frumos pagina.
           Pe rolă termică 50×30mm utilizatorul setează "Fit to page" și iese
           tot la dimensiunea corectă. */
        .lot-label-print-portal .lot-label {
          border: none !important;
          transform: scale(4);
          transform-origin: center center;
        }
      }
    `}</style>
  );

  // Pe ecran: arătăm preview-ul direct (pentru dialog).
  // În același timp montăm un PORTAL pe body care e ascuns pe ecran
  // și care la print devine singurul conținut vizibil → 1 pagină 50×30mm.
  const portalTarget = typeof document !== "undefined" ? document.body : null;

  return (
    <>
      {styleTag}
      <div className="lot-label-onscreen">{labelMarkup}</div>
      {portalTarget &&
        createPortal(
          <div className="lot-label-print-portal">{labelMarkup}</div>,
          portalTarget
        )}
    </>
  );
};

export default LotQRLabel;
