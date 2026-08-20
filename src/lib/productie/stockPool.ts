import { supabase } from '@/integrations/supabase/client';

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
      const { data, error } = await supabase
        .from('productie_restocari')
        .select('id, produs_id, cantitate_surplus, data_productie')
        .eq('status', 'disponibil')
        .gt('cantitate_surplus', 0)
        .in('produs_id', batch)
        .order('data_productie', { ascending: true });
      if (error) throw error;
      return (data || []) as PoolRow[];
    })
  );
  return batches.flat();
};

/** Total disponibil în pool, grupat pe produs. */
export const fetchPoolTotals = async (produsIds: string[]): Promise<Map<string, number>> => {
  const rows = await fetchPoolRows(produsIds);
  const map = new Map<string, number>();
  rows.forEach((r) => {
    map.set(r.produs_id, (map.get(r.produs_id) || 0) + Number(r.cantitate_surplus || 0));
  });
  return map;
};

/**
 * Consumă FIFO din pool pentru un produs.
 * Returnează cantitatea efectiv alocată (poate fi mai mică decât cea cerută).
 */
export const consumaDinPool = async (produsId: string, cantitate: number): Promise<number> => {
  if (!produsId || cantitate <= 0) return 0;
  const rows = await fetchPoolRows([produsId]);
  let ramas = cantitate;
  let luat = 0;
  const writes: Promise<any>[] = [];

  for (const r of rows) {
    if (ramas <= 0) break;
    const disponibil = Number(r.cantitate_surplus || 0);
    if (disponibil <= 0) continue;
    const take = Math.min(ramas, disponibil);
    if (take >= disponibil) {
      writes.push(
        supabase
          .from('productie_restocari')
          .update({ status: 'folosit', cantitate_surplus: 0, updated_at: new Date().toISOString() })
          .eq('id', r.id) as any
      );
    } else {
      writes.push(
        supabase
          .from('productie_restocari')
          .update({ cantitate_surplus: disponibil - take, updated_at: new Date().toISOString() })
          .eq('id', r.id) as any
      );
    }
    luat += take;
    ramas -= take;
  }

  if (writes.length > 0) await Promise.all(writes);
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
  cantitateDorita: number
): Promise<number> => {
  const curent = Number(comanda.cantitate_din_restock || 0);
  const tinta = Math.max(0, cantitateDorita);
  const delta = tinta - curent;
  if (Math.abs(delta) < 1e-9) return curent;

  let final = curent;
  if (delta > 0) {
    const luat = await consumaDinPool(comanda.produs_id, delta);
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
