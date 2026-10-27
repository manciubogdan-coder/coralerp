import { supabase } from '@/integrations/supabase/client';
import { restockProductIds } from './restockGroups';

/**
 * POOL MODE
 * ---------
 * Tot ce se produce intră într-un "pool" comun pe produs (tabela
 * `productie_restocari`, status = 'disponibil').  Comenzile NU mai consumă
 * automat producția: marfa se scade din pool doar când este numărată în
 * picking (automat) sau alocată manual din ecranul de redistribuire.
 */
export const POOL_MODE = true;

export interface PoolRow {
  id: string;
  produs_id: string;
  cantitate_surplus: number;
  data_productie: string | null;
}

const chunk = <T,>(arr: T[], size = 50): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

/** Toate loturile disponibile din pool pentru produsele cerute (FIFO). */
export const fetchPoolRows = async (produsIds: string[]): Promise<PoolRow[]> => {
  const ids = Array.from(new Set(produsIds.filter(Boolean)));
  if (ids.length === 0) return [];
  const batches = await Promise.all(
    chunk(ids, 50).map(async (batch) => {
      const rows: PoolRow[] = [];
      let from = 0;
      while (true) {
      const { data, error } = await supabase
        .from('productie_restocari')
        .select('id, produs_id, cantitate_surplus, data_productie')
        .eq('status', 'disponibil')
        .gt('cantitate_surplus', 0)
        .in('produs_id', batch)
        .order('data_productie', { ascending: true }).order('id')
        .range(from, from + 999);
      if (error) throw error;
      rows.push(...(data || []) as PoolRow[]);
      if (!data || data.length < 1000) break;
      from += 1000;
      }
      return rows;
    })
  );
  return batches.flat();
};

/** Total disponibil în pool, grupat pe produs. */
export const fetchPoolTotals = async (produsIds: string[], groups: Record<string, string> = {}): Promise<Map<string, number>> => {
  const rows = await fetchPoolRows(produsIds.flatMap(id => restockProductIds(id, groups)));
  const map = new Map<string, number>();
  rows.forEach((r) => {
    map.set(r.produs_id, (map.get(r.produs_id) || 0) + Number(r.cantitate_surplus || 0));
  });
  return new Map(produsIds.map(id => [id, restockProductIds(id, groups).reduce((total, source) => total + (map.get(source) || 0), 0)]));
};

/**
 * Consumă FIFO din pool pentru un produs.
 * Returnează cantitatea efectiv alocată (poate fi mai mică decât cea cerută).
 */
export const consumaDinPool = async (produsId: string, cantitate: number, groups: Record<string, string> = {}): Promise<number> => {
  if (!produsId || cantitate <= 0) return 0;
  const rows = (await fetchPoolRows(restockProductIds(produsId, groups))).sort((a, b) =>
    (a.data_productie || '').localeCompare(b.data_productie || '') || a.id.localeCompare(b.id));
  let ramas = cantitate;
  let luat = 0;

  for (const r of rows) {
    if (ramas <= 0) break;
    const disponibil = Number(r.cantitate_surplus || 0);
    if (disponibil <= 0) continue;
    const take = Math.min(ramas, disponibil);
    const { data, error } = await supabase.from('productie_restocari')
      .update({ cantitate_surplus: disponibil - take, status: take >= disponibil ? 'redistribuit' : 'disponibil', updated_at: new Date().toISOString() })
      .eq('id', r.id).eq('status', 'disponibil').eq('cantitate_surplus', disponibil).select('id');
    if (error) throw error;
    if (!data?.length) continue;
    luat += take;
    ramas -= take;
  }

  return luat;
};

/** Returnează marfă în pool (dezalocare sau producție nouă). */
export const adaugaInPool = async (
  produsId: string,
  cantitate: number,
  comandaId?: string | null,
  dataProductie?: string
) => {
  if (!produsId || cantitate <= 0) return;
  const { error } = await supabase.from('productie_restocari').insert([
    {
      comanda_originala_id: comandaId || null,
      produs_id: produsId,
      cantitate_surplus: cantitate,
      data_productie: dataProductie || new Date().toISOString().split('T')[0],
      status: 'disponibil',
    },
  ]);
  if (error) throw error;
};

/**
 * Setează cantitatea alocată unei comenzi din pool (cantitate_din_restock).
 * Diferența pozitivă se scade din pool, cea negativă se întoarce în pool.
 * Returnează cantitatea finală alocată.
 */
export const setAlocareComanda = async (
  comanda: { id: string; produs_id: string; cantitate_din_restock?: number | null },
  cantitateDorita: number,
  groups: Record<string, string> = {}
): Promise<number> => {
  const curent = Number(comanda.cantitate_din_restock || 0);
  const tinta = Math.max(0, cantitateDorita);
  const delta = tinta - curent;
  if (Math.abs(delta) < 1e-9) return curent;

  let final = curent;
  if (delta > 0) {
    const luat = await consumaDinPool(comanda.produs_id, delta, groups);
    final = curent + luat;
  } else {
    await adaugaInPool(comanda.produs_id, -delta, comanda.id);
    final = tinta;
  }

  const { error } = await supabase
    .from('productie_comenzi')
    .update({ cantitate_din_restock: final, updated_at: new Date().toISOString() })
    .eq('id', comanda.id);
  if (error) throw error;
  return final;
};
