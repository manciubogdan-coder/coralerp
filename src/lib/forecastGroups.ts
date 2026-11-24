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

/** Comanda sugerată: consumul zilei următoare + tampon − stoc final, fără adaos PT. */
export const suggestedOrderFor = (finalStock: number, consum: number[], i: number, buffer = 0): number =>
  Math.max((consum[i + 1] || 0) + (buffer || 0) - (finalStock || 0), 0);

/**
 * Comenzi sugerate succesive când stocul proiectat poate merge pe minus (ambalaje/etichete):
 * fiecare perioadă comandă doar ce lipsește după comenzile sugerate în perioadele anterioare,
 * ca totalul să fie necesarul real, nu deficitul numărat de mai multe ori.
 */
export const sequentialOrderPlan = (closings: (number | null)[], targets: number[]): (number | null)[] => {
  let placed = 0;
  return closings.map((closing, k) => {
    if (closing == null) return null;
    const q = Math.max((targets[k] || 0) - (closing + placed), 0);
    placed += q;
    return q;
  });
};

/** Ziua până la care trebuie plasată comanda ca să ajungă la livrare, după termenul de livrare (zile). */
export const orderByDay = (deliveryDay: string, leadTimeDays: number): string => {
  const d = new Date(`${deliveryDay}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - Math.max(0, Math.round(leadTimeDays || 0)));
  return d.toISOString().slice(0, 10);
};

/** Kg pe un palet (Bogdan, 24.11.2026): radicchio rosso 500; iceberg, indivia riccia, scarola, PDZ 400; baby leaf/salate 220; aromate 200. */
const HEAD_KEYS = ["capatan", "iceberg", "pandi", "pdz", "pzd", "indivi", "scarola", "varz"];
export const palletKgFor = (name: string): number | null => {
  const n = norm(name);
  if (n.includes("radic")) return 500;
  if (HEAD_KEYS.some((k) => n.includes(k))) return 400;
  const g = forecastGroupOf(name);
  if (g === "Aromate") return 200;
  if (g === "Salate") return 220;
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


// Ambalaje/etichete: grupă după tipul din denumire (Folie, Caserole, Cutii...).
export const PACK_TYPES: [string, string[]][] = [
  ["Folie", ["folie", "ribon", "banda"]], ["Caserole", ["caserol", "barcut"]], ["Capace", ["capac"]],
  ["Cutii", ["cuti", "carton"]], ["Pungi", ["pung"]], ["Etichete", ["etichet"]],
  ["Paleți și lădițe", ["palet", "euro", "ladit", "coltar"]], ["Tacâmuri", ["furculit", "lingurit", "tacam"]],
];
export const packGroupOf = (name: string) => {
  const n = (name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
  const hit = PACK_TYPES.find(([, keys]) => keys.some((k) => n.startsWith(k)))
    || PACK_TYPES.find(([, keys]) => keys.some((k) => n.includes(k)));
  if (hit) return hit[0];
  const w = (name || "").trim().split(/\s+/)[0] || "Altele";
  return w.length > 2 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : "Altele";
};
