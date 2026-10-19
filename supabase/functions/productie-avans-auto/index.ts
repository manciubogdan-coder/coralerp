import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { LEGACY_URL, LEGACY_ANON } from '../_shared/appData.ts'

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

function bucharestToday(): Date {
  // Data curentă în fusul Europe/Bucharest
  const s = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Bucharest' })
  return new Date(`${s}T12:00:00Z`)
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function isoWeekday(d: Date): number {
  // 1 = Luni ... 7 = Duminică
  return ((d.getUTCDay() + 6) % 7) + 1
}

async function resolveProduct(legacy: any, id: string | null, nume: string) {
  if (id) {
    const { data } = await legacy.from('productie_produse').select('id,nume').eq('id', id).maybeSingle()
    if (data) return data
  }
  const { data: exact } = await legacy.from('productie_produse').select('id,nume').ilike('nume', nume).limit(2)
  if (exact?.length === 1) return exact[0]
  const { data } = await legacy.from('productie_produse').select('id,nume').ilike('nume', `%${nume}%`).limit(6)
  return data?.length ? data[0] : null
}

async function resolveLine(legacy: any, id: string | null, nume: string | null) {
  if (id) {
    const { data } = await legacy.from('productie_linii').select('id,nume').eq('id', id).maybeSingle()
    if (data) return data
  }
  if (!nume) return null
  const { data: exact } = await legacy.from('productie_linii').select('id,nume').ilike('nume', nume).limit(2)
  if (exact?.length === 1) return exact[0]
  const { data } = await legacy.from('productie_linii').select('id,nume').ilike('nume', `%${nume}%`).limit(6)
  return data?.length ? data[0] : null
}

async function gridFromMatrix(cloud: any, legacy: any, weekday: number) {
  const { data: rows } = await cloud
    .from('productie_avans_matrix')
    .select('*')
    .eq('weekday', weekday)
    .order('position')
  if (!rows?.length) return { items: [] as any[], unresolved: [] as string[] }
  const items: any[] = []
  const unresolved: string[] = []
  for (const r of rows) {
    const p = await resolveProduct(legacy, r.produs_id, r.produs_nume)
    if (!p) { unresolved.push(r.produs_nume); continue }
    const l = await resolveLine(legacy, r.linie_id, r.linie_nume)
    items.push({ produs_id: p.id, produs_nume: p.nume, cantitate: Math.round(Number(r.cantitate)), linie_id: l?.id ?? null, linie_nume: l?.nume ?? r.linie_nume ?? null, baxare: r.baxare ?? null })
  }
  return { items, unresolved }
}

const normName = (s: string | null | undefined) =>
  (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/(\d+)\s*(gr|g)\b/g, '$1').replace(/[^a-z0-9]/g, '')

// Grupa produsului din „Grupare ambalare"; codurile duplicate fără grupă se potrivesc după denumire.
async function groupResolver(cloud: any, legacy: any) {
  const { data: gr } = await cloud.from('productie_grupare_ambalare').select('produs_id,grup_nume')
  const byId: Record<string, string> = {}
  for (const r of gr ?? []) if (r.grup_nume?.trim()) byId[r.produs_id] = r.grup_nume.trim()
  const { data: prods } = await legacy.from('productie_produse').select('id,nume').range(0, 4999)
  const byName: Record<string, string> = {}
  for (const p of prods ?? []) if (byId[p.id]) byName[normName(p.nume)] = byId[p.id]
  return (id: string, nume: string) => byId[id] || byName[normName(nume)] || (nume || '').trim()
}

async function gridFromHistory(cloud: any, legacy: any, target: Date) {
  // Ultimele 8 apariții ale aceleiași zile a săptămânii, câte un rând pe grupă de produs
  const dates: string[] = []
  for (let w = 1; w <= 8; w++) {
    dates.push(isoDay(new Date(target.getTime() - w * 7 * 86400000)))
  }
  const { data } = await legacy
    .from('productie_comenzi')
    .select('produs_id,linie_id,cantitate,data_productie,baxare,productie_produse(nume),productie_linii(nume)')
    .eq('magazin', 'PRODUCTIE_AVANS')
    .in('data_productie', dates)
  if (!data?.length) return { items: [] as any[], unresolved: [] as string[] }
  const groupOf = await groupResolver(cloud, legacy)
  type Acc = { grup: string; perDay: Map<string, number>; use: Map<string, number>; names: Map<string, string>; lines: Map<string, number>; lineNames: Map<string, string | null>; bax: Map<string, number> }
  const acc = new Map<string, Acc>()
  for (const r of data as any[]) {
    const nume = r.productie_produse?.nume ?? '?'
    const grup = groupOf(r.produs_id, nume)
    const k = grup.toLowerCase()
    const a = acc.get(k) ?? { grup, perDay: new Map(), use: new Map(), names: new Map(), lines: new Map(), lineNames: new Map(), bax: new Map() }
    const q = Number(r.cantitate) || 0
    a.perDay.set(r.data_productie, (a.perDay.get(r.data_productie) ?? 0) + q)
    a.use.set(r.produs_id, (a.use.get(r.produs_id) ?? 0) + 1)
    a.names.set(r.produs_id, nume)
    const lk = r.linie_id ?? ''
    a.lines.set(lk, (a.lines.get(lk) ?? 0) + q)
    a.lineNames.set(lk, r.productie_linii?.nume ?? null)
    if (r.baxare) a.bax.set(r.baxare, (a.bax.get(r.baxare) ?? 0) + 1)
    acc.set(k, a)
  }
  const top = (m: Map<string, number>) => [...m].sort((x, y) => y[1] - x[1])[0]?.[0]
  const items = [...acc.values()].map((a) => {
    const days = [...a.perDay.values()]
    const exact = [...a.names].find(([, n]) => n.trim().toLowerCase() === a.grup.toLowerCase())
      ?? [...a.names].find(([, n]) => normName(n) === normName(a.grup))
    const pid = exact ? exact[0] : top(a.use)!
    const lk = top(a.lines) ?? ''
    return {
      produs_id: pid, produs_nume: a.names.get(pid) ?? a.grup,
      cantitate: Math.round(days.reduce((s, v) => s + v, 0) / days.length),
      linie_id: lk || null, linie_nume: a.lineNames.get(lk) ?? null, baxare: top(a.bax) ?? null,
    }
  }).filter((i) => i.cantitate > 0)
  return { items, unresolved: [] as string[] }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const cloud = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const legacy = createClient(LEGACY_URL, LEGACY_ANON, { auth: { persistSession: false, autoRefreshToken: false } })

    const { data: settings } = await cloud.from('productie_avans_settings').select('*').eq('id', true).maybeSingle()
    if (!settings?.auto_enabled) {
      return json({ skipped: true, reason: 'Generarea automată este oprită (comutator OFF).' })
    }

    const tomorrow = new Date(bucharestToday().getTime() + 86400000)
    const target = isoDay(tomorrow)
    const weekday = isoWeekday(tomorrow)

    // Anti-duplicat: nu generăm dacă există deja comenzi de avans pentru ziua țintă
    const { data: existing } = await legacy
      .from('productie_comenzi')
      .select('id')
      .eq('magazin', 'PRODUCTIE_AVANS')
      .eq('data_productie', target)
      .limit(1)
    if (existing?.length) {
      await cloud.from('productie_avans_log').insert({
        target_date: target, source: 'auto', orders_created: 0,
        details: { weekday, note: 'Există deja comenzi de avans pentru ziua țintă — nu s-a generat nimic.' },
      })
      return json({ skipped: true, reason: `Există deja comenzi de avans pentru ${target}.` })
    }

    let { items, unresolved } = await gridFromMatrix(cloud, legacy, weekday)
    let sursa = 'matrice'
    if (items.length === 0) {
      ;({ items, unresolved } = await gridFromHistory(cloud, legacy, tomorrow))
      sursa = 'istoric'
    }
    if (items.length === 0) {
      await cloud.from('productie_avans_log').insert({
        target_date: target, source: 'auto', orders_created: 0,
        error: 'Nicio linie în matrice și nici istoric pentru această zi a săptămânii.',
        details: { weekday },
      })
      return json({ ok: false, error: 'Nicio linie de generat (matrice goală și fără istoric).' }, 200)
    }

    const rows = items.map((i) => ({
      magazin: 'PRODUCTIE_AVANS',
      punct_livrare: 'PRODUCTIE_AVANS',
      produs_id: i.produs_id,
      cantitate: i.cantitate,
      baxare: i.baxare ?? undefined,
      linie_id: i.linie_id,
      status: i.linie_id ? 'assigned' : 'pending',
      cantitate_din_restock: 0,
      tip_comanda: 'PRODUCTIE_AVANS',
      data_productie: target,
      numar_comanda: '',
    }))
    const { data: inserted, error } = await legacy.from('productie_comenzi').insert(rows).select('id')
    if (error) {
      await cloud.from('productie_avans_log').insert({
        target_date: target, source: 'auto', orders_created: 0, error: String(error.message ?? error), details: { weekday, sursa },
      })
      return json({ ok: false, error: String(error.message ?? error) }, 500)
    }

    await cloud.from('productie_avans_log').insert({
      target_date: target, source: 'auto', orders_created: inserted?.length ?? rows.length,
      details: { weekday, sursa, unresolved, items: items.map((i) => ({ produs: i.produs_nume, cantitate: i.cantitate, linie: i.linie_nume })) },
    })
    await cloud.from('productie_comenzi_audit').insert({
      table_name: 'productie_comenzi', action: 'insert',
      record_ids: (inserted ?? []).map((r: any) => r.id),
      comanda_ids: (inserted ?? []).map((r: any) => r.id),
      changes: { sursa: `auto-avans (${sursa})`, target_date: target, count: rows.length },
      user_email: 'automatizare@productie-avans', page_path: '/productie', source: 'productie-avans-auto',
    })

    return json({ ok: true, target_date: target, sursa, orders_created: inserted?.length ?? rows.length, unresolved })
  } catch (e) {
    return json({ ok: false, error: String(e?.message ?? e) }, 500)
  }
})
