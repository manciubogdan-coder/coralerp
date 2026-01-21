import React, { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useInventoryType } from "@/context/inventory-type";
import ProductionStockTable from "./ProductionStockTable";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-custom-toast";
import { exportToExcel } from "@/lib/excelExport";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ro } from "date-fns/locale";
import { CalendarIcon, Download } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ProductionStockItem {
  id: string;
  inventory_item_id: string | null;
  transfer_id: string | null;
  product_id: string | null;
  supplier_id: string | null;
  manufacturer_id: string | null;
  name: string;
  quantity: number;
  unit: string;
  lot_number: string | null;
  document_number: string | null;
  transfer_date: string;
  created_at: string;
  updated_at: string;
  products?: { name: string; cod_produs?: string } | null;
  suppliers?: { name: string } | null;
  manufacturers?: { name: string } | null;
}

const ProductionStockManagement = () => {
  const { inventoryType } = useInventoryType();
  const [stock, setStock] = useState<ProductionStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const fetchStock = async () => {
    try {
      setLoading(true);
      const tableName = inventoryType === 'ambalaje' 
        ? 'ambalaje_production_stock' 
        : 'production_stock';

      let query = supabase
        .from(tableName)
        .select(`
          *,
          products:product_id (name, cod_produs),
          suppliers:supplier_id (name),
          manufacturers:manufacturer_id (name)
        `)
        .gt('quantity', 0)
        .order('transfer_date', { ascending: false });

      if (dateRange.from) {
        query = query.gte('transfer_date', format(dateRange.from, 'yyyy-MM-dd'));
      }
      if (dateRange.to) {
        query = query.lte('transfer_date', format(dateRange.to, 'yyyy-MM-dd'));
      }

      const { data, error } = await query;

      if (error) throw error;
      setStock(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Eroare la încărcarea stocului producție",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStock();
  }, [inventoryType, refreshKey, dateRange]);

  const handleDataChange = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleExportStock = () => {
    if (stock.length === 0) {
      toast({
        variant: "destructive",
        title: "Nu există date",
        description: "Nu există articole în stoc pentru export.",
      });
      return;
    }

    const exportData = stock.map(item => ({
      'Produs': item.products?.name || item.name,
      'Cod Produs': item.products?.cod_produs || '-',
      'Lot': item.lot_number || '-',
      'Furnizor': item.suppliers?.name || '-',
      'Producător': item.manufacturers?.name || '-',
      'Cantitate': item.quantity,
      'Unitate': item.unit,
      'Data Transfer': format(new Date(item.transfer_date), 'dd.MM.yyyy'),
      'Nr. Document': item.document_number || '-',
    }));

    const dateStr = dateRange.from && dateRange.to
      ? `${format(dateRange.from, 'dd.MM.yyyy')}-${format(dateRange.to, 'dd.MM.yyyy')}`
      : format(new Date(), 'dd.MM.yyyy');

    exportToExcel(exportData, `stoc_productie_${inventoryType}_${dateStr}.xlsx`, {
      reportTitle: `Stoc Producție ${inventoryType === 'ambalaje' ? 'Ambalaje' : 'Materii Prime'}`,
      date: new Date().toISOString(),
      filters: dateRange.from && dateRange.to
        ? `Perioada: ${format(dateRange.from, 'dd.MM.yyyy')} - ${format(dateRange.to, 'dd.MM.yyyy')}`
        : undefined,
    });

    toast({
      title: "Export realizat",
      description: "Fișierul Excel a fost descărcat.",
    });
  };

  const formatDateRange = () => {
    if (dateRange.from && dateRange.to) {
      return `${format(dateRange.from, 'dd MMM yyyy', { locale: ro })} - ${format(dateRange.to, 'dd MMM yyyy', { locale: ro })}`;
    }
    if (dateRange.from) {
      return format(dateRange.from, 'dd MMM yyyy', { locale: ro });
    }
    return 'Selectați perioada';
  };

  const title = inventoryType === 'ambalaje' 
    ? 'Stoc Producție Ambalaje' 
    : 'Stoc Producție Materii Prime';

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">
          Gestionați stocul din producție - consum, modificare, returnare în depozit
        </p>
      </div>

      <Tabs defaultValue="stock" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="stock">Stoc Curent</TabsTrigger>
          <TabsTrigger value="history">Istoric Operații</TabsTrigger>
        </TabsList>

        <TabsContent value="stock">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal w-full sm:w-auto",
                    !dateRange.from && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formatDateRange()}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange.from}
                  selected={{ from: dateRange.from, to: dateRange.to }}
                  onSelect={(range) => {
                    setDateRange({ from: range?.from, to: range?.to });
                    if (range?.from && range?.to) {
                      setIsCalendarOpen(false);
                    }
                  }}
                  numberOfMonths={2}
                  locale={ro}
                />
              </PopoverContent>
            </Popover>

            <Button onClick={handleExportStock} variant="outline" className="w-full sm:w-auto">
              <Download className="mr-2 h-4 w-4" />
              Export Excel
            </Button>
          </div>

          <ProductionStockTable 
            stock={stock}
            loading={loading}
            onDataChange={handleDataChange}
          />
        </TabsContent>

        <TabsContent value="history">
          <ProductionStockHistory dateRange={dateRange} setDateRange={setDateRange} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Componenta pentru istoric
