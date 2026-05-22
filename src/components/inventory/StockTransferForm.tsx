import React, { useState, useEffect, useRef } from "react";
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
import { ConfirmationDialog } from "./ConfirmationDialog";
import { Badge } from "@/components/ui/badge";
import { emitNotification } from "@/lib/notifications";
import { TransferQRDialog } from "./TransferQRDialog";
import type { TransferLabelData } from "./TransferQRLabel";

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

const MIN_TRANSFER_QUANTITY = 0.000001;

const normalizeStockQuantity = (quantity: number) =>
  Math.abs(quantity) < MIN_TRANSFER_QUANTITY ? 0 : Number(quantity.toFixed(6));

export function StockTransferForm({ onTransferComplete }: StockTransferFormProps) {
  const { inventoryType } = useInventoryType();
  const [isOpen, setIsOpen] = useState(false);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<TransferItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [crateTypes, setCrateTypes] = useState<any[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [qrLabels, setQrLabels] = useState<TransferLabelData[]>([]);
  const [qrOpen, setQrOpen] = useState(false);
  const isMobile = useIsMobile();
  const productSelectTriggerRef = useRef<HTMLButtonElement>(null);

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
    } else {
      // Reset preselect when dialog closes
      pendingPreselectRef.current = null;
    }
  }, [isOpen, inventoryType]);

  // Auto-add the scanned lot once inventory is loaded
  useEffect(() => {
    const targetId = pendingPreselectRef.current;
    if (!isOpen || !targetId || inventory.length === 0) return;
    const match = inventory.find((it) => it.id === targetId);
    if (!match) return;
    const productName = match.products?.name || match.name || "Produs necunoscut";
    const lotKey = `${productName}-${match.lot_number || "fara-lot"}`;
    // Skip if already added
    if (selectedItems.some((s) => s.lotKey === lotKey)) {
      pendingPreselectRef.current = null;
      return;
    }
    // Aggregate all inventory entries sharing the same product+lot
    const sameLot = inventory.filter((it) => {
      const pn = it.products?.name || it.name || "";
      return pn === productName && (it.lot_number || "") === (match.lot_number || "");
    });
    const total = sameLot.reduce((s, it) => s + Number(it.quantity || 0), 0);
    const transferItem: TransferItem = {
      lotKey,
      productName,
      lot_number: match.lot_number || "",
      quantity: total,
      unit: match.unit,
      maxQuantity: total,
      items: sameLot,
      supplier: match.supplier || match.suppliers?.name,
      manufacturer: match.manufacturer || match.manufacturers?.name,
      product_id: match.product_id,
      supplier_id: match.supplier_id,
      manufacturer_id: match.manufacturer_id,
    };
    setSelectedItems((prev) => [...prev, transferItem]);
    pendingPreselectRef.current = null;
    toast({
      title: "Lot preselectat din scanare",
      description: `${productName} • Lot ${match.lot_number || "N/A"} • ${total.toFixed(2)} ${match.unit}`,
    });
  }, [inventory, isOpen]);

  const pendingPreselectRef = useRef<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { inventoryItemId?: string } | undefined;
      if (detail?.inventoryItemId) {
        pendingPreselectRef.current = detail.inventoryItemId;
      }
      setIsOpen(true);
    };
    window.addEventListener("open-transfer-form", handler as EventListener);
    return () => window.removeEventListener("open-transfer-form", handler as EventListener);
  }, []);

  useEffect(() => {
    if (!isOpen || isMobile) return;
    if (pendingPreselectRef.current) return; // skip auto-open when lot pre-selected
    const timer = window.setTimeout(() => {
      productSelectTriggerRef.current?.focus();
      productSelectTriggerRef.current?.click();
    }, 120);

    return () => window.clearTimeout(timer);
  }, [isOpen, isMobile]);

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
        .gt("quantity", MIN_TRANSFER_QUANTITY)
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

  // Grupează produsele după lot pentru afișare
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
      acc[groupKey].totalQuantity = normalizeStockQuantity(acc[groupKey].totalQuantity + item.quantity);

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

    updatedItems[index] = {
      ...item,
      quantity: newQuantity,
    };

    setSelectedItems(updatedItems);
  };

  const handleGrossQuantityChange = (index: number, value: number) => {
    const updatedItems = [...selectedItems];
    const item = updatedItems[index];

    updatedItems[index] = {
      ...item,
      grossQuantity: value,
    };

    calculateNetQuantity(index, updatedItems);
    setSelectedItems(updatedItems);
  };

  const handleCrateTypeChange = (index: number, crateTypeId: string) => {
    const updatedItems = [...selectedItems];

    updatedItems[index] = {
      ...updatedItems[index],
      crateTypeId: crateTypeId === "no-crate" ? null : crateTypeId,
    };

    calculateNetQuantity(index, updatedItems);
    setSelectedItems(updatedItems);
  };

  const handleCrateCountChange = (index: number, count: number) => {
    const updatedItems = [...selectedItems];

    updatedItems[index] = {
      ...updatedItems[index],
      crateCount: count,
    };

    calculateNetQuantity(index, updatedItems);
    setSelectedItems(updatedItems);
  };

  const handleCrateWeightChange = (index: number, weight: number) => {
    const updatedItems = [...selectedItems];

    updatedItems[index] = {
      ...updatedItems[index],
      crateWeight: weight,
    };

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

    items[index] = {
      ...item,
      netQuantity: calculatedNet,
      quantity: calculatedNet, // Folosim cantitatea netă ca și cantitate de transfer
    };
  };

  const handleRemoveItem = (index: number) => {
    setSelectedItems(selectedItems.filter((_, i) => i !== index));
  };

  const onSubmit = (formData: TransferFormValues) => {
    if (selectedItems.length === 0) {
      toast({
        variant: "destructive",
        title: "Eroare",
        description: "Vă rugăm să selectați cel puțin un produs pentru transfer.",
      });
      return;
    }
    // Verifică validitatea cantităților înainte să deschidă confirmarea
    const invalid = selectedItems.find((it) => !(it.quantity > 0 && it.quantity <= it.maxQuantity));
    if (invalid) {
      toast({
        variant: "destructive",
        title: "Cantitate invalidă",
        description: `Verifică cantitatea pentru ${invalid.productName}.`,
      });
      return;
    }
    setShowConfirm(true);
  };

  const executeTransfer = async () => {
    const formData = form.getValues();
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
        .insert({
          transfer_date: formData.transferDate,
          destination: formData.destination,
          notes: formData.notes,
        })
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

          const availableNet = normalizeStockQuantity(inventoryItem.quantity || 0);
          if (availableNet <= 0) continue;

          const netToDeduct = Math.min(remainingNet, availableNet);
          const newQuantity = normalizeStockQuantity(availableNet - netToDeduct);

          const { error: updateError } = await supabase
            .from(inventoryTable)
            .update({ quantity: newQuantity })
            .eq("id", inventoryItem.id);

          if (updateError) throw updateError;

          const { error: historyError } = await supabase.from(historyTable).insert({
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

          if (historyError) throw historyError;

          const grossForThisItem =
            ratioNetPerGross > 0 ? Number((netToDeduct / ratioNetPerGross).toFixed(3)) : netToDeduct;

          const { error: transferItemError } = await supabase.from(transferItemsTable).insert({
            transfer_id: transfer.id,
            inventory_item_id: inventoryItem.id,
            quantity: grossForThisItem,
            net_quantity: netToDeduct,
            unit: inventoryItem.unit,
          });

          if (transferItemError) throw transferItemError;

          remainingNet = normalizeStockQuantity(remainingNet - netToDeduct);
        }
      }

      const dest = (formData.destination || "").toString();
      const isProductionDest = /produc[țt]ie/i.test(dest);
      try {
        await emitNotification("transfer.created", "Transfer creat", {
          body: `Bon transfer către ${dest} (${selectedItems.length} produse)`,
          link: "/depozit-mp",
          payload: { destination: dest, items: selectedItems.length },
        });
        if (isProductionDest) {
          await emitNotification("transfer.to_production", "Transfer către Producție", {
            body: `Bon transfer către ${dest} (${selectedItems.length} produse)`,
            link: "/depozit-mp",
            payload: { destination: dest, items: selectedItems.length },
          });
        }
      } catch (e) {
        console.warn("[transfer] notif emit failed", e);
      }

      toast({
        title: "Transfer creat cu succes",
        description: `Bonul de transfer pentru ${formData.destination} a fost generat.`,
      });

      // Pregătim etichetele QR (câte una pentru fiecare linie de transfer)
      const labels: TransferLabelData[] = selectedItems.map((it) => ({
        inventory_item_id: it.items[0]?.id || "",
        product_name: it.productName,
        lot_number: it.lot_number,
        quantity: it.quantity,
        unit: it.unit,
        destination: formData.destination,
        transfer_date: formData.transferDate,
        supplier: it.supplier,
        manufacturer: it.manufacturer,
        document_number: it.items[0]?.document_number,
      }));

      setShowConfirm(false);
      setIsOpen(false);
      setSelectedItems([]);
      form.reset();
      setQrLabels(labels);
      setQrOpen(true);

      if (onTransferComplete) {
        onTransferComplete();
      }
    } catch (error: any) {
      console.error("Error creating transfer:", error);
      toast({
        variant: "destructive",
        title: "Eroare la crearea transferului",
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isQuantityValid = (item: TransferItem) => {
    return item.quantity <= item.maxQuantity && item.quantity > 0;
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size={isMobile ? "default" : "sm"}>
          <FileText className="h-4 w-4 mr-2" />
          Bon de Transfer
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-w-3xl w-[95vw] max-h-[90vh] overflow-hidden p-0 gap-0 max-sm:inset-0 max-sm:w-screen max-sm:h-[100dvh] max-sm:max-w-none max-sm:max-h-none max-sm:rounded-none max-sm:border-0 max-sm:left-0 max-sm:top-0 max-sm:translate-x-0 max-sm:translate-y-0"
        onPointerDownOutside={(e) => { if (isMobile) e.preventDefault(); }}
        onInteractOutside={(e) => { if (isMobile) e.preventDefault(); }}
      >
        <div className="flex flex-col h-full max-h-[100dvh] sm:max-h-[90vh]">
          <div className="p-4 sm:p-6 border-b shrink-0">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg">Creare Bon de Transfer Gestiune</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Transferați produse din stocul depozit către producție sau alte departamente.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
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
                        <FormControl>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selectați destinația" />
                            </SelectTrigger>
                            <SelectContent className="bg-popover">
                              <SelectItem value="Producție" className="py-3 text-base">
                                Producție
                              </SelectItem>
                              <SelectItem value="Distrugere" className="py-3 text-base">
                                Distrugere
                              </SelectItem>
                              <SelectItem value="Extern" className="py-3 text-base">
                                Extern
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
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
                        <Input placeholder="Notițe opționale despre transfer" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="border rounded-md p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-md font-medium">Produse de transferat</h3>
                    <Select
                      onValueChange={handleAddItem}
                      onOpenChange={(open) => {
                        if (open) {
                          setSearchTerm("");
                          setIsSearchFocused(true);
                        } else {
                          setIsSearchFocused(false);
                        }
                      }}
                    >
                      <SelectTrigger ref={productSelectTriggerRef} className={`w-full sm:w-[400px] ${isMobile ? "h-12" : ""}`}>
                        <SelectValue placeholder="Adăugați un produs" />
                      </SelectTrigger>
                      <SelectContent disablePortal={true} className="bg-popover max-h-[40vh] overflow-y-auto z-50">
                        <div className="px-3 py-2 border-b bg-popover sticky top-0 z-10">
                          <Input
                            placeholder="Caută produse..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={(e) => e.stopPropagation()}
                            className={isMobile ? "h-12" : ""}
                            autoFocus
                          />
                        </div>

                        {Object.keys(groupedByLot).length === 0 ? (
                          <div className="p-3 text-center text-muted-foreground">Nu există produse disponibile</div>
                        ) : (
                          Object.entries(groupedByLot)
                            .sort(([, a], [, b]) => a.productName.localeCompare(b.productName))
                            .map(([groupKey, group]) => (
                              <SelectItem
                                key={groupKey}
                                value={groupKey}
                                className={`py-4 ${isMobile ? "text-base" : ""}`}
                              >
                                <div className="flex flex-col">
                                  <span className="font-medium">
                                    {group.productName} - Lot: {group.lotNumber || "N/A"}
                                  </span>
                                  <span className="text-sm text-blue-600 font-medium">
                                    Total disponibil: {group.totalQuantity.toFixed(2)} {group.unit}
                                  </span>
                                  {(group.supplier || group.manufacturer) && (
                                    <span className="text-xs text-muted-foreground">
                                      {group.supplier && <>Furnizor: {group.supplier}</>}
                                      {group.supplier && group.manufacturer && " • "}
                                      {group.manufacturer && <>Producător: {group.manufacturer}</>}
                                    </span>
                                  )}
                                </div>
                              </SelectItem>
                            ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedItems.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>Niciun produs selectat</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {selectedItems.map((item, index) => (
                        <div key={index} className="flex flex-col gap-3 p-3 border rounded-md bg-muted/30">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">{item.productName}</h4>
                              {item.lot_number && (
                                <p className="text-xs text-muted-foreground">Lot: {item.lot_number}</p>
                              )}
                              {(item.supplier || item.manufacturer) && (
                                <p className="text-xs text-muted-foreground">
                                  {item.supplier && <>Furnizor: {item.supplier}</>}
                                  {item.supplier && item.manufacturer && " • "}
                                  {item.manufacturer && <>Producător: {item.manufacturer}</>}
                                </p>
                              )}
                              <p className="text-sm text-blue-600">
                                Disponibil: {item.maxQuantity} {item.unit}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className={`${isMobile ? "h-10 w-10" : "h-8 w-8"} p-0`}
                              onClick={() => handleRemoveItem(index)}
                            >
                              &times;
                            </Button>
                          </div>

                          <div className="space-y-3">
                            <div>
                              <label className="text-sm font-medium">Cantitate netă ({item.unit})</label>
                              <Input
                                type="number"
                                inputMode="decimal"
                                step="0.01"
                                min="0"
                                value={item.quantity || ""}
                                onChange={(e) => handleQuantityChange(index, parseFloat(e.target.value) || 0)}
                                className={isMobile ? "h-12 text-lg" : ""}
                                placeholder={`Net în ${item.unit}`}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </form>
            </Form>
          </div>

          <div className="p-4 sm:p-6 border-t shrink-0 bg-background">
            <DialogFooter className="flex-row gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)} className="flex-1 sm:flex-none h-12 sm:h-10">
                Anulează
              </Button>
              <Button type="submit" form="transfer-form" disabled={selectedItems.length === 0 || isSubmitting} className="flex-1 sm:flex-none h-12 sm:h-10">
                {isSubmitting ? "Se procesează..." : "Creare bon"}
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>

      <ConfirmationDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        onConfirm={executeTransfer}
        isSubmitting={isSubmitting}
        title="CONFIRMĂ BONUL DE TRANSFER"
        description="Verifică cu atenție produsele și cantitățile. Aceste cantități vor fi scăzute din stoc."
        confirmLabel="CONFIRM transferul"
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-muted/40 border p-5 space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Destinație</div>
                <div className="text-2xl font-bold mt-1">{form.getValues("destination")}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Data transfer</div>
                <div className="text-base font-semibold mt-1">{form.getValues("transferDate")}</div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <div className="bg-muted/60 px-4 py-2 text-xs uppercase tracking-wide font-semibold flex justify-between">
              <span>Produse de transferat</span>
              <Badge variant="secondary">
                {selectedItems.length} {selectedItems.length === 1 ? "linie" : "linii"}
              </Badge>
            </div>
            <div className="divide-y">
              {selectedItems.map((it, i) => (
                <div key={i} className="px-4 py-3 flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="text-base font-bold truncate">{it.productName}</div>
                    {it.lot_number && (
                      <div className="text-xs text-muted-foreground mt-0.5">Lot: {it.lot_number}</div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-2xl font-extrabold text-primary leading-none">
                      {it.quantity.toFixed(it.unit === "buc" ? 0 : 2)}
                    </div>
                    <div className="text-xs font-semibold text-muted-foreground mt-0.5">{it.unit}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ConfirmationDialog>
    </Dialog>
  );
}
