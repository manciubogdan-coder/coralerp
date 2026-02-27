import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-custom-toast";
import { supabase } from "@/integrations/supabase/client";
import { InventoryItem } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { FileText, Search, Trash2, ChevronDown } from "lucide-react";
import { useForm } from "react-hook-form";
import { useInventoryType } from "@/context/inventory-type";

interface StockTransferFormProps {
  onTransferComplete?: () => void;
}

interface TransferItem {
  lotKey: string;
  productName: string;
  lot_number: string;
  quantity: number;
  unit: string;
  maxQuantity: number;
  items: InventoryItem[];
  supplier?: string;
  manufacturer?: string;
  product_id?: string;
  supplier_id?: string;
  manufacturer_id?: string;
  grossQuantity?: number;
  crateTypeId?: string | null;
  crateCount?: number;
  crateWeight?: number;
}

interface TransferFormValues {
  transferDate: string;
  destination: string;
  notes: string;
}

export function StockTransferForm({ onTransferComplete }: StockTransferFormProps) {
  const { inventoryType } = useInventoryType();
  const [isOpen, setIsOpen] = useState(false);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<TransferItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [crateTypes, setCrateTypes] = useState<any[]>([]);

  const form = useForm<TransferFormValues>({
    defaultValues: {
      transferDate: new Date().toISOString().split("T")[0],
      destination: "Producție",
      notes: "",
    },
  });

  useEffect(() => {
    if (isOpen) {
      fetchInventory();
      fetchCrateTypes();
    }
  }, [isOpen, inventoryType]);

  const fetchCrateTypes = async () => {
    try {
      const table =
        inventoryType === "ambalaje"
          ? "ambalaje_crate_types"
          : inventoryType === "etichete"
            ? "etichete_crate_types"
            : "crate_types";
      const { data } = await supabase.from(table).select("*").order("name", { ascending: true });
      setCrateTypes(data || []);
    } catch (error) {
      console.error("Error fetching crate types:", error);
    }
  };

  const fetchInventory = async () => {
    try {
      const table =
        inventoryType === "ambalaje"
          ? "ambalaje_inventory"
          : inventoryType === "etichete"
            ? "etichete_inventory"
            : "inventory";
      const { data, error } = await supabase
        .from(table)
        .select(`*, suppliers:supplier_id (name), products:product_id (name), manufacturers:manufacturer_id (name)`)
        .gt("quantity", 0)
        .order("lot_number", { ascending: true });
      if (error) throw error;
      setInventory(data || []);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Eroare stoc", description: error.message });
    }
  };

  const groupedByLot = inventory
    .filter((item) => {
      const s = searchTerm.toLowerCase();
      const name = (item.products?.name || item.name || "").toLowerCase();
      const lot = (item.lot_number || "").toLowerCase();
      return name.includes(s) || lot.includes(s);
    })
    .reduce((acc, item) => {
      const productName = item.products?.name || item.name || "Produs";
      const lotKey = `${productName}-${item.lot_number || "fara-lot"}`;
      if (!acc[lotKey]) {
        acc[lotKey] = {
          productName,
          lotNumber: item.lot_number,
          total: 0,
          unit: item.unit,
          items: [],
          supplier: item.suppliers?.name,
        };
      }
      acc[lotKey].total += item.quantity;
      acc[lotKey].items.push(item);
      return acc;
    }, {} as any);

  const handleAddItem = (lotKey: string) => {
    const group = groupedByLot[lotKey];
    if (!group) return;
    const newItem: TransferItem = {
      lotKey,
      productName: group.productName,
      lot_number: group.lotNumber || "",
      quantity: 0,
      unit: group.unit,
      maxQuantity: group.total,
      items: group.items,
      supplier: group.supplier,
      product_id: group.items[0]?.product_id,
      supplier_id: group.items[0]?.supplier_id,
      manufacturer_id: group.items[0]?.manufacturer_id,
      grossQuantity: 0,
      crateTypeId: null,
      crateCount: 0,
      crateWeight: 0,
    };
    setSelectedItems([...selectedItems, newItem]);
    setSearchTerm("");
    setShowDropdown(false);
  };

  const calculateNetQuantity = (item: TransferItem) => {
    if (inventoryType === "etichete") return item.quantity;
    const selectedCrate = crateTypes.find((c) => c.id === item.crateTypeId);
    const crateTare = selectedCrate ? selectedCrate.weight * (item.crateCount || 0) : 0;
    const net = (item.grossQuantity || 0) - crateTare - (item.crateWeight || 0);
    return Math.max(0, parseFloat(net.toFixed(2)));
  };

  const updateItem = (index: number, updates: Partial<TransferItem>) => {
    const newItems = [...selectedItems];
    const updated = { ...newItems[index], ...updates };
    if (inventoryType !== "etichete") {
      updated.quantity = calculateNetQuantity(updated);
    }
    newItems[index] = updated;
    setSelectedItems(newItems);
  };

  const onSubmit = async (values: TransferFormValues) => {
    if (selectedItems.length === 0) return;
    setIsSubmitting(true);

    try {
      const ticketTable =
        inventoryType === "ambalaje"
          ? "ambalaje_transfer_tickets"
          : inventoryType === "etichete"
            ? "etichete_transfer_tickets"
            : "transfer_tickets";
      const itemTable =
        inventoryType === "ambalaje"
          ? "ambalaje_transfer_items"
          : inventoryType === "etichete"
            ? "etichete_transfer_items"
            : "transfer_items";
      const invTable =
        inventoryType === "ambalaje"
          ? "ambalaje_inventory"
          : inventoryType === "etichete"
            ? "etichete_inventory"
            : "inventory";

      const { data: ticket, error: ticketError } = await supabase
        .from(ticketTable)
        .insert([
          {
            transfer_date: values.transferDate,
            destination: values.destination,
            notes: values.notes,
            status: "completed",
          },
        ])
        .select()
        .single();

      if (ticketError) throw ticketError;

      for (const item of selectedItems) {
        // Inserare item transfer
        const { error: itemError } = await supabase.from(itemTable).insert([
          {
            ticket_id: ticket.id,
            product_id: item.product_id,
            lot_number: item.lot_number,
            quantity: item.quantity,
            unit: item.unit,
            gross_quantity: item.grossQuantity,
            crate_type_id: item.crateTypeId,
            crate_count: item.crateCount,
            crate_weight: item.crateWeight,
          },
        ]);
        if (itemError) throw itemError;

        // Scadere din lotul specific selectat
        let remaining = item.quantity;
        for (const subInv of item.items) {
          if (remaining <= 0) break;
          const toSubtract = Math.min(subInv.quantity, remaining);
          const { error: invError } = await supabase
            .from(invTable)
            .update({ quantity: subInv.quantity - toSubtract })
            .eq("id", subInv.id);
          if (invError) throw invError;
          remaining -= toSubtract;
        }
      }

      toast({ title: "Succes", description: "Transfer înregistrat și stoc actualizat." });
      setIsOpen(false);
      setSelectedItems([]);
      if (onTransferComplete) onTransferComplete();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Eroare", description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileText className="h-4 w-4" /> Bon de Transfer
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl w-[98vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Creare Bon de Transfer</DialogTitle>
          <DialogDescription>Alegeți destinația și detaliile de cântărire pentru lotul selectat.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-lg border">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase">Data</label>
              <Input type="date" {...form.register("transferDate")} className="bg-white" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase">Destinație</label>
              <Select
                onValueChange={(v) => form.setValue("destination", v)}
                defaultValue={form.getValues("destination")}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Producție">Producție</SelectItem>
                  <SelectItem value="Distrugere">Distrugere</SelectItem>
                  <SelectItem value="Extern">Extern</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase">Note</label>
              <Input placeholder="Note..." {...form.register("notes")} className="bg-white" />
            </div>
          </div>

          <div className="relative">
            <div
              className="flex h-10 w-full items-center justify-between rounded-md border bg-white px-3 py-2 text-sm cursor-pointer"
              onClick={() => setShowDropdown(!showDropdown)}
            >
              <div className="flex items-center gap-2 flex-1">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  className="flex-1 outline-none"
                  placeholder="Caută produs sau lot în stoc..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setShowDropdown(true);
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <ChevronDown className="h-4 w-4 opacity-50 transition-transform" />
            </div>

            {showDropdown && (
              <div className="absolute w-full mt-1 bg-white border rounded-md shadow-2xl z-[100] max-h-[250px] overflow-y-auto">
                {Object.entries(groupedByLot).map(([key, group]: any) => (
                  <div
                    key={key}
                    className="p-3 hover:bg-blue-50 cursor-pointer border-b flex justify-between items-center"
                    onClick={() => handleAddItem(key)}
                  >
                    <div>
                      <div className="font-bold text-sm">{group.productName}</div>
                      <div className="text-[10px] text-slate-500 font-medium">LOT: {group.lotNumber}</div>
                    </div>
                    <div className="text-blue-600 font-bold text-sm">
                      {group.total.toFixed(2)} {group.unit}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            {selectedItems.map((item, index) => (
              <div key={index} className="bg-white p-4 rounded-lg border shadow-sm space-y-4 relative">
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 text-slate-300 hover:text-red-500"
                  onClick={() => setSelectedItems(selectedItems.filter((_, i) => i !== index))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <div className="font-bold border-b pb-2">
                  {item.productName} - Lot: {item.lot_number}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {inventoryType !== "etichete" && (
                    <>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-slate-400">Brut</label>
                        <Input
                          type="number"
                          value={item.grossQuantity || ""}
                          onChange={(e) => updateItem(index, { grossQuantity: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-slate-400">Lădiță</label>
                        <Select
                          value={item.crateTypeId || "no"}
                          onValueChange={(v) => updateItem(index, { crateTypeId: v === "no" ? null : v })}
                        >
                          <SelectTrigger className="text-xs h-10">
                            <SelectValue placeholder="Tip..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="no">Fără</SelectItem>
                            {crateTypes.map((ct) => (
                              <SelectItem key={ct.id} value={ct.id}>
                                {ct.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-slate-400">Nr Lăzi</label>
                        <Input
                          type="number"
                          value={item.crateCount || ""}
                          onChange={(e) => updateItem(index, { crateCount: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-slate-400">Tări kg</label>
                        <Input
                          type="number"
                          value={item.crateWeight || ""}
                          onChange={(e) => updateItem(index, { crateWeight: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    </>
                  )}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-blue-600">Cantitate Netă</label>
                    <Input
                      className="bg-blue-50 font-bold"
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, { quantity: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="p-6 border-t bg-slate-50">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Anulează
          </Button>
          <Button onClick={form.handleSubmit(onSubmit)} disabled={isSubmitting || selectedItems.length === 0}>
            {isSubmitting ? "Se procesează..." : "Confirmă Transfer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
