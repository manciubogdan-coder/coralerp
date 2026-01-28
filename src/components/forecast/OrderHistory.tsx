import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-custom-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, Search, CalendarIcon, FileSpreadsheet, Package, Truck, Check, X, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ro } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { exportToExcel } from "@/lib/excelExport";
import { exportPurchaseOrder } from "@/lib/purchaseOrderExport";
import SupplierSelectDialog from "./SupplierSelectDialog";

interface OrderHistoryProps {
  inventoryType: "materii-prime" | "ambalaje" | "etichete";
}

interface HistoryOrder {
  id: string;
  product_id: string;
  product_name: string;
  product_code: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  quantity_ordered: number;
  unit: string;
  order_date: Date;
  expected_delivery_date: Date | null;
  status: "pending" | "ordered" | "delivered" | "cancelled";
  notes: string | null;
}

interface SupplierOrderGroup {
  supplier_id: string | null;
  supplier_name: string;
  orders: HistoryOrder[];
  total_products: number;
  total_quantity: number;
}

const OrderHistory: React.FC<OrderHistoryProps> = ({ inventoryType }) => {
  const [orders, setOrders] = useState<HistoryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [fromDate, setFromDate] = useState<Date>(startOfMonth(subMonths(new Date(), 3)));
  const [toDate, setToDate] = useState<Date>(endOfMonth(new Date()));
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(new Set());
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [pendingExportGroup, setPendingExportGroup] = useState<SupplierOrderGroup | null>(null);

  const getTableNames = () => {
    switch (inventoryType) {
      case "ambalaje":
        return { 
          orders: "ambalaje_product_orders" as const,
          products: "ambalaje_products" as const,
          suppliers: "ambalaje_suppliers" as const
        };
      case "etichete":
        return { 
          orders: "etichete_product_orders" as const,
          products: "etichete_products" as const,
          suppliers: "etichete_suppliers" as const
        };
      default:
        return { 
          orders: "product_orders" as const,
          products: "products" as const,
          suppliers: "suppliers" as const
        };
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [inventoryType, fromDate, toDate]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const tables = getTableNames();

      // Fetch orders
      const { data: ordersData, error: ordersError } = await supabase
        .from(tables.orders)
        .select("*")
        .gte("order_date", format(fromDate, "yyyy-MM-dd"))
        .lte("order_date", format(toDate, "yyyy-MM-dd") + "T23:59:59")
        .order("order_date", { ascending: false });

      if (ordersError) throw ordersError;

      // Fetch products
      const productIds = [...new Set((ordersData || []).map(o => o.product_id))];
      const { data: productsData } = await supabase
        .from(tables.products)
        .select("id, name, cod_produs, default_unit")
        .in("id", productIds.length > 0 ? productIds : ["no-id"]);

      const productMap = new Map((productsData || []).map((p: any) => [p.id, p]));

      // Fetch all suppliers for filter
      const { data: suppliersData } = await supabase
        .from(tables.suppliers)
        .select("id, name")
        .order("name");

      setSuppliers((suppliersData || []) as Array<{ id: string; name: string }>);
      const supplierMap = new Map((suppliersData || []).map((s: any) => [s.id, s.name]));

      const historyOrders: HistoryOrder[] = (ordersData || []).map((order: any) => {
        const product = productMap.get(order.product_id) as any;
        return {
          id: order.id,
          product_id: order.product_id,
          product_name: product?.name || "Produs șters",
          product_code: product?.cod_produs || null,
          supplier_id: order.supplier_id,
          supplier_name: order.supplier_id ? supplierMap.get(order.supplier_id) || null : null,
          quantity_ordered: order.quantity_ordered,
          unit: product?.default_unit || "buc",
          order_date: new Date(order.order_date),
          expected_delivery_date: order.expected_delivery_date ? new Date(order.expected_delivery_date) : null,
          status: order.status,
          notes: order.notes
        };
      });

      setOrders(historyOrders);
    } catch (error) {
      console.error("Error fetching order history:", error);
      toast({ title: "Eroare la încărcarea istoricului", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = useMemo(() => {
    let result = orders;

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(order => 
        order.product_name.toLowerCase().includes(lower) ||
        (order.product_code?.toLowerCase().includes(lower)) ||
        (order.supplier_name?.toLowerCase().includes(lower))
      );
    }

    if (statusFilter !== "all") {
      result = result.filter(order => order.status === statusFilter);
    }

    if (supplierFilter !== "all") {
      result = result.filter(order => order.supplier_id === supplierFilter);
    }

    return result;
  }, [orders, searchTerm, statusFilter, supplierFilter]);

  // Group orders by supplier
  const supplierGroups = useMemo(() => {
    const groups = new Map<string, SupplierOrderGroup>();

    filteredOrders.forEach(order => {
      const key = order.supplier_id || "no-supplier";
      if (!groups.has(key)) {
        groups.set(key, {
          supplier_id: order.supplier_id,
          supplier_name: order.supplier_name || "Fără furnizor",
          orders: [],
          total_products: 0,
          total_quantity: 0
        });
      }
      const group = groups.get(key)!;
      group.orders.push(order);
      group.total_products++;
      group.total_quantity += order.quantity_ordered;
    });

    return Array.from(groups.values()).sort((a, b) => a.supplier_name.localeCompare(b.supplier_name));
  }, [filteredOrders]);

  const toggleSupplier = (supplierId: string) => {
    setExpandedSuppliers(prev => {
      const next = new Set(prev);
      if (next.has(supplierId)) {
        next.delete(supplierId);
      } else {
        next.add(supplierId);
      }
      return next;
    });
  };

  const handleExportSupplier = (group: SupplierOrderGroup) => {
    // If no supplier, open dialog to select one
    if (!group.supplier_id) {
      setPendingExportGroup(group);
      setSupplierDialogOpen(true);
      return;
    }

    executeExport(group.supplier_name, group.orders);
  };

  const handleSupplierSelected = (supplierId: string, supplierName: string) => {
    if (pendingExportGroup) {
      executeExport(supplierName, pendingExportGroup.orders);
      setPendingExportGroup(null);
    }
  };

  const executeExport = (supplierName: string, ordersList: HistoryOrder[]) => {
    const items = ordersList.map(order => ({
      product_code: order.product_code,
      product_name: order.product_name,
      quantity: order.quantity_ordered,
      unit: order.unit,
      expected_delivery_date: order.expected_delivery_date
    }));

    const orderNumber = exportPurchaseOrder({
      supplier_name: supplierName,
      items,
      order_date: new Date()
    }, inventoryType);

    toast({ title: `Comandă ${orderNumber} exportată pentru ${supplierName}` });
  };

  const handleDeleteOrder = async (orderId: string) => {
    try {
      const tables = getTableNames();
      const { error } = await supabase
        .from(tables.orders)
        .delete()
        .eq("id", orderId);

      if (error) throw error;

      toast({ title: "Comanda a fost ștearsă" });
      fetchOrders();
    } catch (error) {
      console.error("Error deleting order:", error);
      toast({ title: "Eroare la ștergerea comenzii", variant: "destructive" });
    }
  };

  const handleExportAll = () => {
    if (filteredOrders.length === 0) {
      toast({ title: "Nu există date de exportat", variant: "destructive" });
      return;
    }

    const exportData = filteredOrders.map(order => ({
      "Furnizor": order.supplier_name || "-",
      "Data Comandă": format(order.order_date, "dd.MM.yyyy"),
      "Cod Produs": order.product_code || "-",
      "Produs": order.product_name,
      "Cantitate": order.quantity_ordered,
      "UM": order.unit,
      "Status": getStatusLabel(order.status),
      "Data Livrare Est.": order.expected_delivery_date ? format(order.expected_delivery_date, "dd.MM.yyyy") : "-",
      "Note": order.notes || "-"
    }));

    const inventoryLabel = inventoryType === "materii-prime" ? "Materii Prime" 
      : inventoryType === "ambalaje" ? "Ambalaje" : "Etichete";

    exportToExcel(exportData, `Istoric_Comenzi_${inventoryLabel}_${format(new Date(), "yyyyMMdd")}.xlsx`, {
      reportTitle: `Istoric Comenzi - ${inventoryLabel}`,
      date: `${format(fromDate, "dd.MM.yyyy")} - ${format(toDate, "dd.MM.yyyy")}`,
      filters: statusFilter !== "all" ? `Status: ${getStatusLabel(statusFilter)}` : undefined
    });

    toast({ title: "Export realizat cu succes" });
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending": return "În așteptare";
      case "ordered": return "Comandată";
      case "delivered": return "Livrată";
      case "cancelled": return "Anulată";
      default: return status;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary"><Package className="h-3 w-3 mr-1" />În așteptare</Badge>;
      case "ordered":
        return <Badge className="bg-blue-500 hover:bg-blue-600"><Truck className="h-3 w-3 mr-1" />Comandată</Badge>;
      case "delivered":
        return <Badge className="bg-green-500 hover:bg-green-600"><Check className="h-3 w-3 mr-1" />Livrată</Badge>;
      case "cancelled":
        return <Badge variant="destructive"><X className="h-3 w-3 mr-1" />Anulată</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const stats = useMemo(() => ({
    total: filteredOrders.length,
    pending: filteredOrders.filter(o => o.status === "pending").length,
    ordered: filteredOrders.filter(o => o.status === "ordered").length,
    delivered: filteredOrders.filter(o => o.status === "delivered").length,
    cancelled: filteredOrders.filter(o => o.status === "cancelled").length,
    suppliers: supplierGroups.length
  }), [filteredOrders, supplierGroups]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Caută produs sau furnizor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[140px]">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(fromDate, "dd MMM yy", { locale: ro })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={fromDate}
                onSelect={(date) => date && setFromDate(date)}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          <span className="self-center text-muted-foreground">-</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[140px]">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(toDate, "dd MMM yy", { locale: ro })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={toDate}
                onSelect={(date) => date && setToDate(date)}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        <Select value={supplierFilter} onValueChange={setSupplierFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Toți furnizorii" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toți furnizorii</SelectItem>
            {suppliers.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 px-3 rounded-md border border-input bg-background text-sm"
        >
          <option value="all">Toate statusurile</option>
          <option value="pending">În așteptare</option>
          <option value="ordered">Comandate</option>
          <option value="delivered">Livrate</option>
          <option value="cancelled">Anulate</option>
        </select>

        <Button onClick={handleExportAll} variant="outline">
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export Tot
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="bg-muted/50 border rounded-lg p-3 text-center">
          <div className="text-xl font-bold">{stats.suppliers}</div>
          <div className="text-xs text-muted-foreground">Furnizori</div>
        </div>
        <div className="bg-muted/50 border rounded-lg p-3 text-center">
          <div className="text-xl font-bold">{stats.total}</div>
          <div className="text-xs text-muted-foreground">Total comenzi</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-yellow-700">{stats.pending}</div>
          <div className="text-xs text-yellow-700">În așteptare</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-blue-700">{stats.ordered}</div>
          <div className="text-xs text-blue-700">Comandate</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-green-700">{stats.delivered}</div>
          <div className="text-xs text-green-700">Livrate</div>
        </div>
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-destructive">{stats.cancelled}</div>
          <div className="text-xs text-destructive">Anulate</div>
        </div>
      </div>

      {/* Orders grouped by supplier */}
      <div className="space-y-3">
        {supplierGroups.length === 0 ? (
          <div className="border rounded-lg p-8 text-center text-muted-foreground">
            Nu există comenzi în perioada selectată.
          </div>
        ) : (
          supplierGroups.map(group => {
            const key = group.supplier_id || "no-supplier";
            const isExpanded = expandedSuppliers.has(key);

            return (
              <Collapsible key={key} open={isExpanded} onOpenChange={() => toggleSupplier(key)}>
                <div className="border rounded-lg overflow-hidden">
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 cursor-pointer">
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        )}
                        <div>
                          <div className="font-semibold">{group.supplier_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {group.total_products} produse comandate
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => { e.stopPropagation(); handleExportSupplier(group); }}
                        >
                          <FileSpreadsheet className="h-4 w-4 mr-1" />
                          Export Comandă
                        </Button>
                      </div>
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data Comandă</TableHead>
                          <TableHead>Cod</TableHead>
                          <TableHead>Produs</TableHead>
                          <TableHead className="text-right">Cantitate</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Data Livrare Est.</TableHead>
                          <TableHead>Note</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.orders.map(order => (
                          <TableRow key={order.id}>
                            <TableCell>{format(order.order_date, "dd.MM.yyyy")}</TableCell>
                            <TableCell className="font-mono text-sm">{order.product_code || "-"}</TableCell>
                            <TableCell className="font-medium">{order.product_name}</TableCell>
                            <TableCell className="text-right font-medium">
                              {order.quantity_ordered.toLocaleString("ro-RO", { maximumFractionDigits: 0 })} {order.unit}
                            </TableCell>
                            <TableCell>{getStatusBadge(order.status)}</TableCell>
                            <TableCell>
                              {order.expected_delivery_date 
                                ? format(order.expected_delivery_date, "dd.MM.yyyy")
                                : "-"
                              }
                            </TableCell>
                            <TableCell className="max-w-[150px] truncate" title={order.notes || ""}>
                              {order.notes || "-"}
                            </TableCell>
                            <TableCell>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Șterge comanda?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Ești sigur că vrei să ștergi comanda pentru "{order.product_name}"? 
                                      Această acțiune nu poate fi anulată.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Anulează</AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={() => handleDeleteOrder(order.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Șterge
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })
        )}
      </div>

      {/* Dialog for selecting supplier when exporting orders without supplier */}
      <SupplierSelectDialog
        open={supplierDialogOpen}
        onOpenChange={setSupplierDialogOpen}
        suppliers={suppliers}
        onConfirm={handleSupplierSelected}
        productCount={pendingExportGroup?.orders.length || 0}
      />
    </div>
  );
};

export default OrderHistory;
