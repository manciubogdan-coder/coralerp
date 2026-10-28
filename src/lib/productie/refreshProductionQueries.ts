import type { QueryClient } from '@tanstack/react-query';

// Keep an existing read alive: cancelling it restarts every history page.
export const refreshProductionQueries = (client: QueryClient, keys: readonly string[]) =>
  client.invalidateQueries(
    { predicate: query => keys.includes(String(query.queryKey[0])), refetchType: 'active' },
    { cancelRefetch: false },
  );