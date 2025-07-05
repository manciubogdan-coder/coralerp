import React, { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { exportToExcel } from "@/lib/excelExport";
import { toast } from "@/hooks/use-custom-toast";

interface LotConsumptionItem {
  product_name: string;
  product_code: string;
  lot_number: string;
  unit: string;
  initial_stock: number;
  outbound_quantity: number;
  received_quantity: number;
  final_stock: number;
}

interface ProductSummary {
  product_name: string;
  product_code: string;
  unit: string;
  total_initial: number;
  total_outbound: number;
  total_received: number;
  total_final: number;
  lots: LotConsumptionItem[];
}

export const DailyLotConsumption = () => {
  const [consumptionData, setConsumptionData] = useState<ProductSummary[]>([]);
  const [filteredData, setFilteredData] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [productFilter, setProductFilter] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => {
    // Setez implicit data de ieri pentru că azi nu există încă mișcări
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  });

  const fetchConsumptionData = async () => {
    try {
      setLoading(true);
      
      // Get snapshot data for the beginning of the day
      const { data: initialStock, error: initialError } = await supabase
        .from("daily_stock_snapshots")
        .select(`
          name,
          lot_number,
          quantity,
          net_quantity,
          unit,
          products:product_id (name, cod_produs)
        `)
        .eq('snapshot_date', selectedDate);

      if (initialError) throw initialError;

      // If no snapshot exists for the selected date, try the previous day's snapshot
      let finalInitialStock = initialStock;
      if (!initialStock || initialStock.length === 0) {
        const previousDay = new Date(selectedDate);
        previousDay.setDate(previousDay.getDate() - 1);
        const previousDateStr = previousDay.toISOString().split('T')[0];
        
        const { data: previousStock, error: previousError } = await supabase
          .from("daily_stock_snapshots")
          .select(`
            name,
            lot_number,
            quantity,
            net_quantity,
            unit,
            products:product_id (name, cod_produs)
          `)
          .eq('snapshot_date', previousDateStr);

        if (!previousError && previousStock) {
          finalInitialStock = previousStock;
        }
      }

      // Get all inventory movements for the selected date
      const { data: movements, error: movementsError } = await supabase
        .from("inventory_history")
        .select(`
          name,
          lot_number,
          quantity,
          net_quantity,
          unit,
          action,
          operation_date,
          notes,
          products:product_id (name, cod_produs)
        `)
        .gte('operation_date', `${selectedDate}T00:00:00`)
        .lte('operation_date', `${selectedDate}T23:59:59`);

      if (movementsError) throw movementsError;


      // Get current inventory for products that had movements on the selected date
      const productsWithMovements = [...new Set((movements || []).map(m => m.name))];
      
      let currentInventory: any[] = [];
      if (productsWithMovements.length > 0) {
        const { data: inventory, error: inventoryError } = await supabase
          .from("inventory")
          .select(`
            name,
            lot_number,
            quantity,
            net_quantity,
            unit,
            products:product_id (name, cod_produs)
          `)
          .in('name', productsWithMovements);

        if (inventoryError) throw inventoryError;
        currentInventory = inventory || [];
      }

      // Process data to create consumption report
      const productMap = new Map<string, ProductSummary>();

      // Process data to identify all products with activity

      // Process initial stock from snapshots - GROUP BY PRODUCT + LOT
      const snapshotGroupedByLot = new Map<string, { items: any[], totalQuantity: number }>();
      
      // First, group all snapshot items by product + lot
      (finalInitialStock || []).forEach(item => {
        const lotKey = `${item.name}_${item.lot_number || 'Fără lot'}`;
        const initialQuantity = item.net_quantity || item.quantity;
        
        if (!snapshotGroupedByLot.has(lotKey)) {
          snapshotGroupedByLot.set(lotKey, {
            items: [],
            totalQuantity: 0
          });
        }
        
        const group = snapshotGroupedByLot.get(lotKey)!;
        group.items.push(item);
        group.totalQuantity += initialQuantity;
      });
      
      // Now process grouped snapshot data
      snapshotGroupedByLot.forEach((group, lotKey) => {
        const firstItem = group.items[0]; // Use first item for product details
        const productKey = `${firstItem.name}_${firstItem.products?.cod_produs || ''}`;
        
        if (!productMap.has(productKey)) {
          productMap.set(productKey, {
            product_name: firstItem.name,
            product_code: firstItem.products?.cod_produs || '',
            unit: firstItem.unit,
            total_initial: 0,
            total_outbound: 0,
            total_received: 0,
            total_final: 0,
            lots: []
          });
        }

        const product = productMap.get(productKey)!;
        
        const lotItem: LotConsumptionItem = {
          product_name: firstItem.name,
          product_code: firstItem.products?.cod_produs || '',
          lot_number: firstItem.lot_number || 'Fără lot',
          unit: firstItem.unit,
          initial_stock: group.totalQuantity,
          outbound_quantity: 0,
          received_quantity: 0,
          final_stock: group.totalQuantity
        };

        product.lots.push(lotItem);
        product.total_initial += group.totalQuantity;
        
        console.log(`Grouped snapshot for ${firstItem.name} lot ${firstItem.lot_number || 'Fără lot'}: ${group.totalQuantity} kg from ${group.items.length} entries`);
      });

      // Process all movements for the selected date - calculate net consumption
      const outboundMovements = new Map<string, number>(); // key: productName_lotNumber, value: total outbound
      const returnMovements = new Map<string, number>(); // key: productName_lotNumber, value: total returns
      
      console.log('=== DEBUGGING DAILY CONSUMPTION ===');
      console.log('Selected date:', selectedDate);
      console.log('Total movements found:', movements?.length || 0);
      
      (movements || []).forEach(movement => {
        const lotKey = `${movement.name}_${movement.lot_number || 'Fără lot'}`;
        const movementQty = movement.net_quantity || movement.quantity;
        
        console.log('Processing movement:', {
          action: movement.action,
          product: movement.name,
          lot: movement.lot_number,
          quantity: movementQty,
          date: movement.operation_date,
          notes: movement.notes
        });
        
        if (movement.action === 'remove') {
          outboundMovements.set(lotKey, (outboundMovements.get(lotKey) || 0) + movementQty);
          console.log(`REMOVE: ${lotKey} +${movementQty} = ${outboundMovements.get(lotKey)}`);
        } else if (movement.action === 'add') {
          // Check if this is a return (has "Returnat" in notes)
          if (movement.notes && movement.notes.includes('Returnat')) {
            returnMovements.set(lotKey, (returnMovements.get(lotKey) || 0) + movementQty);
            console.log(`RETURN: ${lotKey} +${movementQty} = ${returnMovements.get(lotKey)}`);
          }
        }
      });

      console.log('Final outbound movements:', Object.fromEntries(outboundMovements));
      console.log('Final return movements:', Object.fromEntries(returnMovements));

      // Process outbound movements (remove actions)
      outboundMovements.forEach((quantity, lotKey) => {
        if (quantity <= 0) return;
        
        console.log(`Processing outbound lot ${lotKey} with quantity: ${quantity}`);
        
        // Find the movement to get product details
        const sampleMovement = movements?.find(m => 
          `${m.name}_${m.lot_number || 'Fără lot'}` === lotKey && m.action === 'remove'
        );
        
        if (!sampleMovement) return;
        
        const productKey = `${sampleMovement.name}_${sampleMovement.products?.cod_produs || ''}`;
        let product = productMap.get(productKey);
        
        // If product doesn't exist, create it
        if (!product) {
          product = {
            product_name: sampleMovement.name,
            product_code: sampleMovement.products?.cod_produs || '',
            unit: sampleMovement.unit,
            total_initial: 0,
            total_outbound: 0,
            total_received: 0,
            total_final: 0,
            lots: []
          };
          productMap.set(productKey, product);
        }
        
        const lotNumber = sampleMovement.lot_number || 'Fără lot';
        let lot = product.lots.find(l => l.lot_number === lotNumber);
        
        // If lot doesn't exist, create it
        if (!lot) {
          lot = {
            product_name: sampleMovement.name,
            product_code: sampleMovement.products?.cod_produs || '',
            lot_number: lotNumber,
            unit: sampleMovement.unit,
            initial_stock: 0, // Will be calculated later from current inventory + outbound - received
            outbound_quantity: 0,
            received_quantity: 0,
            final_stock: 0
          };
          product.lots.push(lot);
        }
        
        // Note: outbound_quantity will be calculated later
      });

      // Note: Returns will be handled later in the final calculation

      // Process new receipts from selected date - din tabela receptions și din movements cu action='add' fără 'Returnat'
      const newReceiptMovements = new Map<string, number>(); // key: productName_lotNumber, value: total new receipts
      
      console.log('=== CHECKING FOR NEW RECEIPTS ===');
      
      // Check receipts from receptions table
      const { data: dailyReceptions, error: receptionsError } = await supabase
        .from("receptions")
        .select(`
          name,
          lot_number,
          quantity,
          net_quantity,
          unit,
          products:product_id (name, cod_produs)
        `)
        .gte('receipt_date', `${selectedDate}T00:00:00`)
        .lte('receipt_date', `${selectedDate}T23:59:59`);

      if (receptionsError) {
        console.error("Error fetching daily receptions:", receptionsError);
      } else {
        console.log('Daily receptions found:', dailyReceptions?.length || 0);
        
        (dailyReceptions || []).forEach(reception => {
          const lotKey = `${reception.name}_${reception.lot_number || 'Fără lot'}`;
          const receiptQty = reception.net_quantity || reception.quantity;
          newReceiptMovements.set(lotKey, (newReceiptMovements.get(lotKey) || 0) + receiptQty);
          
          console.log(`NEW RECEIPT from receptions table: ${lotKey} +${receiptQty} = ${newReceiptMovements.get(lotKey)}`);
        });
      }
      
      // Also check movements for any additional receipts (returns, adjustments, etc.)
      console.log('All movements for receipts analysis:', movements?.length);
      
      (movements || []).forEach(movement => {
        console.log(`Analyzing movement: action=${movement.action}, notes=${movement.notes}, product=${movement.name}, lot=${movement.lot_number}`);
        
        if (movement.action === 'add' && (!movement.notes || !movement.notes.includes('Returnat'))) {
          const lotKey = `${movement.name}_${movement.lot_number || 'Fără lot'}`;
          const receiptQty = movement.net_quantity || movement.quantity;
          newReceiptMovements.set(lotKey, (newReceiptMovements.get(lotKey) || 0) + receiptQty);
          
          console.log(`NEW RECEIPT from movements: ${lotKey} +${receiptQty} = ${newReceiptMovements.get(lotKey)}`);
        }
      });
      
      console.log('Final newReceiptMovements map:', Object.fromEntries(newReceiptMovements));

      // Process current inventory for products that had activity
      (currentInventory || []).forEach(inventory => {
        const productKey = `${inventory.name}_${inventory.products?.cod_produs || ''}`;
        let product = productMap.get(productKey);
        
        if (!product) {
          product = {
            product_name: inventory.name,
            product_code: inventory.products?.cod_produs || '',
            unit: inventory.unit,
            total_initial: 0,
            total_outbound: 0,
            total_received: 0,
            total_final: 0,
            lots: []
          };
          productMap.set(productKey, product);
        }

        const lotKey = inventory.lot_number || 'Fără lot';
        let lot = product.lots.find(l => l.lot_number === lotKey);
        
        if (!lot) {
          lot = {
            product_name: inventory.name,
            product_code: inventory.products?.cod_produs || '',
            lot_number: lotKey,
            unit: inventory.unit,
            initial_stock: 0,
            outbound_quantity: 0,
            received_quantity: 0,
            final_stock: 0
          };
          product.lots.push(lot);
        }

        // Note: final_stock will be calculated later using the formula
        const currentStockForThisEntry = inventory.net_quantity || inventory.quantity;
        
        console.log(`Processing current inventory for lot ${lotKey} - ${inventory.name}:`);
        console.log(`- Current stock: ${currentStockForThisEntry}`);
      });
      
      // Calculate quantities for each lot
      productMap.forEach(product => {
        product.lots.forEach(lot => {
          // Ieșirile pentru acest lot (din outboundMovements)
          const lotMovementKey = `${product.product_name}_${lot.lot_number}`;
          const rawOutbound = outboundMovements.get(lotMovementKey) || 0;
          const returns = returnMovements.get(lotMovementKey) || 0;
          
          // Ieșirile nete = ieșirile brute - retururile
          lot.outbound_quantity = Math.max(0, rawOutbound - returns);
          
          // Recepțiile noi pentru acest lot (doar din ziua selectată)
          const newReceiptsForThisLot = newReceiptMovements.get(lotMovementKey) || 0;
          lot.received_quantity = newReceiptsForThisLot;
          
          // STOCUL INIȚIAL vine din SNAPSHOT (deja setat mai sus în cod)
          // Pentru produsele care nu sunt în snapshot, calculez din inventarul curent
          if (lot.initial_stock === 0) {
            // Calculez stocul curent pentru acest lot din inventar
            const currentStock = currentInventory
              .filter(inv => inv.name === product.product_name && (inv.lot_number || 'Fără lot') === lot.lot_number)
              .reduce((sum, inv) => sum + (inv.net_quantity || inv.quantity), 0);
            
            // Stoc Inițial = Stoc Curent + Ieșiri - Recepții Noi
            lot.initial_stock = Math.max(0, currentStock + lot.outbound_quantity - lot.received_quantity);
            
            console.log(`Calculated initial stock for product not in snapshot: ${lot.product_name} lot ${lot.lot_number}:`);
            console.log(`- Current stock: ${currentStock}`);
            console.log(`- Outbound: ${lot.outbound_quantity}`);
            console.log(`- New receipts: ${lot.received_quantity}`);
            console.log(`- Calculated initial: ${lot.initial_stock}`);
          }
          
          // CALCULEZ STOCUL FINAL cu formula corectă:
          // Stoc Final = Stoc Inițial (din snapshot sau calculat) + Recepții Noi - Ieșiri
          lot.final_stock = lot.initial_stock + lot.received_quantity - lot.outbound_quantity;
          
          console.log(`Correct calculation for lot ${lot.lot_number}:`);
          console.log(`- Initial stock (from snapshot): ${lot.initial_stock}`);
          console.log(`- New receipts: ${lot.received_quantity}`);
          console.log(`- Outbound: ${lot.outbound_quantity}`);
          console.log(`- Final stock = ${lot.initial_stock} + ${lot.received_quantity} - ${lot.outbound_quantity} = ${lot.final_stock}`);
          
          console.log(`Final calculation for lot ${lot.lot_number}:`);
          console.log(`- Initial stock: ${lot.initial_stock}`);
          console.log(`- Outbound: ${lot.outbound_quantity}`);
          console.log(`- Received: ${lot.received_quantity}`);
          console.log(`- Final stock: ${lot.final_stock}`);
          console.log(`- Verification: ${lot.initial_stock} + ${lot.received_quantity} - ${lot.outbound_quantity} = ${lot.initial_stock + lot.received_quantity - lot.outbound_quantity}`);
        });
      });

      // Calculate product totals
      productMap.forEach(product => {
        product.total_initial = product.lots.reduce((sum, lot) => sum + lot.initial_stock, 0);
        product.total_outbound = product.lots.reduce((sum, lot) => sum + lot.outbound_quantity, 0);
        product.total_received = product.lots.reduce((sum, lot) => sum + lot.received_quantity, 0);
        product.total_final = product.lots.reduce((sum, lot) => sum + lot.final_stock, 0);
      });

      const results = Array.from(productMap.values());
      setConsumptionData(results);
      setFilteredData(results);
    } catch (error: any) {
      console.error("Error fetching consumption data:", error);
      toast({
        variant: "destructive",
        title: "Eroare la încărcarea consumului zilnic",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConsumptionData();
  }, [selectedDate]);

  useEffect(() => {
    if (productFilter.trim() === "") {
      setFilteredData(consumptionData);
    } else {
      const filtered = consumptionData.filter(product =>
        product.product_name.toLowerCase().includes(productFilter.toLowerCase()) ||
        product.product_code.toLowerCase().includes(productFilter.toLowerCase())
      );
      setFilteredData(filtered);
    }
  }, [productFilter, consumptionData]);

  const handleExport = () => {
    const dataToExport: any[] = [];
    
    filteredData.forEach(product => {
      // Add product summary row
      dataToExport.push({
        'Produs': product.product_name,
        'Cod Produs': product.product_code,
        'Lot': 'TOTAL PRODUS',
        'Unitate': product.unit,
        'Stoc Inițial': product.total_initial.toFixed(2),
        'Ieșiri': product.total_outbound.toFixed(2),
        'Recepții Noi': product.total_received.toFixed(2),
        'Stoc Final': product.total_final.toFixed(2)
      });

      // Add lot details
      product.lots.forEach(lot => {
        dataToExport.push({
          'Produs': '',
          'Cod Produs': '',
          'Lot': lot.lot_number,
          'Unitate': lot.unit,
          'Stoc Inițial': lot.initial_stock.toFixed(2),
          'Ieșiri': lot.outbound_quantity.toFixed(2),
          'Recepții Noi': lot.received_quantity.toFixed(2),
          'Stoc Final': lot.final_stock.toFixed(2)
        });
      });

      // Add empty row for separation
      dataToExport.push({
        'Produs': '',
        'Cod Produs': '',
        'Lot': '',
        'Unitate': '',
        'Stoc Inițial': '',
        'Ieșiri': '',
        'Recepții Noi': '',
        'Stoc Final': ''
      });
    });
    
    const filename = `consum_zilnic_loturi_${selectedDate}.xlsx`;
    exportToExcel(dataToExport, filename);
    
    toast({
      title: "Export realizat",
      description: `Consumul zilnic pe loturi din ${new Date(selectedDate).toLocaleDateString('ro-RO')} a fost exportat cu succes.`
    });
  };

  if (loading) {
    return <div className="p-4 text-center">Se încarcă consumul zilnic...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="text-sm font-medium">Selectează data:</span>
          </div>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-auto"
          />
          <Input
            type="text"
            placeholder="Filtrează după produs..."
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="w-auto min-w-[200px]"
          />
        </div>
        
        <Button onClick={handleExport} disabled={filteredData.length === 0}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export Excel
        </Button>
      </div>

      {filteredData.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>{productFilter ? "Nu există produse care să se potrivească cu filtrul." : "Nu există date pentru data selectată."}</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produs</TableHead>
                <TableHead>Cod Produs</TableHead>
                <TableHead>Lot</TableHead>
                <TableHead>Unitate</TableHead>
                <TableHead className="text-right">Stoc Inițial</TableHead>
                <TableHead className="text-right">Ieșiri</TableHead>
                <TableHead className="text-right">Recepții Noi</TableHead>
                <TableHead className="text-right">Stoc Final</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((product, productIndex) => [
                // Product summary row
                <TableRow key={`${product.product_name}-${product.product_code}-summary`} className="bg-muted font-semibold">
                  <TableCell className="font-bold">{product.product_name}</TableCell>
                  <TableCell className="font-bold">{product.product_code}</TableCell>
                  <TableCell className="font-bold">TOTAL PRODUS</TableCell>
                  <TableCell>{product.unit}</TableCell>
                  <TableCell className="text-right">{product.total_initial.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{product.total_outbound.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{product.total_received.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{product.total_final.toFixed(2)}</TableCell>
                </TableRow>,
                
                // Lot detail rows
                ...product.lots.map((lot, lotIndex) => (
                  <TableRow key={`${product.product_name}-${lot.lot_number}-${lotIndex}`}>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                    <TableCell className="pl-8">{lot.lot_number}</TableCell>
                    <TableCell>{lot.unit}</TableCell>
                    <TableCell className="text-right">{lot.initial_stock.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{lot.outbound_quantity.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{lot.received_quantity.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{lot.final_stock.toFixed(2)}</TableCell>
                  </TableRow>
                ))
              ]).flat()}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};