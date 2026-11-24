import { test, expect } from 'bun:test';
import { searchConversations } from '../../supabase/functions/argus/conversationSearch';

function fakeCloud(tables: Record<string, any[]>) {
  return {
    from(name: string) {
      let rows = [...(tables[name] ?? [])];
      const q: any = {
        select: () => q, order: () => q, limit: (count: number) => { rows = rows.slice(0, count); return q; },
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

test('recall finds work after the first 80 conversations', async () => {
  const threads=Array.from({length:81},(_,i)=>({id:`t${i}`,title:'Conversație nouă',user_id:'p',updated_at:'2026-11-24'}));
  const cloud=fakeCloud({argus_threads:threads,app_activity_pings:[{user_id:'p',display_name:'Petrica'}],argus_messages:[{thread_id:'t80',...msg('analiza iceberg')} ]});
  expect((await searchConversations({cloud},'analiza iceberg','Petrica')).map(r=>r.id)).toEqual(['t80']);
});

test('recall finds a message after the 1000-row page limit and preserves its position', async () => {
  const messages=Array.from({length:1201},(_,i)=>({thread_id:'t',...msg(i===1200?'analiza iceberg':'alt subiect')}));
  const cloud=fakeCloud({argus_threads:[{id:'t',title:'Conversație nouă',user_id:'p',updated_at:'2026-11-24'}],app_activity_pings:[{user_id:'p',display_name:'Petrica'}],argus_messages:messages});
  const results=await searchConversations({cloud},'analiza iceberg','Petrica');
  expect(results[0].mesaje).toBe(1201);
  expect(results[0].potriviri[0].pozitie).toBe(1201);
});

test('colleague matching does not disappear behind 2000 recent activity rows from another user', async () => {
  const cloud=fakeCloud({argus_threads:[{id:'t',title:'analiza iceberg',user_id:'p',updated_at:'2026-11-24'},{id:'b',title:'altceva',user_id:'b',updated_at:'2026-11-24'}],app_activity_pings:[...Array.from({length:2000},()=>({user_id:'b',display_name:'Bogdan'})),{user_id:'p',display_name:'Petrica'}]});
  expect((await searchConversations({cloud},'analiza iceberg','Petrica')).map(r=>r.id)).toEqual(['t']);
});
