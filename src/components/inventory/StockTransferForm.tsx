import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle, Trash, Send } from "lucide-react";
import { toast } from "@/hooks/use-custom-toast";
import { supabase } from "@/integrations/supabase/client";
import { useInventoryData } from "@/hooks/use-inventory-data";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface StockTransferFormProps {
  onTransferComplete: () => void;
}

export const StockTransferForm = ({ onTransferComplete }: StockTransferFormProps) => {
  const [open, setOpen] = useState(false);
  const { products } = useInventoryData();
  const [formData, setFormData] = useState({
    destination: '',
    notes: '',
    items: [{ productId: '', quantity: '', unit: 'kg' }]
  });

  const handleAddItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { productId: '', quantity: '', unit: 'kg' }]
    }));
  };

  const handleRemoveItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleItemChange = (index: number, field: string, value: string) => {
    setFormData(prev => {
      const updatedItems = [...prev.items];
      updatedItems[index] = { ...updatedItems[index], [field]: value };
      return { ...prev, items: updatedItems };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.destination) {
      toast({
        title: "Destinație lipsă",
        description: "Vă rugăm să specificați o destinație pentru transfer",
        variant: "warning"
      });
      return;
    }

    if (formData.items.some(item => !item.productId || !item.quantity)) {
      toast({
        title: "Date incomplete",
        description: "Vă rugăm să completați toate câmpurile pentru produse",
        variant: "warning"
      });
      return;
    }

    try {
      const { data: transferData, error: transferError } = await supabase
        .from('stock_transfers')
        .insert({
          destination: formData.destination,
          notes: formData.notes || null
        })
        .select('id')
        .single();

      if (transferError) throw transferError;

      for (const item of formData.items) {
        const { data: inventoryItems, error: inventoryError } = await supabase
          .from('inventory')
          .select('id, quantity, unit')
          .eq('product_id', item.productId)
          .gt('quantity', 0)
          .order('created_at', { ascending: false })
          .limit(1);

        if (inventoryError) throw inventoryError;
        
        if (!inventoryItems || inventoryItems.length === 0) {
          toast({
            title: "Eroare",
            description: `Produsul selectat nu mai are stoc disponibil`,
            variant: "destructive"
          });
          continue;
        }

        const inventoryItem = inventoryItems[0];
        const quantity = parseFloat(item.quantity);

        const { error: insertError } = await supabase
          .from('stock_transfer_items')
          .insert({
            transfer_id: transferData.id,
            inventory_item_id: inventoryItem.id,
            quantity: quantity,
            unit: item.unit
          });

        if (insertError) throw insertError;

        const { error: updateError } = await supabase.rpc(
          'decrement_quantity',
          {
            item_id: inventoryItem.id,
            decrement_by: quantity,
            exit_document: formData.destination
          }
        );

        if (updateError) throw updateError;
      }

      toast({
        title: "Transfer finalizat",
        description: "Transferul a fost înregistrat cu succes",
        variant: "default"
      });

      setFormData({
        destination: '',
        notes: '',
        items: [{ productId: '', quantity: '', unit: 'kg' }]
      });
      setOpen(false);
      onTransferComplete();
    } catch (error) {
      console.error("Eroare la procesarea transferului:", error);
      toast({
        title: "Eroare",
        description: "A apărut o eroare la procesarea transferului",
        variant: "destructive"
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <PlusCircle className="h-4 w-4 mr-2" /> Transfer Stoc
        </Button>
      </DialogTrigger>

      <DialogContent className="md:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Transfer stoc</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="destination">Destinație</Label>
              <Input 
                id="destination" 
                value={formData.destination} 
                onChange={e => setFormData(prev => ({ ...prev, destination: e.target.value }))} 
                placeholder="Introduceți destinația"
              />
            </div>
            <div>
              <Label htmlFor="notes">Observații</Label>
              <Input 
                id="notes" 
                value={formData.notes} 
                onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))} 
                placeholder="Observații opționale"
              />
            </div>
          </div>

          <div>
            <Label>Produse</Label>
            <div className="space-y-2 mt-2">
              {formData.items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5">
                    <Select 
                      value={item.productId} 
                      onValueChange={value => handleItemChange(index, 'productId', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selectați produsul" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map(product => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3">
                    <Input 
                      type="number" 
                      placeholder="Cantitate" 
                      value={item.quantity} 
                      onChange={e => handleItemChange(index, 'quantity', e.target.value)}
                    />
                  </div>
                  <div className="col-span-3">
                    <Select 
                      value={item.unit} 
                      onValueChange={value => handleItemChange(index, 'unit', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kg">kg</SelectItem>
                        <SelectItem value="g">g</SelectItem>
                        <SelectItem value="l">l</SelectItem>
                        <SelectItem value="ml">ml</SelectItem>
                        <SelectItem value="buc">buc</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-1">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleRemoveItem(index)}
                      disabled={formData.items.length === 1}
                    >
                      <Trash className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              onClick={handleAddItem} 
              className="mt-2"
            >
              <PlusCircle className="h-4 w-4 mr-2" /> Adaugă produs
            </Button>
          </div>

          <div className="flex justify-end pt-4">
            <Button type="submit" className="flex items-center">
              <Send className="h-4 w-4 mr-2" /> Finalizează transfer
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
