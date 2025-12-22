import React, { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { exportToExcel } from "@/lib/excelExport";
import { toast } from "@/hooks/use-custom-toast";
import { useInventoryType } from "@/App";

interface DailyStockItem {
  id: string;
  snapshot_date: string;
  name: string;
  quantity: number;
  net_quantity: number;
  gross_quantity: number;
  unit: string;
  lot_number: string;
  document_number: string;
  entry_number: number;
  receipt_date: string;
  suppliers?: { name: string };
  manufacturers?: { name: string };
  crate_types?: { name: string; weight: number };
  products?: { name: string; cod_produs: string };
  crate_count: number;
}

export const DailyStockHistory = () => {
  const { inventoryType } = useInventoryType();
  const [stockSnapshots, setStockSnapshots] = useState<DailyStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const fetchDailyStock = async () => {
    try {
      setLoading(true);
      const tableName = inventoryType === 'ambalaje' ? 'ambalaje_daily_stock_snapshots' : 'daily_stock_snapshots';
      const suppliersTable = inventoryType === 'ambalaje' ? 'ambalaje_suppliers' : 'suppliers';
      const manufacturersTable = inventoryType === 'ambalaje' ? 'ambalaje_manufacturers' : 'manufacturers';
      const crateTypesTable = inventoryType === 'ambalaje' ? 'ambalaje_crate_types' : 'crate_types';
      const productsTable = inventoryType === 'ambalaje' ? 'ambalaje_products' : 'products';
      
      
      // Fetch all data with pagination
      const pageSize = 1000;
      let allData: any[] = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from(tableName)
          .select(`
            id,
            snapshot_date,
            name,
            quantity,
            net_quantity,
            gross_quantity,
            unit,
            lot_number,
            document_number,
            entry_number,
            receipt_date,
            crate_count,
            suppliers:supplier_id (name),
            manufacturers:manufacturer_id (name),
            crate_types:crate_type_id (name, weight),
            products:product_id (name, cod_produs)
          `)
          .eq('snapshot_date', selectedDate)
          .order("name", { ascending: true })
          .range(offset, offset + pageSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          offset += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      console.log("Daily stock snapshots data (total: " + allData.length + "):", allData);
      setStockSnapshots(allData || []);
    } catch (error: any) {
      console.error("Error fetching daily stock snapshots:", error);
      toast({
        variant: "destructive",
        title: "Eroare la încărcarea stocului zilnic",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDailyStock();
  }, [selectedDate, inventoryType]);

  const handleExport = () => {
    const dataToExport = stockSnapshots.map(item => ({
      'Data Snapshot': new Date(item.snapshot_date).toLocaleDateString('ro-RO'),
      'Nr. Intrare': item.entry_number || '',
      'Produs': item.name,
      'Cod Produs': item.products?.cod_produs || '',
      'Nr Lot': item.lot_number || '',
      'Cantitate': item.quantity.toFixed(2),
      'Unitate': item.unit,
      'Document': item.document_number || '',
      'Data Recepție': item.receipt_date ? new Date(item.receipt_date).toLocaleDateString('ro-RO') : '',
      'Furnizor': item.suppliers?.name || '',
      'Producător': item.manufacturers?.name || '',
      'Tip Lădiță': item.crate_types?.name || '',
      'Nr. Lădițe': item.crate_count || ''
    }));
    
    const filename = `stoc_inceput_zi_${selectedDate}.xlsx`;
    exportToExcel(dataToExport, filename);
    
    toast({
      title: "Export realizat",
      description: `Stocul din ${new Date(selectedDate).toLocaleDateString('ro-RO')} a fost exportat cu succes.`
    });
  };

  const triggerSnapshot = async () => {
    try {
      const { error } = await supabase.functions.invoke('daily-stock-snapshot', {
        body: { inventoryType },
      });
      
      if (error) {
        throw error;
      }
      
      toast({
        title: "Snapshot creat",
        description: "Snapshot-ul stocului curent a fost salvat cu succes."
      });
      
      // Refresh data
      fetchDailyStock();
    } catch (error: any) {
      console.error("Error creating snapshot:", error);
      toast({
        variant: "destructive",
        title: "Eroare la crearea snapshot-ului",
        description: error.message,
      });
    }
  };

  if (loading) {
    return <div className="p-4 text-center">Se încarcă stocul zilnic...</div>;
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
        
        <div className="flex gap-2">
          <Button onClick={triggerSnapshot} variant="outline">
            Creează Snapshot Acum
          </Button>
          <Button onClick={handleExport} disabled={stockSnapshots.length === 0}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
        </div>
      </div>

      {stockSnapshots.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>Nu există snapshot pentru data selectată.</p>
          <p className="text-sm mt-2">Snapshot-urile se creează automat în fiecare zi la ora 5:00 dimineața.</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
                 <TableRow>
                   <TableHead>Nr. Intrare</TableHead>
                   <TableHead>Produs</TableHead>
                   <TableHead>Cod Produs</TableHead>
                   <TableHead>Nr Lot</TableHead>
                   <TableHead className="text-right">Cantitate</TableHead>
                   <TableHead>Unitate</TableHead>
                   <TableHead>Document</TableHead>
                   <TableHead>Data Recepție</TableHead>
                   <TableHead>Furnizor</TableHead>
                   <TableHead>Producător</TableHead>
                   <TableHead>Tip Lădiță</TableHead>
                   <TableHead>Nr. Lădițe</TableHead>
                 </TableRow>
            </TableHeader>
            <TableBody>
              {stockSnapshots.map((item) => (
                <TableRow key={item.id}>
                   <TableCell className="font-medium">{item.entry_number || '-'}</TableCell>
                   <TableCell className="font-medium">{item.name}</TableCell>
                   <TableCell>{item.products?.cod_produs || '-'}</TableCell>
                   <TableCell>{item.lot_number || '-'}</TableCell>
                   <TableCell className="text-right">
                     {item.quantity.toFixed(2)}
                   </TableCell>
                   <TableCell>{item.unit}</TableCell>
                  <TableCell>{item.document_number || '-'}</TableCell>
                  <TableCell>
                    {item.receipt_date ? new Date(item.receipt_date).toLocaleDateString('ro-RO') : '-'}
                  </TableCell>
                  <TableCell>{item.suppliers?.name || '-'}</TableCell>
                  <TableCell>{item.manufacturers?.name || '-'}</TableCell>
                  <TableCell>{item.crate_types?.name || '-'}</TableCell>
                  <TableCell>{item.crate_count || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};