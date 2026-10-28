
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { refreshProductionQueries } from '@/lib/productie/refreshProductionQueries';

interface UseAutoRefreshOptions {
  interval?: number; // în milisecunde, default 30 secunde
  enabled?: boolean;
  queryKeys?: string[][]; // query keys specifice de invalidat
}

export const useAutoRefresh = ({ 
  interval = 30000, 
  enabled = true,
  queryKeys = []
}: UseAutoRefreshOptions = {}) => {
  const queryClient = useQueryClient();
  const keysSignature = JSON.stringify(queryKeys);

  useEffect(() => {
    if (!enabled) return;

    const invalidate = () => {
      if (document.visibilityState === 'hidden') return;
      const keys: string[][] = JSON.parse(keysSignature);
      // Invalidez cache-urile specifice dacă sunt date
      if (keys.length > 0) {
        keys.forEach(queryKey => {
          void queryClient.invalidateQueries({ queryKey }, { cancelRefetch: false });
        });
      } else {
        // Invalidez toate cache-urile importante pentru producție
        void refreshProductionQueries(queryClient, ['orders', 'production-orders', 'productie-comenzi', 'restockings', 'work-sessions']);
      }
    };

    // Auto-refresh silențios - fără mesaje în consolă
    const intervalId = setInterval(invalidate, interval);

    // Reîmprospătare imediată când ecranul/tableta se trezește din sleep —
    // altfel un ecran lăsat deschis peste noapte arată datele de ieri.
    const onVisible = () => {
      if (document.visibilityState === 'visible') invalidate();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [queryClient, interval, enabled, keysSignature]);
};
