import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-custom-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileDown, TrendingDown, TrendingUp, Minus, Search } from "lucide-react";
import { format, addDays, startOfDay, endOfDay } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import * as XLSX from "xlsx";

interface StockSufficiencyProps {
  inventoryType: "materii-prime" | "ambalaje" | "etichete";
}

interface SufficiencyItem {
  product_id: string;
  product_name: string;
  product_code: string | null;
  unit: string;
  current_stock: number;
  avg_daily_consumption: number;
  days_remaining: number;
  status: "critical" | "low" | "medium" | "good" | "excellent";
}

type PeriodType = "week" | "month" | "quarter" | "year";

const StockSufficiency: React.FC<StockSufficiencyProps> = ({ inventoryType }) => {
  const [period, setPeriod] = useState<PeriodType>("month");
  const [data, setData] = useState<SufficiencyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const chunk = <T,>(arr: T[], size: number) => {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };

  const getPeriodDays = (p: PeriodType) => {
    switch (p) {
      case "week": return 7;
      case "month": return 30;
      case "quarter": return 90;
      case "year": return 365;
    }
  };

  const getTableNames = () => {
    switch (inventoryType) {
      case "ambalaje":
        return { 
          products: "ambalaje_products" as const, 
          inventory: "ambalaje_inventory" as const,
          transfers: "ambalaje_stock_transfer_items" as const,
          transfersMain: "ambalaje_stock_transfers" as const
        };
      case "etichete":
        return { 
          products: "etichete_products" as const, 
          inventory: "etichete_inventory" as const,
          transfers: "etichete_stock_transfer_items" as const,
          transfersMain: "etichete_stock_transfers" as const
        };
      default:
        return { 
          products: "products" as const, 
          inventory: "inventory" as const,
          transfers: "stock_transfer_items" as const,
          transfersMain: "stock_transfers" as const
        };
    }
  };

  useEffect(() => {
    fetchSufficiency();
  }, [inventoryType, period]);

  const fetchSufficiency = async () => {
    setLoading(true);
    try {
      const tables = getTableNames();
      const periodDays = getPeriodDays(period);
      const isTimestampRange = inventoryType === "etichete";
      const tz = "Europe/Bucharest";
      
      const fromDate = addDays(new Date(), -periodDays);
      const toDate = new Date();
      
      const startDateStr = isTimestampRange
        ? formatInTimeZone(startOfDay(fromDate), tz, "yyyy-MM-dd'T'HH:mm:ssXXX")
        : format(fromDate, "yyyy-MM-dd");
      const endDateStr = isTimestampRange
        ? formatInTimeZone(endOfDay(toDate), tz, "yyyy-MM-dd'T'HH:mm:ssXXX")
        : format(toDate, "yyyy-MM-dd");

      const { data: productsData } = await supabase
        .from(tables.products)
        .select("id, name, cod_produs, default_unit");

      // Current stock
      const { data: inventoryData } = await supabase
        .from(tables.inventory)
        .select("product_id, quantity")
        .gt("quantity", 0);

      // Fetch ALL transfers with pagination
      let allTransfersMain: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        const { data: pageData, error: pageError } = await supabase
          .from(tables.transfersMain)
          .select("id, destination, transfer_date")
          .gte("transfer_date", startDateStr)
          .lte("transfer_date", endDateStr)
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

      const productionTransferIds = allTransfersMain
        .filter(t => {
          const dest = (t.destination || "").toLowerCase();
          return dest.includes("produc") || dest.includes("producție") || dest.includes("productie");
        })
        .map(t => t.id);


      // Fetch transfer items in batches (avoid URL length limits)
      const batchSize = 50;
      let allTransferItems: Array<{ quantity: number; inventory_item_id: string }> = [];
      if (productionTransferIds.length > 0) {
        for (const batch of chunk(productionTransferIds, batchSize)) {
          let offset = 0;
          let hasMoreItems = true;
          while (hasMoreItems) {
            const { data: pageData, error: pageError } = await supabase
              .from(tables.transfers)
              .select("quantity, inventory_item_id")
              .in("transfer_id", batch)
              .order("created_at", { ascending: true })
              .range(offset, offset + pageSize - 1);

            if (pageError) throw pageError;
            if (pageData && pageData.length > 0) {
              allTransferItems = [...allTransferItems, ...(pageData as any[])];
              hasMoreItems = pageData.length === pageSize;
              offset += pageSize;
            } else {
              hasMoreItems = false;
            }
          }
        }
      }

      // Map inventory_item_id -> product_id in batches
      const inventoryItemIds = [...new Set(allTransferItems.map(t => t.inventory_item_id))];
      const inventoryProductMap = new Map<string, string>();
      for (const batch of chunk(inventoryItemIds, batchSize)) {
        const { data: invData, error: invError } = await supabase
          .from(tables.inventory)
          .select("id, product_id")
          .in("id", batch);
        if (invError) throw invError;
        (invData || []).forEach((row: any) => {
          if (row?.product_id) inventoryProductMap.set(row.id, row.product_id);
        });
      }

      // Aggregate consumption per product
      const productConsumption = new Map<string, number>();
      allTransferItems.forEach(t => {
        const productId = inventoryProductMap.get(t.inventory_item_id);
        if (!productId) return;
        productConsumption.set(productId, (productConsumption.get(productId) || 0) + t.quantity);
      });

      const stockByProduct = new Map<string, number>();
      (inventoryData || []).forEach((item: any) => {
        if (item.product_id) {
          stockByProduct.set(item.product_id, (stockByProduct.get(item.product_id) || 0) + item.quantity);
        }
      });

      const sufficiencyItems: SufficiencyItem[] = (productsData || []).map((product: any) => {
        const currentStock = stockByProduct.get(product.id) || 0;
        const totalConsumption = productConsumption.get(product.id) || 0;
        const avgDaily = totalConsumption / periodDays;
        const daysRemaining = avgDaily > 0 ? currentStock / avgDaily : currentStock > 0 ? Infinity : 0;

        let status: "critical" | "low" | "medium" | "good" | "excellent";
        if (daysRemaining <= 3) status = "critical";
        else if (daysRemaining <= 7) status = "low";
        else if (daysRemaining <= 14) status = "medium";
        else if (daysRemaining <= 30) status = "good";
        else status = "excellent";

        return {
          product_id: product.id,
          product_name: product.name,
          product_code: product.cod_produs,
          unit: product.default_unit,
          current_stock: currentStock,
          avg_daily_consumption: avgDaily,
          days_remaining: daysRemaining === Infinity ? 999 : daysRemaining,
          status
        };
      });

      // Sort by days remaining (ascending)
      sufficiencyItems.sort((a, b) => a.days_remaining - b.days_remaining);
      setData(sufficiencyItems);
    } catch (error) {
      console.error("Error fetching stock sufficiency:", error);
      toast({ title: "Eroare la calculul zilelor de stoc", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string, days: number) => {
    const displayDays = days >= 999 ? "∞" : Math.round(days);
    switch (status) {
      case "critical":
        return <Badge variant="destructive" className="w-20 justify-center">{displayDays} zile</Badge>;
      case "low":
        return <Badge className="bg-orange-500 hover:bg-orange-600 w-20 justify-center">{displayDays} zile</Badge>;
      case "medium":
        return <Badge className="bg-amber-500 hover:bg-amber-600 w-20 justify-center">{displayDays} zile</Badge>;
      case "good":
        return <Badge className="bg-green-500 hover:bg-green-600 w-20 justify-center">{displayDays} zile</Badge>;
      default:
        return <Badge className="bg-primary hover:bg-primary/90 w-20 justify-center">{displayDays} zile</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "critical":
      case "low":
        return <TrendingDown className="h-4 w-4 text-destructive" />;
      case "medium":
        return <Minus className="h-4 w-4 text-amber-500" />;
      default:
        return <TrendingUp className="h-4 w-4 text-green-500" />;
    }
  };

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
      "Stoc Curent": d.current_stock,
      "Consum Mediu/Zi": Math.round(d.avg_daily_consumption * 100) / 100,
      "Zile Rămase": d.days_remaining >= 999 ? "Infinit" : Math.round(d.days_remaining),
      "Status": d.status === "critical" ? "CRITIC" : d.status === "low" ? "SCĂZUT" : d.status === "medium" ? "MEDIU" : d.status === "good" ? "BUN" : "EXCELENT"
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Zile Stoc");
    
    const typeLabel = inventoryType === "materii-prime" ? "MateriPrime" 
      : inventoryType === "ambalaje" ? "Ambalaje" : "Etichete";
    XLSX.writeFile(wb, `ZileStoc_${typeLabel}_${format(new Date(), "yyyyMMdd")}.xlsx`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Caută produs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <span className="text-sm font-medium">Perioada de calcul medie:</span>
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodType)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Ultima Săptămână</SelectItem>
              <SelectItem value="month">Ultima Lună</SelectItem>
              <SelectItem value="quarter">Ultimul Trimestru</SelectItem>
              <SelectItem value="year">Ultimul An</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <Button variant="outline" onClick={exportToExcel}>
          <FileDown className="h-4 w-4 mr-2" />
          Export Excel
        </Button>
      </div>

      <div className="grid grid-cols-5 gap-4 mb-4">
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-destructive">
            {filteredData.filter(d => d.status === "critical").length}
          </div>
          <div className="text-sm text-destructive">Critice (&lt;3 zile)</div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-orange-600">
            {filteredData.filter(d => d.status === "low").length}
          </div>
          <div className="text-sm text-orange-700">Scăzute (3-7 zile)</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-amber-600">
            {filteredData.filter(d => d.status === "medium").length}
          </div>
          <div className="text-sm text-amber-700">Medii (7-14 zile)</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-600">
            {filteredData.filter(d => d.status === "good").length}
          </div>
          <div className="text-sm text-green-700">Bune (14-30 zile)</div>
        </div>
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-primary">
            {filteredData.filter(d => d.status === "excellent").length}
          </div>
          <div className="text-sm text-primary">Excelente (&gt;30 zile)</div>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Cod Produs</TableHead>
              <TableHead>Nume Produs</TableHead>
              <TableHead className="text-right">Stoc Curent</TableHead>
              <TableHead className="text-right">Consum Mediu/Zi</TableHead>
              <TableHead className="text-center">Zile Rămase</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.map(item => (
              <TableRow 
                key={item.product_id} 
                className={
                  item.status === "critical" ? "bg-destructive/5" : 
                  item.status === "low" ? "bg-orange-50" : ""
                }
              >
                <TableCell>{getStatusIcon(item.status)}</TableCell>
                <TableCell className="font-mono text-sm">{item.product_code || "-"}</TableCell>
                <TableCell className="font-medium">{item.product_name}</TableCell>
                <TableCell className="text-right">
                  {item.current_stock.toLocaleString("ro-RO", { maximumFractionDigits: 2 })} {item.unit}
                </TableCell>
                <TableCell className="text-right">
                  {item.avg_daily_consumption > 0 
                    ? item.avg_daily_consumption.toLocaleString("ro-RO", { maximumFractionDigits: 2 })
                    : "-"
                  } {item.avg_daily_consumption > 0 ? item.unit : ""}
                </TableCell>
                <TableCell className="text-center">
                  {getStatusBadge(item.status, item.days_remaining)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default StockSufficiency;
