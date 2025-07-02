import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get current date
    const today = new Date().toISOString().split('T')[0];
    
    console.log('Creating daily stock snapshot for date:', today);

    // Check if snapshot already exists for today
    const { data: existingSnapshot } = await supabaseClient
      .from('daily_stock_snapshots')
      .select('id')
      .eq('snapshot_date', today)
      .limit(1);

    if (existingSnapshot && existingSnapshot.length > 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Snapshot already exists for today',
          date: today 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

    // Get current inventory data
    const { data: inventoryData, error: inventoryError } = await supabaseClient
      .from('inventory')
      .select(`
        *,
        suppliers:supplier_id (name),
        products:product_id (name, cod_produs),
        manufacturers:manufacturer_id (name),
        crate_types:crate_type_id (name, weight)
      `);

    if (inventoryError) {
      throw inventoryError;
    }

    if (!inventoryData || inventoryData.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'No inventory data found',
          date: today 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

    // Prepare snapshot data
    const snapshotData = inventoryData.map(item => ({
      snapshot_date: today,
      name: item.name,
      quantity: item.quantity,
      net_quantity: item.net_quantity,
      gross_quantity: item.gross_quantity,
      unit: item.unit,
      lot_number: item.lot_number,
      document_number: item.document_number,
      entry_number: item.entry_number,
      receipt_date: item.receipt_date,
      supplier_id: item.supplier_id,
      manufacturer_id: item.manufacturer_id,
      product_id: item.product_id,
      crate_type_id: item.crate_type_id,
      crate_count: item.crate_count,
      crate_weight: item.crate_weight
    }));

    // Insert snapshot data
    const { data: insertedData, error: insertError } = await supabaseClient
      .from('daily_stock_snapshots')
      .insert(snapshotData)
      .select();

    if (insertError) {
      throw insertError;
    }

    console.log(`Successfully created ${insertedData.length} snapshot records for ${today}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Snapshot created successfully for ${today}`,
        recordsCount: insertedData.length,
        date: today 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error creating daily stock snapshot:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});