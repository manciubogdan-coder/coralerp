// Estimare → comandă fermă: o comandă Senior venită mai târziu pentru același magazin,
// produs și zi de producție, cu cantitate apropiată, absoarbe comanda anterioară.
export const ABSORB_TOLERANCE = 0.2;

export function docNumber(n: unknown) {
  const v = Number(String(n ?? '').replace(/\D/g, ''));
  return Number.isFinite(v) ? v : 0;
}

/** True când comanda nouă confirmă estimarea (cantitate în ±20%), nu o completează. */
export function isFirmReplacement(oldQty: number, newQty: number) {
  if (!(oldQty > 0) || !(newQty > 0)) return false;
  return Math.abs(oldQty - newQty) <= ABSORB_TOLERANCE * Math.max(oldQty, newQty);
}

export function absorbedStatus(produced: number, qty: number, oldStatus: string, linie: string | null) {
  if (produced >= qty - 0.0001) return 'completed';
  if (produced > 0) return 'partial';
  if (oldStatus === 'completed') return linie ? 'assigned' : 'pending';
  return linie ? (oldStatus === 'pending' ? 'assigned' : oldStatus) : 'pending';
}

type Row = { id: string; numar_comanda: string; magazin: string; produs_id: string; data_productie: string; cantitate: number; status: string; linie_id: string | null; tip_comanda?: string | null };

/** Perechi estimare → fermă găsite în memorie (fără interogări per linie). */
export function findAbsorbPairs(rows: Row[], absorbed: Set<string>) {
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    if (r.tip_comanda || !(Number(r.cantitate) > 0) || absorbed.has(String(r.id))) continue;
    const k = `${r.magazin}|${r.produs_id}|${r.data_productie}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(r);
  }
  const pairs: { old: Row; neu: Row }[] = [];
  for (const g of groups.values()) {
    g.sort((a, b) => docNumber(a.numar_comanda) - docNumber(b.numar_comanda));
    const used = new Set<string>();
    for (let j = g.length - 1; j > 0; j--) {
      const neu = g[j];
      if (used.has(neu.id)) continue;
      for (let i = 0; i < j; i++) {
        const old = g[i];
        if (used.has(old.id) || docNumber(old.numar_comanda) >= docNumber(neu.numar_comanda)) continue;
        if (!isFirmReplacement(Number(old.cantitate), Number(neu.cantitate))) continue;
        used.add(old.id); used.add(neu.id); pairs.push({ old, neu }); break;
      }
    }
  }
  return pairs;
}

export async function applyAbsorb(legacy: any, cloud: any, absorbed: Set<string>, old: Row, neu: Row) {
  const { error: sErr } = await legacy.from('productie_sesiuni_lucru').update({ comanda_id: neu.id }).eq('comanda_id', old.id);
  if (sErr) throw sErr;
  for (const t of ['productie_sesiuni_rebut', 'productie_trasabilitate']) {
    const { error: e } = await cloud.from(t).update({ comanda_id: neu.id }).eq('comanda_id', old.id);
    if (e) throw e;
  }
  const { data: ses, error: rErr } = await legacy.from('productie_sesiuni_lucru').select('cantitate_produsa,status').eq('comanda_id', neu.id);
  if (rErr) throw rErr;
  const produced = (ses ?? []).filter((s: any) => ['finalizata', 'partial'].includes(s.status))
    .reduce((a: number, s: any) => a + Number(s.cantitate_produsa || 0), 0);
  const active = (ses ?? []).some((s: any) => !['finalizata', 'partial'].includes(s.status));
  const qty = Number(neu.cantitate);
  const linie = old.linie_id || neu.linie_id || null;
  const baseStatus = produced > 0 || active ? String(old.status) : String(neu.status || old.status);
  const status = active ? 'partial' : absorbedStatus(produced, qty, baseStatus, linie);
  const { error: nErr } = await legacy.from('productie_comenzi').update({ status, linie_id: linie, cantitate_reala_produsa: produced }).eq('id', neu.id);
  if (nErr) throw nErr;
  const { error: cErr } = await legacy.from('productie_comenzi').update({ cantitate: 0, status: 'completed' }).eq('id', old.id);
  if (cErr) throw cErr;
  absorbed.add(String(old.id));
  await cloud.from('productie_comenzi_absorbite').upsert({
    old_id: old.id, new_id: neu.id, old_numar: old.numar_comanda, new_numar: neu.numar_comanda, magazin: neu.magazin,
    produs_id: neu.produs_id, data_productie: neu.data_productie, cantitate_veche: old.cantitate, cantitate_noua: qty, produs_mutat: produced,
  });
  await cloud.from('productie_comenzi_audit').insert({
    table_name: 'productie_comenzi', action: 'update', record_ids: [old.id, neu.id], comanda_ids: [old.id, neu.id],
    changes: { absorbtie: `${old.numar_comanda} → ${neu.numar_comanda}`, produs_mutat: produced }, source: 'senior-erp',
  });
  return { from: old.numar_comanda, to: neu.numar_comanda, produced, qty, id: neu.id, produsId: neu.produs_id, day: neu.data_productie };
}
