// Grupare produse pentru Producția în Avans.
// Același produs apare în nomenclator sub mai multe denumiri / coduri
// (ex. „BUSUIOC 30", „Busuioc 30 g", „BUSUIOC 30 GR"). Grupa vine din
// „Grupare ambalare" (produs_id → grup_nume); dacă un cod nu e în grupă,
// îl potrivim după denumirea normalizată a unui produs care e în grupă.

export const normName = (s: string | null | undefined) =>
  (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/(\d+)\s*(gr|g)\b/g, "$1")
    .replace(/[^a-z0-9]/g, "");

export type GroupResolver = (produsId: string | null | undefined, produsNume: string | null | undefined) => string;

/** Întoarce funcția care dă grupa unui produs (sau numele lui, dacă nu are grupă). */
export const buildGroupResolver = (
  grupById: Record<string, string>,
  products: { id: string; nume: string }[],
): GroupResolver => {
  const byName: Record<string, string> = {};
  for (const p of products) {
    const g = (grupById[p.id] || "").trim();
    if (g) byName[normName(p.nume)] = g;
  }
  return (id, nume) => {
    const g = (id && (grupById[id] || "").trim()) || byName[normName(nume)];
    return g || (nume || "").trim();
  };
};

export type HistoryOrder = {
  produs_id: string;
  produs_nume: string | null;
  linie_id: string | null;
  linie_nume: string | null;
  cantitate: number;
  data_productie: string; // YYYY-MM-DD
  baxare?: string | null;
};

export type MatrixRow = {
  weekday: number; // 1 = Luni … 7 = Duminică
  grup: string;
  produs_id: string;
  produs_nume: string;
  cantitate: number;
  linie_id: string | null;
  linie_nume: string | null;
  baxare: string | null;
  position: number;
};

const isoWeekday = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return ((d.getUTCDay() + 6) % 7) + 1;
};

const top = <K>(m: Map<K, number>): K | undefined => {
  let best: K | undefined;
  let bv = -Infinity;
  for (const [k, v] of m) if (v > bv) { bv = v; best = k; }
  return best;
};

/**
 * Câte un rând pe grupă și zi a săptămânii.
 * Cantitate = media pe zilele în care grupa a fost produsă (toate variantele adunate pe zi).
 * Produsul reprezentativ = cel cu denumirea identică grupei, altfel cel folosit cel mai des.
 * Linia = linia cu cea mai mare cantitate.
 */
export const matrixFromHistory = (orders: HistoryOrder[], groupOf: GroupResolver): MatrixRow[] => {
  type Acc = {
    grup: string;
    perDay: Map<string, number>;
    useCount: Map<string, number>;
    names: Map<string, string>;
    lineQty: Map<string, number>;
    lineNames: Map<string, string | null>;
    bax: Map<string, number>;
  };
  const acc = new Map<string, Acc>();
  for (const o of orders) {
    const q = Number(o.cantitate) || 0;
    const grup = groupOf(o.produs_id, o.produs_nume);
    const wd = isoWeekday(o.data_productie);
    const key = `${wd}|${grup.toLowerCase()}`;
    let a = acc.get(key);
    if (!a) {
      a = { grup, perDay: new Map(), useCount: new Map(), names: new Map(), lineQty: new Map(), lineNames: new Map(), bax: new Map() };
      acc.set(key, a);
    }
    a.perDay.set(o.data_productie, (a.perDay.get(o.data_productie) || 0) + q);
    a.useCount.set(o.produs_id, (a.useCount.get(o.produs_id) || 0) + 1);
    a.names.set(o.produs_id, o.produs_nume || "");
    const lk = o.linie_id ?? "";
    a.lineQty.set(lk, (a.lineQty.get(lk) || 0) + q);
    a.lineNames.set(lk, o.linie_nume ?? null);
    if (o.baxare) a.bax.set(o.baxare, (a.bax.get(o.baxare) || 0) + 1);
  }

  const out: MatrixRow[] = [];
  for (const [key, a] of acc) {
    const weekday = Number(key.split("|")[0]);
    const days = [...a.perDay.values()];
    const cantitate = Math.round(days.reduce((s, v) => s + v, 0) / days.length);
    if (cantitate <= 0) continue;
    const same = (n: string) => n.trim().toLowerCase() === a.grup.trim().toLowerCase();
    const exact = [...a.names].find(([, n]) => same(n)) ?? [...a.names].find(([, n]) => normName(n) === normName(a.grup));
    const produs_id = exact ? exact[0] : (top(a.useCount) as string);
    const lk = top(a.lineQty) ?? "";
    out.push({
      weekday,
      grup: a.grup,
      produs_id,
      produs_nume: (a.names.get(produs_id) || a.grup).trim(),
      cantitate,
      linie_id: lk || null,
      linie_nume: a.lineNames.get(lk) ?? null,
      baxare: top(a.bax) ?? null,
      position: 0,
    });
  }
  out.sort((x, y) => x.weekday - y.weekday || x.grup.localeCompare(y.grup, "ro"));
  const pos: Record<number, number> = {};
  for (const r of out) r.position = (pos[r.weekday] = (pos[r.weekday] || 0) + 1);
  return out;
};
