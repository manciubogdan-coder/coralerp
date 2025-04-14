
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
import { FileText, Plus } from "lucide-react";
import { useForm } from "react-hook-form";

interface StockTransferFormProps {
  onTransferComplete?: () => void;
}

interface TransferItem {
  id: string;
  productName: string;
  quantity: number;
  unit: string;
  maxQuantity: number;
}

interface TransferFormValues {
  transferDate: string;
  destination: string;
  notes: string;
}

export function StockTransferForm({ onTransferComplete }: StockTransferFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<TransferItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      const { data, error } = await supabase
        .from("inventory")
        .select(`
          *,
          suppliers:supplier_id (name),
          products:product_id (name),
          manufacturers:manufacturer_id (name)
        `)
        .gt("quantity", 0)
        .order("name");

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
    
    setSelectedItems([...selectedItems, {
      id: selectedItem.id,
      productName,
      quantity: 1,
      unit: selectedItem.unit,
      maxQuantity: selectedItem.quantity
    }]);
  };

  const handleQuantityChange = (index: number, value: number) => {
    const updatedItems = [...selectedItems];
    updatedItems[index] = {
      ...updatedItems[index],
      quantity: Math.min(Math.max(value, 0), updatedItems[index].maxQuantity)
    };
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

    setIsSubmitting(true);
    
    try {
      // Create transfer record
      const { data: transferData, error: transferError } = await supabase
        .from("stock_transfers")
        .insert([{
          transfer_date: formData.transferDate,
          destination: formData.destination,
          notes: formData.notes
        }])
        .select();

      if (transferError) throw transferError;
      
      if (!transferData || transferData.length === 0) {
        throw new Error("Nu s-a putut crea bonul de transfer.");
      }

      const transferId = transferData[0].id;
      
      // Create transfer items and update inventory
      const transferItemsPromises = selectedItems.map(async (item) => {
        // Add transfer item
        const { error: itemError } = await supabase
          .from("stock_transfer_items")
          .insert([{
            transfer_id: transferId,
            inventory_item_id: item.id,
            quantity: item.quantity,
            unit: item.unit
          }]);
          
        if (itemError) throw itemError;

        // Update inventory quantity
        const { error: updateError } = await supabase
          .from("inventory")
          .update({ 
            quantity: supabase.rpc('decrement_quantity', { 
              row_id: item.id, 
              amount: item.quantity 
            })
          })
          .eq("id", item.id);
          
        if (updateError) throw updateError;

        // Add to inventory history
        const { error: historyError } = await supabase
          .from("inventory_history")
          .insert([{
            inventory_item_id: item.id,
            action: "remove",
            name: item.productName,
            quantity: item.quantity,
            unit: item.unit,
            operation_date: new Date().toISOString(),
            notes: `Transfer către ${formData.destination}`
          }]);
          
        if (historyError) throw historyError;
      });

      await Promise.all(transferItemsPromises);

      toast({
        title: "Succes",
        description: `Bon de transfer nr. ${transferId} creat cu succes.`
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

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
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
                        <SelectContent>
                          <SelectItem value="Producție">Producție</SelectItem>
                          <SelectItem value="Secția de Ambalare">Secția de Ambalare</SelectItem>
                          <SelectItem value="Secția de Procesare">Secția de Procesare</SelectItem>
                          <SelectItem value="Laborator">Laborator</SelectItem>
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
                <Select onValueChange={handleAddItem} value="">
                  <SelectTrigger className="w-[250px]">
                    <SelectValue placeholder="Adăugați un produs" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableItems.length === 0 ? (
                      <SelectItem value="" disabled>Nu mai există produse disponibile</SelectItem>
                    ) : (
                      availableItems.map(item => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.products?.name || item.name} ({item.quantity} {item.unit})
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
                    <div key={index} className="flex items-center gap-3 p-3 border rounded-md bg-gray-50">
                      <div className="flex-grow">
                        <p className="font-medium">{item.productName}</p>
                        <p className="text-xs text-gray-500">Max: {item.maxQuantity} {item.unit}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleQuantityChange(index, parseFloat(e.target.value))}
                          min={0}
                          max={item.maxQuantity}
                          className="w-24 text-right"
                        />
                        <span className="text-sm">{item.unit}</span>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-8 w-8 p-0" 
                          onClick={() => handleRemoveItem(index)}
                        >
                          &times;
                        </Button>
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
              <Button type="submit" disabled={selectedItems.length === 0 || isSubmitting}>
                {isSubmitting ? "Se procesează..." : "Creare bon de transfer"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
