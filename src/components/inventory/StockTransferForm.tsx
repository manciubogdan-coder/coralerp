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
    }
  }, [isOpen]);

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

  const availableItems = inventory.filter(item => 
    !selectedItems.some(selected => {
      const productName = item.products?.name || item.name || 'Produs necunoscut';
      const lotKey = item.lot_number || 'fara-lot';
      const itemLotKey = `${productName}-${lotKey}`;
      return selected.lotKey === itemLotKey;
    })
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
    const productName = item.products?.name || item.name || 'Produs necunoscut';
    const groupKey = `${productName}-${lotKey}`;
    
    // Verifică că groupKey nu este gol
    if (!groupKey || groupKey.trim() === '' || groupKey === '-') {
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

  const handleAddItem = (lotKey: string) => {
    const group = groupedByLot[lotKey];
    if (!group) return;

    const transferItem: TransferItem = {
      lotKey,
      productName: group.productName,
      lot_number: group.lotNumber || '',
      quantity: group.totalQuantity,
      unit: group.unit,
      maxQuantity: group.totalQuantity,
      items: group.items,
      supplier: group.supplier,
      manufacturer: group.manufacturer,
      product_id: group.items[0]?.product_id,
      supplier_id: group.items[0]?.supplier_id,
      manufacturer_id: group.items[0]?.manufacturer_id
    };
    
    setSelectedItems([...selectedItems, transferItem]);
  };

  const handleQuantityChange = (index: number, value: number) => {
    const updatedItems = [...selectedItems];
    const item = updatedItems[index];
    
    const newQuantity = Math.max(0, Math.min(value, item.maxQuantity));
    
    updatedItems[index] = {
      ...item,
      quantity: newQuantity
    };
    
    setSelectedItems(updatedItems);
  };

  const handleRemoveItem = (index: number) => {
    setSelectedItems(selectedItems.filter((_, i) => i !== index));
  };

  const onSubmit = async (formData: TransferFormValues) => {
    if (selectedItems.length === 0) {
      toast({
        variant: "destructive",
        title: "Eroare",
        description: "Vă rugăm să selectați cel puțin un produs pentru transfer."
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const transfersTable = inventoryType === 'ambalaje' ? 'ambalaje_stock_transfers' : 'stock_transfers';
      const transferItemsTable = inventoryType === 'ambalaje' ? 'ambalaje_stock_transfer_items' : 'stock_transfer_items';
      const inventoryTable = inventoryType === 'ambalaje' ? 'ambalaje_inventory' : 'inventory';
      const historyTable = inventoryType === 'ambalaje' ? 'ambalaje_inventory_history' : 'inventory_history';

      // Creează transferul principal
      const { data: transfer, error: transferError } = await supabase
        .from(transfersTable)
        .insert({
          transfer_date: formData.transferDate,
          destination: formData.destination,
          notes: formData.notes
        })
        .select()
        .single();

      if (transferError) throw transferError;

      // Pentru fiecare lot selectat, scade cantitatea din intrările disponibile
      for (const item of selectedItems) {
        let remainingQuantity = item.quantity;
        
        // Sortează intrările după data recepției (FIFO)
        const sortedItems = [...item.items].sort((a, b) => 
          new Date(a.receipt_date || '').getTime() - new Date(b.receipt_date || '').getTime()
        );

        for (const inventoryItem of sortedItems) {
          if (remainingQuantity <= 0) break;

          const quantityToDeduct = Math.min(remainingQuantity, inventoryItem.quantity);
          const newQuantity = inventoryItem.quantity - quantityToDeduct;

          // Actualizează cantitatea în inventar
          const { error: updateError } = await supabase
            .from(inventoryTable)
            .update({ quantity: newQuantity })
            .eq('id', inventoryItem.id);

          if (updateError) throw updateError;

          // Adaugă în istoric
          const { error: historyError } = await supabase
            .from(historyTable)
            .insert({
              inventory_item_id: inventoryItem.id,
              name: inventoryItem.name,
              action: 'transfer_out',
              quantity: quantityToDeduct,
              previous_quantity: inventoryItem.quantity,
              unit: inventoryItem.unit,
              supplier: inventoryItem.supplier || inventoryItem.suppliers?.name,
              supplier_id: inventoryItem.supplier_id,
              manufacturer_id: inventoryItem.manufacturer_id,
              product_id: inventoryItem.product_id,
              lot_number: inventoryItem.lot_number,
              document_number: inventoryItem.document_number,
              notes: `Transfer către ${formData.destination}`,
              operation_date: formData.transferDate
            });

          if (historyError) throw historyError;

          // Creează item-ul de transfer
          const { error: transferItemError } = await supabase
            .from(transferItemsTable)
            .insert({
              transfer_id: transfer.id,
              inventory_item_id: inventoryItem.id,
              quantity: quantityToDeduct,
              unit: inventoryItem.unit
            });

          if (transferItemError) throw transferItemError;

          remainingQuantity -= quantityToDeduct;
        }
      }

      toast({
        title: "Transfer creat cu succes",
        description: `Bonul de transfer pentru ${formData.destination} a fost generat.`
      });

      setIsOpen(false);
      setSelectedItems([]);
      form.reset();
      
      if (onTransferComplete) {
        onTransferComplete();
      }

    } catch (error: any) {
      console.error("Error creating transfer:", error);
      toast({
        variant: "destructive",
        title: "Eroare la crearea transferului",
        description: error.message
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Verifică dacă cantitatea este validă
  const isQuantityValid = (item: TransferItem) => {
    return item.quantity <= item.maxQuantity && item.quantity > 0;
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
                        <SelectItem 
                          key={groupKey} 
                          value={groupKey} 
                          className={`py-4 ${isMobile ? 'text-base' : ''}`}
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">
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
                        </SelectItem>
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
                          <h4 className="font-medium">{item.productName}</h4>
                          <p className="text-xs text-gray-500">
                            Lot: {item.lot_number || '-'}
                          </p>
                          <p className="text-xs text-gray-500">
                            Furnizor: {item.supplier || '-'}
                          </p>
                          <p className="text-sm text-blue-600">
                            Disponibil: {item.maxQuantity} {item.unit}
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
                      
                      <div className="grid grid-cols-1 gap-2">
                        <div>
                          <label className="text-sm">Cantitate de transferat {item.unit}</label>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleQuantityChange(index, parseFloat(e.target.value) || 0)}
                            min={0}
                            max={item.maxQuantity}
                            step="0.01"
                            className={isMobile ? 'h-12' : ''}
                          />
                          {!isQuantityValid(item) && (
                            <p className="text-xs text-red-600 mt-1">
                              Cantitatea trebuie să fie între 0.01 și {item.maxQuantity.toFixed(2)} {item.unit}
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