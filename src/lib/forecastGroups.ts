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

/** Comanda sugerată pentru ziua i: consumul zilei + următoarelor două zile minus stocul de început al zilei. */
export const suggestedOrderFor = (start: number, consum: number[], i: number): number => {
  const need = (consum[i] || 0) + (consum[i + 1] || 0) + (consum[i + 2] || 0);
  return Math.max(need - (start || 0), 0);
};

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
