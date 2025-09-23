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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { inventoryType = 'main', force = false, targetDate } = await req.json().catch(() => ({}))
    // Întotdeauna folosim data curentă - salvăm exact stocul de acum (pentru data selectată)
    const snapshotDate = (typeof targetDate === 'string' && targetDate.length > 0) ? targetDate : new Date().toISOString().split('T')[0]

    console.log(`Saving CURRENT stock as snapshot for ${inventoryType} inventory, date: ${snapshotDate}`)

    // Determine table names based on inventory type
    const inventoryTable = inventoryType === 'ambalaje' ? 'ambalaje_inventory' : 'inventory'
    const snapshotTable = inventoryType === 'ambalaje' ? 'ambalaje_daily_stock_snapshots' : 'daily_stock_snapshots'

    // Check if snapshot already exists for this date
    const { data: existingSnapshot } = await supabase
      .from(snapshotTable)
      .select('id')
      .eq('snapshot_date', snapshotDate)
      .limit(1)

    if (existingSnapshot && existingSnapshot.length > 0) {
      if (!force) {
        console.log(`Snapshot already exists for ${snapshotDate} (${inventoryType}) - keeping existing (no force)`)
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: `Snapshot already exists for ${snapshotDate}`,
            existing: true,
            inventoryType 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } else {
        console.log(`Snapshot exists for ${snapshotDate} (${inventoryType}) - overwriting due to force=true`)
        const { error: deleteError } = await supabase
          .from(snapshotTable)
          .delete()
          .eq('snapshot_date', snapshotDate)
        if (deleteError) throw deleteError
      }
    }

    // Get current inventory exactly as it is right now (we'll filter/normalize in code)
    const { data: inventory, error: inventoryError } = await supabase
      .from(inventoryTable)
      .select('*')
    if (inventoryError) {
      throw inventoryError
    }

    if (!inventory || inventory.length === 0) {
      console.log(`No ${inventoryType} inventory data found`)
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `No ${inventoryType} inventory data to snapshot`,
          count: 0,
          inventoryType 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Group strictly by product (ignore supplier/manufacturer/lot) and sum only positive quantities
    const groupedInventory = new Map<string, {
      name: string
      quantity: number
      unit: string
      lot_number: string | null
      product_id: string | null
      supplier_id: string | null
      manufacturer_id: string | null
      crate_type_id: string | null
      document_number: string | null
      entry_number: number
      receipt_date: string | null
    }>()

    const toNum = (val: any) => {
      const n = typeof val === 'number' ? val : parseFloat((val ?? '0').toString())
      return Number.isFinite(n) ? n : 0
    }

    // Diagnostics
    const stats = (inventory as any[]).reduce((acc, it: any) => {
      const qQty = toNum(it.quantity)
      const qNet = toNum(it.net_quantity)
      const qGross = toNum(it.gross_quantity)
      if (qQty > 0) acc.posQty++
      if (qNet > 0) acc.posNet++
      if (qGross > 0) acc.posGross++
      return acc
    }, { posQty: 0, posNet: 0, posGross: 0, total: (inventory as any[]).length })
    console.log(`Diagnostics: total=${stats.total}, posQty=${stats.posQty}, posNet=${stats.posNet}, posGross=${stats.posGross}`)
    console.log('Sample inventory:', (inventory as any[]).slice(0, 5).map((it:any) => ({ name: it.name, q: it.quantity, net: it.net_quantity, gross: it.gross_quantity, unit: it.unit })))

    inventory.forEach((item: InventoryItem) => {
      // Preferăm cantitatea curentă (quantity), apoi netă (net_quantity), apoi brută (gross_quantity)
      const qQty = toNum((item as any).quantity)
      const qNet = toNum((item as any).net_quantity)
      const qGross = toNum((item as any).gross_quantity)

      let qty = 0
      if (qQty > 0) qty = qQty
      else if (qNet > 0) qty = qNet
      else if (qGross > 0) qty = qGross

      const key = item.product_id ? `product:${item.product_id}` : `name:${item.name}`

      if (!groupedInventory.has(key)) {
        groupedInventory.set(key, {
          name: item.name,
          quantity: qty,
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
      } else {
        const existing = groupedInventory.get(key)!
        existing.quantity = toNum(existing.quantity) + qty
        // Keep latest metadata by highest entry_number
        if (item.entry_number > existing.entry_number) {
          existing.lot_number = item.lot_number
          existing.document_number = item.document_number
          existing.entry_number = item.entry_number
          existing.receipt_date = item.receipt_date
          existing.crate_type_id = item.crate_type_id
          existing.supplier_id = item.supplier_id
          existing.manufacturer_id = item.manufacturer_id
        }
      }
    })

    // Create snapshot entries from grouped data
    const snapshotData = Array.from(groupedInventory.values()).map((item) => {
      const q = toNum(item.quantity)
      return {
        snapshot_date: snapshotDate,
        name: item.name,
        quantity: q,
        net_quantity: q,
        unit: item.unit,
        lot_number: item.lot_number,
        product_id: item.product_id,
        supplier_id: item.supplier_id,
        manufacturer_id: item.manufacturer_id,
        crate_type_id: item.crate_type_id,
        crate_count: null,
        crate_weight: null,
        document_number: item.document_number,
        entry_number: item.entry_number,
        receipt_date: item.receipt_date,
        gross_quantity: null
      }
    })

    // Debug preview in logs
    const positives = snapshotData.filter(r => (toNum(r.quantity) > 0)).length
    console.log(`Snapshot ${inventoryType} preview for ${snapshotDate}: groups=${snapshotData.length}, positives=${positives}`, snapshotData.slice(0, 5).map(s => ({ name: s.name, q: s.quantity, unit: s.unit })))

    // Insert snapshot data
    const { error: insertError } = await supabase
      .from(snapshotTable)
      .insert(snapshotData)

    if (insertError) {
      throw insertError
    }

    const totalQty = snapshotData.reduce((acc, r) => acc + (Number(r.quantity) || 0), 0)
    console.log(`Successfully created ${inventoryType} snapshot for ${snapshotDate} with ${snapshotData.length} items, total qty: ${totalQty}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${inventoryType} stock snapshot created for ${snapshotDate}`,
        count: snapshotData.length,
        inventoryType 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error creating stock snapshot:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})