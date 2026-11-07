// Viteza reală pe linie vs norma setată (capacitate_ora), calculată DOAR pe orele
// efectiv lucrate (durata sesiunilor), nu pe ore/zi sau 24h. Sesiunile care se
// suprapun pe aceeași linie (comenzi grupate rulate simultan) se unesc ca timpul
// să nu fie numărat de două ori.

export interface SpeedSession {
  id: string;
  linie_id: string;
  comanda_id?: string | null;
  nume_operator?: string | null;
  numar_angajati?: number | null;
  ora_start?: string | null;
  ora_sfarsit?: string | null;
  cantitate_produsa?: number | null;
  status?: string | null;
}

export interface SpeedLine { id: string; nume: string; capacitate_ora: number }

export type SuspectReason = 'deschisa' | 'prea_lunga' | 'prea_scurta' | 'peste_norma' | 'fara_bucati';

export const MAX_SESSION_HOURS = 12;
export const MIN_SESSION_MINUTES = 2;
/** O sesiune de peste 3× norma e aproape sigur o cantitate introdusă greșit. */
export const MAX_NORM_RATIO = 3;

export interface Bucket {
  buc: number;
  ore: number;          // ore lucrate (intervale unite)
  oreOm: number;        // ore × oameni (pentru buc/oră/om)
  sesiuni: number;
}

export interface SpeedStat extends Bucket {
  bucPeOra: number;
  bucPeOraOm: number;
  norma: number;
  procentNorma: number | null;   // null când linia nu are normă
  bucNerealizate: number;         // norma × ore − buc (negativ = peste normă)
  orePierdute: number;            // ore − buc/normă
}

const ms = (s?: string | null) => (s ? new Date(s).getTime() : NaN);

export const sessionHours = (s: SpeedSession) => {
  const a = ms(s.ora_start), b = ms(s.ora_sfarsit);
  return isNaN(a) || isNaN(b) || b <= a ? 0 : (b - a) / 3_600_000;
};

/** Motivul pentru care sesiunea ar distorsiona viteza, sau null dacă e validă. */
export const suspectReason = (s: SpeedSession, norma: number): SuspectReason | null => {
  if (!s.ora_sfarsit) return 'deschisa';
  const h = sessionHours(s);
  if (h > MAX_SESSION_HOURS) return 'prea_lunga';
  if (h * 60 < MIN_SESSION_MINUTES) return 'prea_scurta';
  const buc = Number(s.cantitate_produsa || 0);
  if (buc <= 0) return 'fara_bucati';
  if (norma > 0 && buc / h > norma * MAX_NORM_RATIO) return 'peste_norma';
  return null;
};

export const SUSPECT_LABEL: Record<SuspectReason, string> = {
  deschisa: 'Sesiune încă deschisă',
  prea_lunga: `Durată peste ${MAX_SESSION_HOURS}h (probabil uitată pornită)`,
  prea_scurta: `Sub ${MIN_SESSION_MINUTES} minute`,
  peste_norma: `Peste ${MAX_NORM_RATIO}× norma (cantitate suspectă)`,
  fara_bucati: 'Fără bucăți raportate',
};

/** Lungimea totală a reuniunii intervalelor, în ore. */
export const mergedHours = (sessions: SpeedSession[]) => {
  const iv = sessions
    .map(s => [ms(s.ora_start), ms(s.ora_sfarsit)] as const)
    .filter(([a, b]) => !isNaN(a) && !isNaN(b) && b > a)
    .sort((x, y) => x[0] - y[0]);
  let total = 0, curA = NaN, curB = NaN;
  for (const [a, b] of iv) {
    if (isNaN(curA) || a > curB) {
      if (!isNaN(curA)) total += curB - curA;
      curA = a; curB = b;
    } else if (b > curB) curB = b;
  }
  if (!isNaN(curA)) total += curB - curA;
  return total / 3_600_000;
};

export const bucket = (sessions: SpeedSession[]): Bucket => ({
  buc: sessions.reduce((s, x) => s + Number(x.cantitate_produsa || 0), 0),
  ore: mergedHours(sessions),
  oreOm: sessions.reduce((s, x) => s + sessionHours(x) * Math.max(1, Number(x.numar_angajati) || 1), 0),
  sesiuni: sessions.length,
});

export const toStat = (b: Bucket, norma: number): SpeedStat => {
  const bucPeOra = b.ore > 0 ? b.buc / b.ore : 0;
  return {
    ...b,
    bucPeOra,
    bucPeOraOm: b.oreOm > 0 ? b.buc / b.oreOm : 0,
    norma,
    procentNorma: norma > 0 && b.ore > 0 ? (bucPeOra / norma) * 100 : null,
    bucNerealizate: norma > 0 ? norma * b.ore - b.buc : 0,
    orePierdute: norma > 0 ? b.ore - b.buc / norma : 0,
  };
};

