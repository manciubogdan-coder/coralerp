// Evidența pe lot: pornește de la NIR (recepție) și urmărește fiecare zi în care lotul a intrat în producție.
// Funcții pure (fără React / Supabase) ca regulile să poată fi testate.

export const lotMaterialKey = (name: string | null | undefined) =>
  (name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

export interface JourneyReception {
  id: string;
  entryNumber: number | null;
  receiptDay: string; // yyyy-MM-dd (București)
  product: string;
  lot: string;
  supplier: string | null;
  producer: string | null;
  nirKg: number;
  remainingKg: number | null;
  qualityPct: number | null;
  creditKg: number | null;
  inventoryIds: string[];
}

export interface JourneyTransfer {
  inventoryId: string;
  material: string; // lotMaterialKey
  day: string;
  kg: number;
  line: string | null;
}

export interface JourneySession {
  id: string;
  day: string;
  productId: string | null;
  productName: string;
  pieces: number;
  start: string | null; // ISO
  end: string | null; // ISO
}

/** Ingredientele rețetei unui produs finit: material + grame pe bucată. */
export type RecipeMap = Map<string, { material: string; grams: number }[]>;

export interface DayOverride {
  id?: string;
  rebut?: number | null;
  kgFinal?: number | null;
  nrPers?: number | null;
  oraStart?: string | null;
  oraStop?: string | null;
  observatii?: string | null;
  schimb?: string | null;
}

export interface JourneyProduct { name: string; grams: number; pieces: number }

export interface JourneyDay {
  day: string;
  ageDays: number;
  lines: string[];
  mpKg: number;
  /** Partea lotului din tot materialul de acest fel dat în producție în ziua respectivă (1 = singurul lot). */
  share: number;
  products: JourneyProduct[];
  piecesByGrams: Record<number, number>;
  autoRebut: number;
  autoKgFinal: number;
  autoStart: string | null;
  autoStop: string | null;
  rebut: number;
  kgFinal: number;
  pusInCaserole: number;
  difCantar: number;
  pctNc: number | null;
  pctCantar: number | null;
  remainingAfter: number;
  override: DayOverride | null;
  hasProduction: boolean;
}

export interface LotJourney {
  reception: JourneyReception;
  days: JourneyDay[];
  totals: {
    mpKg: number;
    rebut: number;
    kgFinal: number;
    pusInCaserole: number;
    difCantar: number;
    pctNc: number | null;
    pctCantar: number | null;
    piecesByGrams: Record<number, number>;
    firstAgeDays: number | null;
    lastAgeDays: number | null;
  };
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const r4 = (n: number) => Math.round((n + Number.EPSILON) * 10000) / 10000;

export const dayDiff = (from: string, to: string) => {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
};

export const overrideKey = (receptionId: string, day: string) => `${receptionId}|${day}`;

const has = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function buildLotJourneys(input: {
  receptions: JourneyReception[];
  /** Toate transferurile în producție din interval (toate loturile), ca partea fiecărui lot să fie corectă. */
  transfers: JourneyTransfer[];
  sessions: JourneySession[];
  recipes: RecipeMap;
  rebutBySession: Map<string, number>;
  overrides: Map<string, DayOverride>;
}): LotJourney[] {
  const { receptions, transfers, sessions, recipes, rebutBySession, overrides } = input;

  // Total material dat în producție pe zi (toate loturile).
  const dayTotal = new Map<string, number>();
  const byInventory = new Map<string, JourneyTransfer[]>();
  for (const t of transfers) {
    const k = `${t.material}|${t.day}`;
    dayTotal.set(k, (dayTotal.get(k) || 0) + t.kg);
    const list = byInventory.get(t.inventoryId);
    if (list) list.push(t); else byInventory.set(t.inventoryId, [t]);
  }

  // Ce s-a produs din fiecare material, pe zi.
  type Use = { session: JourneySession; grams: number; ingredientShare: number };
  const uses = new Map<string, Use[]>();
  for (const s of sessions) {
    const recipe = (s.productId && recipes.get(s.productId)) || [];
    const totalGrams = recipe.reduce((a, i) => a + i.grams, 0);
    for (const ing of recipe) {
      if (!(ing.grams > 0)) continue;
      const k = `${ing.material}|${s.day}`;
      const u = { session: s, grams: ing.grams, ingredientShare: totalGrams > 0 ? ing.grams / totalGrams : 1 };
      const list = uses.get(k);
      if (list) list.push(u); else uses.set(k, [u]);
    }
  }

  return receptions.map((rec) => {
    const material = lotMaterialKey(rec.product);
    const perDay = new Map<string, { kg: number; lines: Set<string> }>();
    for (const id of rec.inventoryIds) {
      for (const t of byInventory.get(id) || []) {
        if (t.day < rec.receiptDay) continue;
        const d = perDay.get(t.day) || { kg: 0, lines: new Set<string>() };
        d.kg += t.kg;
        if (t.line) d.lines.add(t.line);
        perDay.set(t.day, d);
      }
    }

    let used = 0;
    const days: JourneyDay[] = [...perDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, d]) => {
        const total = dayTotal.get(`${material}|${day}`) || d.kg;
        const share = total > 0 ? Math.min(1, d.kg / total) : 1;
        const products = new Map<string, JourneyProduct>();
        let autoRebut = 0;
        let autoKgFinal = 0;
        let autoStart: string | null = null;
        let autoStop: string | null = null;
        const seenRebut = new Set<string>();
        for (const u of uses.get(`${material}|${day}`) || []) {
          const s = u.session;
          const pieces = s.pieces * share;
          const pk = `${s.productName}|${u.grams}`;
          const p = products.get(pk) || { name: s.productName, grams: u.grams, pieces: 0 };
          p.pieces += pieces;
          products.set(pk, p);
          autoKgFinal += (pieces * u.grams) / 1000;
          if (!seenRebut.has(s.id)) {
            seenRebut.add(s.id);
            autoRebut += (rebutBySession.get(s.id) || 0) * u.ingredientShare * share;
          }
          if (s.start && (!autoStart || s.start < autoStart)) autoStart = s.start;
          const end = s.end || s.start;
          if (end && (!autoStop || end > autoStop)) autoStop = end;
        }
        const ov = overrides.get(overrideKey(rec.id, day)) || null;
        const rebut = has(ov?.rebut) ? ov!.rebut! : r2(autoRebut);
        const kgFinal = has(ov?.kgFinal) ? ov!.kgFinal! : r2(autoKgFinal);
        const mpKg = r2(d.kg);
        const pus = r2(mpKg - rebut);
        const dif = r2(pus - kgFinal);
        used += mpKg;
        const piecesByGrams: Record<number, number> = {};
        for (const p of products.values()) piecesByGrams[p.grams] = (piecesByGrams[p.grams] || 0) + p.pieces;
        return {
          day,
          ageDays: dayDiff(rec.receiptDay, day),
          lines: [...d.lines],
          mpKg,
          share: r4(share),
          products: [...products.values()].sort((a, b) => a.grams - b.grams || a.name.localeCompare(b.name)),
          piecesByGrams,
          autoRebut: r2(autoRebut),
          autoKgFinal: r2(autoKgFinal),
          autoStart,
          autoStop,
          rebut,
          kgFinal,
          pusInCaserole: pus,
          difCantar: dif,
          pctNc: mpKg > 0 ? r4(rebut / mpKg) : null,
          pctCantar: pus > 0 ? r4(dif / pus) : null,
          remainingAfter: r2(rec.nirKg - used),
          override: ov,
          hasProduction: products.size > 0,
        };
      });

    const sum = (f: (d: JourneyDay) => number) => r2(days.reduce((a, d) => a + f(d), 0));
    const mpKg = sum((d) => d.mpKg);
    const rebut = sum((d) => d.rebut);
    const kgFinal = sum((d) => d.kgFinal);
    const pus = r2(mpKg - rebut);
    const dif = r2(pus - kgFinal);
    const piecesByGrams: Record<number, number> = {};
    for (const d of days) for (const [g, n] of Object.entries(d.piecesByGrams)) piecesByGrams[+g] = (piecesByGrams[+g] || 0) + n;
    return {
      reception: rec,
      days,
      totals: {
        mpKg, rebut, kgFinal, pusInCaserole: pus, difCantar: dif,
        pctNc: mpKg > 0 ? r4(rebut / mpKg) : null,
        pctCantar: pus > 0 ? r4(dif / pus) : null,
        piecesByGrams,
        firstAgeDays: days.length ? days[0].ageDays : null,
        lastAgeDays: days.length ? days[days.length - 1].ageDays : null,
      },
    };
  });
}

/** Ora (HH:mm) în București pentru un moment ISO. */
export const bucharestTime = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat("ro-RO", { timeZone: "Europe/Bucharest", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso)) : "";
