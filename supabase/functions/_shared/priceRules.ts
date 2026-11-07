// Company-wide price calculator rules, edited by the user in "Reguli de calcul" and read at every calculation.
// Defaults reproduce the rules agreed so far (labour CSV October 2026, pallet norms, supply truck, Bio Baby Spanac, paired cursă).

/** overheadPct: factory overhead % of the direct labour for this line (default: the global labourOverheadPct). */
export type LabourLineRule = { name: string; people: number; speed: number | null; hourCost: number; overheadPct?: number; note?: string; builtIn?: boolean };
export type PalletGroupRule = { label: string; keywords: string[]; kgPerPallet: number };
export type TradedGoodRule = { label: string; keywords: string[]; piecesPerPallet: number; note: string };
export type CityRouteRule = { city: string; route: string };
export type PriceRules = {
  labourOverheadPct: number;
  lines: LabourLineRule[];
  palletGroups: PalletGroupRule[];
  tradedGoods: TradedGoodRule[];
  truckPallets: number;
  routePairs: Array<[string, string]>;
  cityRoutes: CityRouteRule[];
  countyRoutes: Record<string, string>;
  marginPct: number;
  eurBufferPct: number;
  techLossPct: number;
  latestCostDays: number;
  loadDays: number;
};

export const MIXED_WASHED = "Multihead — Mixte SPĂLATE";
/** CSV octombrie 2026: lei per person-hour = direct × speed ÷ people; overhead % = CSV regie ÷ direct, so the rounded CSV tariffs stay exact. */
const csv = (name: string, people: number, speed: number, direct: number, overhead: number): LabourLineRule =>
  ({ name, people, speed, hourCost: (direct * speed) / people, overheadPct: (overhead / direct) * 100, builtIn: true });
export const DEFAULT_PRICE_RULES: PriceRules = {
  labourOverheadPct: 41,
  lines: [
    csv("Giostra", 4, 915, 0.151, 0.062),
    csv("Flowpack", 8, 915, 0.302, 0.124),
    csv("Multihead — Monoprodus", 6, 975, 0.212, 0.087),
    csv("Spanac Mare", 3, 258, 0.401, 0.165),
    csv("Aromate", 8, 500, 0.552, 0.226),
    csv("Vracuri / Gastro", 2, 120, 0.575, 0.236),
    { name: MIXED_WASHED, people: 13, speed: null, hourCost: (0.212 * 975) / 6, note: "6 ambalare + 7 spălare; viteza reală din Producție, conform mix", builtIn: true },
  ],
  palletGroups: [
    { label: "Radicchio", keywords: ["radic", "radich"], kgPerPallet: 500 },
    { label: "Căpățâni", keywords: ["iceberg", "pan di", "indivi", "scarola", "varz"], kgPerPallet: 400 },
    { label: "Frunze / aromate", keywords: ["spanac", "rucola", "valerian", "latuga", "salat", "baby", "mizuna", "tsatsoi", "blood", "chard", "busuioc", "marar", "patrunjel", "menta", "cimbru", "coriandru", "rozmarin", "oregano", "tarhon", "chivas"], kgPerPallet: 220 },
  ],
  tradedGoods: [
    { label: "Bio Baby Spanac", keywords: ["spanac", "bio"], piecesPerPallet: 1000, note: "Bio Baby Spanac: semifabricat din Italia, revândut ca atare, 1000 buc/palet" },
  ],
  truckPallets: 26,
  routePairs: [["TURDA", "TURDA-IERNUT"], ["TIMISOARA", "LUGOJ"]],
  cityRoutes: [
    { city: "IERNUT", route: "TURDA-IERNUT" }, { city: "TURDA", route: "TURDA" }, { city: "LUGOJ", route: "LUGOJ" }, { city: "ROMAN", route: "ROMAN" },
    { city: "CRAIOVA", route: "CRAIOVA" }, { city: "TIMISOARA", route: "TIMISOARA" }, { city: "PLOIESTI", route: "PLOIESTI" }, { city: "FOCSANI", route: "FOCSANI" }, { city: "BUCURESTI", route: "BUCURESTI" },
  ],
  countyRoutes: {
    BUCURESTI: "BUCURESTI", ILFOV: "BUCURESTI", GIURGIU: "BUCURESTI", PRAHOVA: "PLOIESTI", NEAMT: "ROMAN", MURES: "TURDA-IERNUT",
    CLUJ: "TURDA", TIMIS: "TIMISOARA", DOLJ: "CRAIOVA", VRANCEA: "FOCSANI",
  },
  marginPct: 15,
  eurBufferPct: 1.5,
  techLossPct: 0,
  latestCostDays: 30,
  loadDays: 90,
};

