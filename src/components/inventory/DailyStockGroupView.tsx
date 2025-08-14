import React, { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar, FileSpreadsheet, ToggleLeft, ToggleRight, Printer } from "lucide-react";
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
  products?: { name: string; cod_produs: string; pt_percent?: number };
  crate_count: number;
}

interface GroupedProduct {
  product_name: string;
  product_code: string;
  unit: string;
  total_net_quantity: number;
  total_gross_quantity: number;
  lots: DailyStockItem[];
}

export const DailyStockGroupView = () => {
  const { inventoryType } = useInventoryType();
  const [stockSnapshots, setStockSnapshots] = useState<DailyStockItem[]>([]);
  const [groupedData, setGroupedData] = useState<GroupedProduct[]>([]);
  const [filteredGroupedData, setFilteredGroupedData] = useState<GroupedProduct[]>([]);
  const [filteredStockSnapshots, setFilteredStockSnapshots] = useState<DailyStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupedView, setGroupedView] = useState(false);
  const [productFilter, setProductFilter] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [qualityMap, setQualityMap] = useState<Record<string, { obs: string | null; nonconform_percent: number | null; consider_quantity: number | null }>>({});

  const fetchDailyStock = async () => {
    try {
      setLoading(true);
      const tableName = inventoryType === 'ambalaje' ? 'ambalaje_daily_stock_snapshots' : 'daily_stock_snapshots';
      const suppliersTable = inventoryType === 'ambalaje' ? 'ambalaje_suppliers' : 'suppliers';
      const manufacturersTable = inventoryType === 'ambalaje' ? 'ambalaje_manufacturers' : 'manufacturers';
      const crateTypesTable = inventoryType === 'ambalaje' ? 'ambalaje_crate_types' : 'crate_types';
      const productsTable = inventoryType === 'ambalaje' ? 'ambalaje_products' : 'products';
      
      // For ambalaje, we don't have daily snapshots yet
      if (inventoryType === 'ambalaje') {
        console.log(`Skipping daily snapshots for ${inventoryType} - table doesn't exist yet`);
        setStockSnapshots([]);
        setGroupedData([]);
        setFilteredGroupedData([]);
        setFilteredStockSnapshots([]);
        setLoading(false);
        return;
      }
      
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
          products:product_id (name, cod_produs, pt_percent)
        `)
        .eq('snapshot_date', selectedDate)
        .order("name", { ascending: true });

      if (error) {
        throw error;
      }

      const snapshots = data || [];
      setStockSnapshots(snapshots);

      // Fetch quality data for these snapshots (read-only display)
      const qualityTable = 'daily_stock_quality';
      if (snapshots.length > 0) {
        const ids = snapshots.map(s => s.id);
        const { data: qData, error: qErr } = await supabase
          .from(qualityTable)
          .select('snapshot_id, obs, nonconform_percent, consider_quantity')
          .in('snapshot_id', ids);
        if (qErr) throw qErr;
        const map: Record<string, { obs: string | null; nonconform_percent: number | null; consider_quantity: number | null }> = {};
        (qData ?? []).forEach((r: any) => {
          map[r.snapshot_id] = {
            obs: r.obs ?? null,
            nonconform_percent: r.nonconform_percent ?? null,
            consider_quantity: r.consider_quantity ?? null,
          };
        });
        setQualityMap(map);
      } else {
        setQualityMap({});
      }
      
      // Group data by product
      const grouped = new Map<string, GroupedProduct>();
      
      snapshots.forEach(item => {
        const key = `${item.name}_${item.products?.cod_produs || ''}`;
        
        if (!grouped.has(key)) {
          grouped.set(key, {
            product_name: item.name,
            product_code: item.products?.cod_produs || '',
            unit: item.unit,
            total_net_quantity: 0,
            total_gross_quantity: 0,
            lots: []
          });
        }
        
        const group = grouped.get(key)!;
        group.total_net_quantity += item.net_quantity || item.quantity;
        group.total_gross_quantity += item.gross_quantity || item.quantity;
        group.lots.push(item);
      });
      
      const groupedResults = Array.from(grouped.values());
      setGroupedData(groupedResults);
      setFilteredGroupedData(groupedResults);
      setFilteredStockSnapshots(snapshots);
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
  }, [selectedDate]);

  useEffect(() => {
    if (productFilter.trim() === "") {
      setFilteredGroupedData(groupedData);
      setFilteredStockSnapshots(stockSnapshots);
    } else {
      const filteredGrouped = groupedData.filter(product =>
        product.product_name.toLowerCase().includes(productFilter.toLowerCase()) ||
        product.product_code.toLowerCase().includes(productFilter.toLowerCase())
      );
      setFilteredGroupedData(filteredGrouped);

      const filteredSnapshots = stockSnapshots.filter(item =>
        item.name.toLowerCase().includes(productFilter.toLowerCase()) ||
        (item.products?.cod_produs && item.products.cod_produs.toLowerCase().includes(productFilter.toLowerCase()))
      );
      setFilteredStockSnapshots(filteredSnapshots);
    }
  }, [productFilter, groupedData, stockSnapshots]);

  const handleExport = () => {
    let dataToExport: any[] = [];
    
    if (groupedView) {
      dataToExport = filteredGroupedData.map(product => ({
        'Data Snapshot': new Date(selectedDate).toLocaleDateString('ro-RO'),
        'Produs': product.product_name,
        'Cod Produs': product.product_code,
        'Cantitate Totală': (product.total_net_quantity || product.total_gross_quantity).toFixed(2),
        'Unitate': product.unit,
        'Numărul de loturi': product.lots.length
      }));
    } else {
      dataToExport = filteredStockSnapshots.map(item => ({
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
        'Producător': item.manufacturers?.name || ''
      }));
    }
    
    const filename = `stoc_inceput_zi_${groupedView ? 'grupat_' : ''}${selectedDate}.xlsx`;
    exportToExcel(dataToExport, filename);
    
    toast({
      title: "Export realizat",
      description: `Stocul din ${new Date(selectedDate).toLocaleDateString('ro-RO')} a fost exportat cu succes.`
    });
  };

  const triggerSnapshot = async () => {
    try {
      const { error } = await supabase.functions.invoke('daily-stock-snapshot');
      
      if (error) {
        throw error;
      }
      
      toast({
        title: "Snapshot creat",
        description: "Snapshot-ul stocului curent a fost salvat cu succes."
      });
      
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
          <Input
            type="text"
            placeholder="Filtrează după produs..."
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="w-auto min-w-[200px]"
          />
        </div>
        
        <div className="flex gap-2 items-center">
          <Button
            variant="outline"
            onClick={() => setGroupedView(!groupedView)}
            className="flex items-center gap-2"
          >
            {groupedView ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
            {groupedView ? "Vedere grupată" : "Vedere detaliată"}
          </Button>
          <Button onClick={triggerSnapshot} variant="outline">
            Creează Snapshot Acum
          </Button>
          <Button onClick={() => window.print()} variant="outline">
            Printează
          </Button>
          <Button onClick={handleExport} disabled={groupedView ? filteredGroupedData.length === 0 : filteredStockSnapshots.length === 0}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
        </div>
      </div>

      {(groupedView ? filteredGroupedData.length === 0 : filteredStockSnapshots.length === 0) ? (
        <div className="text-center py-8 text-gray-500">
          {productFilter ? (
            <p>Nu există produse care să se potrivească cu filtrul.</p>
          ) : (
            <>
              <p>Nu există snapshot pentru data selectată.</p>
              <p className="text-sm mt-2">Snapshot-urile se creează automat în fiecare zi la ora 5:00 dimineața.</p>
            </>
          )}
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto print:overflow-visible print:border-0">
          {groupedView ? (
            <Table className="text-xs print:text-[8px] table-fixed w-full min-w-fit print:min-w-full">
              <TableHeader>
                <TableRow className="print:break-inside-avoid">
                   <TableHead className="w-32 px-2 py-3 print:table-cell print:w-auto print:text-[8px] print:border print:border-gray-300 print:py-1">Produs</TableHead>
                   <TableHead className="w-16 px-2 py-3 hidden md:table-cell print:table-cell print:w-auto print:text-[8px] print:border print:border-gray-300 print:py-1">Cod Produs</TableHead>
                   <TableHead className="w-16 px-2 py-3 text-right print:table-cell print:w-auto print:text-[8px] print:border print:border-gray-300 print:py-1">Cant. Tot.</TableHead>
                   <TableHead className="w-12 px-2 py-3 hidden lg:table-cell print:table-cell print:w-auto print:text-[8px] print:border print:border-gray-300 print:py-1">U.M.</TableHead>
                   <TableHead className="w-12 px-2 py-3 hidden md:table-cell print:table-cell print:w-auto print:text-[8px] print:border print:border-gray-300 print:py-1">% PT</TableHead>
                   <TableHead className="w-20 px-2 py-3 hidden lg:table-cell print:table-cell print:w-auto print:text-[8px] print:border print:border-gray-300 print:py-1">Obs</TableHead>
                   <TableHead className="w-16 px-2 py-3 hidden md:table-cell print:table-cell print:w-auto print:text-[8px] print:border print:border-gray-300 print:py-1">% marfă neconf.</TableHead>
                   <TableHead className="w-16 px-2 py-3 text-right print:table-cell print:w-auto print:text-[8px] print:border print:border-gray-300 print:py-1">C. Cons.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGroupedData.map((product, index) => {
                  const qItems = product.lots
                    .map((it) => qualityMap[it.id])
                    .filter((q): q is { obs: string | null; nonconform_percent: number | null; consider_quantity: number | null } => Boolean(q));
                  const uniqueObs = Array.from(
                    new Set(
                      qItems
                        .map((q) => (q.obs ?? '').trim())
                        .filter((v) => v.length > 0)
                    )
                  );
                  const obsText = uniqueObs.length === 1 ? uniqueObs[0] : uniqueObs.length > 1 ? 'Variate' : '-';

                  const baseSum = product.lots.reduce((acc, it) => acc + (Number(it.net_quantity || it.quantity) || 0), 0);
                  const sumConsider = product.lots.reduce((acc, it) => {
                    const base = (it.net_quantity || it.quantity) || 0;
                    const pt = it.products?.pt_percent ?? 0;
                    const q = qualityMap[it.id];
                    let val = 0;
                    if (q) {
                      const nonconf = q.nonconform_percent ?? 0;
                      val = (q.consider_quantity != null)
                        ? Number(q.consider_quantity)
                        : base * (1 - nonconf / 100) * (1 - pt / 100);
                    } else {
                      val = base * (1 - pt / 100);
                    }
                    return acc + (Number(val) || 0);
                  }, 0);

                  const percentText = baseSum > 0 ? `${((1 - sumConsider / baseSum) * 100).toFixed(2)}%` : '-';
                  const considerText = baseSum > 0 ? sumConsider.toFixed(2) : '-';
                  const ptVal = product.lots[0]?.products?.pt_percent ?? 0;
                  return (
                    <TableRow key={index} className="print:break-inside-avoid">
                      <TableCell className="px-2 py-3 font-medium text-xs print:table-cell print:text-[8px] print:border print:border-gray-300 print:py-1" title={product.product_name}>{product.product_name}</TableCell>
                      <TableCell className="px-2 py-3 text-xs hidden md:table-cell print:table-cell print:text-[8px] print:border print:border-gray-300 print:py-1">{product.product_code}</TableCell>
                      <TableCell className="px-2 py-3 text-right text-xs print:table-cell print:text-[8px] print:border print:border-gray-300 print:py-1">{(product.total_net_quantity || product.total_gross_quantity).toFixed(2)}</TableCell>
                      <TableCell className="px-2 py-3 text-xs hidden lg:table-cell print:table-cell print:text-[8px] print:border print:border-gray-300 print:py-1">{product.unit}</TableCell>
                      <TableCell className="px-2 py-3 text-xs hidden md:table-cell print:table-cell print:text-[8px] print:border print:border-gray-300 print:py-1">{ptVal ? `${ptVal}%` : '-'}</TableCell>
                      <TableCell className="px-2 py-3 text-xs hidden lg:table-cell print:table-cell print:text-[8px] print:border print:border-gray-300 print:py-1 whitespace-normal break-words min-h-[2.5rem]" title={obsText}>
                        <div className="max-w-[150px] whitespace-normal break-words">{obsText}</div>
                      </TableCell>
                      <TableCell className="px-2 py-3 text-xs hidden md:table-cell print:table-cell print:text-[8px] print:border print:border-gray-300 print:py-1">{percentText}</TableCell>
                      <TableCell className="px-2 py-3 text-right text-xs print:table-cell print:text-[8px] print:border print:border-gray-300 print:py-1">{considerText}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <Table className="text-xs print:text-[8px] table-fixed w-full min-w-fit print:min-w-full">
              <TableHeader>
                <TableRow className="print:break-inside-avoid">
                   <TableHead className="w-8 px-1 py-3 print:table-cell print:w-[6%] print:text-[8px] print:border print:border-gray-300 print:py-1">Nr.</TableHead>
                   <TableHead className="w-20 px-1 py-3 print:table-cell print:w-[16%] print:text-[8px] print:border print:border-gray-300 print:py-1">Produs</TableHead>
                   <TableHead className="w-12 px-1 py-3 hidden md:table-cell print:table-cell print:w-[7%] print:text-[8px] print:border print:border-gray-300 print:py-1">Cod</TableHead>
                   <TableHead className="w-10 px-1 py-3 hidden lg:table-cell print:table-cell print:w-[7%] print:text-[8px] print:border print:border-gray-300 print:py-1">Lot</TableHead>
                   <TableHead className="w-10 px-1 py-3 text-right print:table-cell print:w-[7%] print:text-[8px] print:border print:border-gray-300 print:py-1">Cant.</TableHead>
                   <TableHead className="w-8 px-2 py-3 hidden md:table-cell print:table-cell print:w-[5%] print:text-[8px] print:border print:border-gray-300 print:py-1">U.M.</TableHead>
                   <TableHead className="w-12 px-2 py-3 hidden lg:table-cell print:table-cell print:w-[8%] print:text-[8px] print:border print:border-gray-300 print:py-1">Doc.</TableHead>
                   <TableHead className="w-16 px-2 py-3 hidden xl:table-cell print:table-cell print:w-[10%] print:text-[8px] print:border print:border-gray-300 print:py-1">Data Rec.</TableHead>
                   <TableHead className="w-16 px-2 py-3 hidden xl:table-cell print:table-cell print:w-[12%] print:text-[8px] print:border print:border-gray-300 print:py-1">Furnizor</TableHead>
                   <TableHead className="w-16 px-2 py-3 hidden xl:table-cell print:table-cell print:w-[12%] print:text-[8px] print:border print:border-gray-300 print:py-1">Producător</TableHead>
                   <TableHead className="w-10 px-2 py-3 hidden md:table-cell print:table-cell print:w-[6%] print:text-[8px] print:border print:border-gray-300 print:py-1">% PT</TableHead>
                   <TableHead className="w-16 px-2 py-3 hidden lg:table-cell print:table-cell print:w-auto print:text-[8px] print:border print:border-gray-300 print:py-1">Obs</TableHead>
                   <TableHead className="w-12 px-2 py-3 hidden md:table-cell print:table-cell print:w-auto print:text-[8px] print:border print:border-gray-300 print:py-1">% marf. nec.</TableHead>
                   <TableHead className="w-12 px-2 py-3 text-right print:table-cell print:w-auto print:text-[8px] print:border print:border-gray-300 print:py-1">C. Cons.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStockSnapshots.map((item) => {
                  const q = qualityMap[item.id];
                  const base = (item.net_quantity || item.quantity) as number;
                  const pt = item.products?.pt_percent ?? 0;
                  const nonconf = q?.nonconform_percent ?? 0;
                  const consider = q?.consider_quantity != null
                    ? Number(q.consider_quantity)
                    : base * (1 - nonconf / 100) * (1 - pt / 100);
                  return (
                    <TableRow key={item.id} className="print:break-inside-avoid">
                       <TableCell className="px-2 py-3 font-medium text-xs print:table-cell print:text-[8px] print:border print:border-gray-300 print:py-1">{item.entry_number || '-'}</TableCell>
                       <TableCell className="px-2 py-3 font-medium text-xs print:table-cell print:text-[8px] print:border print:border-gray-300 print:py-1" title={item.name}>{item.name}</TableCell>
                       <TableCell className="px-2 py-3 text-xs hidden md:table-cell print:table-cell print:text-[8px] print:border print:border-gray-300 print:py-1">{item.products?.cod_produs || '-'}</TableCell>
                       <TableCell className="px-2 py-3 text-xs hidden lg:table-cell print:table-cell print:text-[8px] print:border print:border-gray-300 print:py-1">{item.lot_number || '-'}</TableCell>
                       <TableCell className="px-2 py-3 text-right text-xs print:table-cell print:text-[8px] print:border print:border-gray-300 print:py-1">
                         {item.quantity.toFixed(2)}
                       </TableCell>
                       <TableCell className="px-2 py-3 text-xs hidden md:table-cell print:table-cell print:text-[8px] print:border print:border-gray-300 print:py-1">{item.unit}</TableCell>
                      <TableCell className="px-2 py-3 text-xs hidden lg:table-cell print:table-cell print:text-[8px] print:border print:border-gray-300 print:py-1">{item.document_number || '-'}</TableCell>
                      <TableCell className="px-2 py-3 text-xs hidden xl:table-cell print:table-cell print:text-[8px] print:border print:border-gray-300 print:py-1">
                        {item.receipt_date ? new Date(item.receipt_date).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit' }) : '-'}
                      </TableCell>
                      <TableCell className="px-2 py-3 text-xs hidden xl:table-cell print:table-cell print:text-[8px] print:border print:border-gray-300 print:py-1">{item.suppliers?.name || '-'}</TableCell>
                      <TableCell className="px-2 py-3 text-xs hidden xl:table-cell print:table-cell print:text-[8px] print:border print:border-gray-300 print:py-1">{item.manufacturers?.name || '-'}</TableCell>
                      <TableCell className="px-2 py-3 text-xs hidden md:table-cell print:table-cell print:text-[8px] print:border print:border-gray-300 print:py-1">{item.products?.pt_percent != null ? `${item.products.pt_percent}%` : '-'}</TableCell>
                      <TableCell className="px-2 py-3 text-xs hidden lg:table-cell print:table-cell print:text-[8px] print:border print:border-gray-300 print:py-1 whitespace-normal break-words min-h-[2.5rem]" title={q?.obs ?? '-'}>
                        <div className="max-w-[150px] whitespace-normal break-words">{q?.obs ?? '-'}</div>
                      </TableCell>
                      <TableCell className="px-2 py-3 text-xs hidden md:table-cell print:table-cell print:text-[8px] print:border print:border-gray-300 print:py-1">{q?.nonconform_percent != null ? `${q.nonconform_percent}%` : '-'}</TableCell>
                      <TableCell className="px-2 py-3 text-right text-xs print:table-cell print:text-[8px] print:border print:border-gray-300 print:py-1">{Number(consider).toFixed(2)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </div>
  );
};