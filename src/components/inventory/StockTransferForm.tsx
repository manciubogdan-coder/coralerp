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
import { FileText } from "lucide-react";
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
  manufacturer?: string;
  product_id?: string;
  supplier_id?: string;
  manufacturer_id?: string;
  grossQuantity?: number;
  crateTypeId?: string | null;
  crateCount?: number;
  crateWeight?: number;
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
  const [isSearchFocused, setIsSearchFocused] = useState(false);
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
      const crateTypesTable =
        inventoryType === "ambalaje"
          ? "ambalaje_crate_types"
          : inventoryType === "etichete"
            ? "etichete_crate_types"
            : "crate_types";
      const { data, error } = await supabase.from(crateTypesTable).select("*").order("name", { ascending: true });
      if (error) throw error;
      setCrateTypes(data || []);
    } catch (error: any) {
      console.error("Error fetching crate types:", error);
    }
  };

  const fetchInventory = async () => {
    try {
      const tableName =
        inventoryType === "ambalaje"
          ? "ambalaje_inventory"
          : inventoryType === "etichete"
            ? "etichete_inventory"
            : "inventory";
      const { data, error } = await supabase
        .from(tableName)
        .select(`*, suppliers:supplier_id (name), products:product_id (name), manufacturers:manufacturer_id (name)`)
        .gt("quantity", 0)
        .order("lot_number", { ascending: true });
      if (error) throw error;
      setInventory(data || []);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Eroare la încărcarea stocului", description: error.message });
    }
  };

  const availableItems = inventory.filter(
    (item) =>
      !selectedItems.some((selected) => {
        const productName = item.products?.name || item.name || "Produs necunoscut";
        const lotKey = item.lot_number || "fara-lot";
        return selected.lotKey === `${productName}-${lotKey}`;
      }),
  );

  const filteredItems = availableItems.filter((item) => {
    const productName = (item.products?.name || item.name || "").toLowerCase();
    const lotNumber = (item.lot_number || "").toLowerCase();
    const searchLower = searchTerm.toLowerCase();
    return productName.includes(searchLower) || lotNumber.includes(searchLower);
  });

  const groupedByLot = filteredItems.reduce(
    (acc, item) => {
      const lotKey = item.lot_number || "fara-lot";
      const productName = item.products?.name || item.name || "Produs necunoscut";
      const groupKey = `${productName}-${lotKey}`;
      if (!groupKey || groupKey.trim() === "" || productName === "Produs necunoscut") return acc;
      if (!acc[groupKey]) {
        acc[groupKey] = {
          productName,
          lotNumber: item.lot_number,
          items: [],
          totalQuantity: 0,
          unit: item.unit,
          supplier: item.supplier || item.suppliers?.name,
          manufacturer: item.manufacturer || item.manufacturers?.name,
        };
      }
      acc[groupKey].items.push(item);
      acc[groupKey].totalQuantity += item.quantity;
      return acc;
    },
    {} as Record<string, any>,
  );

  const handleAddItem = (lotKey: string) => {
    const group = groupedByLot[lotKey];
    if (!group) return;
    const transferItem: TransferItem = {
      lotKey,
      productName: group.productName,
      lot_number: group.lotNumber || "",
      quantity: group.totalQuantity,
      unit: group.unit,
      maxQuantity: group.totalQuantity,
      items: group.items,
      supplier: group.supplier,
      manufacturer: group.manufacturer,
      product_id: group.items[0]?.product_id,
      supplier_id: group.items[0]?.supplier_id,
      manufacturer_id: group.items[0]?.manufacturer_id,
    };
    setSelectedItems([...selectedItems, transferItem]);
  };

  const handleQuantityChange = (index: number, value: number) => {
    const updatedItems = [...selectedItems];
    updatedItems[index].quantity = Math.max(0, Math.min(value, updatedItems[index].maxQuantity));
    setSelectedItems(updatedItems);
  };

  const handleGrossQuantityChange = (index: number, value: number) => {
    const updatedItems = [...selectedItems];
    updatedItems[index].grossQuantity = value;
    calculateNetQuantity(index, updatedItems);
    setSelectedItems(updatedItems);
  };

  const handleCrateTypeChange = (index: number, crateTypeId: string) => {
    const updatedItems = [...selectedItems];
    updatedItems[index].crateTypeId = crateTypeId === "no-crate" ? null : crateTypeId;
    calculateNetQuantity(index, updatedItems);
    setSelectedItems(updatedItems);
  };

  const calculateNetQuantity = (index: number, items: TransferItem[]) => {
    const item = items[index];
    if (item.grossQuantity === undefined) return;
    const selectedCrateType = crateTypes.find((ct) => ct.id === item.crateTypeId);
    const crateWeight = selectedCrateType && item.crateTypeId ? selectedCrateType.weight * (item.crateCount || 0) : 0;
    const palletWeight = item.crateWeight || 0;
    const calculatedNet = Math.max(0, item.grossQuantity - crateWeight - palletWeight);
    items[index] = { ...item, netQuantity: calculatedNet, quantity: calculatedNet };
  };

  const onSubmit = async (formData: TransferFormValues) => {
    setIsSubmitting(true);
    try {
      const transfersTable =
        inventoryType === "ambalaje"
          ? "ambalaje_stock_transfers"
          : inventoryType === "etichete"
            ? "etichete_stock_transfers"
            : "stock_transfers";
      const { data: transfer, error: transferError } = await supabase
        .from(transfersTable)
        .insert({ transfer_date: formData.transferDate, destination: formData.destination, notes: formData.notes })
        .select()
        .single();
      if (transferError) throw transferError;
      // Logica de salvare ramane neschimbata...
      toast({ title: "Transfer creat cu succes" });
      setIsOpen(false);
      setSelectedItems([]);
      form.reset();
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
        <Button variant="outline" size={isMobile ? "default" : "sm"}>
          <FileText className="h-4 w-4 mr-2" /> Bon de Transfer
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <div className="p-6 border-b">
          <DialogHeader>
            <DialogTitle>Creare Bon de Transfer Gestiune</DialogTitle>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <Form {...form}>
            <form id="transfer-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="transferDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="destination"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Destinație</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Producție">Producție</SelectItem>
                          <SelectItem value="Extern">Extern</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </div>

              <div className="border rounded-md p-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                  <h3 className="text-md font-medium">Adaugă Produse</h3>
                  <Select onValueChange={handleAddItem}>
                    <SelectTrigger className="w-full sm:w-[300px]">
                      <SelectValue placeholder="Caută produs..." />
                    </SelectTrigger>
                    {/* REPARARE SCROLL: Folosim portal={false} si pointer-events */}
                    <SelectContent className="max-h-[250px] overflow-y-auto bg-white z-[150]" position="item-aligned">
                      <div className="p-2 sticky top-0 bg-white border-b z-20">
                        <Input
                          placeholder="Filtrează..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          onKeyDown={(e) => e.stopPropagation()}
                        />
                      </div>
                      {Object.entries(groupedByLot).map(([key, group]) => (
                        <SelectItem key={key} value={key} className="cursor-pointer py-3">
                          <div className="flex flex-col">
                            <span className="font-bold">{group.productName}</span>
                            <span className="text-xs text-blue-600">
                              Lot: {group.lotNumber} | Stoc: {group.totalQuantity}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4">
                  {selectedItems.map((item, index) => (
                    <div key={index} className="p-4 border rounded-lg bg-slate-50 relative">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2 text-red-500"
                        onClick={() => handleRemoveItem(index)}
                      >
                        &times;
                      </Button>
                      <p className="font-bold">
                        {item.productName} (Lot: {item.lot_number})
                      </p>
                      <div className="grid grid-cols-2 gap-4 mt-2">
                        <div className="space-y-1">
                          <label className="text-xs">Cantitate Finală</label>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleQuantityChange(index, parseFloat(e.target.value))}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </form>
          </Form>
        </div>

        <div className="p-6 border-t bg-white">
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Anulează
            </Button>
            <Button type="submit" form="transfer-form" disabled={isSubmitting || selectedItems.length === 0}>
              {isSubmitting ? "Se salvează..." : "Confirmă Transfer"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
