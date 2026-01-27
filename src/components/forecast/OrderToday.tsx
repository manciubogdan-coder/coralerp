import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-custom-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, ShoppingCart } from "lucide-react";
import { format, addDays } from "date-fns";

interface OrderTodayProps {
  inventoryType: "materii-prime" | "ambalaje" | "etichete";
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
  urgency: "critical" | "high" | "medium" | "low";
}

const OrderToday: React.FC<OrderTodayProps> = ({ inventoryType }) => {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);

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
      const thirtyDaysAgo = format(addDays(new Date(), -30), "yyyy-MM-dd");
      
      // First get production transfers
      const { data: transfersMainData } = await supabase
        .from(tables.transfersMain)
        .select("id, destination")
        .gte("transfer_date", thirtyDaysAgo);

      const productionTransferIds = (transfersMainData || [])
        .filter(t => {
          const dest = (t.destination || "").toLowerCase();
          return dest.includes("produc");
        })
        .map(t => t.id);

      let productConsumption = new Map<string, number>();
      
      if (productionTransferIds.length > 0) {
        const { data: transferItemsData } = await supabase
          .from(tables.transfers)
          .select("quantity, inventory_item_id")
          .in("transfer_id", productionTransferIds);

        // Get inventory items mapping
        const inventoryItemIds = [...new Set((transferItemsData || []).map(t => t.inventory_item_id))];
        let inventoryProductMap = new Map<string, string>();
        
        if (inventoryItemIds.length > 0) {
          const { data: invData } = await supabase
            .from(tables.inventory)
            .select("id, product_id")
            .in("id", inventoryItemIds);
          
          (invData || []).forEach((item: any) => {
            if (item.product_id) inventoryProductMap.set(item.id, item.product_id);
          });
        }

        (transferItemsData || []).forEach(t => {
          const productId = inventoryProductMap.get(t.inventory_item_id);
          if (productId) {
            productConsumption.set(productId, (productConsumption.get(productId) || 0) + t.quantity);
          }
        });
      }

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
          const neededQty = (leadTime + 7) * avgDaily - currentStock; // Order for lead time + 1 week buffer
          const suggestedQty = Math.max(neededQty, settings.min_order_quantity);

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
        <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">Nu există comenzi necesare azi</h3>
        <p className="text-muted-foreground">Toate produsele au stoc suficient pentru perioada de livrare.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-4 bg-amber-50 rounded-lg border border-amber-200">
        <AlertTriangle className="h-5 w-5 text-amber-600" />
        <span className="text-amber-800 font-medium">
          {orders.length} produse necesită comandă astăzi pentru a evita întreruperea stocului.
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
              <TableHead className="text-right">Cantitate Sugerată</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map(order => (
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
                <TableCell className="text-right font-bold text-primary">
                  {order.suggested_order_quantity.toLocaleString("ro-RO", { maximumFractionDigits: 0 })} {order.unit}
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
