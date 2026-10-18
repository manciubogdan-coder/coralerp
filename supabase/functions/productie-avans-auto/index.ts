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

async function gridFromHistory(legacy: any, target: Date) {
  // Ultimele 8 apariții ale aceleiași zile a săptămânii
  const dates: string[] = []
  for (let w = 1; w <= 8; w++) {
    dates.push(isoDay(new Date(target.getTime() - w * 7 * 86400000)))
  }
  const { data } = await legacy
    .from('productie_comenzi')
    .select('produs_id,linie_id,cantitate,data_productie,productie_produse(nume),productie_linii(nume)')
    .eq('magazin', 'PRODUCTIE_AVANS')
    .in('data_productie', dates)
  if (!data?.length) return { items: [] as any[], unresolved: [] as string[] }
  const acc = new Map<string, { produs_id: string; linie_id: string | null; nume: string; linie: string | null; vals: number[] }>()
  for (const r of data) {
    const key = `${r.produs_id}|${r.linie_id ?? ''}`
    const cur = acc.get(key) ?? {
      produs_id: r.produs_id, linie_id: r.linie_id ?? null,
      nume: r.productie_produse?.nume ?? '?', linie: r.productie_linii?.nume ?? null, vals: [],
    }
    cur.vals.push(Number(r.cantitate) || 0)
    acc.set(key, cur)
  }
  const items = [...acc.values()].map((a) => ({
    produs_id: a.produs_id, produs_nume: a.nume,
    cantitate: Math.round(a.vals.reduce((s, v) => s + v, 0) / a.vals.length),
    linie_id: a.linie_id, linie_nume: a.linie, baxare: null,
  })).filter((i) => i.cantitate > 0)
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
      ;({ items, unresolved } = await gridFromHistory(legacy, tomorrow))
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
