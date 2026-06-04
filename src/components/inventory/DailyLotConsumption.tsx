import React, { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { exportToExcel } from "@/lib/excelExport";
import { toast } from "@/hooks/use-custom-toast";
import { useInventoryType } from "@/context/inventory-type";
import { persistDateKey, readStoredDateKey, yesterdayKey } from "@/lib/persistentDate";

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
  const { inventoryType } = useInventoryType();
  const [consumptionData, setConsumptionData] = useState<ProductSummary[]>([]);
  const [filteredData, setFilteredData] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [productFilter, setProductFilter] = useState("");
  const dateStorageKey = `dailyLotConsumption.date.${inventoryType}`;
  const [selectedDate, setSelectedDateState] = useState(() => readStoredDateKey(dateStorageKey, yesterdayKey()));

  const setSelectedDate = (value: string) => {
    setSelectedDateState(value);
    persistDateKey(dateStorageKey, value);
  };

  useEffect(() => {
    setSelectedDateState(readStoredDateKey(dateStorageKey, yesterdayKey()));
  }, [dateStorageKey]);

  const fetchConsumptionData = async () => {
    try {
      setLoading(true);
      
      const snapshotTable = inventoryType === 'ambalaje'
        ? 'ambalaje_daily_stock_snapshots'
        : inventoryType === 'etichete'
          ? 'etichete_daily_stock_snapshots'
          : 'daily_stock_snapshots';
      const inventoryTable = inventoryType === 'ambalaje'
        ? 'ambalaje_inventory'
        : inventoryType === 'etichete'
          ? 'etichete_inventory'
          : 'inventory';
      
      // For ambalaje, we don't have daily snapshots yet, so skip
      if (inventoryType === 'ambalaje') {
        console.log(`Skipping daily lot consumption for ${inventoryType} - daily snapshots don't exist yet`);
        setConsumptionData([]);
        setFilteredData([]);
        setLoading(false);
        return;
      }
      
      console.log('=== DAILY CONSUMPTION REPORT ===');
      console.log('Selected date:', selectedDate);
      
      // Get initial stock from the SELECTED DATE snapshot (beginning of day)
      const { data: initialStock, error: initialError } = await supabase
        .from(snapshotTable)
        .select(`
          name,
          lot_number,
          quantity,
          unit,
          product_id,
          products:product_id (name, cod_produs)
        `)
        .eq('snapshot_date', selectedDate);

      if (initialError) throw initialError;

      // Get final stock from CURRENT INVENTORY (real-time) instead of snapshots
      const { data: finalStock, error: finalError } = await supabase
        .from(inventoryTable)
        .select(`
          name,
          lot_number,
          quantity,
          unit,
          product_id,
          products:product_id (name, cod_produs)
        `)
        .gt('quantity', 0); // Only get non-zero quantities

      if (finalError) throw finalError;

      // Get reception records for the selected date to identify actual receipts
      // Note: ambalaje is already returned above.
      const receptionTable = inventoryType === 'etichete'
        ? 'etichete_reception_records'
        : 'reception_records';
      const { data: receptionRecords, error: receptionError } = await supabase
        .from(receptionTable)
        .select('name, lot_number, original_quantity')
        .gte('receipt_date', selectedDate)
        .lt('receipt_date', `${selectedDate}T23:59:59`);

      if (receptionError) throw receptionError;

      // Get transfers for the selected date to track official transfers out
      // NOTE: for etichete we must not join to stock_transfers (different table), so we fetch transfer IDs first.
      // Note: ambalaje is already returned above.
      const transferItemsTable = inventoryType === 'etichete'
        ? 'etichete_stock_transfer_items'
        : 'stock_transfer_items';
      const transfersTable = inventoryType === 'etichete'
        ? 'etichete_stock_transfers'
        : 'stock_transfers';

      const { data: transfersForDate, error: transfersForDateError } = await supabase
        .from(transfersTable)
        .select('id')
        .eq('transfer_date', selectedDate);
      if (transfersForDateError) throw transfersForDateError;

      const transferIds = (transfersForDate ?? []).map((t: any) => t.id).filter(Boolean);

      let transfersOut: any[] = [];
      if (transferIds.length > 0) {
        const { data: items, error: itemsErr } = await supabase
          .from(transferItemsTable)
          .select('quantity, inventory_item_id, transfer_id')
          .in('transfer_id', transferIds);
        if (itemsErr) throw itemsErr;

        const invIds = Array.from(
          new Set(((items ?? []) as any[]).map((i: any) => i.inventory_item_id).filter(Boolean))
        );

        const inventoryById = new Map<string, { name: string; lot_number: string | null }>();
        if (invIds.length > 0) {
          const { data: invRows, error: invErr } = await supabase
            .from(inventoryTable)
            .select('id, name, lot_number')
            .in('id', invIds);
          if (invErr) throw invErr;
          (invRows ?? []).forEach((r: any) => {
            inventoryById.set(r.id, { name: r.name, lot_number: r.lot_number ?? null });
          });
        }

        transfersOut = ((items ?? []) as any[]).map((it: any) => ({
          ...it,
          inventory: inventoryById.get(it.inventory_item_id) ?? null,
        }));
      }

      console.log('Initial stock entries:', initialStock?.length || 0);
      console.log('Final stock entries:', finalStock?.length || 0);

      // Create maps for easier lookup
      const initialStockMap = new Map<string, number>();
      const finalStockMap = new Map<string, number>();
      const productDetailsMap = new Map<string, any>();
      const actualReceiptsMap = new Map<string, number>();
      const actualTransfersMap = new Map<string, number>();

      // Process reception records to identify actual receipts
      (receptionRecords || []).forEach(receipt => {
        const key = `${receipt.name}_${receipt.lot_number || 'Fără lot'}`;
        actualReceiptsMap.set(key, (actualReceiptsMap.get(key) || 0) + receipt.original_quantity);
        console.log(`Receipt: ${key} = ${receipt.original_quantity}`);
      });

      // Process transfers out to identify official transfers
      (transfersOut || []).forEach(transfer => {
        if (transfer.inventory?.name && transfer.inventory?.lot_number) {
          const key = `${transfer.inventory.name}_${transfer.inventory.lot_number}`;
          actualTransfersMap.set(key, (actualTransfersMap.get(key) || 0) + transfer.quantity);
          console.log(`Transfer out: ${key} = ${transfer.quantity}`);
        }
      });

      console.log('Reception records for date:', receptionRecords?.length || 0);
      console.log('Transfer records for date:', transfersOut?.length || 0);
      console.log('Actual receipts map:', Array.from(actualReceiptsMap.entries()));
      console.log('Actual transfers map:', Array.from(actualTransfersMap.entries()));

      // Process initial stock
      (initialStock || []).forEach(item => {
        const key = `${item.name}_${item.lot_number || 'Fără lot'}`;
        initialStockMap.set(key, (initialStockMap.get(key) || 0) + item.quantity);
        
        if (!productDetailsMap.has(item.name)) {
          productDetailsMap.set(item.name, {
            name: item.name,
            code: (item as any).products?.cod_produs || '',
            unit: item.unit,
            product_id: item.product_id
          });
        }
      });

      // Process final stock
      (finalStock || []).forEach(item => {
        const key = `${item.name}_${item.lot_number || 'Fără lot'}`;
        finalStockMap.set(key, (finalStockMap.get(key) || 0) + item.quantity);
        
        if (!productDetailsMap.has(item.name)) {
          productDetailsMap.set(item.name, {
            name: item.name,
            code: (item as any).products?.cod_produs || '',
            unit: item.unit,
            product_id: item.product_id
          });
        }
      });

      // Final logic: cantitatea ieșită = ce e în actualTransfersMap, punct!

      // Get all unique lot keys from both snapshots
      const allLotKeys = new Set([
        ...Array.from(initialStockMap.keys()),
        ...Array.from(finalStockMap.keys())
      ]);

      console.log('Total unique lots found:', allLotKeys.size);
      console.log('All lot keys:', Array.from(allLotKeys));
      console.log('Bulls Blod lots:', Array.from(allLotKeys).filter(key => key.includes('Bulls Blod')));

      // Process data to create consumption report
      const productMap = new Map<string, ProductSummary>();

      allLotKeys.forEach(lotKey => {
        const [productName, lotNumber] = lotKey.split('_');
        const productDetails = productDetailsMap.get(productName);
        
        if (!productDetails) {
          console.warn(`No product details found for ${productName}`);
          return;
        }

        // Get or create product summary
        if (!productMap.has(productName)) {
          productMap.set(productName, {
            product_name: productName,
            product_code: productDetails.code,
            unit: productDetails.unit,
            total_initial: 0,
            total_outbound: 0,
            total_received: 0,
            total_final: 0,
            lots: []
          });
        }

        const product = productMap.get(productName)!;
        
        const initialQty = initialStockMap.get(lotKey) || 0;
        const finalQty = finalStockMap.get(lotKey) || 0;
        
          // Cantitatea ieșită = exact ce e în actualTransfersMap pentru ziua selectată
          let receivedQty = actualReceiptsMap.get(lotKey) || 0;
          let consumedQty = actualTransfersMap.get(lotKey) || 0; // PUNCT!
          
          // For receipts, check if we have official reception records
          if (receivedQty === 0 && initialQty === 0 && finalQty > 0) {
            receivedQty = finalQty;
          }

        // Dacă nu există în actualTransfersMap, consumul trebuie să fie 0!!!
        if (consumedQty > 0 || receivedQty > 0) {
          const lotItem: LotConsumptionItem = {
            product_name: productName,
            product_code: productDetails.code,
            lot_number: lotNumber,
            unit: productDetails.unit,
            initial_stock: initialQty,
            outbound_quantity: consumedQty,
            received_quantity: receivedQty,
            final_stock: finalQty
          };

          product.lots.push(lotItem);
          product.total_initial += initialQty;
          product.total_outbound += consumedQty;
          product.total_received += receivedQty;
          product.total_final += finalQty;

          console.log(`✅ Lot ${lotKey}: ${initialQty} → ${finalQty} (consumed: ${consumedQty}, received: ${receivedQty})`);
        } else {
          console.log(`⏭️ Skipping lot ${lotKey}: no activity (initial=${initialQty}, final=${finalQty})`);
        }
      });

      // Filter out products with no activity (no consumption and no receipts)
      const dataWithActivity = Array.from(productMap.values()).filter(product => 
        product.total_outbound > 0 || product.total_received > 0
      );

      // Sort by product name
      dataWithActivity.sort((a, b) => a.product_name.localeCompare(b.product_name));

      // Sort lots within each product
      dataWithActivity.forEach(product => {
        product.lots.sort((a, b) => a.lot_number.localeCompare(b.lot_number));
      });

      console.log(`Final consumption report: ${dataWithActivity.length} products with activity`);

      setConsumptionData(dataWithActivity);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching consumption data:", error);
      toast({
        title: "Eroare",
        description: "Nu s-au putut încărca datele de consum",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('🚀 Re-running fetchConsumptionData at:', new Date().toISOString());
    fetchConsumptionData();
  }, [selectedDate, inventoryType]);

  useEffect(() => {
    if (!productFilter.trim()) {
      setFilteredData(consumptionData);
    } else {
      const filtered = consumptionData.filter(product =>
        product.product_name.toLowerCase().includes(productFilter.toLowerCase()) ||
        product.product_code.toLowerCase().includes(productFilter.toLowerCase())
      );
      setFilteredData(filtered);
    }
  }, [consumptionData, productFilter]);

  const handleExport = () => {
    if (!filteredData.length) {
      toast({
        title: "Nu există date",
        description: "Nu există date pentru export",
        variant: "destructive",
      });
      return;
    }

    const exportData = filteredData.flatMap(product =>
      product.lots.map(lot => ({
        "Produs": lot.product_name,
        "Cod Produs": lot.product_code,
        "Lot": lot.lot_number,
        "Unitate": lot.unit,
        "Stoc Inițial": lot.initial_stock,
        "Cantitate Ieșită": lot.outbound_quantity,
        "Cantitate Primită": lot.received_quantity,
        "Stoc Final": lot.final_stock,
        "Consum Net": lot.outbound_quantity - lot.received_quantity
      }))
    );

    exportToExcel(exportData, `Consum_zilnic_loturi_${selectedDate}.xlsx`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Se încarcă raportul de consum...</div>
      </div>
    );
  }

  if (inventoryType === 'ambalaje') {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">
          Raportul de consum zilnic nu este disponibil pentru ambalaje
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border rounded-md text-sm"
          />
        </div>
        
        <Input
          placeholder="Filtrează după produs..."
          value={productFilter}
          onChange={(e) => setProductFilter(e.target.value)}
          className="w-full sm:w-64"
        />
        
        <Button onClick={() => window.print()} variant="outline" size="sm">
          Printează
        </Button>
        
        <Button onClick={handleExport} variant="outline" size="sm">
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export Excel
        </Button>
      </div>

      {filteredData.length === 0 ? (
        <div className="text-center p-8 text-muted-foreground">
          Nu există date de consum pentru ziua selectată
        </div>
      ) : (
        <div className="border rounded-lg overflow-auto print:overflow-visible print:max-h-none">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="font-semibold">Produs</TableHead>
                <TableHead className="font-semibold">Cod</TableHead>
                <TableHead className="font-semibold">Lot</TableHead>
                <TableHead className="font-semibold text-right">Stoc Inițial</TableHead>
                <TableHead className="font-semibold text-right">Cantitate Ieșită</TableHead>
                <TableHead className="font-semibold text-right">Cantitate Primită</TableHead>
                <TableHead className="font-semibold text-right">Stoc Final</TableHead>
                <TableHead className="font-semibold text-right">Consum Net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((product, productIndex) => (
                <React.Fragment key={`${product.product_name}-${productIndex}`}>
                  {/* Product summary row */}
                  <TableRow className="bg-muted/50 font-medium">
                    <TableCell className="font-semibold">
                      {product.product_name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {product.product_code}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-medium">
                      TOTAL
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {product.total_initial.toFixed(2)} {product.unit}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {product.total_outbound.toFixed(2)} {product.unit}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {product.total_received.toFixed(2)} {product.unit}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {product.total_final.toFixed(2)} {product.unit}
                    </TableCell>
                     <TableCell className="text-right font-semibold">
                       {product.total_outbound.toFixed(2)} {product.unit}
                     </TableCell>
                  </TableRow>
                  
                  {/* Individual lot rows */}
                  {product.lots.map((lot, lotIndex) => (
                    <TableRow key={`${lot.product_name}-${lot.lot_number}-${lotIndex}`}>
                      <TableCell className="pl-8 text-muted-foreground">
                        {lot.product_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {lot.product_code}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {lot.lot_number}
                      </TableCell>
                      <TableCell className="text-right">
                        {lot.initial_stock.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        {lot.outbound_quantity.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        {lot.received_quantity.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        {lot.final_stock.toFixed(2)}
                      </TableCell>
                       <TableCell className="text-right">
                         {lot.outbound_quantity.toFixed(2)}
                       </TableCell>
                    </TableRow>
                  ))}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};