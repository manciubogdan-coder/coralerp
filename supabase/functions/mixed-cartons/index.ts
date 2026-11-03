import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3.25.76';
import { makeClients } from '../_shared/appData.ts';
import { readAll } from '../_shared/productRecipes.ts';
import { validateCarton, type MixedCarton } from '../_shared/mixedCartons.ts';
const headers = { ...corsHeaders, 'Access-Control-Allow-Headers': `${corsHeaders['Access-Control-Allow-Headers']}, x-app-token` };
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
const schema = z.object({ produs_id: z.string().uuid(), aliases: z.array(z.string().trim().min(1).max(200)).max(30), enabled: z.boolean(), components: z.array(z.object({ produs_id: z.string().uuid(), units: z.number().int().positive().max(10000) })).min(2).max(20) });
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  try {
    const token = req.headers.get('x-app-token');
    if (!token) return json({ error: 'Autentificare necesară.' }, 401);
    const c = makeClients(token);
    const { data: auth, error: authError } = await c.legacyUser.auth.getUser(token);
    if (authError || !auth.user) return json({ error: 'Sesiune invalidă.' }, 401);
    const { data: profile, error: profileError } = await c.legacyUser.from('app_profiles').select('approved').eq('user_id', auth.user.id).maybeSingle();
    if (profileError || !profile?.approved) return json({ error: 'Cont neaprobat.' }, 403);
    if (req.method !== 'POST') return json({ error: 'Metodă neacceptată.' }, 405);
    const { data: roles, error: roleError } = await c.legacyUser.from('app_user_roles').select('role').eq('user_id', auth.user.id);
    if (roleError || !roles?.some(r => r.role === 'admin')) return json({ error: 'Doar administratorul poate configura baxurile.' }, 403);
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return json({ error: 'Verifică produsele și bucățile pe bax.' }, 400);
    const b = parsed.data;
    const products = await readAll(c.legacyUser, 'productie_produse', 'id,nume,unitate_masura');
    const source = products.find(p => p.id === b.produs_id);
    if (!source) return json({ error: 'Produsul comercial nu există.' }, 400);
    const components = b.components.map(part => {
      const p = products.find(p => p.id === part.produs_id);
      if (!p) throw new Error('Un produs component nu mai există.');
      if (!/^buc/i.test(p.unitate_masura ?? '')) throw new Error(`${p.nume}: componenta trebuie măsurată în bucăți.`);
      const weight = p.nume.match(/(\d+(?:[.,]\d+)?)\s*(?:gr|g)\b/i);
      return { ...part, nume: p.nume, gramaj: weight ? Number(weight[1].replace(',', '.')) : null };
    });
    const row: MixedCarton = { ...b, denumire: source.nume, components };
    const existing: MixedCarton[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await c.cloud.from('productie_baxuri_mixte').select('*').order('produs_id').range(offset, offset + 999);
      if (error) throw error;
      existing.push(...(data ?? []) as MixedCarton[]);
      if (!data || data.length < 1000) break;
    }
    validateCarton(row, existing);
    const { data, error } = await c.cloud.from('productie_baxuri_mixte').upsert({ ...row, updated_at: new Date().toISOString() }).select().single();
    if (error) throw error;
    return json(data);
  } catch (e) { return json({ error: e instanceof Error ? e.message : 'Baxul nu a putut fi salvat.' }, 400); }
});