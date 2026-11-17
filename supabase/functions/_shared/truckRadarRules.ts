// Pure rules for the purchasing "Radar tiruri" (no imports: used by the edge function and the screen).

export interface RadarSettings {
  /** Days between the order day and the loading day (2 = order today for loading the day after tomorrow). */
  advanceDays: number;
  /** Latest time (HH:MM, Bucharest) the order for a loading must be final on the order day. */
  cutoff: string;
  /** Days between loading at the supplier and arrival at the warehouse. */
  transitDays: number;
  /** Ordered vs needed difference tolerated before a warning, in %. */
  tolerancePct: number;
  /** ISO weekdays with loadings (1 = Monday ... 7 = Sunday). */
  loadingWeekdays: number[];
}

export const DEFAULT_RADAR_SETTINGS: RadarSettings = {
  advanceDays: 2, cutoff: '14:00', transitDays: 1, tolerancePct: 10, loadingWeekdays: [1, 2, 3, 4, 5, 6],
};

const int = (v: unknown, min: number, max: number, label: string) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${label}: între ${min} și ${max}.`);
  return n;
};

export function validRadarSettings(raw: any): RadarSettings {
  const s = raw ?? {};
  const cutoff = String(s.cutoff ?? '');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(cutoff)) throw new Error('Ora limită trebuie să fie HH:MM.');
  const days = Array.isArray(s.loadingWeekdays) ? [...new Set<number>(s.loadingWeekdays.map(Number))] : [] as number[];
  if (!days.length || days.some((d) => !Number.isInteger(d) || d < 1 || d > 7)) throw new Error('Alege cel puțin o zi de încărcare.');
  const tol = Number(s.tolerancePct);
  if (!Number.isFinite(tol) || tol < 0 || tol > 100) throw new Error('Toleranța: între 0 și 100%.');
  return {
    advanceDays: int(s.advanceDays, 0, 14, 'Zile avans comandă'),
    cutoff,
    transitDays: int(s.transitDays, 0, 10, 'Zile tranzit'),
    tolerancePct: tol,
    loadingWeekdays: (days as number[]).sort((a, b) => a - b),
  };
}

export interface SeenOrder { order_id: string; product_id: string | null; delivery_date: string | null; quantity: number; status: string | null }

/** Orders whose quantity/date/status differ from the last recorded version (or never recorded). */
export function changedOrders(current: SeenOrder[], last: Map<string, SeenOrder>): SeenOrder[] {
  return current.filter((o) => {
    const p = last.get(o.order_id);
    return !p || Number(p.quantity) !== Number(o.quantity) || (p.delivery_date ?? null) !== (o.delivery_date ?? null) || (p.status ?? null) !== (o.status ?? null);
  });
}
