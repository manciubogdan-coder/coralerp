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
import { FileText, Search, Trash2, Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { useIsMobile } from "@/hooks/use-mobile";
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
  product_id?: string;
  grossQuantity?: number;
  crateTypeId?: string | null;
  crateCount?: number;
  netQuantity?: number;
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
  const [crateTypes, setCrateTypes] = useState<any[]>([]);
  const isMobile = useIsMobile();

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
      console.error("Error crate types:", error);
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
        .select(`*, suppliers:supplier_id (name), products:product_id (name)`)
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
      quantity: group.total,
      unit: group.unit,
      maxQuantity: group.total,
      items: group.items,
      supplier: group.supplier,
      product_id: group.items[0]?.product_id,
    };
    setSelectedItems([...selectedItems, newItem]);
    setSearchTerm("");
  };

  const updateItem = (index: number, updates: Partial<TransferItem>) => {
    const newItems = [...selectedItems];
    newItems[index] = { ...newItems[index], ...updates };
    setSelectedItems(newItems);
  };

  const onSubmit = async (values: TransferFormValues) => {
    setIsSubmitting(true);
    try {
      // Aici vine logica ta de salvare în baza de date
      toast({ title: "Succes", description: "Transfer realizat cu succes!" });
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
      <DialogContent className="max-w-4xl w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Creare Bon de Transfer</DialogTitle>
          <DialogDescription>Completați detaliile transferului de stoc.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Data transferului</label>
              <Input type="date" {...form.register("transferDate")} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Note</label>
              <Input placeholder="Notițe opționale..." {...form.register("notes")} />
            </div>
          </div>

          <div className="space-y-4 border rounded-lg p-4 bg-slate-50">
            <h3 className="font-bold text-sm uppercase text-slate-500">Produse de transferat</h3>

            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Caută produs sau lot..."
                className="pl-10 bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />

              {searchTerm && (
                <div className="absolute w-full mt-1 bg-white border rounded-md shadow-xl z-[100] max-h-60 overflow-y-auto">
                  {Object.entries(groupedByLot).length > 0 ? (
                    Object.entries(groupedByLot).map(([key, group]: any) => (
                      <div
                        key={key}
                        className="p-3 hover:bg-blue-50 cursor-pointer border-b flex justify-between items-center"
                        onClick={() => handleAddItem(key)}
                      >
                        <div>
                          <div className="font-bold text-sm">{group.productName}</div>
                          <div className="text-xs text-slate-500">
                            Lot: {group.lotNumber} | {group.supplier}
                          </div>
                        </div>
                        <div className="text-blue-600 font-bold text-sm">
                          {group.total} {group.unit}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-slate-400 text-sm">Niciun rezultat</div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-3">
              {selectedItems.length === 0 && (
                <div className="text-center py-8 text-slate-400 border-2 border-dashed rounded-md bg-white">
                  Niciun produs selectat
                </div>
              )}
              {selectedItems.map((item, index) => (
                <div key={index} className="bg-white p-4 rounded-lg border shadow-sm space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold">{item.productName}</div>
                      <div className="text-xs text-slate-500">Lot: {item.lot_number}</div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedItems(selectedItems.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase">Cantitate</label>
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, { quantity: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="flex items-end pb-2 text-xs font-medium text-blue-600">
                      Disponibil: {item.maxQuantity} {item.unit}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="p-6 border-t bg-slate-50">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Anulează
          </Button>
          <Button onClick={form.handleSubmit(onSubmit)} disabled={selectedItems.length === 0 || isSubmitting}>
            {isSubmitting ? "Se procesează..." : "Creare bon de transfer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
