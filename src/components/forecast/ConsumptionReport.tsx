import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-custom-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Loader2, FileDown, Search } from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ro } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";

interface ConsumptionReportProps {
  inventoryType: "materii-prime" | "ambalaje" | "etichete";
}

interface ConsumptionData {
  product_id: string;
  product_name: string;
  product_code: string | null;
  unit: string;
  total_consumed: number;
  min_daily: number;
  avg_daily: number;
  max_daily: number;
  days_count: number;
}

const ConsumptionReport: React.FC<ConsumptionReportProps> = ({ inventoryType }) => {
  const [fromDate, setFromDate] = useState<Date>(subDays(new Date(), 30));
  const [toDate, setToDate] = useState<Date>(new Date());
  const [data, setData] = useState<ConsumptionData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const getTableNames = () => {
    switch (inventoryType) {
      case "ambalaje":
        return { 
          products: "ambalaje_products" as const, 
          transfers: "ambalaje_stock_transfer_items" as const,
          transfersMain: "ambalaje_stock_transfers" as const,
          inventory: "ambalaje_inventory" as const
        };
      case "etichete":
        return { 
          products: "etichete_products" as const, 
          transfers: "etichete_stock_transfer_items" as const,
          transfersMain: "etichete_stock_transfers" as const,
          inventory: "etichete_inventory" as const
        };
      default:
        return { 
          products: "products" as const, 
          transfers: "stock_transfer_items" as const,
          transfersMain: "stock_transfers" as const,
          inventory: "inventory" as const
        };
    }
  };

  const fetchReport = async () => {
    setLoading(true);
    try {
      const tables = getTableNames();

      // Fetch all products
      const { data: productsData, error: productsError } = await supabase
        .from(tables.products)
        .select("id, name, cod_produs, default_unit");

      if (productsError) throw productsError;

      // Fetch transfers in date range
      // NOTE: tables are not consistent: etichete_stock_transfers.transfer_date is timestamptz,
      // while stock_transfers/ambalaje_stock_transfers.transfer_date are date.
      // If we send only YYYY-MM-DD for timestamptz, Postgres interprets it as midnight and
      // we lose the rest of the end day.
      const tz = "Europe/Bucharest";
      const from = startOfDay(fromDate);
      const to = endOfDay(toDate);
      const isTimestampRange = inventoryType === "etichete";
      const fromStr = isTimestampRange
        ? formatInTimeZone(from, tz, "yyyy-MM-dd'T'HH:mm:ssXXX")
        : format(from, "yyyy-MM-dd");
      const toStr = isTimestampRange
        ? formatInTimeZone(to, tz, "yyyy-MM-dd'T'HH:mm:ssXXX")
        : format(to, "yyyy-MM-dd");

      // Fetch ALL transfers in date range using pagination (Supabase default limit is 1000)
      let allTransfersMain: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        const { data: pageData, error: pageError } = await supabase
          .from(tables.transfersMain)
          .select("id, transfer_date, destination")
          .gte("transfer_date", fromStr)
          .lte("transfer_date", toStr)
          .range(page * pageSize, (page + 1) * pageSize - 1);
        
        if (pageError) throw pageError;
        
        if (pageData && pageData.length > 0) {
          allTransfersMain = [...allTransfersMain, ...pageData];
          hasMore = pageData.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }
      
      console.log(`[ConsumptionReport] Fetched ${allTransfersMain.length} total transfers`);

      // Filter production transfers
      const productionTransfers = allTransfersMain.filter(t => {
        const dest = t.destination?.toLowerCase() || "";
        return dest.includes("produc") || dest.includes("producție") || dest.includes("productie");
      });
      
      console.log(`[ConsumptionReport] Found ${productionTransfers.length} production transfers`);

      if (productionTransfers.length === 0) {
        setData([]);
        setLoading(false);
        return;
      }

      const productionTransferIds = productionTransfers.map(t => t.id);

      // Fetch transfer items in batches to avoid URL length limits
      const batchSize = 50;
      let allTransferItems: any[] = [];
      
      for (let i = 0; i < productionTransferIds.length; i += batchSize) {
        const batch = productionTransferIds.slice(i, i + batchSize);
        const { data: batchData, error: batchError } = await supabase
          .from(tables.transfers)
          .select("quantity, inventory_item_id, transfer_id")
          .in("transfer_id", batch);
        
        if (batchError) throw batchError;
        if (batchData) allTransferItems = [...allTransferItems, ...batchData];
      }

      // Get inventory items to map to products - also in batches
      const inventoryItemIds = [...new Set(allTransferItems.map(t => t.inventory_item_id))];
      
      // Map inventory_item_id -> product_id
      let inventoryToProductMap = new Map<string, string>();
      if (inventoryItemIds.length > 0) {
        for (let i = 0; i < inventoryItemIds.length; i += batchSize) {
          const batch = inventoryItemIds.slice(i, i + batchSize);
          const { data: invData } = await supabase
            .from(tables.inventory)
            .select("id, product_id")
            .in("id", batch);
          
          (invData || []).forEach((item: any) => {
            if (item.product_id) {
              inventoryToProductMap.set(item.id, item.product_id);
            }
          });
        }
      }
      
      // Build a set of valid product IDs for quick lookup
      const validProductIds = new Set((productsData || []).map((p: any) => p.id));

      // Create a map of transfer dates
      const transferDateMap = new Map<string, string>();
      productionTransfers.forEach(t => {
        transferDateMap.set(t.id, t.transfer_date);
      });

      // Group transfers by product and date
      const productDailyConsumption = new Map<string, Map<string, number>>();
      
      allTransferItems.forEach(transfer => {
        const productId = inventoryToProductMap.get(transfer.inventory_item_id);
        // Skip if no product mapping or product not in our valid products list
        if (!productId || !validProductIds.has(productId)) return;

        const transferDate = transferDateMap.get(transfer.transfer_id);
        if (!transferDate) return;

        const date = format(new Date(transferDate), "yyyy-MM-dd");
        
        if (!productDailyConsumption.has(productId)) {
          productDailyConsumption.set(productId, new Map());
        }
        
        const dailyMap = productDailyConsumption.get(productId)!;
        dailyMap.set(date, (dailyMap.get(date) || 0) + transfer.quantity);
      });

      // Calculate stats for each product
      const consumptionData: ConsumptionData[] = (productsData || []).map((product: any) => {
        const dailyMap = productDailyConsumption.get(product.id);
        
        if (!dailyMap || dailyMap.size === 0) {
          return {
            product_id: product.id,
            product_name: product.name,
            product_code: product.cod_produs,
            unit: product.default_unit,
            total_consumed: 0,
            min_daily: 0,
            avg_daily: 0,
            max_daily: 0,
            days_count: 0
          };
        }

        const dailyValues = Array.from(dailyMap.values());
        const total = dailyValues.reduce((a, b) => a + b, 0);
        
        return {
          product_id: product.id,
          product_name: product.name,
          product_code: product.cod_produs,
          unit: product.default_unit,
          total_consumed: total,
          min_daily: Math.min(...dailyValues),
          avg_daily: total / dailyMap.size,
          max_daily: Math.max(...dailyValues),
          days_count: dailyMap.size
        };
      });

      setData(consumptionData.filter(d => d.total_consumed > 0));
    } catch (error) {
      console.error("Error fetching consumption report:", error);
      toast({ title: "Eroare la generarea raportului", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [inventoryType]);

  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    const lower = searchTerm.toLowerCase();
    return data.filter(item => 
      item.product_name.toLowerCase().includes(lower) ||
      (item.product_code?.toLowerCase().includes(lower))
    );
  }, [data, searchTerm]);

  const exportToExcel = () => {
    const exportData = filteredData.map(d => ({
      "Cod Produs": d.product_code || "-",
      "Nume Produs": d.product_name,
      "Unitate": d.unit,
      "Total Consumat": d.total_consumed,
      "Minim/Zi": d.min_daily,
      "Medie/Zi": Math.round(d.avg_daily * 100) / 100,
      "Maxim/Zi": d.max_daily,
      "Zile Active": d.days_count
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Raport Consum");
    
    const typeLabel = inventoryType === "materii-prime" ? "MateriPrime" 
      : inventoryType === "ambalaje" ? "Ambalaje" : "Etichete";
    XLSX.writeFile(wb, `RaportConsum_${typeLabel}_${format(fromDate, "yyyyMMdd")}_${format(toDate, "yyyyMMdd")}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 items-end">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Caută produs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">De la</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[200px] justify-start text-left font-normal")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(fromDate, "dd MMM yyyy", { locale: ro })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={fromDate}
                onSelect={(date) => date && setFromDate(date)}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Până la</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[200px] justify-start text-left font-normal")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(toDate, "dd MMM yyyy", { locale: ro })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={toDate}
                onSelect={(date) => date && setToDate(date)}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        <Button onClick={fetchReport} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Generează Raport
        </Button>

        <Button variant="outline" onClick={exportToExcel} disabled={data.length === 0}>
          <FileDown className="h-4 w-4 mr-2" />
          Export Excel
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredData.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {searchTerm ? "Nu s-au găsit produse pentru căutarea efectuată." : "Nu există date de consum pentru perioada selectată."}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cod Produs</TableHead>
                <TableHead>Nume Produs</TableHead>
                <TableHead>Unitate</TableHead>
                <TableHead className="text-right">Total Consumat</TableHead>
                <TableHead className="text-right">Minim/Zi</TableHead>
                <TableHead className="text-right">Medie/Zi</TableHead>
                <TableHead className="text-right">Maxim/Zi</TableHead>
                <TableHead className="text-right">Zile Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map(item => (
                <TableRow key={item.product_id}>
                  <TableCell className="font-mono text-sm">{item.product_code || "-"}</TableCell>
                  <TableCell className="font-medium">{item.product_name}</TableCell>
                  <TableCell>{item.unit}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {item.total_consumed.toLocaleString("ro-RO", { maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.min_daily.toLocaleString("ro-RO", { maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right text-primary font-medium">
                    {item.avg_daily.toLocaleString("ro-RO", { maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.max_daily.toLocaleString("ro-RO", { maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right">{item.days_count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default ConsumptionReport;
