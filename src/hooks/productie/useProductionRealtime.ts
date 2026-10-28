import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { refreshProductionQueries } from '@/lib/productie/refreshProductionQueries';

// Cheile de cache folosite de ecranele de producție/operator.
const PRODUCTION_KEYS = [
  'orders',
  'production-orders',
  'productie-comenzi',
  'work-sessions',
  'restockings',
  'marfa-restocata',
  'marfa-restocata-istoric',
  'operator-restock',
  'pool-cautare-restocari',
];

// Tabelele ale căror schimbări trebuie să ajungă instant la toți operatorii.
const WATCHED_TABLES = [
  'productie_comenzi',
  'productie_sesiuni_lucru',
  'productie_restocari',
];

/**
 * Abonează pagina curentă la modificările din baza de date (Supabase Realtime):
 * când alt operator pornește/finalizează o comandă sau se schimbă o cantitate,
 * toate ecranele deschise pe aceeași pagină se actualizează singure, fără refresh.
 *
 * Necesită ca tabelele să fie în publicația realtime a bazei (o singură dată):
 *   alter publication supabase_realtime add table productie_comenzi;
 *   alter publication supabase_realtime add table productie_sesiuni_lucru;
 *   alter publication supabase_realtime add table productie_restocari;
 * Dacă publicația lipsește, hook-ul nu face nimic (polling-ul rămâne plasa de siguranță).
 */
export const useProductionRealtime = (enabled = true) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    // Debounce: o rafală de evenimente (ex. import Senior) declanșează o singură reîmprospătare.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleInvalidate = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void refreshProductionQueries(queryClient, PRODUCTION_KEYS);
      }, 400);
    };

    const channel = supabase
      .channel(`productie-rt-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: WATCHED_TABLES[0] }, scheduleInvalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: WATCHED_TABLES[1] }, scheduleInvalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: WATCHED_TABLES[2] }, scheduleInvalidate)
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [queryClient, enabled]);
};
