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
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    today.setDate(today.getDate() - 1); // Yesterday by default
    return today.toISOString().split('T')[0];
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
          products:product_id (name, cod_produs)
        `)
        .gte('operation_date', `${selectedDate}T00:00:00`)
        .lt('operation_date', `${selectedDate}T23:59:59`);

      if (movementsError) throw movementsError;

      // Get new receptions for the selected date
      const { data: receptions, error: receptionsError } = await supabase
        .from("inventory")
        .select(`
          name,
          lot_number,
          quantity,
          net_quantity,
          unit,
          receipt_date,
          products:product_id (name, cod_produs)
        `)
        .gte('receipt_date', `${selectedDate}T00:00:00`)
        .lt('receipt_date', `${selectedDate}T23:59:59`);

      if (receptionsError) throw receptionsError;

      // Process data to create consumption report
      const productMap = new Map<string, ProductSummary>();

      // Process initial stock
      (initialStock || []).forEach(item => {
        const productKey = `${item.name}_${item.products?.cod_produs || ''}`;
        const lotKey = `${productKey}_${item.lot_number || ''}`;
        
        if (!productMap.has(productKey)) {
          productMap.set(productKey, {
            product_name: item.name,
            product_code: item.products?.cod_produs || '',
            unit: item.unit,
            total_initial: 0,
            total_outbound: 0,
            total_received: 0,
            total_final: 0,
            lots: []
          });
        }

        const product = productMap.get(productKey)!;
        const initialQuantity = item.net_quantity || item.quantity;
        
        const lotItem: LotConsumptionItem = {
          product_name: item.name,
          product_code: item.products?.cod_produs || '',
          lot_number: item.lot_number || 'Fără lot',
          unit: item.unit,
          initial_stock: initialQuantity,
          outbound_quantity: 0,
          received_quantity: 0,
          final_stock: initialQuantity
        };

        product.lots.push(lotItem);
        product.total_initial += initialQuantity;
      });

      // Process outbound movements
      (movements || []).forEach(movement => {
        if (movement.action === 'remove') {
          const productKey = `${movement.name}_${movement.products?.cod_produs || ''}`;
          const product = productMap.get(productKey);
          
          if (product) {
            const lot = product.lots.find(l => l.lot_number === (movement.lot_number || 'Fără lot'));
            const outboundQty = movement.net_quantity || movement.quantity;
            
            if (lot) {
              lot.outbound_quantity += outboundQty;
              lot.final_stock -= outboundQty;
            }
            product.total_outbound += outboundQty;
          }
        }
      });

      // Process new receptions
      (receptions || []).forEach(reception => {
        const productKey = `${reception.name}_${reception.products?.cod_produs || ''}`;
        let product = productMap.get(productKey);
        
        if (!product) {
          product = {
            product_name: reception.name,
            product_code: reception.products?.cod_produs || '',
            unit: reception.unit,
            total_initial: 0,
            total_outbound: 0,
            total_received: 0,
            total_final: 0,
            lots: []
          };
          productMap.set(productKey, product);
        }

        const lotKey = reception.lot_number || 'Fără lot';
        let lot = product.lots.find(l => l.lot_number === lotKey);
        
        if (!lot) {
          lot = {
            product_name: reception.name,
            product_code: reception.products?.cod_produs || '',
            lot_number: lotKey,
            unit: reception.unit,
            initial_stock: 0,
            outbound_quantity: 0,
            received_quantity: 0,
            final_stock: 0
          };
          product.lots.push(lot);
        }

        const receivedQty = reception.net_quantity || reception.quantity;
        lot.received_quantity += receivedQty;
        lot.final_stock += receivedQty;
        product.total_received += receivedQty;
      });

      // Calculate totals
      productMap.forEach(product => {
        product.total_final = product.total_initial - product.total_outbound + product.total_received;
      });

      setConsumptionData(Array.from(productMap.values()));
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

  const handleExport = () => {
    const dataToExport: any[] = [];
    
    consumptionData.forEach(product => {
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
        </div>
        
        <Button onClick={handleExport} disabled={consumptionData.length === 0}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export Excel
        </Button>
      </div>

      {consumptionData.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>Nu există date pentru data selectată.</p>
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
              {consumptionData.map((product, productIndex) => (
                <React.Fragment key={`${product.product_name}-${product.product_code}`}>
                  {/* Product summary row */}
                  <TableRow className="bg-muted font-semibold">
                    <TableCell className="font-bold">{product.product_name}</TableCell>
                    <TableCell className="font-bold">{product.product_code}</TableCell>
                    <TableCell className="font-bold">TOTAL PRODUS</TableCell>
                    <TableCell>{product.unit}</TableCell>
                    <TableCell className="text-right">{product.total_initial.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{product.total_outbound.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{product.total_received.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{product.total_final.toFixed(2)}</TableCell>
                  </TableRow>
                  
                  {/* Lot detail rows */}
                  {product.lots.map((lot, lotIndex) => (
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