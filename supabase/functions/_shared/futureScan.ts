/** Autonomous "what's coming" scan: web-researched legal/price changes → validated cost levers. */
export const SCAN_LEVERS = ["salariu", "motorina", "energie", "ambalaje", "mp", "inflatie"] as const;
export type ScanLever = typeof SCAN_LEVERS[number];
export type ScanItem = { lever: ScanLever; title: string; pct: number; effective: string; source: string; url: string; confirmed: boolean };
export type ScanResult = { levers: Partial<Record<ScanLever, number>>; items: ScanItem[]; advice: string[]; checkedAt: string };

export const scanPrompt = (today: string) => `Ești analist economic pentru o fabrică din România (salate ambalate, baby leaf, aromate) care importă materie primă din Italia cu camioane, vinde la Lidl, Kaufland, Metro, Mega Image și exportă în Bulgaria și Moldova.
Azi este ${today}. Caută pe internet (surse oficiale: Monitorul Oficial, Guvern, ANAF, Ministerul Finanțelor, INS, BNR, ANRE, RetuRO, presă economică) modificările care vor intra în vigoare în următoarele 12 luni sau sunt anunțate oficial și afectează costurile: salariul minim brut și contribuțiile, acciza/prețul motorinei, prețul energiei și gazului, taxe pe ambalaje/plastic/RetuRO/mediu, prețul legumelor în Italia/UE, inflația prognozată (BNR), TVA și alte taxe.
Pentru fiecare găsire, estimează creșterea procentuală a costului respectiv față de azi. Nu inventa: dacă nu ai sursă, nu include elementul. confirmed=true doar dacă e lege/hotărâre publicată.
Răspunde DOAR cu JSON valid, fără text în jur:
{"items":[{"lever":"salariu|motorina|energie|ambalaje|mp|inflatie","title":"ce se schimbă, în română simplă","pct":numar,"effective":"YYYY-MM-DD sau text scurt","source":"numele sursei","url":"https://...","confirmed":true|false}],"advice":["sfat concret scurt pentru fabrică"]}`;

/** Parse and clamp the model output; drop anything without a source or with an absurd value. */
export function parseScan(text: string, today: string): ScanResult {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("Căutarea nu a întors un rezultat citibil. Mai încearcă.");
  const raw = JSON.parse(m[0]);
  const items: ScanItem[] = [];
  for (const i of Array.isArray(raw?.items) ? raw.items : []) {
    const pct = Number(i?.pct);
    if (!SCAN_LEVERS.includes(i?.lever) || !Number.isFinite(pct) || pct < -50 || pct > 100) continue;
    const url = String(i?.url ?? "");
    if (!/^https?:\/\//.test(url)) continue;
    items.push({ lever: i.lever, title: String(i.title ?? "").slice(0, 300), pct: Math.round(pct * 10) / 10, effective: String(i.effective ?? "").slice(0, 40), source: String(i.source ?? "").slice(0, 120), url: url.slice(0, 500), confirmed: i.confirmed === true });
  }
  return { levers: combineLevers(items), items, advice: (Array.isArray(raw?.advice) ? raw.advice : []).map((a: unknown) => String(a).slice(0, 300)).slice(0, 8), checkedAt: today };
}

/** Several changes on the same lever compound: (1+a)(1+b)−1. */
export function combineLevers(items: Pick<ScanItem, "lever" | "pct">[]): Partial<Record<ScanLever, number>> {
  const out: Partial<Record<ScanLever, number>> = {};
  for (const l of SCAN_LEVERS) {
    const xs = items.filter((i) => i.lever === l);
    if (!xs.length) continue;
    const f = xs.reduce((p, i) => p * (1 + i.pct / 100), 1);
    out[l] = Math.round((f - 1) * 1000) / 10;
  }
  return out;
}