const groupBy = <T,>(xs: T[], key: (x: T) => string) => {
  const m = new Map<string, T[]>();
  xs.forEach(x => { const k = key(x); m.set(k, [...(m.get(k) || []), x]); });
  return m;
};

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export interface LineReport extends SpeedStat {
  id: string;
  nume: string;
  zile: number;
  /** Mediana vitezei zilnice — o normă „realistă” propusă din istoric. */
  normaRealista: number;
  ceaMaiBunaZi: { zi: string; bucPeOra: number } | null;
  ceaMaiSlabaZi: { zi: string; bucPeOra: number } | null;
  perZi: Map<string, SpeedStat>;
  perProdus: (SpeedStat & { produs: string })[];
  perOperator: (SpeedStat & { operator: string })[];
}

export interface SpeedReport {
  lines: LineReport[];
  suspects: { session: SpeedSession; linie: string; motiv: SuspectReason; ore: number }[];
  zile: string[];
  total: SpeedStat;
}

export function buildSpeedReport(opts: {
  sessions: SpeedSession[];
  lines: SpeedLine[];
  dayOf: (iso: string) => string;
  productOf: (comandaId?: string | null) => string;
  excludeSuspect: boolean;
}): SpeedReport {
  const { sessions, lines, dayOf, productOf, excludeSuspect } = opts;
  const lineById = new Map(lines.map(l => [l.id, l]));
  const suspects: SpeedReport['suspects'] = [];
  const valid: SpeedSession[] = [];
  for (const s of sessions) {
    const line = lineById.get(s.linie_id);
    if (!line || !s.ora_start) continue;
    const motiv = suspectReason(s, Number(line.capacitate_ora) || 0);
    if (motiv) suspects.push({ session: s, linie: line.nume, motiv, ore: sessionHours(s) });
    // Sesiunile deschise nu au încă bucăți; nu intră niciodată în viteză.
    if (motiv === 'deschisa' || (motiv && excludeSuspect)) continue;
    valid.push(s);
  }

  const zileSet = new Set<string>();
  const byLine = groupBy(valid, s => s.linie_id);
  const out: LineReport[] = [];
  for (const line of lines) {
    const ls = byLine.get(line.id) || [];
    if (!ls.length) continue;
    const norma = Number(line.capacitate_ora) || 0;
    const perZi = new Map<string, SpeedStat>();
    for (const [zi, xs] of groupBy(ls, s => dayOf(s.ora_start!))) {
      zileSet.add(zi);
      perZi.set(zi, toStat(bucket(xs), norma));
    }
    const ranked = [...perZi.entries()].filter(([, s]) => s.ore >= 0.5).sort((a, b) => b[1].bucPeOra - a[1].bucPeOra);
    const perProdus = [...groupBy(ls, s => productOf(s.comanda_id))]
      .map(([produs, xs]) => ({ produs, ...toStat(bucket(xs), norma) }))
      .sort((a, b) => b.ore - a.ore);
    const perOperator = [...groupBy(ls, s => (s.nume_operator || '').trim() || '—')]
      .map(([operator, xs]) => ({ operator, ...toStat(bucket(xs), norma) }))
      .sort((a, b) => b.ore - a.ore);
    out.push({
      id: line.id,
      nume: line.nume,
      ...toStat(bucket(ls), norma),
      zile: perZi.size,
      normaRealista: median([...perZi.values()].filter(s => s.ore >= 0.5).map(s => s.bucPeOra)),
      ceaMaiBunaZi: ranked[0] ? { zi: ranked[0][0], bucPeOra: ranked[0][1].bucPeOra } : null,
      ceaMaiSlabaZi: ranked.length > 1 ? { zi: ranked[ranked.length - 1][0], bucPeOra: ranked[ranked.length - 1][1].bucPeOra } : null,
      perZi,
      perProdus,
      perOperator,
    });
  }
  out.sort((a, b) => (a.procentNorma ?? Infinity) - (b.procentNorma ?? Infinity));

  // Total fabrică: orele se adună pe linii (linii diferite lucrează în paralel).
  const t = out.reduce<Bucket>((acc, l) => ({ buc: acc.buc + l.buc, ore: acc.ore + l.ore, oreOm: acc.oreOm + l.oreOm, sesiuni: acc.sesiuni + l.sesiuni }), { buc: 0, ore: 0, oreOm: 0, sesiuni: 0 });
  const normaPonderata = t.ore > 0 ? out.reduce((s, l) => s + l.norma * l.ore, 0) / t.ore : 0;
  return { lines: out, suspects, zile: [...zileSet].sort(), total: toStat(t, normaPonderata) };
}

export const normaTone = (p: number | null) => (p == null ? 'none' : p >= 95 ? 'good' : p >= 80 ? 'warn' : 'bad');
