
import React, { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { exportToExcel } from "@/lib/excelExport";
import { toast } from "@/hooks/use-custom-toast";
import { useGroupedReceptions } from "@/hooks/use-grouped-receptions";
import { useInventoryType } from "@/App";

interface ReceptionItem {
  id: string;
  entry_number: number;
  receipt_date: string;
  name: string;
  quantity: number;
  gross_quantity: number;
  net_quantity: number;
  unit: string;
  document_number: string;
  lot_number: string;
  suppliers?: { name: string };
  manufacturers?: { name: string };
  crate_types?: { name: string; weight: number };
  products?: { name: string; cod_produs: string };
  crate_count: number;
}

type GroupingMode = 'none' | 'product' | 'supplier' | 'lot';

export const ReceptionHistory = () => {
  const { inventoryType } = useInventoryType();
  const [receptions, setReceptions] = useState<ReceptionItem[]>([]);
  const [filteredReceptions, setFilteredReceptions] = useState<ReceptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [groupBy, setGroupBy] = useState<GroupingMode>('none');

  const groupedData = useGroupedReceptions(filteredReceptions, groupBy);

  const fetchReceptions = async () => {
    try {
      setLoading(true);
      // For ambalaje, we don't have the receptions table yet
      if (inventoryType === 'ambalaje') {
        console.log(`Skipping receptions for ${inventoryType} - table doesn't exist yet`);
        setReceptions([]);
        setFilteredReceptions([]);
        setLoading(false);
        return;
      }
      
      let query = supabase
        .from('receptions')
        .select(`
          id,
          entry_number,
          receipt_date,
          name,
          quantity,
          gross_quantity,
          net_quantity,
          unit,
          document_number,
          lot_number,
          crate_count,
          suppliers:supplier_id (name),
          manufacturers:manufacturer_id (name),
          crate_types:crate_type_id (name, weight),
          products:product_id (name, cod_produs)
        `)
        .order("receipt_date", { ascending: false });

      if (dateFrom) {
        query = query.gte('receipt_date', dateFrom);
      }
      if (dateTo) {
        query = query.lte('receipt_date', dateTo + 'T23:59:59');
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      console.log("Reception history data:", data);
      const receptionsData = data || [];
      setReceptions(receptionsData);
      setFilteredReceptions(receptionsData);
    } catch (error: any) {
      console.error("Error fetching reception history:", error);
      toast({
        variant: "destructive",
        title: "Eroare la încărcarea istoricului recepțiilor",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceptions();
  }, [dateFrom, dateTo]);

  useEffect(() => {
    if (productFilter.trim() === "") {
      setFilteredReceptions(receptions);
    } else {
      const filtered = receptions.filter(item =>
        item.name.toLowerCase().includes(productFilter.toLowerCase()) ||
        (item.products?.cod_produs && item.products.cod_produs.toLowerCase().includes(productFilter.toLowerCase()))
      );
      setFilteredReceptions(filtered);
    }
  }, [productFilter, receptions]);

  const handleExport = () => {
    const dataToExport = filteredReceptions.map(item => ({
      'Nr. Intrare': item.entry_number,
      'Data Recepție': item.receipt_date ? new Date(item.receipt_date).toLocaleDateString('ro-RO') : '',
      'Produs': item.name,
      'Cod Produs': item.products?.cod_produs || '',
      'Nr Lot': item.lot_number || '',
      'Cantitate Netă': item.net_quantity?.toFixed(2) || item.quantity.toFixed(2),
      'Unitate': item.unit,
      'Document': item.document_number || '',
      'Furnizor': item.suppliers?.name || '',
      'Producător': item.manufacturers?.name || '',
      'Tip Lădiță': item.crate_types?.name || '',
      'Nr. Lădițe': item.crate_count || ''
    }));
    
    const filename = `istoric_receptii_${dateFrom || 'toate'}_${dateTo || 'toate'}.xlsx`;
    exportToExcel(dataToExport, filename);
    
    toast({
      title: "Export realizat",
      description: "Istoricul recepțiilor a fost exportat cu succes."
    });
  };

  if (loading) {
    return <div className="p-4 text-center">Se încarcă istoricul recepțiilor...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="text-sm font-medium">Filtrare pe dată:</span>
          </div>
          <div className="flex gap-2">
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              placeholder="De la"
              className="w-auto"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              placeholder="Până la"
              className="w-auto"
            />
          </div>
          <Input
            type="text"
            placeholder="Filtrează după produs..."
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="w-auto min-w-[200px]"
          />
        </div>
        
        <Button onClick={handleExport} disabled={filteredReceptions.length === 0}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export Excel
        </Button>
      </div>

      <div className="mb-4 flex gap-2 flex-wrap">
        <Button
          variant={groupBy === 'none' ? 'default' : 'outline'}
          onClick={() => setGroupBy('none')}
        >
          Fără grupare
        </Button>
        <Button
          variant={groupBy === 'product' ? 'default' : 'outline'}
          onClick={() => setGroupBy('product')}
        >
          Grupare după produs
        </Button>
        <Button
          variant={groupBy === 'supplier' ? 'default' : 'outline'}
          onClick={() => setGroupBy('supplier')}
        >
          Grupare după furnizor
        </Button>
        <Button
          variant={groupBy === 'lot' ? 'default' : 'outline'}
          onClick={() => setGroupBy('lot')}
        >
          Grupare după lot
        </Button>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nr. Intrare</TableHead>
              <TableHead>Data Recepție</TableHead>
              <TableHead>Produs</TableHead>
              <TableHead>Cod Produs</TableHead>
              <TableHead>Nr Lot</TableHead>
              <TableHead className="text-right">Cantitate Netă</TableHead>
              <TableHead>Unitate</TableHead>
              <TableHead>Document</TableHead>
              <TableHead>Furnizor</TableHead>
              <TableHead>Producător</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groupedData.length > 0 ? (
              groupedData.map((item) => {
                const isGroupHeader = 'isGroupHeader' in item && item.isGroupHeader;
                return (
                  <TableRow key={item.id} className={isGroupHeader ? "bg-muted font-semibold" : ""}>
                    <TableCell className="font-medium">
                      {isGroupHeader ? '' : item.entry_number}
                    </TableCell>
                    <TableCell>
                      {isGroupHeader ? '' : (item.receipt_date ? new Date(item.receipt_date).toLocaleDateString('ro-RO') : '-')}
                    </TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{isGroupHeader ? '' : (item.products?.cod_produs || '-')}</TableCell>
                    <TableCell>{isGroupHeader ? '' : (item.lot_number || '-')}</TableCell>
                    <TableCell className="text-right">
                      {isGroupHeader ? '' : (item.net_quantity || item.quantity).toFixed(2)}
                    </TableCell>
                    <TableCell>{isGroupHeader ? '' : item.unit}</TableCell>
                    <TableCell>{isGroupHeader ? '' : (item.document_number || '-')}</TableCell>
                    <TableCell>{isGroupHeader ? '' : (item.suppliers?.name || '-')}</TableCell>
                    <TableCell>{isGroupHeader ? '' : (item.manufacturers?.name || '-')}</TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-6 text-gray-500">
                  Nu s-au găsit recepții în intervalul selectat.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
