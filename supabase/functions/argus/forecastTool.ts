import { jsonSchema, tool } from 'npm:ai@7.0.123';
import { bucharestDay, type Clients } from './data.ts';
import { projectionMaterialKey, projectionQuantity, projectionTransferQuantity, projectionConsumptionDestination, weekdayAverages, sevenDayBuffer, netPendingDeliveries, reconcileProjection, projectionDemand } from '../_shared/forecastProjectionRules.ts';

async function pages(build: () => any): Promise<any[]> {
  const rows: any[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await build().range(offset, offset + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data || []));
    if (!data || data.length < 1000) return rows;
  }
}
const shift = (day: string, n: number) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dayOf = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : bucharestDay(new Date(value));
// A 26-hour inclusive envelope covers Bucharest dates in either DST season; filter by business day after reading.
const bounds = (day: string) => ({ start: `${shift(day, -1)}T21:00:00Z`, end: `${day}T21:59:59.999Z` });
const sum = (rows: any[], value: (r: any) => number) => rows.reduce((n, r) => n + value(r), 0);

export async function purchasingForecast(c: Clients, product: string, warehouse: string, days = 28, today = bucharestDay()) {
  const prefix = warehouse === 'materii-prime' ? '' : `${warehouse}_`;
  const db = c.legacy;
  const products = await pages(() => db.from(`${prefix}products`).select('id,name,default_unit').order('id'));
  const key = projectionMaterialKey(product);
  const exact = products.filter(p => projectionMaterialKey(p.name) === key);
  const matched = exact.length ? exact : products.filter(p => projectionMaterialKey(p.name).includes(key));
  if (!matched.length) return { eroare: 'Produsul nu există în nomenclatorul acestui depozit.', depozit: warehouse, produs: product };
  if (matched.length > 12) return { eroare: 'Denumirea este prea largă. Alege produsul exact.', produse: matched.map(p => p.name) };
  const names = new Map(products.map(p => [projectionMaterialKey(p.name), p]));
  const byId = new Map(products.map(p => [p.id, p]));
  const from = shift(today, -28), to = shift(today, days - 1);
  const resolve = (r: any) => names.get(projectionMaterialKey(r.name || '')) || byId.get(r.product_id);
  const [snapshots, receipts, transfers, returns, orders, lots] = await Promise.all([
    pages(() => db.from(warehouse === 'materii-prime' ? 'daily_stock_snapshots' : `${prefix}daily_stock_snapshots`).select('id,product_id,name,quantity,unit,snapshot_date').eq('snapshot_date', today).order('id')),
    pages(() => db.from(`${prefix}reception_records`).select('id,product_id,name,original_quantity,net_quantity,unit,receipt_date').gte('receipt_date', bounds(today).start).lte('receipt_date', bounds(to).end).order('id')),
    pages(() => db.from(`${prefix}stock_transfers`).select('id,transfer_date,destination').gte('transfer_date', warehouse === 'etichete' ? bounds(from).start : from).lte('transfer_date', warehouse === 'etichete' ? bounds(today).end : today).order('id')),
    pages(() => db.from(`${prefix}inventory_history`).select('id,product_id,name,quantity,unit,operation_date').in('action', ['transfer_in','return','return_from_production']).gte('operation_date', warehouse === 'etichete' ? bounds(today).start : today).lte('operation_date', warehouse === 'etichete' ? bounds(to).end : to).order('id')),
    pages(() => db.from(`${prefix}product_orders`).select('id,product_id,quantity_ordered,expected_delivery_date,status').in('product_id', matched.map(p => p.id)).order('id')),
    pages(() => db.from(`${prefix}inventory`).select('id,product_id,name,quantity,unit,lot_number,receipt_date').gt('quantity', 0).order('id')),
  ]);
  const lotById = new Map(lots.map(r => [r.id, r]));
  const relevantTransfers = transfers.filter(r => dayOf(r.transfer_date) >= from && dayOf(r.transfer_date) <= today && projectionConsumptionDestination(r.destination));
  const headers = new Map(relevantTransfers.map(r => [r.id, r]));
  const items: any[] = [];
  const transferIds = [...headers.keys()];
  for (let i = 0; i < transferIds.length; i += 50) {
    items.push(...await pages(() => db.from(`${prefix}stock_transfer_items`).select('id,transfer_id,inventory_item_id,quantity,net_quantity,unit').in('transfer_id', transferIds.slice(i, i + 50)).order('id')));
  }
  // Original lots must be hydrated even after stock reaches zero; current positive stock cannot explain past usage.
  const missingLots = [...new Set(items.map(i => i.inventory_item_id).filter(id => id && !lotById.has(id)))];
  for (let i = 0; i < missingLots.length; i += 50) {
    const historicalLots = await pages(() => db.from(`${prefix}inventory`).select('id,product_id,name,quantity,unit,lot_number,receipt_date').in('id', missingLots.slice(i, i + 50)).order('id'));
    historicalLots.forEach(r => lotById.set(r.id, r));
  }
  if (items.some(i => !lotById.has(i.inventory_item_id))) {
    throw new Error('Unele loturi din transferuri nu pot fi citite; consumul complet nu este verificabil.');
  }
  const refDays = Array.from({ length: 28 }, (_, i) => shift(from, i));
  const dates = Array.from({ length: days }, (_, i) => shift(today, i));
  return { sursa: 'Achiziții → Forecast din comenzi client → Proiecție zi pe zi', depozit: warehouse, verificat_la: new Date().toISOString(), azi: today,
    perioada_mediei: { de_la: from, pana_la: shift(today, -1), zile: 28, regula: 'Media pe aceeași zi a săptămânii, câte 4 zile de referință; fără PT; zilele fără transfer sunt zero. Azi: maxim(media zilei, transferurile de azi). Nu este stoc ÷ medie generică.' },
    produse: matched.map(p => {
      const same = (r: any) => resolve(r)?.id === p.id;
      const actual: Record<string, number> = {};
      const sources: any[] = [];
      for (const item of items) {
        const lot = lotById.get(item.inventory_item_id), header = headers.get(item.transfer_id);
        if (!lot || !header || !same(lot)) continue;
        const day = dayOf(header.transfer_date), quantity = projectionTransferQuantity(item, lot.unit);
        actual[day] = (actual[day] || 0) + quantity;
        sources.push({ zi: day, cantitate: quantity, lot: lot.lot_number, transfer: header.id, destinatie: header.destination });
      }
      const perWeekday = weekdayAverages(actual, refDays);
      const received: Record<string, number> = {}, returned: Record<string, number> = {}, ordered: Record<string, number> = {};
      receipts.filter(same).forEach(r => { const d = dayOf(r.receipt_date); if (d >= today && d <= to) received[d] = (received[d] || 0) + projectionQuantity(r.original_quantity ?? r.net_quantity, r.unit); });
      returns.filter(same).forEach(r => { const d = dayOf(r.operation_date); if (d >= today && d <= to) returned[d] = (returned[d] || 0) + projectionQuantity(r.quantity, r.unit); });
      orders.filter(o => o.product_id === p.id && ['pending','ordered'].includes(o.status)).forEach(o => { const d = o.expected_delivery_date?.slice(0, 10); if (d && d >= today && Number(o.quantity_ordered) > 0) ordered[d] = (ordered[d] || 0) + Number(o.quantity_ordered); });
      const ownSnapshots = snapshots.filter(same);
      const anchor = ownSnapshots.length ? sum(ownSnapshots, r => projectionQuantity(r.quantity, r.unit)) : null;
      const physical = sum(lots.filter(r => same(r) && Number(r.quantity) > 0), r => projectionQuantity(r.quantity, r.unit));
      const demand = dates.map(d => projectionDemand(actual, perWeekday, d, today));
      const projection = anchor === null ? null : reconcileProjection({ dates, today, anchor, snapshots: { [today]: anchor }, ordered: netPendingDeliveries({ ordered, today }), received, returned, outbound: {}, demand, allowNegative: warehouse !== 'materii-prime' });
      const shortage = projection?.findIndex(r => r.closing !== null && r.closing < 0) ?? -1;
      return { produs: p.name, unitate: warehouse === 'materii-prime' ? 'kg' : p.default_unit, stoc_fizic_acum: physical, stoc_inceput_azi: anchor,
        avertisment: anchor === null ? 'Snapshotul acestui produs lipsește; nu pot verifica proiecția de început de zi. Stocul fizic nu este stocul de început.' : null,
        consum_azi: actual[today] || 0, medie_pe_zile: perWeekday, total_28_zile: sum(refDays, d => actual[d] || 0), medie_calendaristica_28_zile: sum(refDays, d => actual[d] || 0) / 28,
        tampon_7_zile: sevenDayBuffer(actual, today), prima_zi_cu_lipsa: shortage >= 0 ? dates[shortage] : null,
        acoperire: !projection ? 'Neverificabilă fără snapshot' : shortage < 0 ? `Nu apare lipsă în cele ${days} zile calculate; nu înseamnă stoc nelimitat.` : `Prima lipsă: ${dates[shortage]}, inclusiv livrările deja comandate.`,
        proiectie: projection?.map((r, i) => ({ zi: dates[i], stoc_inceput: r.opening, comandat: ordered[dates[i]] || 0, receptionat: received[dates[i]] || 0, consum: r.consumption, stoc_final: r.closing })) ?? [],
        surse_consum: sources, zile_consum_referinta: refDays.map(d => ({ zi: d, cantitate: actual[d] || 0 })) };
    }) };
}

export function forecastTools(c: Clients) {
  return { stoc_si_proiectie_achizitii: tool({
    description: 'OBLIGATORIU pentru stoc, consum mediu și cât ajunge marfa: aceleași surse și formule ca Achiziții Forecast Proiecție zi pe zi. Distinge stocul fizic de snapshotul de început. Nu calcula acoperirea din stoc/medie. Denumire de materie primă/ambalaj/etichetă, nu produs finit. Returnează separat toate variantele potrivite.',
    inputSchema: jsonSchema<{ produs: string; depozit: string; zile: number }>({ type: 'object', additionalProperties: false, required: ['produs','depozit','zile'], properties: { produs: { type: 'string', minLength: 2, maxLength: 120 }, depozit: { type: 'string', enum: ['materii-prime','ambalaje','etichete'] }, zile: { type: 'integer', minimum: 1, maximum: 60 } } }),
    execute: async ({ produs, depozit, zile }) => { try { return await purchasingForecast(c, produs, depozit, zile); } catch (e) { return { eroare: `Proiecția Achiziții nu a putut fi verificată: ${(e as Error).message}` }; } },
  }) };
}