let active: PriceRules = DEFAULT_PRICE_RULES;
/** Rules of the current calculation: loaded from Cloud on the server, received with the price list on the screen. */
export const priceRules = () => active;
export function setPriceRules(r: PriceRules) { active = r; }

/** Lowercase, no diacritics: "Mărar" = "marar". */
export const plainName = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Pallet groups: a keyword anywhere in the name ("salat" matches "salata"). */
export const containsKeyword = (name: string, kw: string) => plainName(name).includes(plainName(kw));
/** Traded goods: every keyword as a whole word ("bio" does not match "biogree"). */
export const hasWord = (name: string, kw: string) => new RegExp(`(^|[^a-z0-9])${esc(plainName(kw))}([^a-z0-9]|$)`).test(plainName(name));

/** Per piece: people × lei/person-hour ÷ pieces/hour; factory overhead = direct × overhead %. */
export function lineRates(l: LabourLineRule, globalOverheadPct = active.labourOverheadPct) {
  if (!l.speed || !l.people || !l.hourCost) return { direct: null, overhead: null, total: null };
  const direct = (l.people * l.hourCost) / l.speed, overhead = (direct * (l.overheadPct ?? globalOverheadPct)) / 100;
  return { direct, overhead, total: direct + overhead };
}

// ---- Validation of a saved rules document (server on save and load; screen before saving).
const ROUTE_RE = /^[A-Z0-9][A-Z0-9 .\-]{0,59}$/;
const upper = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
const text = (s: unknown, max: number) => String(s ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
const words = (v: unknown) => (Array.isArray(v) ? v : String(v ?? "").split(","))
  .map((w) => plainName(text(w, 40))).filter((w) => w.length >= 2).slice(0, 60);
const numIn = (v: unknown, min: number, max: number) => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;

export function validPriceRules(raw: unknown): { rules: PriceRules } | { error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { error: "Reguli invalide." };
  const r = raw as Record<string, any>, D = DEFAULT_PRICE_RULES;
  const pick = (k: keyof PriceRules) => (r[k] === undefined ? D[k] : r[k]);
  const out = { ...D } as PriceRules;
  const scalars: Array<[keyof PriceRules, number, number, string]> = [
    ["labourOverheadPct", 0, 500, "Regie fabrică %"], ["truckPallets", 1, 100, "Paleți pe camion plin"], ["marginPct", 0, 89, "Marjă brută implicită %"],
    ["eurBufferPct", 0, 50, "Siguranță curs EUR %"], ["techLossPct", 0, 89, "Pierdere suplimentară %"], ["latestCostDays", 7, 365, "Zile pentru ultimele prețuri"], ["loadDays", 14, 365, "Zile pentru încărcare medie"],
  ];
  for (const [k, min, max, label] of scalars) {
    const v = pick(k);
    if (!numIn(v, min, max)) return { error: `${label}: valoare între ${min} și ${max}.` };
    (out as any)[k] = v;
  }
  const lines = pick("lines");
  if (!Array.isArray(lines) || !lines.length || lines.length > 40) return { error: "Liniile de producție lipsesc." };
  const names = new Set<string>();
  out.lines = [];
  for (const l of lines) {
    const name = text(l?.name, 60);
    if (!name) return { error: "Fiecare linie are nevoie de un nume." };
    if (names.has(name)) return { error: `Linia „${name}” apare de două ori.` };
    names.add(name);
    if (!numIn(l.people, 0.1, 200)) return { error: `${name}: număr de oameni invalid.` };
    if (l.speed != null && !numIn(l.speed, 1, 100000)) return { error: `${name}: viteză invalidă (buc/oră).` };
    if (!numIn(l.hourCost, 0.01, 10000)) return { error: `${name}: cost orar pe om invalid.` };
    if (l.overheadPct != null && !numIn(l.overheadPct, 0, 500)) return { error: `${name}: regie % invalidă.` };
    const builtIn = D.lines.some((x) => x.name === name);
    out.lines.push({ name, people: l.people, speed: l.speed ?? null, hourCost: l.hourCost, ...(l.overheadPct != null ? { overheadPct: l.overheadPct } : {}), ...(text(l.note, 200) ? { note: text(l.note, 200) } : {}), ...(builtIn ? { builtIn: true } : {}) });
  }
  // Built-in lines are proposed automatically from the recipe; they cannot be removed.
  for (const b of D.lines) if (!names.has(b.name)) return { error: `Linia „${b.name}” nu poate fi ștearsă (e propusă automat după rețetă).` };
  const groups = pick("palletGroups");
  if (!Array.isArray(groups) || groups.length > 30) return { error: "Grupele de paleți sunt invalide." };
  out.palletGroups = [];
  for (const g of groups) {
    const label = text(g?.label, 60), keywords = words(g?.keywords);
    if (!label || !keywords.length) return { error: "Fiecare grupă de paleți are nume și cel puțin un cuvânt de recunoaștere." };
    if (!numIn(g.kgPerPallet, 1, 5000)) return { error: `${label}: kg/palet invalid.` };
    out.palletGroups.push({ label, keywords, kgPerPallet: g.kgPerPallet });
  }
  const traded = pick("tradedGoods");
  if (!Array.isArray(traded) || traded.length > 30) return { error: "Lista de mărfuri revândute este invalidă." };
  out.tradedGoods = [];
  for (const g of traded) {
    const label = text(g?.label, 60), keywords = words(g?.keywords);
    if (!label || !keywords.length) return { error: "Fiecare marfă revândută are nume și cuvinte de recunoaștere." };
    if (!numIn(g.piecesPerPallet, 1, 1000000)) return { error: `${label}: buc/palet invalid.` };
    out.tradedGoods.push({ label, keywords, piecesPerPallet: g.piecesPerPallet, note: text(g.note, 200) || `${label}: revândut ca atare, ${g.piecesPerPallet} buc/palet` });
  }
  const pairs = pick("routePairs");
  if (!Array.isArray(pairs) || pairs.length > 20) return { error: "Perechile de curse sunt invalide." };
  out.routePairs = [];
  for (const p of pairs) {
    const a = upper(p?.[0]), b = upper(p?.[1]);
    if (!ROUTE_RE.test(a) || !ROUTE_RE.test(b) || a === b) return { error: "Fiecare pereche are două curse diferite." };
    out.routePairs.push([a, b]);
  }
  const cities = pick("cityRoutes");
  if (!Array.isArray(cities) || cities.length > 60) return { error: "Lista oraș → cursă este invalidă." };
  out.cityRoutes = [];
  for (const c of cities) {
    const city = upper(c?.city), route = upper(c?.route);
    if (!/^[A-Z0-9][A-Z0-9 .\-]{1,40}$/.test(city) || !ROUTE_RE.test(route)) return { error: "Fiecare oraș are o cursă." };
    out.cityRoutes.push({ city, route });
  }
  const counties = pick("countyRoutes");
  if (!counties || typeof counties !== "object" || Array.isArray(counties) || Object.keys(counties).length > 60) return { error: "Lista județ → cursă este invalidă." };
  out.countyRoutes = {};
  for (const [k, v] of Object.entries(counties)) {
    const county = upper(k), route = upper(v);
    if (!/^[A-Z0-9][A-Z0-9 .\-]{1,40}$/.test(county) || !ROUTE_RE.test(route)) return { error: "Fiecare județ are o cursă." };
    out.countyRoutes[county] = route;
  }
  return { rules: out };
}

export type RulesMeta = { rules: PriceRules; saved: boolean; updatedAt: string | null; updatedBy: string | null };
/** Latest saved rules (append-only history) or the defaults; read failures are visible, never silent defaults. Sets the active rules. */
export async function loadPriceRules(cloud: any): Promise<RulesMeta> {
  const { data, error } = await cloud.from("argus_price_rules").select("rules,updated_by,created_at").order("created_at", { ascending: false }).limit(1);
  if (error) throw new Error(`Nu pot citi regulile de calcul preț: ${error.message}`);
  const row = data?.[0];
  if (!row) { setPriceRules(DEFAULT_PRICE_RULES); return { rules: DEFAULT_PRICE_RULES, saved: false, updatedAt: null, updatedBy: null }; }
  const v = validPriceRules(row.rules);
  if ("error" in v) throw new Error(`Regulile de calcul preț salvate sunt invalide: ${v.error}`);
  setPriceRules(v.rules);
  return { rules: v.rules, saved: true, updatedAt: row.created_at, updatedBy: row.updated_by ?? null };
}
export async function savePriceRules(cloud: any, raw: unknown, by: string | null): Promise<RulesMeta> {
  const v = validPriceRules(raw);
  if ("error" in v) throw new Error(v.error);
  const { error } = await cloud.from("argus_price_rules").insert({ rules: v.rules, updated_by: by });
  if (error) throw new Error(`Nu pot salva regulile: ${error.message}`);
  return loadPriceRules(cloud);
}
