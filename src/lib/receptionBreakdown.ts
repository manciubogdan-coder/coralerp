// Helpers pentru defalcarea pe tipuri multiple a paleților și lăzilor.
// Date stocate string-encoded în câmpul `paleti_lazi_document` din
// `reception_report_data`. Format:
//   "{totalP}P/{totalL}L||{tipDominant}||BD:{base64(JSON)}"
// Compatibil înapoi cu formatele vechi:
//   "2P/10L"
//   "2P/10L||TipLada"

export type BreakdownEntry = {
  id: string | null;
  name: string;
  count: number;
};

export type BreakdownPayload = {
  rec_pallets: BreakdownEntry[];
  rec_crates: BreakdownEntry[];
  doc_pallets: BreakdownEntry[];
  doc_crates: BreakdownEntry[];
};

export const emptyBreakdown = (): BreakdownPayload => ({
  rec_pallets: [],
  rec_crates: [],
  doc_pallets: [],
  doc_crates: [],
});

const b64encode = (s: string): string => {
  try {
    if (typeof window !== "undefined" && typeof window.btoa === "function") {
      // unicode-safe
      return window.btoa(unescape(encodeURIComponent(s)));
    }
  } catch { /* ignore */ }
  // Fallback (Node)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (globalThis as any).Buffer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? (globalThis as any).Buffer.from(s, "utf-8").toString("base64")
    : s;
};

const b64decode = (s: string): string => {
  try {
    if (typeof window !== "undefined" && typeof window.atob === "function") {
      return decodeURIComponent(escape(window.atob(s)));
    }
  } catch { /* ignore */ }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (globalThis as any).Buffer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? (globalThis as any).Buffer.from(s, "base64").toString("utf-8")
    : s;
};

const sumCount = (rows: BreakdownEntry[]): number =>
  rows.reduce((s, r) => s + (Number(r.count) || 0), 0);

/**
 * Decodifică `paleti_lazi_document` într-un breakdown complet.
 * Pentru rândurile vechi (fără BD:), populează doar `doc_pallets`/`doc_crates`
 * cu un singur rând (folosind tipul lăzii din câmpul vechi).
 */
export const decodePalDoc = (text: string | null | undefined): {
  totalDocP: number | null;
  totalDocL: number | null;
  legacyTipLada: string;
  breakdown: BreakdownPayload;
} => {
  const out = {
    totalDocP: null as number | null,
    totalDocL: null as number | null,
    legacyTipLada: "",
    breakdown: emptyBreakdown(),
  };
  if (!text) return out;
  const parts = text.split("||");
  const counts = parts[0] || "";
  const tip = (parts[1] || "").trim();
  const bdPart = parts.find((p) => p.startsWith("BD:"));

  const pMatch = counts.match(/(\d+)\s*P/i);
  const lMatch = counts.match(/(\d+)\s*L/i);
  out.totalDocP = pMatch ? parseInt(pMatch[1], 10) : null;
  out.totalDocL = lMatch ? parseInt(lMatch[1], 10) : null;
  out.legacyTipLada = tip;

  if (bdPart) {
    try {
      const json = b64decode(bdPart.slice(3));
      const parsed = JSON.parse(json) as Partial<BreakdownPayload>;
      out.breakdown = {
        rec_pallets: Array.isArray(parsed.rec_pallets) ? parsed.rec_pallets : [],
        rec_crates: Array.isArray(parsed.rec_crates) ? parsed.rec_crates : [],
        doc_pallets: Array.isArray(parsed.doc_pallets) ? parsed.doc_pallets : [],
        doc_crates: Array.isArray(parsed.doc_crates) ? parsed.doc_crates : [],
      };
    } catch { /* ignore corrupt payload */ }
  } else {
    // Format vechi: doar totaluri document + tip
    if (out.totalDocP && out.totalDocP > 0) {
      out.breakdown.doc_pallets = [{ id: null, name: "", count: out.totalDocP }];
    }
    if (out.totalDocL && out.totalDocL > 0) {
      out.breakdown.doc_crates = [{ id: null, name: tip, count: out.totalDocL }];
    }
  }
  return out;
};

/**
 * Codifică un breakdown complet în formatul stocabil.
 * Totalul P/L se calculează din `doc_pallets`/`doc_crates`. Tipul dominant
 * (al doilea câmp) e numele primului tip de lădiță document, pentru
 * compatibilitate cu UI-ul vechi.
 */
export const encodePalDoc = (bd: BreakdownPayload): string => {
  const totalP = sumCount(bd.doc_pallets);
  const totalL = sumCount(bd.doc_crates);
  const parts: string[] = [];
  if (totalP > 0) parts.push(`${totalP}P`);
  if (totalL > 0) parts.push(`${totalL}L`);
  const counts = parts.join("/");
  const dominantTip = bd.doc_crates[0]?.name?.trim() || "";

  // Dacă breakdown-ul e gol în întregime, întoarce ""
  const isEmpty =
    bd.rec_pallets.length === 0 &&
    bd.rec_crates.length === 0 &&
    bd.doc_pallets.length === 0 &&
    bd.doc_crates.length === 0;
  if (isEmpty) return "";

  const json = JSON.stringify(bd);
  return `${counts}||${dominantTip}||BD:${b64encode(json)}`;
};

/** Sumar text scurt: "2 EUR + 1 IND" sau "—". */
export const summarizeBreakdown = (rows: BreakdownEntry[]): string => {
  const valid = rows.filter((r) => (Number(r.count) || 0) > 0);
  if (valid.length === 0) return "—";
  return valid
    .map((r) => `${r.count} ${r.name || "?"}`)
    .join(" + ");
};

/** Total câmp count. */
export const totalBreakdown = (rows: BreakdownEntry[]): number => sumCount(rows);

/** Adună count-urile pe nume de tip (case-insensitive). */
export const aggregateByType = (rows: BreakdownEntry[]): Map<string, number> => {
  const map = new Map<string, number>();
  rows.forEach((r) => {
    const key = (r.name || "").trim();
    if (!key) return;
    const c = Number(r.count) || 0;
    if (c <= 0) return;
    map.set(key, (map.get(key) || 0) + c);
  });
  return map;
};
