import { test, expect } from 'bun:test';
import { searchConversations } from '../../supabase/functions/argus/conversationSearch';

function fakeCloud(tables: Record<string, any[]>) {
  return {
    from(name: string) {
      let rows = [...(tables[name] ?? [])];
      const q: any = {
        select: () => q, order: () => q, limit: () => q,
        in: (col: string, vals: string[]) => { rows = rows.filter(r => vals.includes(r[col])); return q; },
        eq: (col: string, v: string) => { rows = rows.filter(r => r[col] === v); return q; },
        range: (a: number, b: number) => Promise.resolve({ data: rows.slice(a, b + 1), error: null }),
        then: (res: any) => res({ data: rows, error: null }),
      };
      return q;
    },
  };
}

const msg = (text: string) => ({ message: { role: 'assistant', parts: [{ type: 'text', text }] } });

test('an admin finds a colleague conversation by colleague name and message content', async () => {
  const cloud = fakeCloud({
    argus_threads: [
      { id: 't1', title: 'Conversație nouă', user_id: 'petrica', updated_at: '2026-11-05' },
      { id: 't2', title: 'Alt subiect', user_id: 'bogdan', updated_at: '2026-11-04' },
    ],
    app_activity_pings: [
      { user_id: 'petrica', display_name: 'Petrica' },
      { user_id: 'bogdan', display_name: 'Manciu Bogdan' },
    ],
    argus_messages: [
      { thread_id: 't1', ...msg('Tabel: cât am plătit pe marfă în criză vs prețul corect') },
      { thread_id: 't2', ...msg('Tabel: cât am plătit pe marfă') },
    ],
  });
  const res = await searchConversations({ cloud }, 'platit marfa criza', 'petrică');
  expect(res.map(r => r.id)).toEqual(['t1']);
  expect(res[0].utilizator).toBe('Petrica');
});
