// Helpers for the Argus chat: live step labels, reusable Senior SQL and tables found in answers.

const STEP: Record<string, [string, string]> = {
  senior_sql: ["Citesc datele din Senior…", "Am citit date din Senior"],
  senior_cauta_tabele: ["Caut tabelele potrivite în Senior…", "Am găsit tabelele din Senior"],
  senior_descrie_tabel: ["Verific coloanele tabelului…", "Am verificat coloanele"],
  calculeaza_pret: ["Calculez fișa de preț din Senior…", "Am calculat fișa de preț"],
  dosar_produs: ["Deschid dosarul produsului…", "Am citit dosarul produsului"],
  interogare_date: ["Citesc datele din aplicație…", "Am citit datele din aplicație"],
  metrici_perioada: ["Calculez indicatorii pe perioadă…", "Am calculat indicatorii"],
  genereaza_raport: ["Pregătesc raportul Excel…", "Raportul Excel e gata"],
  propune_actiune: ["Pregătesc acțiunea propusă…", "Acțiunea e pregătită"],
  cauta_conversatii: ["Caut în conversațiile anterioare…", "Am căutat în conversații"],
  citeste_istoric: ["Recitesc conversația anterioară…", "Am recitit conversația"],
  salveaza_memorie: ["Salvez regula în memorie…", "Am salvat în memorie"],
  creeaza_agent: ["Pregătesc agentul…", "Agentul e pregătit"],
  modifica_agent: ["Modific agentul…", "Agentul e modificat"],
  lista_agenti: ["Citesc agenții existenți…", "Am citit agenții"],
};

export function stepLabel(part: any, running: boolean): string {
  const name = String(part?.type ?? "").replace(/^tool-/, "");
  const pair = STEP[name];
  if (!pair) return running ? "Argus lucrează…" : "Pas finalizat";
  if (!running && part?.state === "output-error") return `${pair[1]} (eroare)`;
  if (!running && name === "senior_sql" && typeof part?.output?.randuri === "number") return `${pair[1]} · ${part.output.randuri} rânduri`;
  return running ? pair[0] : pair[1];
}

/** Last successful Senior SELECT in an assistant message (the one that produced the data shown). */
export function lastSeniorSql(m: { parts: any[] }): string | null {
  for (let i = m.parts.length - 1; i >= 0; i--) {
    const p = m.parts[i];
    if (p?.type === "tool-senior_sql" && p.state === "output-available" && !p.output?.eroare && Number(p.output?.randuri) > 0 && typeof p.input?.sql === "string") return p.input.sql;
  }
  return null;
}

const splitRow = (line: string) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim().replace(/\*\*/g, ""));

/** Markdown tables in a text, with the nearest preceding heading/line as title. */
export function markdownTables(text: string): { title: string; headers: string[]; rows: string[][] }[] {
  const lines = text.split("\n");
  const out: { title: string; headers: string[]; rows: string[][] }[] = [];
  for (let i = 0; i < lines.length - 1; i++) {
    if (!/^\s*\|.*\|\s*$/.test(lines[i]) || !/^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) continue;
    const headers = splitRow(lines[i]);
    const rows: string[][] = [];
    let j = i + 2;
    for (; j < lines.length && /^\s*\|.*\|\s*$/.test(lines[j]); j++) rows.push(splitRow(lines[j]));
    let title = "";
    for (let k = i - 1; k >= 0 && k >= i - 4; k--) if (lines[k].trim()) { title = lines[k].replace(/^#+\s*|\*\*/g, "").trim(); break; }
    out.push({ title: (title || headers.slice(0, 3).join(" · ")).slice(0, 90), headers, rows });
    i = j - 1;
  }
  return out;
}
