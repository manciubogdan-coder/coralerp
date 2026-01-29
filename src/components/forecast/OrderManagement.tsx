import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-custom-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, ShoppingCart, Check, AlertTriangle, CalendarIcon, Package, Truck, Plus, Trash2, FileSpreadsheet } from "lucide-react";
import { format, addDays, startOfDay, endOfDay } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { ro } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { exportToExcel } from "@/lib/excelExport";

interface OrderManagementProps {
  inventoryType: "materii-prime" | "ambalaje" | "etichete";
}

interface OrderItem {
  product_id: string;
  product_name: string;
  product_code: string | null;
  unit: string;
  supplier_id: string | null;
  supplier_name: string | null;
  current_stock: number;
  avg_daily_consumption: number;
  days_remaining: number;
  lead_time_days: number;
  suggested_quantity: number;
  order_id: string | null;
  order_status: "pending" | "ordered" | "delivered" | "cancelled" | null;
  order_quantity: number | null;
  expected_delivery_date: Date | null;
  days_with_order: number | null;
}

interface SupplierGroup {
  supplier_id: string | null;
  supplier_name: string;
  products: OrderItem[];
  total_products: number;
}

interface EditableOrderItem {
  product_id: string;
  product_name: string;
  product_code: string | null;
  unit: string;
  quantity: number;
  suggested_quantity: number;
}

interface AllProduct {
  id: string;
  name: string;
  cod_produs: string | null;
  default_unit: string;
}

interface SupplierOption {
  id: string;
  name: string;
}

