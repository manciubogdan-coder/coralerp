import { palletsFor, palletKgFor, summarizePallets } from "@/lib/forecastGroups";
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarIcon, FileSpreadsheet, Truck, Plus, Trash2 } from "lucide-react";
import { format, addDays } from "date-fns";
import { ro } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-custom-toast";
import { exportPurchaseOrder } from "@/lib/purchaseOrderExport";

export interface OrderLineInput {
  key: string;
  name: string;
  code?: string | null;
  unit: string;
  qty: number;
  productId?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inventoryType: "materii-prime" | "ambalaje" | "etichete";
  lines: OrderLineInput[];
  onCreated?: () => void;
}

const fmt = (n: number, max = 2) => n.toLocaleString("ro-RO", { maximumFractionDigits: max });

const CreateSupplierOrderDialog: React.FC<Props> = ({ open, onOpenChange, inventoryType, lines, onCreated }) => {
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [deliveryDate, setDeliveryDate] = useState<Date>(addDays(new Date(), 3));
  const [qtys, setQtys] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<OrderLineInput[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string; default_unit?: string; cod_produs?: string }[]>([]);
  const [saving, setSaving] = useState(false);

  const suppliersTable =
    inventoryType === "ambalaje" ? "ambalaje_suppliers" : inventoryType === "etichete" ? "etichete_suppliers" : "suppliers";
  const ordersTable =
    inventoryType === "ambalaje"
      ? "ambalaje_product_orders"
      : inventoryType === "etichete"
      ? "etichete_product_orders"
      : "product_orders";

  const productsTable =
    inventoryType === "ambalaje" ? "ambalaje_products" : inventoryType === "etichete" ? "etichete_products" : "products";

  const addRow = () =>
    setRows((p) => [...p, { key: `new-${Date.now()}-${p.length}`, name: "", unit: "kg", qty: 0, productId: null }]);
  const setRowName = (key: string, name: string) => {
    const match = products.find((p) => p.name.trim().toLowerCase() === name.trim().toLowerCase());
    setRows((p) => p.map((r) => (r.key === key
      ? { ...r, name, productId: match?.id || null, code: match?.cod_produs || null, unit: match?.default_unit || r.unit }
      : r)));
  };

  useEffect(() => {
    if (!open) return;
    setQtys(Object.fromEntries(lines.map((l) => [l.key, String(Math.round(Math.max(l.qty, 0) * 100) / 100)])));
    setRows(lines.length ? lines : [{ key: `new-${Date.now()}`, name: "", unit: "kg", qty: 0, productId: null }]);
    (async () => {
      const { data } = await supabase.from(suppliersTable).select("id, name").order("name");
      setSuppliers((data as any) || []);
      const all: any[] = [];
      for (let from = 0; ; from += 1000) {
        const { data: page } = await supabase.from(productsTable).select("*").order("name").range(from, from + 999);
        all.push(...(page || []));
        if (!page || page.length < 1000) break;
      }
      setProducts(all);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lines]);

  const supplierName = useMemo(() => suppliers.find((s) => s.id === supplierId)?.name || "", [suppliers, supplierId]);

  const palletTotals = useMemo(
    () => summarizePallets(rows.map((l) => ({ name: l.name, unit: l.unit, qty: Number(qtys[l.key]) || 0 }))),
    [rows, qtys]
  );

  const handleGenerate = async () => {
    if (!supplierName) return;
    const items = rows
      .filter((l) => l.name.trim())
      .map((l) => ({
        product_id: l.productId || null,
        product_code: l.code || null,
        product_name: l.name,
        quantity: Number(qtys[l.key]) || 0,
        unit: l.unit || "kg",
        expected_delivery_date: deliveryDate,
      }))
      .filter((i) => i.quantity > 0);

    if (items.length === 0) {
      toast({ title: "Nu există cantități de comandat", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const toInsert = items
        .filter((i) => i.product_id)
        .map((i) => ({
          product_id: i.product_id,
          supplier_id: supplierId,
          quantity_ordered: i.quantity,
          order_date: new Date().toISOString(),
          expected_delivery_date: format(deliveryDate, "yyyy-MM-dd"),
          status: "ordered",
          notes: "Generat din Forecast",
        }));

      if (toInsert.length > 0) {
        const { error } = await supabase.from(ordersTable).insert(toInsert as any);
        if (error) throw error;
      }

      exportPurchaseOrder({ supplier_name: supplierName, items, order_date: new Date() }, inventoryType);

      const skipped = items.length - toInsert.length;
      toast({
        title: "Comandă generată și salvată",
        description: `${toInsert.length} produse înregistrate pentru ${supplierName}${
          skipped > 0 ? ` (${skipped} fără corespondent în nomenclator, doar în Excel)` : ""
        }`,
      });
      onCreated?.();
      onOpenChange(false);
    } catch (e) {
      console.error("[CreateSupplierOrderDialog]", e);
      toast({ title: "Eroare la salvarea comenzii", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            Comandă către furnizor
          </DialogTitle>
          <DialogDescription>
            Alege furnizorul, data de livrare dorită și ajustează cantitățile înainte de a genera comanda.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Furnizor</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Alege un furnizor..." />
                </SelectTrigger>
                <SelectContent className="max-h-[300px] overflow-y-auto">
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data livrării</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(deliveryDate, "dd MMM yyyy", { locale: ro })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={deliveryDate}
                    onSelect={(d) => d && setDeliveryDate(d)}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produs</TableHead>
                  <TableHead>UM</TableHead>
                  <TableHead className="text-right w-[160px]">Cantitate</TableHead>
                  <TableHead className="text-right">Paleți</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((l) => (
                  <TableRow key={l.key}>
                    <TableCell className="font-medium">
                      <Input
                        list="supplier-order-products"
                        value={l.name}
                        placeholder="Alege sau scrie produsul..."
                        onChange={(e) => setRowName(l.key, e.target.value)}
                      />
                      {l.name && !l.productId && (
                        <span className="text-[10px] text-muted-foreground">produs nou — apare doar în Excel</span>
                      )}
                    </TableCell>
                    <TableCell>{l.unit}</TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        step="0.01"
                        className="text-right"
                        value={qtys[l.key] ?? ""}
                        onChange={(e) => setQtys((p) => ({ ...p, [l.key]: e.target.value }))}
                      />
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap text-sm">
                      {(() => {
                        const pal = String(l.unit || "kg").toLowerCase() === "kg" ? palletsFor(l.name, Number(qtys[l.key]) || 0) : null;
                        return pal === null ? "—" : `${fmt(pal)} (${palletKgFor(l.name)} kg/palet)`;
                      })()}
                    </TableCell>
                    <TableCell className="w-[40px]">
                      <Button variant="ghost" size="icon" onClick={() => setRows((p) => p.filter((r) => r.key !== l.key))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="bg-muted/60 hover:bg-muted/60">
                  <TableCell colSpan={2} className="font-semibold">
                    Total
                  </TableCell>
                  <TableCell className="text-right font-semibold whitespace-nowrap">{fmt(palletTotals.kg)} kg</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <span className="font-semibold">{fmt(palletTotals.pallets)} paleți</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {palletTotals.wholePallets} paleți întregi de încărcat
                    </span>
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
            <datalist id="supplier-order-products">
              {products.map((p) => <option key={p.id} value={p.name} />)}
            </datalist>
          </div>
          <Button variant="outline" size="sm" onClick={addRow}>
            <Plus className="h-4 w-4 mr-1" /> Adaugă produs
          </Button>

          {palletTotals.byClass.length > 0 && (
            <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
              {palletTotals.byClass.map((c) => (
                <span key={c.perPalletKg}>
                  {fmt(c.pallets)} paleți de {c.perPalletKg} kg = {fmt(c.kg)} kg
                </span>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="p-6 pt-3 border-t">
          <div className="text-sm font-medium mr-auto">
            Total: {fmt(palletTotals.pallets)} paleți ({palletTotals.wholePallets} de încărcat)
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Anulează
          </Button>
          <Button onClick={handleGenerate} disabled={!supplierId || saving}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Generează comanda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateSupplierOrderDialog;