interface ProductionStockHistoryProps {
  dateRange: { from: Date | undefined; to: Date | undefined };
  setDateRange: (range: { from: Date | undefined; to: Date | undefined }) => void;
}

const ProductionStockHistory = ({ dateRange, setDateRange }: ProductionStockHistoryProps) => {
  const { inventoryType } = useInventoryType();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const tableName = inventoryType === 'ambalaje'
          ? 'ambalaje_production_stock_history'
          : 'production_stock_history';

        let query = supabase
          .from(tableName)
          .select('*')
          .order('created_at', { ascending: false });

        if (dateRange.from) {
          query = query.gte('created_at', format(dateRange.from, 'yyyy-MM-dd'));
        }
        if (dateRange.to) {
          const nextDay = new Date(dateRange.to);
          nextDay.setDate(nextDay.getDate() + 1);
          query = query.lt('created_at', format(nextDay, 'yyyy-MM-dd'));
        }

        const { data, error } = await query;

        if (error) throw error;
        setHistory(data || []);
      } catch (error: any) {
        console.error('Error fetching history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [inventoryType, dateRange]);

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'consumption': return 'Consum';
      case 'return': return 'Returnare depozit';
      case 'modify': return 'Modificare';
      case 'delete': return 'Ștergere';
      default: return action;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'consumption': return 'text-orange-600';
      case 'return': return 'text-blue-600';
      case 'modify': return 'text-yellow-600';
      case 'delete': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const handleExportHistory = () => {
    if (history.length === 0) {
      toast({
        variant: "destructive",
        title: "Nu există date",
        description: "Nu există operații în istoric pentru export.",
      });
      return;
    }

    const exportData = history.map(item => ({
      'Data': format(new Date(item.created_at), 'dd.MM.yyyy HH:mm'),
      'Acțiune': getActionLabel(item.action),
      'Cantitate': item.quantity,
      'Cantitate Anterioară': item.previous_quantity || '-',
      'Note': item.notes || '-',
    }));

    const dateStr = dateRange.from && dateRange.to
      ? `${format(dateRange.from, 'dd.MM.yyyy')}-${format(dateRange.to, 'dd.MM.yyyy')}`
      : format(new Date(), 'dd.MM.yyyy');

    exportToExcel(exportData, `istoric_productie_${inventoryType}_${dateStr}.xlsx`, {
      reportTitle: `Istoric Operații Producție ${inventoryType === 'ambalaje' ? 'Ambalaje' : 'Materii Prime'}`,
      date: new Date().toISOString(),
      filters: dateRange.from && dateRange.to
        ? `Perioada: ${format(dateRange.from, 'dd.MM.yyyy')} - ${format(dateRange.to, 'dd.MM.yyyy')}`
        : undefined,
    });

    toast({
      title: "Export realizat",
      description: "Fișierul Excel a fost descărcat.",
    });
  };

  const formatDateRange = () => {
    if (dateRange.from && dateRange.to) {
      return `${format(dateRange.from, 'dd MMM yyyy', { locale: ro })} - ${format(dateRange.to, 'dd MMM yyyy', { locale: ro })}`;
    }
    if (dateRange.from) {
      return format(dateRange.from, 'dd MMM yyyy', { locale: ro });
    }
    return 'Selectați perioada';
  };

  if (loading) {
    return <div className="text-center py-8">Se încarcă istoricul...</div>;
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "justify-start text-left font-normal w-full sm:w-auto",
                !dateRange.from && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {formatDateRange()}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange.from}
              selected={{ from: dateRange.from, to: dateRange.to }}
              onSelect={(range) => {
                setDateRange({ from: range?.from, to: range?.to });
                if (range?.from && range?.to) {
                  setIsCalendarOpen(false);
                }
              }}
              numberOfMonths={2}
              locale={ro}
            />
          </PopoverContent>
        </Popover>

        <Button onClick={handleExportHistory} variant="outline" className="w-full sm:w-auto">
          <Download className="mr-2 h-4 w-4" />
          Export Excel
        </Button>
      </div>

      {history.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">Nu există operații în istoric pentru perioada selectată.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Data</th>
                <th className="text-left p-2">Acțiune</th>
                <th className="text-right p-2">Cantitate</th>
                <th className="text-right p-2">Cant. Anterioară</th>
                <th className="text-left p-2">Note</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id} className="border-b hover:bg-muted/50">
                  <td className="p-2">
                    {new Date(item.created_at).toLocaleString('ro-RO')}
                  </td>
                  <td className={`p-2 font-medium ${getActionColor(item.action)}`}>
                    {getActionLabel(item.action)}
                  </td>
                  <td className="p-2 text-right">{item.quantity}</td>
                  <td className="p-2 text-right">{item.previous_quantity || '-'}</td>
                  <td className="p-2">{item.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ProductionStockManagement;
