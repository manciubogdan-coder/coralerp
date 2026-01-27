import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-custom-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, ShoppingCart } from "lucide-react";
import { format, addDays, startOfDay, endOfDay } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

interface OrderTodayProps {
  inventoryType: "materii-prime" | "ambalaje" | "etichete";
  searchTerm?: string;
}

interface OrderItem {
  product_id: string;
  product_name: string;
  product_code: string | null;
  unit: string;
  current_stock: number;
  avg_daily_consumption: number;
  lead_time_days: number;
  min_order_quantity: number;
  days_until_stockout: number;
  suggested_order_quantity: number;
  suggested_7_days: number;
  urgency: "critical" | "high" | "medium" | "low";
}

const OrderToday: React.FC<OrderTodayProps> = ({ inventoryType, searchTerm = "" }) => {
  const [orders, setOrders] = useState<OrderItem[]>([]);
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
    fetchForecast();
  }, [inventoryType]);

  const fetchForecast = async () => {
    setLoading(true);
    try {
      const tables = getTableNames();
      const isTimestampRange = inventoryType === "etichete";
      const tz = "Europe/Bucharest";

      // Fetch products with settings
      const { data: productsData } = await supabase
        .from(tables.products)
        .select("id, name, cod_produs, default_unit");

      const { data: settingsData } = await supabase
        .from(tables.settings)
        .select("*");

      // Fetch current stock
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

      // Fetch transfer items in batches (avoid URL length limits on huge IN lists)
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

      // Map inventory_item_id -> product_id in batches (same URL-length issue)
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

      // Calculate current stock per product
      const stockByProduct = new Map<string, number>();
      (inventoryData || []).forEach((item: any) => {
        if (item.product_id) {
          stockByProduct.set(item.product_id, (stockByProduct.get(item.product_id) || 0) + item.quantity);
        }
      });

      // Build settings map
      const settingsMap = new Map((settingsData || []).map((s: any) => [s.product_id, s]));

      // Calculate order needs
      const orderItems: OrderItem[] = [];

      (productsData || []).forEach((product: any) => {
        const settings = settingsMap.get(product.id) as any || { lead_time_days: 7, min_order_quantity: 100 };
        const currentStock = stockByProduct.get(product.id) || 0;
        const totalConsumption = productConsumption.get(product.id) || 0;
        const avgDaily = totalConsumption / 30;

        if (avgDaily === 0) return; // Skip products with no consumption

        const daysUntilStockout = avgDaily > 0 ? currentStock / avgDaily : Infinity;
        const leadTime = settings.lead_time_days;

        // Need to order if stockout happens before delivery arrives
        if (daysUntilStockout <= leadTime) {
          // Suggested quantity = enough to cover lead time (until order arrives)
          const neededForLeadTime = leadTime * avgDaily - currentStock;
          const suggestedQty = Math.max(Math.max(0, neededForLeadTime), settings.min_order_quantity);
          
          // Suggested quantity for 7 days of stock
          const suggested7Days = Math.max(0, 7 * avgDaily);

          let urgency: "critical" | "high" | "medium" | "low" = "low";
          if (daysUntilStockout <= 1) urgency = "critical";
          else if (daysUntilStockout <= 3) urgency = "high";
          else if (daysUntilStockout <= leadTime / 2) urgency = "medium";

          orderItems.push({
            product_id: product.id,
            product_name: product.name,
            product_code: product.cod_produs,
            unit: product.default_unit,
            current_stock: currentStock,
            avg_daily_consumption: avgDaily,
            lead_time_days: leadTime,
            min_order_quantity: settings.min_order_quantity,
            days_until_stockout: daysUntilStockout,
            suggested_order_quantity: suggestedQty,
            suggested_7_days: suggested7Days,
            urgency
          });
        }
      });

      // Sort by urgency
      orderItems.sort((a, b) => {
        const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      });

      setOrders(orderItems);
    } catch (error) {
      console.error("Error fetching forecast:", error);
      toast({ title: "Eroare la calculul forecast-ului", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case "critical":
        return <Badge variant="destructive">CRITIC</Badge>;
      case "high":
        return <Badge className="bg-orange-500 hover:bg-orange-600">URGENT</Badge>;
      case "medium":
        return <Badge className="bg-amber-500 hover:bg-amber-600">MEDIU</Badge>;
      default:
        return <Badge variant="secondary">SCĂZUT</Badge>;
    }
  };

  const filteredOrders = useMemo(() => {
    if (!searchTerm) return orders;
    const lower = searchTerm.toLowerCase();
    return orders.filter(order => 
      order.product_name.toLowerCase().includes(lower) ||
      (order.product_code?.toLowerCase().includes(lower))
    );
  }, [orders, searchTerm]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (filteredOrders.length === 0) {
    return (
      <div className="text-center py-12">
        <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">
          {searchTerm ? "Nu s-au găsit produse pentru căutare" : "Nu există comenzi necesare azi"}
        </h3>
        <p className="text-muted-foreground">
          {searchTerm ? "Încercați alt termen de căutare." : "Toate produsele au stoc suficient pentru perioada de livrare."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-4 bg-amber-50 rounded-lg border border-amber-200">
        <AlertTriangle className="h-5 w-5 text-amber-600" />
        <span className="text-amber-800 font-medium">
          {filteredOrders.length} produse necesită comandă astăzi pentru a evita întreruperea stocului.
        </span>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Urgență</TableHead>
              <TableHead>Cod</TableHead>
              <TableHead>Produs</TableHead>
              <TableHead className="text-right">Stoc Curent</TableHead>
              <TableHead className="text-right">Consum/Zi</TableHead>
              <TableHead className="text-right">Zile Rămase</TableHead>
              <TableHead className="text-right">Lead Time (zile)</TableHead>
              <TableHead className="text-right">Cant. Sugerată (Lead Time)</TableHead>
              <TableHead className="text-right">Cant. Sugerată (7 zile)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrders.map(order => (
              <TableRow key={order.product_id} className={order.urgency === "critical" ? "bg-red-50" : ""}>
                <TableCell>{getUrgencyBadge(order.urgency)}</TableCell>
                <TableCell className="font-mono text-sm">{order.product_code || "-"}</TableCell>
                <TableCell className="font-medium">{order.product_name}</TableCell>
                <TableCell className="text-right">
                  {order.current_stock.toLocaleString("ro-RO", { maximumFractionDigits: 2 })} {order.unit}
                </TableCell>
                <TableCell className="text-right">
                  {order.avg_daily_consumption.toLocaleString("ro-RO", { maximumFractionDigits: 2 })} {order.unit}
                </TableCell>
                <TableCell className="text-right font-medium">
                  <span className={order.days_until_stockout <= 1 ? "text-destructive" : order.days_until_stockout <= 3 ? "text-orange-600" : ""}>
                    {order.days_until_stockout.toFixed(1)} zile
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  {order.lead_time_days} zile
                </TableCell>
                <TableCell className="text-right font-bold text-primary">
                  {order.suggested_order_quantity.toLocaleString("ro-RO", { maximumFractionDigits: 0 })} {order.unit}
                </TableCell>
                <TableCell className="text-right font-medium text-muted-foreground">
                  {order.suggested_7_days.toLocaleString("ro-RO", { maximumFractionDigits: 0 })} {order.unit}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default OrderToday;
