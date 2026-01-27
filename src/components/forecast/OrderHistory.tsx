import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-custom-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Loader2, Search, CalendarIcon, Download, FileSpreadsheet, Package, Truck, Check, X } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ro } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { exportToExcel } from "@/lib/excelExport";

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

const OrderHistory: React.FC<OrderHistoryProps> = ({ inventoryType }) => {
  const [orders, setOrders] = useState<HistoryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [fromDate, setFromDate] = useState<Date>(startOfMonth(subMonths(new Date(), 3)));
  const [toDate, setToDate] = useState<Date>(endOfMonth(new Date()));
  const [statusFilter, setStatusFilter] = useState<string>("all");

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

      // Fetch suppliers
      const supplierIds = [...new Set((ordersData || []).filter(o => o.supplier_id).map(o => o.supplier_id))];
      const { data: suppliersData } = await supabase
        .from(tables.suppliers)
        .select("id, name")
        .in("id", supplierIds.length > 0 ? supplierIds : ["no-id"]);

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

    return result;
  }, [orders, searchTerm, statusFilter]);

  const handleExport = () => {
    if (filteredOrders.length === 0) {
      toast({ title: "Nu există date de exportat", variant: "destructive" });
      return;
    }

    const exportData = filteredOrders.map(order => ({
      "Data Comandă": format(order.order_date, "dd.MM.yyyy"),
      "Cod Produs": order.product_code || "-",
      "Produs": order.product_name,
      "Furnizor": order.supplier_name || "-",
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
    totalQty: filteredOrders.reduce((acc, o) => acc + o.quantity_ordered, 0)
  }), [filteredOrders]);

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

        <Button onClick={handleExport} variant="outline">
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export Excel
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
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

      {/* Orders Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data Comandă</TableHead>
              <TableHead>Cod</TableHead>
              <TableHead>Produs</TableHead>
              <TableHead>Furnizor</TableHead>
              <TableHead className="text-right">Cantitate</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data Livrare Est.</TableHead>
              <TableHead>Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Nu există comenzi în perioada selectată.
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map(order => (
                <TableRow key={order.id}>
                  <TableCell>{format(order.order_date, "dd.MM.yyyy")}</TableCell>
                  <TableCell className="font-mono text-sm">{order.product_code || "-"}</TableCell>
                  <TableCell className="font-medium">{order.product_name}</TableCell>
                  <TableCell>{order.supplier_name || "-"}</TableCell>
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
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default OrderHistory;
