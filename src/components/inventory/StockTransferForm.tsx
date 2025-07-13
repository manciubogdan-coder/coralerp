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
import { 
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage 
} from "@/components/ui/form";
import { FileText } from "lucide-react";
import { useForm } from "react-hook-form";
import { useIsMobile } from "@/hooks/use-mobile";
import { useInventoryType } from "@/App";

interface StockTransferFormProps {
  onTransferComplete?: () => void;
}

interface TransferItem {
  id: string;
  productName: string;
  quantity: number;
  unit: string;
  maxQuantity: number; // Cantitatea netă maximă disponibilă
  maxGrossQuantity: number; // Cantitatea brută maximă estimată
  crateCount?: number;
  crateTypeId?: string;
  crateWeight?: number;
  pallets?: number;
  palletWeight?: number;
  grossQuantity: number;
  netQuantity: number;
  originalCrateCount?: number;
  lot_number?: string;
  // Informații adiționale pentru reintroducere
  supplier?: string;
  supplier_id?: string;
  manufacturer?: string;
  manufacturer_id?: string;
  document_number?: string;
  entry_number?: number;
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
  const [crateTypes, setCrateTypes] = useState<{id: string, name: string, weight: number}[]>([]);
  const isMobile = useIsMobile();

  const form = useForm<TransferFormValues>({
    defaultValues: {
      transferDate: new Date().toISOString().split('T')[0],
      destination: "Producție",
      notes: ""
    }
  });

  useEffect(() => {
    if (isOpen) {
      fetchInventory();
      fetchCrateTypes();
    }
  }, [isOpen]);

  const fetchCrateTypes = async () => {
    try {
      const crateTypesTable = inventoryType === 'ambalaje' ? 'ambalaje_crate_types' : 'crate_types';
      const { data, error } = await supabase
        .from(crateTypesTable)
        .select('id, name, weight')
        .order('name');
      
      if (error) throw error;
      setCrateTypes(data || []);
    } catch (error: any) {
      console.error('Error fetching crate types:', error);
    }
  };

