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

    const { inventoryType = 'main' } = await req.json().catch(() => ({}))
    // Întotdeauna folosim data curentă - salvăm exact stocul de acum
    const snapshotDate = new Date().toISOString().split('T')[0]

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
      console.log(`Snapshot already exists for ${snapshotDate} (${inventoryType})`)
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Snapshot already exists for ${snapshotDate}`,
          existing: true,
          inventoryType 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get current inventory - exact as it is right now
    const { data: inventory, error: inventoryError } = await supabase
      .from(inventoryTable)
      .select('*')
      .gt('quantity', 0) // Doar intrările cu stoc > 0

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

    // Grupez după produs și lot pentru a evita duplicatele
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

    inventory.forEach((item: InventoryItem) => {
      const key = `${item.name}-${item.lot_number || ''}-${item.product_id || ''}-${item.supplier_id || ''}-${item.manufacturer_id || ''}-${item.crate_type_id || ''}-${item.document_number || ''}-${item.receipt_date || ''}`
      
      if (groupedInventory.has(key)) {
        const existing = groupedInventory.get(key)!
        existing.quantity += item.quantity
      } else {
        groupedInventory.set(key, {
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          lot_number: item.lot_number,
          product_id: item.product_id,
          supplier_id: item.supplier_id,
          manufacturer_id: item.manufacturer_id,
          crate_type_id: item.crate_type_id,
          document_number: item.document_number,
          entry_number: item.entry_number,
          receipt_date: item.receipt_date
        })
      }
    })

    // Create snapshot entries from grouped data
    const snapshotData = Array.from(groupedInventory.values()).map((item) => ({
      snapshot_date: snapshotDate,
      name: item.name,
      quantity: item.quantity,
      net_quantity: item.quantity, // Folosesc quantity pentru net_quantity pentru că net_quantity e incorectă
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
    }))

    // Insert snapshot data
    const { error: insertError } = await supabase
      .from(snapshotTable)
      .insert(snapshotData)

    if (insertError) {
      throw insertError
    }

    console.log(`Successfully created ${inventoryType} snapshot for ${snapshotDate} with ${snapshotData.length} items`)

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