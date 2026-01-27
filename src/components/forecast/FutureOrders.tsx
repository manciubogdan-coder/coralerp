import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-custom-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar } from "lucide-react";
import { format, addDays, startOfWeek, endOfWeek, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { ro } from "date-fns/locale";

interface FutureOrdersProps {
  inventoryType: "materii-prime" | "ambalaje" | "etichete";
}

interface FutureOrderItem {
  product_id: string;
  product_name: string;
  product_code: string | null;
  unit: string;
  order_by_date: Date;
  expected_stockout_date: Date;
  current_stock: number;
  avg_daily_consumption: number;
  suggested_order_quantity: number;
  is_this_week: boolean;
}

const FutureOrders: React.FC<FutureOrdersProps> = ({ inventoryType }) => {
  const [orders, setOrders] = useState<FutureOrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  const chunk = <T,>(arr: T[], size: number) => {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };

  const getTableNames = () => {
    switch (inventoryType) {
      case "ambalaje":
        return { 
          products: "ambalaje_products" as const, 
          settings: "ambalaje_product_order_settings" as const,
          inventory: "ambalaje_inventory" as const,
          transfers: "ambalaje_stock_transfer_items" as const,
          transfersMain: "ambalaje_stock_transfers" as const
        };
      case "etichete":
        return { 
          products: "etichete_products" as const, 
          settings: "etichete_product_order_settings" as const,
          inventory: "etichete_inventory" as const,
          transfers: "etichete_stock_transfer_items" as const,
          transfersMain: "etichete_stock_transfers" as const
        };
      default:
        return { 
          products: "products" as const, 
          settings: "product_order_settings" as const,
          inventory: "inventory" as const,
          transfers: "stock_transfer_items" as const,
          transfersMain: "stock_transfers" as const
        };
    }
  };

  useEffect(() => {
    fetchFutureOrders();
  }, [inventoryType]);

  const fetchFutureOrders = async () => {
    setLoading(true);
    try {
      const tables = getTableNames();
      const isTimestampRange = inventoryType === "etichete";
      const tz = "Europe/Bucharest";

      const { data: productsData } = await supabase
        .from(tables.products)
        .select("id, name, cod_produs, default_unit");

      const { data: settingsData } = await supabase
        .from(tables.settings)
        .select("*");

      const { data: inventoryData } = await supabase
        .from(tables.inventory)
        .select("product_id, quantity")
        .gt("quantity", 0);

      // Calculate average consumption from last 30 days
      const fromDate = addDays(new Date(), -30);
      const toDate = new Date();
      
      const fromStr = isTimestampRange
        ? formatInTimeZone(startOfDay(fromDate), tz, "yyyy-MM-dd'T'HH:mm:ssXXX")
        : format(fromDate, "yyyy-MM-dd");
      const toStr = isTimestampRange
        ? formatInTimeZone(endOfDay(toDate), tz, "yyyy-MM-dd'T'HH:mm:ssXXX")
        : format(toDate, "yyyy-MM-dd");
      
      // Fetch ALL transfers with pagination
      let allTransfersMain: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        const { data: pageData, error: pageError } = await supabase
          .from(tables.transfersMain)
          .select("id, destination, transfer_date")
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

      const settingsMap = new Map((settingsData || []).map((s: any) => [s.product_id, s]));

      const today = new Date();
      const weekStart = startOfWeek(today, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

      const futureItems: FutureOrderItem[] = [];

      (productsData || []).forEach((product: any) => {
        const settings = settingsMap.get(product.id) as any || { lead_time_days: 7, min_order_quantity: 100 };
        const currentStock = stockByProduct.get(product.id) || 0;
        const totalConsumption = productConsumption.get(product.id) || 0;
        const avgDaily = totalConsumption / 30;

        if (avgDaily === 0 || currentStock === 0) return;

        const daysUntilStockout = currentStock / avgDaily;
        const stockoutDate = addDays(today, daysUntilStockout);
        const orderByDate = addDays(stockoutDate, -settings.lead_time_days);

        // Only show orders needed within next 30 days, excluding today
        if (orderByDate > today && orderByDate <= addDays(today, 30)) {
          // Keep consistent with OrderToday: order for (lead time + 7 days buffer) minus current stock
          const neededQty = (settings.lead_time_days + 7) * avgDaily - currentStock;
          const suggestedQty = Math.max(Math.max(0, neededQty), settings.min_order_quantity);

          futureItems.push({
            product_id: product.id,
            product_name: product.name,
            product_code: product.cod_produs,
            unit: product.default_unit,
            order_by_date: orderByDate,
            expected_stockout_date: stockoutDate,
            current_stock: currentStock,
            avg_daily_consumption: avgDaily,
            suggested_order_quantity: suggestedQty,
            is_this_week: isWithinInterval(orderByDate, { start: weekStart, end: weekEnd })
          });
        }
      });

      futureItems.sort((a, b) => a.order_by_date.getTime() - b.order_by_date.getTime());
      setOrders(futureItems);
    } catch (error) {
      console.error("Error fetching future orders:", error);
      toast({ title: "Eroare la calculul comenzilor viitoare", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-12">
        <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">Nu există comenzi programate</h3>
        <p className="text-muted-foreground">Toate produsele au stoc suficient pentru următoarele 30 de zile.</p>
      </div>
    );
  }

  const thisWeekOrders = orders.filter(o => o.is_this_week);
  const laterOrders = orders.filter(o => !o.is_this_week);

  return (
    <div className="space-y-6">
      {thisWeekOrders.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Badge className="bg-primary hover:bg-primary/90">Săptămâna aceasta</Badge>
            {thisWeekOrders.length} produse
          </h3>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dată Comandă</TableHead>
                  <TableHead>Cod</TableHead>
                  <TableHead>Produs</TableHead>
                  <TableHead className="text-right">Stoc Curent</TableHead>
                  <TableHead className="text-right">Consum/Zi</TableHead>
                  <TableHead className="text-right">Dată Epuizare</TableHead>
                  <TableHead className="text-right">Cantitate Sugerată</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {thisWeekOrders.map(order => (
                  <TableRow key={order.product_id} className="bg-primary/5">
                    <TableCell className="font-medium">
                      {format(order.order_by_date, "EEEE, d MMM", { locale: ro })}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{order.product_code || "-"}</TableCell>
                    <TableCell className="font-medium">{order.product_name}</TableCell>
                    <TableCell className="text-right">
                      {order.current_stock.toLocaleString("ro-RO", { maximumFractionDigits: 2 })} {order.unit}
                    </TableCell>
                    <TableCell className="text-right">
                      {order.avg_daily_consumption.toLocaleString("ro-RO", { maximumFractionDigits: 2 })} {order.unit}
                    </TableCell>
                    <TableCell className="text-right text-orange-600">
                      {format(order.expected_stockout_date, "d MMM", { locale: ro })}
                    </TableCell>
                    <TableCell className="text-right font-bold text-primary">
                      {order.suggested_order_quantity.toLocaleString("ro-RO", { maximumFractionDigits: 0 })} {order.unit}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {laterOrders.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Badge variant="secondary">Săptămânile următoare</Badge>
            {laterOrders.length} produse
          </h3>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dată Comandă</TableHead>
                  <TableHead>Cod</TableHead>
                  <TableHead>Produs</TableHead>
                  <TableHead className="text-right">Stoc Curent</TableHead>
                  <TableHead className="text-right">Consum/Zi</TableHead>
                  <TableHead className="text-right">Dată Epuizare</TableHead>
                  <TableHead className="text-right">Cantitate Sugerată</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {laterOrders.map(order => (
                  <TableRow key={order.product_id}>
                    <TableCell className="font-medium">
                      {format(order.order_by_date, "EEEE, d MMM", { locale: ro })}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{order.product_code || "-"}</TableCell>
                    <TableCell className="font-medium">{order.product_name}</TableCell>
                    <TableCell className="text-right">
                      {order.current_stock.toLocaleString("ro-RO", { maximumFractionDigits: 2 })} {order.unit}
                    </TableCell>
                    <TableCell className="text-right">
                      {order.avg_daily_consumption.toLocaleString("ro-RO", { maximumFractionDigits: 2 })} {order.unit}
                    </TableCell>
                    <TableCell className="text-right">
                      {format(order.expected_stockout_date, "d MMM", { locale: ro })}
                    </TableCell>
                    <TableCell className="text-right font-bold text-primary">
                      {order.suggested_order_quantity.toLocaleString("ro-RO", { maximumFractionDigits: 0 })} {order.unit}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
};

export default FutureOrders;