const OrderManagement: React.FC<OrderManagementProps> = ({ inventoryType }) => {
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierGroup | null>(null);
  const [orderDate, setOrderDate] = useState<Date>(new Date());
  const [expectedDelivery, setExpectedDelivery] = useState<Date>(addDays(new Date(), 7));
  const [submitting, setSubmitting] = useState(false);
  const [editableItems, setEditableItems] = useState<EditableOrderItem[]>([]);
  const [allProducts, setAllProducts] = useState<AllProduct[]>([]);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [selectedProductToAdd, setSelectedProductToAdd] = useState<string>("");
  const [orderNotes, setOrderNotes] = useState("");
  const [allSuppliers, setAllSuppliers] = useState<SupplierOption[]>([]);
  const [editableSupplierId, setEditableSupplierId] = useState<string>("");
  const [isManualOrder, setIsManualOrder] = useState(false);

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
          transfersMain: "ambalaje_stock_transfers" as const,
          orders: "ambalaje_product_orders" as const,
          suppliers: "ambalaje_suppliers" as const
        };
      case "etichete":
        return { 
          products: "etichete_products" as const, 
          settings: "etichete_product_order_settings" as const,
          inventory: "etichete_inventory" as const,
          transfers: "etichete_stock_transfer_items" as const,
          transfersMain: "etichete_stock_transfers" as const,
          orders: "etichete_product_orders" as const,
          suppliers: "etichete_suppliers" as const
        };
      default:
        return { 
          products: "products" as const, 
          settings: "product_order_settings" as const,
          inventory: "inventory" as const,
          transfers: "stock_transfer_items" as const,
          transfersMain: "stock_transfers" as const,
          orders: "product_orders" as const,
          suppliers: "suppliers" as const
        };
    }
  };

  useEffect(() => {
    fetchData();
    fetchAllProducts();
    fetchAllSuppliers();
  }, [inventoryType]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const tables = getTableNames();
      const isTimestampRange = inventoryType === "etichete";
      const tz = "Europe/Bucharest";

      // Fetch products with default supplier
      const { data: productsData } = await supabase
        .from(tables.products)
        .select("id, name, cod_produs, default_unit, default_supplier_id");

      // Fetch suppliers
      const { data: suppliersData } = await supabase
        .from(tables.suppliers)
        .select("id, name");

      const supplierMap = new Map((suppliersData || []).map((s: any) => [s.id, s.name]));

      // Fetch settings
      const { data: settingsData } = await supabase
        .from(tables.settings)
        .select("*");

      // Fetch current inventory
      const { data: inventoryData } = await supabase
        .from(tables.inventory)
        .select("product_id, quantity, supplier_id")
        .gt("quantity", 0);

      // Fetch active orders (pending or ordered)
      const { data: ordersData } = await supabase
        .from(tables.orders)
        .select("*")
        .in("status", ["pending", "ordered"]);

      // Calculate average consumption (last 30 days)
      const fromDate = addDays(new Date(), -30);
      const toDate = new Date();
      
      const fromStr = isTimestampRange
        ? formatInTimeZone(startOfDay(fromDate), tz, "yyyy-MM-dd'T'HH:mm:ssXXX")
        : format(fromDate, "yyyy-MM-dd");
      const toStr = isTimestampRange
        ? formatInTimeZone(endOfDay(toDate), tz, "yyyy-MM-dd'T'HH:mm:ssXXX")
        : format(toDate, "yyyy-MM-dd");

      // Fetch transfers
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

      // Fetch transfer items in batches
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

      // Map inventory_item_id -> product_id
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

      // Build stock and supplier maps
      const stockByProduct = new Map<string, number>();
      const productSupplierMap = new Map<string, string>();
      (inventoryData || []).forEach((item: any) => {
        if (item.product_id) {
          stockByProduct.set(item.product_id, (stockByProduct.get(item.product_id) || 0) + item.quantity);
          if (item.supplier_id && !productSupplierMap.has(item.product_id)) {
            productSupplierMap.set(item.product_id, item.supplier_id);
          }
        }
      });

      const settingsMap = new Map((settingsData || []).map((s: any) => [s.product_id, s]));
      const ordersMap = new Map((ordersData || []).map((o: any) => [o.product_id, o]));

      const today = new Date();
      const orderItems: OrderItem[] = [];

      (productsData || []).forEach((product: any) => {
        const settings = settingsMap.get(product.id) as any || { lead_time_days: 7, min_order_quantity: 100 };
        const currentStock = stockByProduct.get(product.id) || 0;
        const totalConsumption = productConsumption.get(product.id) || 0;
        const avgDaily = totalConsumption / 30;

        if (avgDaily === 0 && currentStock === 0) return;

        const daysRemaining = avgDaily > 0 ? currentStock / avgDaily : currentStock > 0 ? 999 : 0;
        const needsOrder = daysRemaining <= settings.lead_time_days + 7;

        if (!needsOrder) return;

        const supplierId = product.default_supplier_id || productSupplierMap.get(product.id) || null;
        const supplierName = supplierId ? supplierMap.get(supplierId) || null : null;

        const existingOrder = ordersMap.get(product.id) as any;
        const suggestedQty = Math.max(
          Math.max(0, settings.lead_time_days * avgDaily - currentStock),
          settings.min_order_quantity
        );

        let daysWithOrder: number | null = null;
        if (existingOrder && existingOrder.expected_delivery_date) {
          const deliveryDate = new Date(existingOrder.expected_delivery_date);
          const daysUntilDelivery = Math.ceil((deliveryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          const stockAtDelivery = Math.max(0, currentStock - (avgDaily * daysUntilDelivery));
          daysWithOrder = avgDaily > 0 
            ? (stockAtDelivery + existingOrder.quantity_ordered) / avgDaily
            : 999;
        }

        orderItems.push({
          product_id: product.id,
          product_name: product.name,
          product_code: product.cod_produs,
          unit: product.default_unit,
          supplier_id: supplierId,
          supplier_name: supplierName,
          current_stock: currentStock,
          avg_daily_consumption: avgDaily,
          days_remaining: daysRemaining,
          lead_time_days: settings.lead_time_days,
          suggested_quantity: suggestedQty,
          order_id: existingOrder?.id || null,
          order_status: existingOrder?.status || null,
          order_quantity: existingOrder?.quantity_ordered || null,
          expected_delivery_date: existingOrder?.expected_delivery_date ? new Date(existingOrder.expected_delivery_date) : null,
          days_with_order: daysWithOrder
        });
      });

      orderItems.sort((a, b) => a.days_remaining - b.days_remaining);
      setItems(orderItems);
    } catch (error) {
      console.error("Error fetching order data:", error);
      toast({ title: "Eroare la încărcarea datelor", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = useMemo(() => {
    if (!searchTerm) return items;
    const lower = searchTerm.toLowerCase();
    return items.filter(item => 
      item.product_name.toLowerCase().includes(lower) ||
      (item.product_code?.toLowerCase().includes(lower)) ||
      (item.supplier_name?.toLowerCase().includes(lower))
    );
  }, [items, searchTerm]);

  const supplierGroups = useMemo(() => {
    const groups = new Map<string, SupplierGroup>();
    
    filteredItems.filter(item => !item.order_id).forEach(item => {
      const key = item.supplier_id || "no-supplier";
      if (!groups.has(key)) {
        groups.set(key, {
          supplier_id: item.supplier_id,
          supplier_name: item.supplier_name || "Fără furnizor",
          products: [],
          total_products: 0
        });
      }
      const group = groups.get(key)!;
      group.products.push(item);
      group.total_products++;
    });

    return Array.from(groups.values()).sort((a, b) => b.total_products - a.total_products);
  }, [filteredItems]);

  const handleCreateOrder = async (supplierGroup: SupplierGroup) => {
    setSelectedSupplier(supplierGroup);
    setEditableSupplierId(supplierGroup.supplier_id || "");
    setIsManualOrder(false);
    const maxLeadTime = Math.max(...supplierGroup.products.map(p => p.lead_time_days));
    setExpectedDelivery(addDays(new Date(), maxLeadTime));
    
    // Initialize editable items with suggested quantities
    const editItems: EditableOrderItem[] = supplierGroup.products.map(p => ({
      product_id: p.product_id,
      product_name: p.product_name,
      product_code: p.product_code,
      unit: p.unit,
      quantity: Math.round(p.suggested_quantity),
      suggested_quantity: p.suggested_quantity
    }));
    setEditableItems(editItems);
    setOrderNotes("");
    setShowAddProduct(false);
    setSelectedProductToAdd("");
    setShowOrderDialog(true);
  };

  const handleCreateManualOrder = () => {
    setSelectedSupplier(null);
    setEditableSupplierId("");
    setIsManualOrder(true);
    setExpectedDelivery(addDays(new Date(), 7));
    setEditableItems([]);
    setOrderNotes("");
    setShowAddProduct(true);
    setSelectedProductToAdd("");
    setShowOrderDialog(true);
  };

  const fetchAllProducts = async () => {
    try {
      const tables = getTableNames();
      const { data } = await supabase
        .from(tables.products)
        .select("id, name, cod_produs, default_unit")
        .order("name");
      
      setAllProducts((data || []) as AllProduct[]);
    } catch (error) {
      console.error("Error fetching all products:", error);
    }
  };

  const fetchAllSuppliers = async () => {
    try {
      const tables = getTableNames();
      const { data } = await supabase
        .from(tables.suppliers)
        .select("id, name")
        .order("name");
      
      setAllSuppliers((data || []) as SupplierOption[]);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
    }
  };

  const handleQuantityChange = (productId: string, newQty: number) => {
    setEditableItems(prev => prev.map(item => 
      item.product_id === productId ? { ...item, quantity: newQty } : item
    ));
  };

  const handleRemoveItem = (productId: string) => {
    setEditableItems(prev => prev.filter(item => item.product_id !== productId));
  };

  const handleAddProduct = () => {
    if (!selectedProductToAdd) return;
    
    const product = allProducts.find(p => p.id === selectedProductToAdd);
    if (!product) return;
    
    // Check if already in list
    if (editableItems.some(item => item.product_id === product.id)) {
      toast({ title: "Produsul este deja în listă", variant: "destructive" });
      return;
    }

    setEditableItems(prev => [...prev, {
      product_id: product.id,
      product_name: product.name,
      product_code: product.cod_produs,
      unit: product.default_unit,
      quantity: 100,
      suggested_quantity: 0
    }]);
    
    setSelectedProductToAdd("");
    setShowAddProduct(false);
  };

  const handleExportOrder = () => {
    if (editableItems.length === 0) {
      toast({ title: "Nu există produse de exportat", variant: "destructive" });
      return;
    }

    const exportData = editableItems.map(item => ({
      "Cod Produs": item.product_code || "-",
      "Produs": item.product_name,
      "Cantitate": item.quantity,
      "UM": item.unit,
      "Cantitate Sugerată": item.suggested_quantity
    }));

    const supplierName = selectedSupplier?.supplier_name || "Furnizor";
    const inventoryLabel = inventoryType === "materii-prime" ? "MP" 
      : inventoryType === "ambalaje" ? "AMB" : "ETI";

    exportToExcel(exportData, `Comanda_${supplierName.replace(/\s/g, "_")}_${inventoryLabel}_${format(new Date(), "yyyyMMdd")}.xlsx`, {
      reportTitle: `Comandă - ${supplierName}`,
      date: format(orderDate, "dd.MM.yyyy"),
      additionalInfo: `Livrare estimată: ${format(expectedDelivery, "dd.MM.yyyy")}`
    });

    toast({ title: "Export realizat cu succes" });
  };

  const submitOrder = async () => {
    if (editableItems.length === 0) return;
    
    // Use editable supplier if set, otherwise original supplier
    const finalSupplierId = editableSupplierId || selectedSupplier?.supplier_id || null;
    const finalSupplierName = editableSupplierId 
      ? allSuppliers.find(s => s.id === editableSupplierId)?.name || "Furnizor"
      : selectedSupplier?.supplier_name || "Furnizor";
    
    setSubmitting(true);
    try {
      const tables = getTableNames();
      
      const ordersToInsert = editableItems
        .filter(item => item.quantity > 0)
        .map(item => ({
          product_id: item.product_id,
          supplier_id: finalSupplierId,
          quantity_ordered: item.quantity,
          order_date: orderDate.toISOString(),
          expected_delivery_date: format(expectedDelivery, "yyyy-MM-dd"),
          status: "ordered" as const,
          notes: orderNotes || null
        }));

      const { error } = await supabase
        .from(tables.orders)
        .insert(ordersToInsert);

      if (error) throw error;

      toast({ title: `Comandă creată pentru ${finalSupplierName}`, description: `${ordersToInsert.length} produse adăugate` });
      setShowOrderDialog(false);
      fetchData();
    } catch (error) {
      console.error("Error creating order:", error);
      toast({ title: "Eroare la crearea comenzii", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkDelivered = async (orderId: string) => {
    try {
      const tables = getTableNames();
      const { error } = await supabase
        .from(tables.orders)
        .update({ status: "delivered" })
        .eq("id", orderId);

      if (error) throw error;
      toast({ title: "Comanda marcată ca livrată" });
      fetchData();
    } catch (error) {
      console.error("Error updating order:", error);
      toast({ title: "Eroare la actualizare", variant: "destructive" });
    }
  };

  const getStatusBadge = (item: OrderItem) => {
    if (item.order_status === "ordered") {
      return (
        <Badge className="bg-blue-500 hover:bg-blue-600">
          <Truck className="h-3 w-3 mr-1" />
          Comandată
        </Badge>
      );
    }
    if (item.days_remaining <= 3) {
      return (
        <Badge variant="destructive">
          <AlertTriangle className="h-3 w-3 mr-1" />
          CRITIC
        </Badge>
      );
    }
    if (item.days_remaining <= 7) {
      return (
        <Badge className="bg-orange-500 hover:bg-orange-600">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Urgent
        </Badge>
      );
    }
    return (
      <Badge variant="secondary">
        <Package className="h-3 w-3 mr-1" />
        De comandat
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const pendingItems = filteredItems.filter(i => !i.order_id);
  const orderedItems = filteredItems.filter(i => i.order_id);

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Caută produs sau furnizor..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Order Actions */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">Comenzi Rapide pe Furnizor</h3>
        <Button onClick={handleCreateManualOrder} variant="outline">
          <Plus className="h-4 w-4 mr-2" />
          Comandă Nouă
        </Button>
      </div>

      {/* Supplier Groups for Quick Order */}
      {supplierGroups.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {supplierGroups.map(group => (
            <div key={group.supplier_id || "no-supplier"} className="border rounded-lg p-4 flex items-center justify-between">
              <div>
                <div className="font-medium">{group.supplier_name}</div>
                <div className="text-sm text-muted-foreground">{group.total_products} produse de comandat</div>
              </div>
              <Button size="sm" onClick={() => handleCreateOrder(group)}>
                <ShoppingCart className="h-4 w-4 mr-1" />
                Comandă
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-destructive">
            {pendingItems.filter(i => i.days_remaining <= 3).length}
          </div>
          <div className="text-sm text-destructive">Critice (fără comandă)</div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-orange-600">
            {pendingItems.filter(i => i.days_remaining > 3 && i.days_remaining <= 7).length}
          </div>
          <div className="text-sm text-orange-700">Urgente (fără comandă)</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">
            {orderedItems.length}
          </div>
          <div className="text-sm text-blue-700">Comenzi în așteptare</div>
        </div>
      </div>

      {/* Items Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Cod</TableHead>
              <TableHead>Produs</TableHead>
              <TableHead>Furnizor</TableHead>
              <TableHead className="text-right">Stoc Curent</TableHead>
              <TableHead className="text-right">Zile Stoc</TableHead>
              <TableHead className="text-right">Cant. Sugerată</TableHead>
              <TableHead className="text-center">Livrare</TableHead>
              <TableHead className="text-right">Zile cu Comandă</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  Nu există produse care necesită comandă.
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map(item => (
                <TableRow 
                  key={item.product_id}
                  className={cn(
                    !item.order_id && item.days_remaining <= 3 && "bg-destructive/5",
                    !item.order_id && item.days_remaining > 3 && item.days_remaining <= 7 && "bg-orange-50"
                  )}
                >
                  <TableCell>{getStatusBadge(item)}</TableCell>
                  <TableCell className="font-mono text-sm">{item.product_code || "-"}</TableCell>
                  <TableCell className="font-medium">{item.product_name}</TableCell>
                  <TableCell>{item.supplier_name || "-"}</TableCell>
                  <TableCell className="text-right">
                    {item.current_stock.toLocaleString("ro-RO", { maximumFractionDigits: 2 })} {item.unit}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={cn(
                      "font-medium",
                      item.days_remaining <= 3 && "text-destructive",
                      item.days_remaining > 3 && item.days_remaining <= 7 && "text-orange-600"
                    )}>
                      {item.days_remaining >= 999 ? "∞" : Math.round(item.days_remaining)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {item.order_quantity 
                      ? item.order_quantity.toLocaleString("ro-RO", { maximumFractionDigits: 0 })
                      : item.suggested_quantity.toLocaleString("ro-RO", { maximumFractionDigits: 0 })
                    } {item.unit}
                  </TableCell>
                  <TableCell className="text-center">
                    {item.expected_delivery_date 
                      ? format(item.expected_delivery_date, "d MMM", { locale: ro })
                      : "-"
                    }
                  </TableCell>
                  <TableCell className="text-right">
                    {item.days_with_order !== null ? (
                      <span className="text-green-600 font-medium">
                        {item.days_with_order >= 999 ? "∞" : Math.round(item.days_with_order)}
                      </span>
                    ) : "-"}
                  </TableCell>
                  <TableCell>
                    {item.order_id && item.order_status === "ordered" && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleMarkDelivered(item.order_id!)}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Livrată
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Order Dialog */}
      <Dialog open={showOrderDialog} onOpenChange={setShowOrderDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {isManualOrder ? "Comandă Nouă" : `Creare Comandă - ${selectedSupplier?.supplier_name}`}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            {/* Supplier selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Furnizor
              </label>
              <Select value={editableSupplierId} onValueChange={setEditableSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selectează furnizor..." />
                </SelectTrigger>
                <SelectContent>
                  {allSuppliers.map(supplier => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!editableSupplierId && (
                <p className="text-xs text-amber-600">⚠ Selectează un furnizor pentru a putea salva comanda</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Data Comenzii</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(orderDate, "dd MMM yyyy", { locale: ro })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={orderDate}
                      onSelect={(date) => date && setOrderDate(date)}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Data Livrării Estimate</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(expectedDelivery, "dd MMM yyyy", { locale: ro })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={expectedDelivery}
                      onSelect={(date) => date && setExpectedDelivery(date)}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Add product section */}
            <div className="flex gap-2 items-end">
              {showAddProduct ? (
                <>
                  <div className="flex-1">
                    <label className="text-sm font-medium">Adaugă produs</label>
                    <Select value={selectedProductToAdd} onValueChange={setSelectedProductToAdd}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selectează produs..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-[200px]">
                        {allProducts
                          .filter(p => !editableItems.some(e => e.product_id === p.id))
                          .map(product => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.cod_produs ? `[${product.cod_produs}] ` : ""}{product.name}
                            </SelectItem>
                          ))
                        }
                      </SelectContent>
                    </Select>
                  </div>
                  <Button size="sm" onClick={handleAddProduct} disabled={!selectedProductToAdd}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowAddProduct(false)}>
                    Anulează
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setShowAddProduct(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Adaugă produs
                </Button>
              )}
            </div>

            {/* Editable products table */}
            <div className="border rounded-lg flex-1 overflow-auto max-h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Produs</TableHead>
                    <TableHead className="text-right w-32">Cant. Sugerată</TableHead>
                    <TableHead className="text-right w-40">Cantitate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {editableItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                        Nu există produse în comandă.
                      </TableCell>
                    </TableRow>
                  ) : (
                    editableItems.map(item => (
                      <TableRow key={item.product_id}>
                        <TableCell>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleRemoveItem(item.product_id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm text-muted-foreground">{item.product_code || ""}</span>
                          {item.product_code && " "}{item.product_name}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {item.suggested_quantity > 0 
                            ? item.suggested_quantity.toLocaleString("ro-RO", { maximumFractionDigits: 0 })
                            : "-"
                          }
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => handleQuantityChange(item.product_id, Number(e.target.value))}
                              className="w-24 text-right"
                              min={0}
                            />
                            <span className="text-sm text-muted-foreground w-10">{item.unit}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Note comandă</label>
              <Input
                placeholder="Observații, instrucțiuni speciale..."
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="flex-shrink-0 gap-2">
            <Button variant="outline" onClick={handleExportOrder}>
              <FileSpreadsheet className="h-4 w-4 mr-1" />
              Export
            </Button>
            <div className="flex-1" />
            <Button variant="outline" onClick={() => setShowOrderDialog(false)}>
              Anulează
            </Button>
            <Button onClick={submitOrder} disabled={submitting || editableItems.filter(i => i.quantity > 0).length === 0 || !editableSupplierId}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmă Comanda ({editableItems.filter(i => i.quantity > 0).length} produse)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrderManagement;
