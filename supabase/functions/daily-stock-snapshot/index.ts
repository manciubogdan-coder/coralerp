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

    const { targetDate, inventoryType = 'main' } = await req.json().catch(() => ({}))
    const snapshotDate = targetDate || new Date().toISOString().split('T')[0]

    console.log(`Creating stock snapshot for ${inventoryType} inventory, date: ${snapshotDate}`)

    // Determine table names based on inventory type
    const inventoryTable = inventoryType === 'ambalaje' ? 'ambalaje_inventory' : 'inventory'
    const snapshotTable = inventoryType === 'ambalaje' ? 'ambalaje_daily_stock_snapshots' : 'daily_stock_snapshots'
    const historyTable = inventoryType === 'ambalaje' ? 'ambalaje_inventory_history' : 'inventory_history'

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

    // Get current inventory
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

    // If creating snapshot for past date, calculate stock at end of that day
    let finalInventory = inventory
    
    if (targetDate && targetDate !== new Date().toISOString().split('T')[0]) {
      console.log(`Calculating historical stock for ${targetDate} (${inventoryType})`)
      
      // Get all movements after the target date
      const nextDay = new Date(targetDate)
      nextDay.setDate(nextDay.getDate() + 1)
      const nextDayStr = nextDay.toISOString().split('T')[0]
      
      const { data: futureMovements, error: movementsError } = await supabase
        .from(historyTable)
        .select('*')
        .gte('operation_date', `${nextDayStr}T00:00:00`)

      if (movementsError) {
        throw movementsError
      }

      // Create a map of current inventory
      const inventoryMap = new Map<string, InventoryItem>()
      inventory.forEach((item: InventoryItem) => {
        const key = `${item.name}_${item.lot_number || 'no_lot'}`
        inventoryMap.set(key, { ...item })
      })

      // Reverse future movements to get stock at end of target date
      futureMovements?.forEach((movement: any) => {
        const key = `${movement.name}_${movement.lot_number || 'no_lot'}`
        const item = inventoryMap.get(key)
        
        if (item) {
          // Pentru acțiuni de transfer_out sau remove, înseamnă că s-a scăzut din stoc
          // Deci pentru a calcula stocul din trecut, trebuie să adăugăm înapoi
          if (movement.action === 'transfer_out' || movement.action === 'remove') {
            // Reverse remove/transfer_out by adding
            item.quantity += movement.quantity
            if (item.net_quantity !== null && movement.net_quantity) {
              item.net_quantity += movement.net_quantity
            } else if (item.net_quantity !== null) {
              item.net_quantity += movement.quantity
            }
          } 
          // Pentru acțiuni de transfer_in sau add, înseamnă că s-a adăugat în stoc
          // Deci pentru a calcula stocul din trecut, trebuie să scădem
          else if (movement.action === 'transfer_in' || movement.action === 'add') {
            // Reverse add/transfer_in by subtracting
            item.quantity -= movement.quantity
            if (item.net_quantity !== null && movement.net_quantity) {
              item.net_quantity -= movement.net_quantity
            } else if (item.net_quantity !== null) {
              item.net_quantity -= movement.quantity
            }
          }
          
          // Asigur că valorile nu devin negative
          item.quantity = Math.max(0, item.quantity)
          if (item.net_quantity !== null) {
            item.net_quantity = Math.max(0, item.net_quantity)
          }
        }
      })

      finalInventory = Array.from(inventoryMap.values()).filter(item => item.quantity > 0)
    }

    // Create snapshot entries
    const snapshotData = finalInventory.map((item: InventoryItem) => ({
      snapshot_date: snapshotDate,
      name: item.name,
      quantity: item.quantity,
      net_quantity: item.net_quantity,
      unit: item.unit,
      lot_number: item.lot_number,
      product_id: item.product_id,
      supplier_id: item.supplier_id,
      manufacturer_id: item.manufacturer_id,
      crate_type_id: item.crate_type_id,
      crate_count: item.crate_count,
      crate_weight: item.crate_weight,
      document_number: item.document_number,
      entry_number: item.entry_number,
      receipt_date: item.receipt_date,
      gross_quantity: item.gross_quantity
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