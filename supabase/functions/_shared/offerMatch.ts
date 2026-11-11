// Offer to another client: the same product is often a different Senior article per client
// (e.g. "MENTA 30 MC" for Metro România, "MENTA 30 MC MD" for ICS Metro Moldova). Match by family + grams.

const CHANNEL = /\b(?:mc|md|mi|pg|metro|lidl|auchan|carrefour|penny|kaufland|profi|selgros|gastro|horeca|bio)\b/g;
const SYNONYMS: Array<[RegExp, string]> = [[/\bcimbrisor\b/g, "cimbru"], [/\binsalatina\b/g, "insalata"]];

export type OfferIdentity = { family: string; words: string[]; grams: number };

/** Product family and grams without client/channel suffixes; null when no grams can be read (services, transport). */
export function offerIdentity(name: string): OfferIdentity | null {
  let t = String(name ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/\bmega\s+image\b/g, " ").replace(/^\s*(?:sal\.|salata\b)\s*/, " ");
  for (const [re, to] of SYNONYMS) t = t.replace(re, to);
  t = t.replace(CHANNEL, " ");
  const m = t.match(/\b(\d+(?:[.,]\d+)?)\s*(kg|gr|g)\b/) ?? t.match(/\b(\d+(?:[.,]\d+)?)\b/);
  if (!m || m.index === undefined) return null;
  const grams = Number(m[1].replace(",", ".")) * (m[2] === "kg" ? 1000 : 1);
  const words = (t.slice(0, m.index) + " " + t.slice(m.index + m[0].length)).replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter((w) => w && w !== "salata");
  return grams > 0 && words.length ? { family: words.join(" "), words, grams } : null;
}

/** Prefixes to pre-filter the target's history in Senior: first 5 letters of each family's first word, so synonyms
 * that share a stem (cimbru / CIMBRISOR) are still read. */
export function offerSearchWords(names: string[]) {
  return [...new Set(names.map((n) => offerIdentity(n)?.words[0]?.slice(0, 5)).filter((w): w is string => !!w && w.length >= 3))];
}

type Sold = { aid: number; name: string; lastDay: string };
export type OfferMatch<T extends Sold> = { row: T; match: "same" | "exact" | "similar" };

/** Target article sold for a source product: same article, else same family + grams, else same grams with one name contained in the other. */
export function matchOffer<T extends Sold>(source: { aid: number; name: string }, sold: T[]): OfferMatch<T> | null {
  const latest = (xs: T[]) => [...xs].sort((a, b) => b.lastDay.localeCompare(a.lastDay))[0];
  const same = sold.find((s) => s.aid === source.aid);
  if (same) return { row: same, match: "same" };
  const id = offerIdentity(source.name);
  if (!id) return null;
  const ids = sold.map((s) => ({ s, id: offerIdentity(s.name) })).filter((x) => x.id && x.id.grams === id.grams);
  const exact = ids.filter((x) => x.id!.family === id.family).map((x) => x.s);
  if (exact.length) return { row: latest(exact), match: "exact" };
  const within = (a: string[], b: string[]) => a.every((w) => b.includes(w));
  const similar = ids.filter((x) => within(x.id!.words, id.words) || within(id.words, x.id!.words)).map((x) => x.s);
  return similar.length ? { row: latest(similar), match: "similar" } : null;
}