  const fetchInventory = async () => {
    try {
      const tableName = inventoryType === 'ambalaje' ? 'ambalaje_inventory' : 'inventory';
      
      const { data, error } = await supabase
        .from(tableName)
        .select(`
          *,
          suppliers:supplier_id (name),
          products:product_id (name),
          manufacturers:manufacturer_id (name)
        `)
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

  const handleAddItem = (itemId: string) => {
    const selectedItem = inventory.find(item => item.id === itemId);
    if (!selectedItem) return;

    const productName = selectedItem.products?.name || selectedItem.name;
    
    // Estimăm o cantitate brută maximă permisă ca fiind de 50% mai mare decât cea netă
    // Aceasta este o estimare pentru a oferi o limită rezonabilă, dar permisivă
    const maxGrossEstimate = selectedItem.quantity * 1.5;
    
    setSelectedItems([...selectedItems, {
      id: selectedItem.id,
      productName,
      quantity: selectedItem.quantity,
      unit: selectedItem.unit,
      maxQuantity: selectedItem.quantity,
      maxGrossQuantity: maxGrossEstimate,
      crateCount: 0,
      originalCrateCount: 0,
      crateTypeId: undefined,
      crateWeight: 0,
      pallets: 0,
      palletWeight: 0,
      grossQuantity: selectedItem.quantity,
      netQuantity: selectedItem.quantity,
      // Informații adiționale salvate
      supplier: selectedItem.supplier || selectedItem.suppliers?.name,
      supplier_id: selectedItem.supplier_id,
      manufacturer: selectedItem.manufacturer || selectedItem.manufacturers?.name,
      manufacturer_id: selectedItem.manufacturer_id,
      document_number: selectedItem.document_number,
      entry_number: selectedItem.entry_number,
      lot_number: selectedItem.lot_number
    }]);
  };

  const calculateNetQuantity = (item: TransferItem) => {
    // Calculăm deducerile din lăzi folosind greutatea corectă din baza de date
    let totalCrateWeight = 0;
    if (item.crateTypeId && item.crateCount && item.crateCount > 0) {
      // Găsim tipul de lădiță în lista crateTypes sau facem query direct
      const crateType = crateTypes.find(ct => ct.id === item.crateTypeId);
      if (crateType) {
        totalCrateWeight = crateType.weight * item.crateCount;
      }
    }
    
    // Calculăm deducerile din paleți
    const totalPalletWeight = item.palletWeight || 0;
    
    // Calculăm cantitatea netă scăzând greutățile din cantitatea brută
    return Math.max(0, item.grossQuantity - totalCrateWeight - totalPalletWeight);
  };

  const handleGrossQuantityChange = (index: number, value: number) => {
    const updatedItems = [...selectedItems];
    const item = updatedItems[index];
    
    // Permite orice cantitate brută, fără limite superioare
    const newGrossQuantity = Math.max(0, value);
    
    updatedItems[index] = {
      ...item,
      grossQuantity: newGrossQuantity,
    };
    
    // Recalculate net quantity
    updatedItems[index].netQuantity = calculateNetQuantity(updatedItems[index]);
    
    setSelectedItems(updatedItems);
  };

  const handleCrateCountChange = (index: number, value: number) => {
    const updatedItems = [...selectedItems];
    const item = updatedItems[index];
    const newCrateCount = Math.max(0, value);
    
    updatedItems[index] = {
      ...item,
      crateCount: newCrateCount
    };
    
    // Recalculate net quantity
    updatedItems[index].netQuantity = calculateNetQuantity(updatedItems[index]);
    
    setSelectedItems(updatedItems);
  };

  const handlePalletsChange = (index: number, value: number) => {
    const updatedItems = [...selectedItems];
    updatedItems[index] = {
      ...updatedItems[index],
      pallets: Math.max(0, value)
    };
    setSelectedItems(updatedItems);
  };
  
  const handlePalletWeightChange = (index: number, value: number) => {
    const updatedItems = [...selectedItems];
    const item = updatedItems[index];
    const newPalletWeight = Math.max(0, value);
    
    updatedItems[index] = {
      ...item,
      palletWeight: newPalletWeight
    };
    
    // Recalculate net quantity
    updatedItems[index].netQuantity = calculateNetQuantity(updatedItems[index]);
    
    setSelectedItems(updatedItems);
  };

  const handleRemoveItem = (index: number) => {
    const updatedItems = [...selectedItems];
    updatedItems.splice(index, 1);
    setSelectedItems(updatedItems);
  };

  const onSubmit = async (formData: TransferFormValues) => {
    if (selectedItems.length === 0) {
      toast({
        variant: "destructive",
        title: "Eroare",
        description: "Adăugați cel puțin un produs pentru transfer."
      });
      return;
    }

    // Verificăm dacă cantitatea netă depășește cantitatea maximă disponibilă
    const invalidItem = selectedItems.find(item => item.netQuantity > item.maxQuantity);
    if (invalidItem) {
      toast({
        variant: "destructive",
        title: "Cantitate netă depășită",
        description: `Pentru ${invalidItem.productName} cantitatea netă (${invalidItem.netQuantity.toFixed(2)} ${invalidItem.unit}) depășește stocul disponibil (${invalidItem.maxQuantity.toFixed(2)} ${invalidItem.unit}).`
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Use appropriate transfer tables based on inventory type
      const transferTable = inventoryType === 'ambalaje' ? 'ambalaje_stock_transfers' : 'stock_transfers';
      const transferItemsTable = inventoryType === 'ambalaje' ? 'ambalaje_stock_transfer_items' : 'stock_transfer_items';
      
      // First create a transfer document
      const { data: transferData, error: transferError } = await supabase
        .from(transferTable)
        .insert({
          transfer_date: formData.transferDate,
          destination: formData.destination,
          notes: formData.notes
        })
        .select()
        .single();
      
      if (transferError) throw transferError;
      
      if (!transferData) {
        throw new Error("Nu s-a putut crea bonul de transfer.");
      }
      
      // Process each item in the transfer
      for (const item of selectedItems) {
        // Add item to transfer items table
        const { error: transferItemError } = await supabase
          .from(transferItemsTable)
          .insert({
            transfer_id: transferData.id,
            inventory_item_id: item.id,
            quantity: item.netQuantity,
            unit: item.unit
          });
          
        if (transferItemError) throw transferItemError;

        // Record the transfer in inventory_history
        const inventoryTable = inventoryType === 'ambalaje' ? 'ambalaje_inventory' : 'inventory';
        const historyTable = inventoryType === 'ambalaje' ? 'ambalaje_inventory_history' : 'inventory_history';
        
        // Get the actual lot_number from the inventory item if not available on selected item
        const actualLotNumber = item.lot_number;
        
        console.log('Debug transfer item:', {
          id: item.id,
          productName: item.productName,
          lot_number: actualLotNumber,
          netQuantity: item.netQuantity
        });
        
        const { error: historyError } = await supabase
          .from(historyTable)
          .insert({
            inventory_item_id: item.id,
            action: "remove",
            name: item.productName,
            quantity: item.netQuantity,
            unit: item.unit,
            lot_number: actualLotNumber,
            operation_date: new Date().toISOString(),
            supplier: item.supplier,
            supplier_id: item.supplier_id,
            manufacturer_id: item.manufacturer_id,
            document_number: item.document_number,
            notes: `Transfer către ${formData.destination}`
          });
          
        if (historyError) throw historyError;

        // Update inventory quantity - scadem cantitatea transferată din stoc
        const { data: inventoryItem, error: getError } = await supabase
          .from(inventoryTable)
          .select('quantity')
          .eq('id', item.id)
          .single();
        
        if (getError) throw getError;
        
        const currentQuantity = inventoryItem?.quantity || 0;
        const newQuantity = Math.max(0, currentQuantity - item.netQuantity);
        
        console.log('Transfer update:', {
          itemId: item.id,
          currentQuantity: currentQuantity,
          removingQuantity: item.netQuantity,
          newQuantity: newQuantity
        });
        
        // Update quantity
        const { error: updateError } = await supabase
          .from(inventoryTable)
          .update({ 
            quantity: newQuantity
          })
          .eq('id', item.id);
           
        if (updateError) throw updateError;
      }

      toast({
        title: "Succes",
        description: `Bon de transfer creat cu succes.`
      });

      setSelectedItems([]);
      setIsOpen(false);
      if (onTransferComplete) onTransferComplete();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Eroare la procesarea transferului",
        description: error.message
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableItems = inventory.filter(
    item => !selectedItems.some(selected => selected.id === item.id)
  );

  const filteredItems = availableItems.filter(item => {
    const productName = item.products?.name || item.name || '';
    const supplierName = item.supplier || item.suppliers?.name || '';
    const manufacturerName = item.manufacturer || item.manufacturers?.name || '';
    const lotNumber = item.lot_number || '';
    const searchLower = searchTerm.toLowerCase();

    return productName.toLowerCase().includes(searchLower) ||
           supplierName.toLowerCase().includes(searchLower) ||
           manufacturerName.toLowerCase().includes(searchLower) ||
           lotNumber.toLowerCase().includes(searchLower);
  });

  // Grupează produsele după lot pentru afișare
  const groupedByLot = filteredItems.reduce((acc, item) => {
    const lotKey = item.lot_number || 'fara-lot';
    const productName = item.products?.name || item.name;
    const groupKey = `${productName}-${lotKey}`;
    
    if (!acc[groupKey]) {
      acc[groupKey] = {
        productName,
        lotNumber: item.lot_number,
        items: [],
        totalQuantity: 0,
        unit: item.unit,
        supplier: item.supplier || item.suppliers?.name,
        manufacturer: item.manufacturer || item.manufacturers?.name
      };
    }
    
    acc[groupKey].items.push(item);
    acc[groupKey].totalQuantity += item.quantity;
    
    return acc;
  }, {} as Record<string, {
    productName: string;
    lotNumber: string | null;
    items: InventoryItem[];
    totalQuantity: number;
    unit: string;
    supplier?: string;
    manufacturer?: string;
  }>);

  // Verifică dacă cantitatea netă rezultată din calculul cu noua cantitate brută este validă
  const isNetQuantityValid = (item: TransferItem) => {
    return item.netQuantity <= item.maxQuantity;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size={isMobile ? "default" : "sm"}>
          <FileText className="h-4 w-4 mr-2" />
          Bon de Transfer
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Creare Bon de Transfer Gestiune</DialogTitle>
          <DialogDescription>
            Transferați produse din stocul depozit către producție sau alte departamente.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
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
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selectați destinația" />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          <SelectItem value="Producție" className="py-3 text-base">Producție</SelectItem>
                          <SelectItem value="Distrugere" className="py-3 text-base">Distrugere</SelectItem>
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
                  <SelectTrigger className={`w-full sm:w-[400px] ${isMobile ? 'h-12' : ''}`}>
                    <SelectValue placeholder="Adăugați un produs" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <div className="px-3 py-2 sticky top-0 bg-white z-10 border-b">
                      <Input
                        placeholder="Caută produse..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={`mb-2 ${isMobile ? 'h-12' : ''}`}
                        onFocus={() => setIsSearchFocused(true)}
                        onBlur={() => setIsSearchFocused(false)}
                        autoFocus={isMobile} // Auto focus for mobile
                      />
                    </div>
                    {Object.keys(groupedByLot).length === 0 ? (
                      <div className="p-3 text-center text-gray-500">
                        Nu există produse disponibile
                      </div>
                    ) : (
                      Object.entries(groupedByLot).map(([groupKey, group]) => (
                        <div key={groupKey} className="px-3 py-2">
                          <div className="flex flex-col mb-2">
                            <span className="font-medium text-sm">
                              {group.productName} - Lot: {group.lotNumber || 'N/A'}
                            </span>
                            <span className="text-sm text-blue-600 font-medium">
                              Total disponibil: {group.totalQuantity.toFixed(2)} {group.unit}
                            </span>
                            <span className="text-xs text-gray-500">
                              {group.supplier ? `Furnizor: ${group.supplier}` : ''}
                              {group.manufacturer ? ` | Producător: ${group.manufacturer}` : ''}
                            </span>
                          </div>
                          <div className="ml-4 space-y-1">
                            {group.items.map(item => (
                              <SelectItem 
                                key={item.id} 
                                value={item.id} 
                                className={`py-2 ${isMobile ? 'text-base' : ''}`}
                              >
                                <div className="flex justify-between items-center w-full">
                                  <span className="text-sm">
                                    Intrare #{item.entry_number}
                                  </span>
                                  <span className="text-sm font-medium">
                                    {item.quantity} {item.unit}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {selectedItems.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>Niciun produs selectat</p>
                  <p className="text-sm mt-2">Folosiți meniul pentru a adăuga produse pentru transfer</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[300px] overflow-y-auto">
                  {selectedItems.map((item, index) => (
                    <div key={index} className="flex flex-col gap-3 p-3 border rounded-md bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-500">
                            Lot: {item.lot_number || '-'}
                          </p>
                          <p className="text-xs text-gray-500">
                            Furnizor: {item.supplier || '-'}
                          </p>
                          <p className="text-xs text-gray-500">
                            Document: {item.document_number || '-'} | Intrare nr.: {item.entry_number || '-'}
                          </p>
                        </div>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className={`${isMobile ? 'h-10 w-10' : 'h-8 w-8'} p-0`}
                          onClick={() => handleRemoveItem(index)}
                        >
                          &times;
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        <div>
                          <label className="text-sm">Cantitate brută {item.unit}</label>
                          <Input
                            type="number"
                            value={item.grossQuantity}
                            onChange={(e) => handleGrossQuantityChange(index, parseFloat(e.target.value) || 0)}
                            min={0}
                            step="0.01"
                            variant={!isNetQuantityValid(item) ? "warning" : "default"}
                            className={isMobile ? 'h-12' : ''}
                          />
                        </div>
                        
                         {inventoryType === 'materii-prime' && item.crateTypeId && (
                           <div>
                             <label className="text-sm">Număr lădițe</label>
                             <Input
                               type="number"
                               value={item.crateCount}
                               onChange={(e) => handleCrateCountChange(index, parseInt(e.target.value) || 0)}
                               min={0}
                               className={isMobile ? 'h-12' : ''}
                             />
                           </div>
                         )}
                        
                        <div>
                          <label className="text-sm">Număr paleți</label>
                          <Input
                            type="number"
                            value={item.pallets}
                            onChange={(e) => handlePalletsChange(index, parseInt(e.target.value) || 0)}
                            min={0}
                            className={isMobile ? 'h-12' : ''}
                          />
                        </div>
                        
                        <div>
                          <label className="text-sm">Greutate paleți (kg)</label>
                          <Input
                            type="number"
                            value={item.palletWeight}
                            onChange={(e) => handlePalletWeightChange(index, parseFloat(e.target.value) || 0)}
                            min={0}
                            step="0.01"
                            className={isMobile ? 'h-12' : ''}
                          />
                        </div>
                        
                        <div>
                          <label className="text-sm font-medium">Cantitate netă (se va extrage)</label>
                          <Input
                            type="number"
                            value={item.netQuantity.toFixed(2)}
                            readOnly
                            className={`bg-gray-100 font-medium ${isMobile ? 'h-12' : ''}`}
                            variant={!isNetQuantityValid(item) ? "warning" : "default"}
                          />
                          {!isNetQuantityValid(item) && (
                            <p className="text-xs text-amber-600 mt-1">
                              Atenție: Cantitatea netă depășește stocul disponibil de {item.maxQuantity.toFixed(2)} {item.unit}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Anulează
              </Button>
              <Button 
                type="submit" 
                disabled={selectedItems.length === 0 || isSubmitting}
                className={isMobile ? 'h-12' : ''}
              >
                {isSubmitting ? "Se procesează..." : "Creare bon de transfer"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
