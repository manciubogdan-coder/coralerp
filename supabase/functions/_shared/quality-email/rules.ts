export function localClock(now: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}
export function shiftDay(day: string, offset: number) {
  const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + offset); return d.toISOString().slice(0, 10);
}
export function dayBounds(day: string) {
  const midnight = (key: string) => {
    const p = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Bucharest', timeZoneName: 'shortOffset' }).formatToParts(new Date(`${key}T12:00:00Z`));
    // Transition days: midnight still uses the previous day's offset.
    const before = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Bucharest', timeZoneName: 'shortOffset' }).formatToParts(new Date(`${key}T00:00:00Z`));
    const offset = (before.find(x => x.type === 'timeZoneName')?.value ?? p.find(x => x.type === 'timeZoneName')?.value ?? 'GMT+2').match(/GMT([+-]\d+)/);
    return new Date(Date.parse(`${key}T00:00:00Z`) - Number(offset?.[1] ?? 2) * 3600000).toISOString();
  };
  return { start: midnight(day), end: midnight(shiftDay(day, 1)) };
}
export function isFinalized(review: any, row: any, report: any): boolean {
  if (!row) return false;
  const canonical = (v: any): string => {
    if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
    if (v && typeof v === 'object') return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
    return JSON.stringify(v);
  };
  return review?.finalized === true && canonical(review.snapshot) === canonical(qualitySnapshot(row, report));
}
export function qualitySnapshot(row: any, report: any) {
  return {
    quantity: Number(row.original_quantity ?? row.net_quantity ?? 0),
    product: row.name ?? '', supplier: row.supplier_id ?? '', supplier_name: row.supplier_name ?? '', producer: row.manufacturer_id ?? '', document: row.document_number ?? '', lot: row.lot_number ?? '',
    document_quantity: report?.cantitate_document ?? null, declared_quantity: report?.declared_quantity ?? null,
    loss: report?.pierdere_calitativa_procent ?? null, defects: report?.defects ?? [], observations: report?.observations ?? '', photos: report?.photos ?? [],
  };
}