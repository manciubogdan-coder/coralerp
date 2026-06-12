import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface InventoryItem {
  id: string
  name: string
  quantity: number
  net_quantity: number | null
  unit: string
  lot_number: string | null
  product_id: string | null
  supplier_id: string | null
  manufacturer_id: string | null
  crate_type_id: string | null
  crate_count: number | null
  crate_weight: number | null
  document_number: string | null
  entry_number: number
  receipt_date: string | null
  gross_quantity: number | null
}

// Acțiuni din inventory_history care SCAD cantitatea (ieșiri din depozit)
const OUTFLOW_ACTIONS = new Set(['transfer_out', 'consumption'])
// Acțiuni care CRESC cantitatea (intrări/întoarceri)
const INFLOW_ACTIONS = new Set(['transfer_in', 'return', 'return_from_production'])

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json().catch(() => ({} as any))
    const inventoryType = body?.inventoryType ?? 'main'
    const force = Boolean(body?.force)
    const requestedDate: string | undefined = typeof body?.snapshotDate === 'string' ? body.snapshotDate : undefined
    const snapshotDate = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
      ? requestedDate
      : new Date().toISOString().split('T')[0]

    console.log(`Snapshot RECONSTRUCT for ${inventoryType}, date: ${snapshotDate}, force: ${force}`)

    const inventoryTable = inventoryType === 'ambalaje'
      ? 'ambalaje_inventory'
      : inventoryType === 'etichete'
        ? 'etichete_inventory'
        : 'inventory'
    const snapshotTable = inventoryType === 'ambalaje'
      ? 'ambalaje_daily_stock_snapshots'
      : inventoryType === 'etichete'
        ? 'etichete_daily_stock_snapshots'
        : 'daily_stock_snapshots'
    const historyTable = inventoryType === 'ambalaje'
      ? 'ambalaje_inventory_history'
      : inventoryType === 'etichete'
        ? 'etichete_inventory_history'
        : 'inventory_history'

    if (force) {
      const { error: deleteError } = await supabase
        .from(snapshotTable)
        .delete()
        .eq('snapshot_date', snapshotDate)
      if (deleteError) throw deleteError
    } else {
      const { data: existingSnapshot } = await supabase
        .from(snapshotTable)
        .select('id')
        .eq('snapshot_date', snapshotDate)
        .limit(1)

      if (existingSnapshot && existingSnapshot.length > 0) {
        return new Response(
          JSON.stringify({ success: true, message: `Snapshot already exists for ${snapshotDate}`, existing: true, inventoryType }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // === 1. Fetch all inventory rows existing AT START of snapshotDate ===
    // Rows must have receipt_date STRICT < snapshotDate (sau null) — adică recepționate
    // înainte de ziua respectivă. Recepțiile cu receipt_date = snapshotDate sunt operațiuni
    // de pe parcursul zilei, NU sunt în stocul de început.
    const pageSize = 1000
    let offset = 0
    let allInventory: InventoryItem[] = []
    let hasMore = true

    while (hasMore) {
      const { data: page, error: pageError } = await supabase
        .from(inventoryTable)
        .select('*')
        .or(`receipt_date.lt.${snapshotDate},receipt_date.is.null`)
        .order('entry_number', { ascending: false })
        .range(offset, offset + pageSize - 1)

      if (pageError) throw pageError
      const rows = (page ?? []) as InventoryItem[]
      allInventory = allInventory.concat(rows)
      offset += pageSize
      hasMore = rows.length === pageSize
    }

    console.log(`Fetched ${allInventory.length} inventory rows with receipt_date < ${snapshotDate}`)

    // === 2. Fetch ALL inventory_history entries on snapshotDate to reverse them ===
    // Batch by inventory_item_id (50 IDs / request — regula proiectului).
    const allIds = allInventory.map(r => r.id)
    const deltaByRow = new Map<string, number>()

    const BATCH = 50
    for (let i = 0; i < allIds.length; i += BATCH) {
      const batchIds = allIds.slice(i, i + BATCH)
      const { data: histRows, error: histErr } = await supabase
        .from(historyTable)
        .select('inventory_item_id, action, quantity, operation_date')
        .eq('operation_date', snapshotDate)
        .in('inventory_item_id', batchIds)

      if (histErr) throw histErr

      for (const h of (histRows ?? []) as any[]) {
        const action = String(h.action || '').toLowerCase()
        const qty = Number(h.quantity) || 0
        let delta = 0
        if (OUTFLOW_ACTIONS.has(action)) delta = qty       // current_qty + outflow = start_of_day
        else if (INFLOW_ACTIONS.has(action)) delta = -qty  // current_qty - inflow = start_of_day
        if (delta !== 0) {
          deltaByRow.set(h.inventory_item_id, (deltaByRow.get(h.inventory_item_id) ?? 0) + delta)
        }
      }
    }

    console.log(`Found history adjustments for ${deltaByRow.size} rows on ${snapshotDate}`)

    // === 3. Compute start-of-day qty per row ===
    const reconstructed = allInventory
      .map(item => {
        const currentQty = Number(item.quantity) || 0
        const delta = deltaByRow.get(item.id) ?? 0
        const startOfDayQty = currentQty + delta
        return { item, startOfDayQty }
      })
      .filter(x => x.startOfDayQty > 0.0001)

    console.log(`Reconstructed ${reconstructed.length} non-zero rows for start-of-day snapshot`)

    if (reconstructed.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: `No data to snapshot for ${snapshotDate}`, count: 0, inventoryType }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // === 4. Group identical lots (same product+lot+supplier+manufacturer+doc+date) ===
    const grouped = new Map<string, {
      name: string; quantity: number; unit: string; lot_number: string | null
      product_id: string | null; supplier_id: string | null; manufacturer_id: string | null
      crate_type_id: string | null; document_number: string | null; entry_number: number
      receipt_date: string | null
    }>()

    for (const { item, startOfDayQty } of reconstructed) {
      const key = `${item.name}-${item.lot_number || ''}-${item.product_id || ''}-${item.supplier_id || ''}-${item.manufacturer_id || ''}-${item.crate_type_id || ''}-${item.document_number || ''}-${item.receipt_date || ''}`
      const existing = grouped.get(key)
      if (existing) {
        existing.quantity += startOfDayQty
      } else {
        grouped.set(key, {
          name: item.name,
          quantity: startOfDayQty,
          unit: item.unit,
          lot_number: item.lot_number,
          product_id: item.product_id,
          supplier_id: item.supplier_id,
          manufacturer_id: item.manufacturer_id,
          crate_type_id: item.crate_type_id,
          document_number: item.document_number,
          entry_number: item.entry_number,
          receipt_date: item.receipt_date,
        })
      }
    }

    const snapshotData = Array.from(grouped.values()).map(g => ({
      snapshot_date: snapshotDate,
      name: g.name,
      quantity: g.quantity,
      net_quantity: g.quantity,
      unit: g.unit,
      lot_number: g.lot_number,
      product_id: g.product_id,
      supplier_id: g.supplier_id,
      manufacturer_id: g.manufacturer_id,
      crate_type_id: g.crate_type_id,
      crate_count: null,
      crate_weight: null,
      document_number: g.document_number,
      entry_number: g.entry_number,
      receipt_date: g.receipt_date,
      gross_quantity: null,
    }))

    const { error: insertError } = await supabase.from(snapshotTable).insert(snapshotData)
    if (insertError) throw insertError

    console.log(`Successfully created ${inventoryType} snapshot for ${snapshotDate} with ${snapshotData.length} items`)

    return new Response(
      JSON.stringify({
        success: true,
        message: `${inventoryType} stock snapshot created for ${snapshotDate}`,
        count: snapshotData.length,
        rowsWithAdjustments: deltaByRow.size,
        inventoryType,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error creating stock snapshot:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
