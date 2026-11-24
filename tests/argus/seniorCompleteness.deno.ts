import { seniorTools, verifiedSeniorRows } from '../../supabase/functions/_shared/senior.ts';
import { runLive } from '../../supabase/functions/argus/liveReports.ts';
import { assistSources } from '../../supabase/functions/erp-mirror/assist.ts';
import type { Clients } from '../../supabase/functions/argus/data.ts';
import { fetchAll, boundedQueryResult } from '../../supabase/functions/_shared/appData.ts';

const bridge = (rows: unknown) => ({ rpc: async (name: string) => ({ data: name === 'erp_live_enqueue' ? 'request' : { status: 'done', result: rows }, error: null }) });

Deno.test('generic Senior read keeps all 350 rows rather than only the first 200', async () => {
  const rows = Array.from({length:350}, (_, i) => ({value: i + 1}));
  const value = await seniorTools(bridge(rows)).senior_sql.execute?.({sql:'SELECT value FROM t'}, { toolCallId:'sql',messages:[],context:{} });
  if (!value || !('date' in value) || !value.date || value.date.length !== 350 || value.date[349].value !== 350) throw new Error('Rows lost');
});

Deno.test('bridge ceiling and malformed results cannot be treated as complete totals', () => {
  for (const value of [Array.from({length:500}, () => ({value:1})), {rows:[]}, null]) {
    let failed = false;
    try { verifiedSeniorRows(value); } catch { failed = true; }
    if (!failed) throw new Error('Unverified result accepted');
  }
  if (verifiedSeniorRows([]).length !== 0) throw new Error('Valid empty result rejected');
});

Deno.test('SQL too long is rejected before calling Senior instead of silently cutting it', async () => {
  let calls = 0;
  const value = await seniorTools({rpc: async () => {calls++;return {data:null,error:null};}}).senior_sql.execute?.({sql:'SELECT '+ 'x'.repeat(8000)}, {toolCallId:'long',messages:[],context:{}});
  if (!value || !('eroare' in value) || calls !== 0) throw new Error('Truncated SQL executed');
});

Deno.test('saved SQL refresh retains 350 rows and rejects the bridge ceiling', async () => {
  const spec = {kind:'sql' as const, template: {kind:'sql' as const, sql:'SELECT value FROM t',params:[],defaults:{},chart:'table' as const,x:null,series:[]}};
  const value = await runLive({cloud:bridge(Array.from({length:350},(_,i)=>({value:i}))),legacy:{}}, spec, {}, '2026-11-24', 'Test');
  if(value.table_data.rows.length !== 350 || value.table_data.rows[349][0] !== '349') throw new Error('Report truncated');
  let failed = false;
  try { await runLive({cloud:bridge(Array.from({length:500},()=>({value:1}))),legacy:{}},spec,{},'2026-11-24','Test'); } catch { failed = true; }
  if(!failed) throw new Error('Incomplete report accepted');
});

Deno.test('CEO assistant exposes the same warehouse projection and schema reads', () => {
  const names=Object.keys(assistSources({cloud:{},legacy:{},legacyUser:{}} as Clients));
  if(!names.includes('stoc_si_proiectie_achizitii') || !names.includes('schema_context')) throw new Error('Assistant lacks sources');
});

Deno.test('application safety ceiling cannot silently return a partial aggregate', async () => {
  const client = (size: number) => ({from:()=>({select:()=>({range:async(from:number,to:number)=>({data:Array.from({length:size},(_,i)=>({id:i})).slice(from,to+1),error:null})})})}) as unknown as Clients['legacy'];
  if ((await fetchAll(client(1000), 'inventory', '*', q=>q, 1000)).length !== 1000) throw new Error('Exact ceiling rejected');
  let failed = false;
  try { await fetchAll(client(1001), 'inventory', '*', q=>q, 1000); } catch { failed = true; }
  if(!failed) throw new Error('Partial total accepted');
});

Deno.test('chat, agents and CEO query output limits disclose partial groups rather than inviting wrong totals', () => {
  const rows = Array.from({length:251}, (_, i) => ({produs:i, suma_quantity:10}));
  for(const limit of [150,200]) {
    const result=boundedQueryResult({total_randuri_sursa:1201,randuri:rows},limit,limit);
    if(result.complet || result.total_grupuri_sau_randuri!==251 || result.randuri_returnate!==limit || !result.avertisment) throw new Error('Partial groups hidden');
  }
  const result=boundedQueryResult({total_randuri_sursa:1201,randuri:[{suma_quantity:2402}]},1);
  if(!result.complet || result.randuri[0].suma_quantity!==2402) throw new Error('Complete source aggregation changed');
});