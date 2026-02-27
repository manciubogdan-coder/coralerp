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
  lotKey: string; // Cheie unică pentru combinația produs-lot
  productName: string;
  lot_number: string;
  quantity: number;
  unit: string;
  maxQuantity: number;
  items: InventoryItem[]; // Toate intrările pentru acest lot
  // Informații pentru afișare
  supplier?: string;
  manufacturer?: string;
  product_id?: string;
  supplier_id?: string;
  manufacturer_id?: string;
  // Pentru calcul net (doar pentru afișare, nu se stochează)
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
        .select(
          `
          *,
          suppliers:supplier_id (name),
          products:product_id (name),
          manufacturers:manufacturer_id (name)
        `,
        )
        .gt("quantity", 0)
        .order("lot_number", { ascending: true });

      if (error) {
        throw error;
      }

      setInventory(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Eroare la încărcarea stocului",
        description: error.message,
      });
    }
  };

  const availableItems = inventory.filter(
    (item) =>
      !selectedItems.some((selected) => {
        const productName = item.products?.name || item.name || "Produs necunoscut";
        const lotKey = item.lot_number || "fara-lot";
        const itemLotKey = `${productName}-${lotKey}`;
        return selected.lotKey === itemLotKey;
      }),
  );

  const filteredItems = availableItems.filter((item) => {
    const productName = item.products?.name || item.name || "";
    const supplierName = item.supplier || item.suppliers?.name || "";
    const manufacturerName = item.manufacturer || item.manufacturers?.name || "";
    const lotNumber = item.lot_number || "";
    const searchLower = searchTerm.toLowerCase();

    return (
      productName.toLowerCase().includes(searchLower) ||
      supplierName.toLowerCase().includes(searchLower) ||
      manufacturerName.toLowerCase().includes(searchLower) ||
      lotNumber.toLowerCase().includes(searchLower)
    );
  });

  const groupedByLot = filteredItems.reduce(
    (acc, item) => {
      const lotKey = item.lot_number || "fara-lot";
      const productName = item.products?.name || item.name || "Produs necunoscut";
      const groupKey = `${productName}-${lotKey}`;

      if (
        !groupKey ||
        groupKey.trim() === "" ||
        groupKey === "-" ||
        groupKey === "Produs necunoscut-fara-lot" ||
        productName.trim() === "" ||
        !productName ||
        productName === "Produs necunoscut"
      ) {
        return acc;
      }

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
    {} as Record<
      string,
      {
        productName: string;
        lotNumber: string | null;
        items: InventoryItem[];
        totalQuantity: number;
        unit: string;
        supplier?: string;
        manufacturer?: string;
      }
    >,
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
    const item = updatedItems[index];
    const newQuantity = Math.max(0, Math.min(value, item.maxQuantity));
    updatedItems[index] = { ...item, quantity: newQuantity };
    setSelectedItems(updatedItems);
  };

  const handleGrossQuantityChange = (index: number, value: number) => {
    const updatedItems = [...selectedItems];
    updatedItems[index] = { ...updatedItems[index], grossQuantity: value };
    calculateNetQuantity(index, updatedItems);
    setSelectedItems(updatedItems);
  };

  const handleCrateTypeChange = (index: number, crateTypeId: string) => {
    const updatedItems = [...selectedItems];
    updatedItems[index] = { ...updatedItems[index], crateTypeId: crateTypeId === "no-crate" ? null : crateTypeId };
    calculateNetQuantity(index, updatedItems);
    setSelectedItems(updatedItems);
  };

  const handleCrateCountChange = (index: number, count: number) => {
    const updatedItems = [...selectedItems];
    updatedItems[index] = { ...updatedItems[index], crateCount: count };
    calculateNetQuantity(index, updatedItems);
    setSelectedItems(updatedItems);
  };

  const handleCrateWeightChange = (index: number, weight: number) => {
    const updatedItems = [...selectedItems];
    updatedItems[index] = { ...updatedItems[index], crateWeight: weight };
    calculateNetQuantity(index, updatedItems);
    setSelectedItems(updatedItems);
  };

  const calculateNetQuantity = (index: number, items: TransferItem[]) => {
    const item = items[index];
    if (!item.grossQuantity) return;
    const selectedCrateType = crateTypes.find((ct) => ct.id === item.crateTypeId);
    const crateWeight = selectedCrateType && item.crateTypeId ? selectedCrateType.weight * (item.crateCount || 0) : 0;
    const palletWeight = item.crateWeight || 0;
    const calculatedNet = Math.max(0, item.grossQuantity - crateWeight - palletWeight);
    items[index] = { ...item, netQuantity: calculatedNet, quantity: calculatedNet };
  };

  const handleRemoveItem = (index: number) => {
    setSelectedItems(selectedItems.filter((_, i) => i !== index));
  };

  const onSubmit = async (formData: TransferFormValues) => {
    if (selectedItems.length === 0) {
      toast({ variant: "destructive", title: "Eroare", description: "Vă rugăm să selectați cel puțin un produs." });
      return;
    }

    setIsSubmitting(true);
    try {
      const transfersTable =
        inventoryType === "ambalaje"
          ? "ambalaje_stock_transfers"
          : inventoryType === "etichete"
            ? "etichete_stock_transfers"
            : "stock_transfers";
      const transferItemsTable =
        inventoryType === "ambalaje"
          ? "ambalaje_stock_transfer_items"
          : inventoryType === "etichete"
            ? "etichete_stock_transfer_items"
            : "stock_transfer_items";
      const inventoryTable =
        inventoryType === "ambalaje"
          ? "ambalaje_inventory"
          : inventoryType === "etichete"
            ? "etichete_inventory"
            : "inventory";
      const historyTable =
        inventoryType === "ambalaje"
          ? "ambalaje_inventory_history"
          : inventoryType === "etichete"
            ? "etichete_inventory_history"
            : "inventory_history";

      const { data: transfer, error: transferError } = await supabase
        .from(transfersTable)
        .insert({ transfer_date: formData.transferDate, destination: formData.destination, notes: formData.notes })
        .select()
        .single();

      if (transferError) throw transferError;

      for (const item of selectedItems) {
        const grossRequested = item.grossQuantity && item.grossQuantity > 0 ? item.grossQuantity : item.quantity;
        const netRequested =
          item.grossQuantity && item.grossQuantity > 0 ? (item.netQuantity ?? item.quantity) : item.quantity;
        const ratioNetPerGross = grossRequested > 0 ? netRequested / grossRequested : 1;

        let remainingNet = netRequested;
        const sortedItems = [...item.items].sort(
          (a, b) => new Date(a.receipt_date || "").getTime() - new Date(b.receipt_date || "").getTime(),
        );

        for (const inventoryItem of sortedItems) {
          if (remainingNet <= 0) break;
          const availableNet = inventoryItem.quantity || 0;
          const netToDeduct = Math.min(remainingNet, availableNet);
          const newQuantity = availableNet - netToDeduct;

          await supabase.from(inventoryTable).update({ quantity: newQuantity }).eq("id", inventoryItem.id);
          await supabase.from(historyTable).insert({
            inventory_item_id: inventoryItem.id,
            name: inventoryItem.name,
            action: "transfer_out",
            quantity: netToDeduct,
            previous_quantity: inventoryItem.quantity,
            unit: inventoryItem.unit,
            supplier: inventoryItem.supplier || inventoryItem.suppliers?.name,
            supplier_id: inventoryItem.supplier_id,
            manufacturer_id: inventoryItem.manufacturer_id,
            product_id: inventoryItem.product_id,
            lot_number: inventoryItem.lot_number,
            document_number: inventoryItem.document_number,
            notes: `Transfer către ${formData.destination}`,
            operation_date: formData.transferDate,
          });

          const grossForThisItem =
            ratioNetPerGross > 0 ? Number((netToDeduct / ratioNetPerGross).toFixed(3)) : netToDeduct;
          await supabase.from(transferItemsTable).insert({
            transfer_id: transfer.id,
            inventory_item_id: inventoryItem.id,
            quantity: grossForThisItem,
            net_quantity: netToDeduct,
            unit: inventoryItem.unit,
          });
          remainingNet -= netToDeduct;
        }
      }

      toast({ title: "Succes", description: "Transfer creat." });
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

  const isQuantityValid = (item: TransferItem) => {
    return item.quantity <= item.maxQuantity && item.quantity > 0;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size={isMobile ? "default" : "sm"}>
          <FileText className="h-4 w-4 mr-2" /> Bon de Transfer
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] overflow-hidden">
        <div className="flex flex-col h-full max-h-[90vh]">
          <div className="p-6 border-b shrink-0">
            <DialogHeader>
              <DialogTitle>Creare Bon de Transfer Gestiune</DialogTitle>
              <DialogDescription>Transferați produse din stocul depozit către producție.</DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-6">
            <Form {...form}>
              <form id="transfer-form" className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="transferDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data transferului</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
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
                            <SelectItem value="Distrugere">Distrugere</SelectItem>
                            <SelectItem value="Extern">Extern</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Note</FormLabel>
                      <FormControl>
                        <Input placeholder="Note..." {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="border rounded-md p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-md font-medium">Produse de transferat</h3>
                    <Select
                      onValueChange={handleAddItem}
                      onOpenChange={(open) => {
                        if (open) setSearchTerm("");
                        setIsSearchFocused(open);
                      }}
                    >
                      <SelectTrigger className="w-full sm:w-[400px]">
                        <SelectValue placeholder="Adăugați un produs" />
                      </SelectTrigger>
                      {/* MODIFICARE AICI: Folosim portal false și clase de scroll pentru a menține lista în interiorul Dialogului */}
                      <SelectContent
                        position="popper"
                        className="w-[var(--radix-select-trigger-width)] max-h-[300px] overflow-y-auto z-[100] bg-white border shadow-md"
                      >
                        <div className="px-2 py-2 sticky top-0 bg-white z-10 border-b">
                          <Input
                            placeholder="Caută produse..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={(e) => e.stopPropagation()}
                            autoFocus
                          />
                        </div>
                        {Object.keys(groupedByLot).length === 0 ? (
                          <div className="p-3 text-center text-muted-foreground">Fără rezultate</div>
                        ) : (
                          Object.entries(groupedByLot)
                            .sort(([, a], [, b]) => a.productName.localeCompare(b.productName))
                            .map(([groupKey, group]) => (
                              <SelectItem key={groupKey} value={groupKey} className="py-3">
                                <div className="flex flex-col">
                                  <span className="font-medium">
                                    {group.productName} - Lot: {group.lotNumber || "N/A"}
                                  </span>
                                  <span className="text-sm text-blue-600">
                                    Disponibil: {group.totalQuantity.toFixed(2)} {group.unit}
                                  </span>
                                </div>
                              </SelectItem>
                            ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedItems.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">Niciun produs selectat</div>
                  ) : (
                    <div className="space-y-4">
                      {selectedItems.map((item, index) => (
                        <div key={index} className="flex flex-col gap-3 p-3 border rounded-md bg-muted/30 relative">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 h-8 w-8 text-red-500"
                            onClick={() => handleRemoveItem(index)}
                          >
                            &times;
                          </Button>
                          <div>
                            <h4 className="font-medium">{item.productName}</h4>
                            <p className="text-xs text-muted-foreground">
                              Lot: {item.lot_number || "-"} | Disponibil: {item.maxQuantity} {item.unit}
                            </p>
                          </div>
                          <div className="space-y-3">
                            {inventoryType === "etichete" ? (
                              <Input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => handleQuantityChange(index, parseFloat(e.target.value) || 0)}
                              />
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <Input
                                  placeholder="Brut"
                                  type="number"
                                  value={item.grossQuantity || ""}
                                  onChange={(e) => handleGrossQuantityChange(index, parseFloat(e.target.value) || 0)}
                                />
                                <Select
                                  value={item.crateTypeId || "no-crate"}
                                  onValueChange={(v) => handleCrateTypeChange(index, v)}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Tip lădiță" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="no-crate">Fără lăzi</SelectItem>
                                    {crateTypes.map((ct) => (
                                      <SelectItem key={ct.id} value={ct.id}>
                                        {ct.name} ({ct.weight}kg)
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Input
                                  placeholder="Nr. lăzi"
                                  type="number"
                                  value={item.crateCount || ""}
                                  onChange={(e) => handleCrateCountChange(index, parseInt(e.target.value) || 0)}
                                  disabled={!item.crateTypeId}
                                />
                                <Input
                                  placeholder="Tări palet"
                                  type="number"
                                  value={item.crateWeight || ""}
                                  onChange={(e) => handleCrateWeightChange(index, parseFloat(e.target.value) || 0)}
                                />
                                <div className="col-span-full font-bold text-blue-600 bg-blue-50 p-2 rounded border">
                                  Net: {item.quantity.toFixed(2)} {item.unit}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </form>
            </Form>
          </div>

          <div className="p-6 border-t shrink-0">
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Anulează
              </Button>
              <Button type="submit" form="transfer-form" disabled={selectedItems.length === 0 || isSubmitting}>
                {isSubmitting ? "Se procesează..." : "Creare bon de transfer"}
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
