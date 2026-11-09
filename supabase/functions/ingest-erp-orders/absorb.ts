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

export async function absorbEstimate(legacy: any, cloud: any, absorbed: Set<string>, o: {
  id: string; numar: string; magazin: string; produsId: string; day: string; cantitate: number;
}) {
  const { data: cands, error } = await legacy.from('productie_comenzi')
    .select('id,numar_comanda,cantitate,status,linie_id,tip_comanda')
    .eq('sursa', 'senior-erp').eq('magazin', o.magazin).eq('produs_id', o.produsId)
    .eq('data_productie', o.day).gt('cantitate', 0).neq('id', o.id);
  if (error) throw error;
  const older = (cands ?? []).filter((c: any) => !c.tip_comanda && !absorbed.has(String(c.id))
    && docNumber(c.numar_comanda) < docNumber(o.numar) && isFirmReplacement(Number(c.cantitate), o.cantitate))
    .sort((a: any, b: any) => docNumber(a.numar_comanda) - docNumber(b.numar_comanda));
  const old = older[0];
  if (!old) return null;

  const { data: me, error: meErr } = await legacy.from('productie_comenzi').select('status,linie_id').eq('id', o.id).maybeSingle();
  if (meErr) throw meErr;
  const { error: sErr } = await legacy.from('productie_sesiuni_lucru').update({ comanda_id: o.id }).eq('comanda_id', old.id);
  if (sErr) throw sErr;
  for (const t of ['productie_sesiuni_rebut', 'productie_trasabilitate']) {
    const { error: e } = await cloud.from(t).update({ comanda_id: o.id }).eq('comanda_id', old.id);
    if (e) throw e;
  }
  const { data: ses } = await legacy.from('productie_sesiuni_lucru').select('cantitate_produsa,status').eq('comanda_id', o.id);
  const produced = (ses ?? []).filter((s: any) => ['finalizata', 'partial'].includes(s.status))
    .reduce((a: number, s: any) => a + Number(s.cantitate_produsa || 0), 0);
  const active = (ses ?? []).some((s: any) => !['finalizata', 'partial'].includes(s.status));
  const linie = old.linie_id || me?.linie_id || null;
  const baseStatus = Number(produced) > 0 || active ? String(old.status) : String(me?.status || old.status);
  const status = active ? 'partial' : absorbedStatus(produced, o.cantitate, baseStatus, linie);
  const { error: nErr } = await legacy.from('productie_comenzi').update({ status, linie_id: linie }).eq('id', o.id);
  if (nErr) throw nErr;
  const { error: cErr } = await legacy.from('productie_comenzi').update({ cantitate: 0, status: 'completed' }).eq('id', old.id);
  if (cErr) throw cErr;
  absorbed.add(String(old.id));
  await cloud.from('productie_comenzi_absorbite').upsert({
    old_id: old.id, new_id: o.id, old_numar: old.numar_comanda, new_numar: o.numar, magazin: o.magazin,
    produs_id: o.produsId, data_productie: o.day, cantitate_veche: old.cantitate, cantitate_noua: o.cantitate, produs_mutat: produced,
  });
  await cloud.from('productie_comenzi_audit').insert({
    table_name: 'productie_comenzi', action: 'update', record_ids: [old.id, o.id], comanda_ids: [old.id, o.id],
    changes: { absorbtie: `${old.numar_comanda} → ${o.numar}`, produs_mutat: produced }, source: 'senior-erp',
  });
  return { from: old.numar_comanda, to: o.numar, produced };
}
