/** Linia de producție a unui bon de transfer MP este păstrată la începutul notelor: „Linia: X · note”. */
const LINE_RE = /^\s*Linia:\s*([^·]+?)\s*(?:·\s*([\s\S]*))?$/;

export const withTransferLine = (line: string | null | undefined, notes?: string | null) =>
  line ? [`Linia: ${line}`, notes?.trim()].filter(Boolean).join(" · ") : (notes || "");

export const parseTransferLine = (notes: string | null | undefined): { line: string | null; rest: string } => {
  const m = (notes || "").match(LINE_RE);
  return m ? { line: m[1].trim(), rest: (m[2] || "").trim() } : { line: null, rest: notes || "" };
};
