
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

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

  useEffect(() => {
    if (!enabled) return;

    // Auto-refresh silențios - fără mesaje în consolă
    const intervalId = setInterval(() => {
      // Invalidez cache-urile specifice dacă sunt date
      if (queryKeys.length > 0) {
        queryKeys.forEach(queryKey => {
          queryClient.invalidateQueries({ queryKey });
        });
      } else {
        // Invalidez toate cache-urile importante pentru producție
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        queryClient.invalidateQueries({ queryKey: ['production-orders'] });
        queryClient.invalidateQueries({ queryKey: ['productie-comenzi'] });
        queryClient.invalidateQueries({ queryKey: ['restockings'] });
        queryClient.invalidateQueries({ queryKey: ['work-sessions'] });
        queryClient.invalidateQueries({ queryKey: ['products'] });
        queryClient.invalidateQueries({ queryKey: ['lines'] });
      }
    }, interval);

    return () => {
      clearInterval(intervalId);
    };
  }, [queryClient, interval, enabled, queryKeys]);
};
