const norm = (s: string) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

const AROMATE_KEYS = [
  "menta", "busuioc", "patrunjel", "marar", "cimbru", "cimbrisor", "rozmarin", "oregano",
  "leustean", "tarhon", "coriandru", "arpagic", "ceapaverde", "salvie", "melisa", "roinita",
  "lavanda", "sovarv", "aromat", "chivas",
];

const LEGUME_FRUCTE_KEYS = [
  "rosii", "rosie", "tomat", "cherry", "castravet", "ardei", "morcov", "ceapa", "usturoi", "dovlecel",
  "vinete", "ridich", "sfecl", "varza", "conopida", "broccoli", "telina", "praz", "cartof", "porumb",
  "mazare", "fasole", "ciuperc", "avocado", "lamai", "lime", "mere", "pere", "capsun", "afine",
  "zmeur", "mure", "strugur", "portocal", "banan", "ananas", "mango", "kiwi", "rodie", "pepene",
  "cirese", "visine", "caise", "piersic", "prune", "fruct", "legum", "ghimbir", "fenicul", "napi",
];

export const FORECAST_GROUP_ORDER = ["Salate", "Aromate", "Legume și fructe"];

export const forecastGroupOf = (name: string): string => {
  const n = norm(name);
  if (AROMATE_KEYS.some((k) => n.includes(k))) return "Aromate";
  if (LEGUME_FRUCTE_KEYS.some((k) => n.includes(k))) return "Legume și fructe";
  return "Salate";
};

/** Comanda sugerată pentru ziua i: consumul zilei următoare + stocul tampon minus stocul final al zilei. */
export const suggestedOrderFor = (finalStock: number, consum: number[], i: number, buffer = 0): number =>
  Math.max((consum[i + 1] || 0) + (buffer || 0) - (finalStock || 0), 0);

/** Kg pe un palet: căpățâni 400, radicchio 500, frunze și aromate 220; altele necunoscut. */
export const palletKgFor = (name: string): number | null => {
  const n = norm(name);
  if (n.includes("radic")) return 500;
  if (n.includes("capatan")) return 400;
  const g = forecastGroupOf(name);
  if (g === "Aromate" || g === "Salate") return 220;
  return null;
};

export const palletsFor = (name: string, kg: number): number | null => {
  const per = palletKgFor(name);
  return per && kg > 0 ? kg / per : null;
};

export interface PalletClass {
  perPalletKg: number;
  kg: number;
  pallets: number;
}

export interface PalletSummary {
  kg: number;
  pallets: number;
  wholePallets: number;
  byClass: PalletClass[];
}

/** Totalizarea paleților unei comenzi: kg, paleți exacti și paleți întregi de încărcat. */
export const summarizePallets = (rows: { name: string; unit?: string; qty: number }[]): PalletSummary => {
  const byClass = new Map<number, number>();
  let kg = 0;
  let wholePallets = 0;
  for (const r of rows) {
    if (String(r.unit || "kg").toLowerCase() !== "kg") continue;
    const per = palletKgFor(r.name);
    const qty = Math.max(Number(r.qty) || 0, 0);
    if (!per || qty <= 0) continue;
    kg += qty;
    wholePallets += Math.ceil(qty / per);
    byClass.set(per, (byClass.get(per) || 0) + qty);
  }
  const classes = [...byClass.entries()]
    .map(([perPalletKg, k]) => ({ perPalletKg, kg: k, pallets: k / perPalletKg }))
    .sort((a, b) => b.perPalletKg - a.perPalletKg);
  return {
    kg,
    pallets: classes.reduce((s, c) => s + c.pallets, 0),
    wholePallets,
    byClass: classes,
  };
};

