import { supabase } from '@/integrations/supabase/client';
import { restockProductIds } from './restockGroups';
import { availablePoolLots, type PoolOrigin } from './poolReservations';

/**
 * POOL MODE
 * ---------
 * Tot ce se produce intră într-un "pool" comun pe produs (tabela
 * `productie_restocari`, status = 'disponibil').  Comenzile NU mai consumă
 * automat producția: marfa se scade din pool doar când este numărată în
 * picking (automat) sau alocată manual din ecranul de redistribuire.
 */
export const POOL_MODE = true;

/** Only an explicitly confirmed manual transfer may take another order's reserved goods. */
export type PoolAccess = 'reserved' | 'physical';

export interface PoolRow {
  id: string;
  produs_id: string;
  cantitate_surplus: number;
  data_productie: string | null;
  comanda_originala_id?: string | null;
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
        .select('id, produs_id, cantitate_surplus, data_productie, comanda_originala_id')
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

/** Free surplus plus the target order's own goods, never another order's reserved production. */
export const fetchAvailablePoolRows = async (produsIds: string[], targetOrderId?: string): Promise<PoolRow[]> => {
  const rows = await fetchPoolRows(produsIds);
  const ids = Array.from(new Set(rows.map(row => row.comanda_originala_id).filter((id): id is string => !!id)));
  const origins: PoolOrigin[] = [];
  for (const batch of chunk(ids)) {
    let from = 0;
    while (true) {
      const { data, error } = await supabase.from('productie_comenzi')
        .select('id, cantitate, cantitate_din_restock, magazin, tip_comanda').in('id', batch).order('id').range(from, from + 999);
      if (error) throw error;
      origins.push(...(data || []) as PoolOrigin[]);
      if (!data || data.length < 1000) break;
      from += 1000;
    }
  }
  return availablePoolLots(rows, origins, targetOrderId);
};

/** Total disponibil în pool, grupat pe produs. */
export const fetchPoolTotals = async (produsIds: string[], groups: Record<string, string> = {}, targetOrderId?: string, access: PoolAccess = 'reserved'): Promise<Map<string, number>> => {
  const sources = produsIds.flatMap(id => restockProductIds(id, groups));
  const rows = access === 'physical' ? await fetchPoolRows(sources) : await fetchAvailablePoolRows(sources, targetOrderId);
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
export const consumaDinPool = async (produsId: string, cantitate: number, groups: Record<string, string> = {}, targetOrderId?: string, access: PoolAccess = 'reserved'): Promise<number> => {
  if (!produsId || cantitate <= 0) return 0;
  const physicalRows = await fetchPoolRows(restockProductIds(produsId, groups));
  const physical = new Map(physicalRows.map(row => [row.id, Number(row.cantitate_surplus)]));
  const rows = (access === 'physical' ? physicalRows : await fetchAvailablePoolRows(restockProductIds(produsId, groups), targetOrderId)).sort((a, b) =>
    Number(b.comanda_originala_id === targetOrderId) - Number(a.comanda_originala_id === targetOrderId) ||
    (a.data_productie || '').localeCompare(b.data_productie || '') || a.id.localeCompare(b.id));
  let ramas = cantitate;
  let luat = 0;

  for (const r of rows) {
    if (ramas <= 0) break;
    const disponibil = Number(r.cantitate_surplus || 0);
    if (disponibil <= 0) continue;
    const take = Math.min(ramas, disponibil);
    const physicalQty = physical.get(r.id);
    if (physicalQty === undefined || physicalQty < disponibil) continue;
    const { data, error } = await supabase.from('productie_restocari')
      .update({ cantitate_surplus: physicalQty - take, status: take >= physicalQty ? 'redistribuit' : 'disponibil', updated_at: new Date().toISOString() })
      .eq('id', r.id).eq('status', 'disponibil').eq('cantitate_surplus', physicalQty).select('id');
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
  groups: Record<string, string> = {},
  access: PoolAccess = 'reserved'
): Promise<number> => {
  const curent = Number(comanda.cantitate_din_restock || 0);
  const tinta = Math.max(0, cantitateDorita);
  const delta = tinta - curent;
  if (Math.abs(delta) < 1e-9) return curent;

  let final = curent;
  if (delta > 0) {
    const luat = await consumaDinPool(comanda.produs_id, delta, groups, undefined, access);
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
