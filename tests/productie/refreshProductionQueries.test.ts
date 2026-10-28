import { expect, test } from 'bun:test';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { refreshProductionQueries } from '../../src/lib/productie/refreshProductionQueries';

test('live refreshes do not restart an in-flight production history read', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let calls = 0;
  let finish: ((value: number) => void) | undefined;
  const observer = new QueryObserver(client, {
    queryKey: ['orders'], initialData: 1, staleTime: Infinity,
    queryFn: () => { calls++; return new Promise<number>(resolve => { finish = resolve; }); },
  });
  const unsubscribe = observer.subscribe(() => {});
  const first = refreshProductionQueries(client, ['orders']);
  const second = refreshProductionQueries(client, ['orders']);
  expect(calls).toBe(1);
  finish?.(2);
  await Promise.all([first, second]);
  expect(client.getQueryData(['orders'])).toBe(2);
  unsubscribe();
  client.clear();
});