import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-custom-toast";
import { Product } from "@/types";
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PlusCircle, Trash, Send } from "lucide-react";

interface StockTransferItem {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  lotNumber?: string;
}

interface StockTransferFormProps {
  onTransferComplete: () => void;
}

export const StockTransferForm = ({ onTransferComplete }: StockTransferFormProps) => {
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [transferData, setTransferData] = useState<{
    destination: string;
    notes: string;
    items: StockTransferItem[];
  }>({
    destination: "",
    notes: "",
    items: [],
  });
  const [newProduct, setNewProduct] = useState<{
    productId: string;
    productName: string;
    quantity: number;
    unit: string;
    lotNumber?: string;
  }>({
    productId: "",
    productName: "",
    quantity: 0,
    unit: "",
    lotNumber: "",
  });
  const [transferErrors, setTransferErrors] = useState<{ [key: number]: string }>({});

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .order("name");

        if (error) {
          throw error;
        }

        setProducts(data || []);
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Eroare la încărcarea produselor",
          description: error.message,
        });
      }
    };

    fetchProducts();
  }, []);

  const addProduct = () => {
    if (!newProduct.productId || !newProduct.quantity || !newProduct.unit) {
      toast({
        variant: "destructive",
        title: "Eroare",
        description: "Te rog completează toate câmpurile.",
      });
      return;
    }

    setTransferData((prev) => ({
      ...prev,
      items: [...prev.items, newProduct],
    }));

    setNewProduct({
      productId: "",
      productName: "",
      quantity: 0,
      unit: "",
      lotNumber: "",
    });
  };

  const removeProduct = (index: number) => {
    const newItems = [...transferData.items];
    newItems.splice(index, 1);
    setTransferData((prev) => ({ ...prev, items: newItems }));
  };

  const handleTransfer = async () => {
    let hasErrors = false;
    setTransferErrors({});

    if (!transferData.destination) {
      toast({
        variant: "destructive",
        title: "Eroare",
        description: "Te rog specifică destinația transferului.",
      });
      return;
    }

    if (transferData.items.length === 0) {
      toast({
        variant: "destructive",
        title: "Eroare",
        description: "Te rog adaugă cel puțin un produs pentru transfer.",
      });
      return;
    }

    try {
      const { data: transferData_, error: transferError } = await supabase
        .from('stock_transfers')
        .insert({
          destination: transferData.destination,
          notes: transferData.notes || null
        })
        .select('id')
        .single();

      if (transferError) throw transferError;

      const items = transferData.items;

      for (const item of items) {
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
            description: `Produsul ${item.productName} nu mai are stoc disponibil`,
            variant: "destructive"
          });
          continue;
        }

        const inventoryItem = inventoryItems[0];
        
        const { error: insertError } = await supabase
          .from('stock_transfer_items')
          .insert({
            transfer_id: transferData_.id,
            inventory_item_id: inventoryItem.id,
            quantity: item.quantity,
            unit: item.unit
          });

        if (insertError) throw insertError;

        const { error: updateError } = await supabase.rpc(
          'decrement_quantity' as any,
          {
            item_id: inventoryItem.id,
            decrement_by: item.quantity,
            exit_document: transferData.destination
          }
        );

        if (updateError) throw updateError;
      }

      if (hasErrors) {
        return;
      }

      toast({
        title: "Succes",
        description: "Transfer realizat cu succes!",
      });
      onTransferComplete();
      setOpen(false);
      setTransferData({ destination: "", notes: "", items: [] });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Eroare",
        description: error.message,
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
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Transfer Stoc</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="col-span-1">
              <Label htmlFor="destination">Destinație</Label>
              <Input
                type="text"
                id="destination"
                value={transferData.destination}
                onChange={(e) =>
                  setTransferData((prev) => ({
                    ...prev,
                    destination: e.target.value,
                  }))
                }
              />
            </div>

            <div className="col-span-1">
              <Label htmlFor="notes">Note</Label>
              <Input
                type="text"
                id="notes"
                value={transferData.notes}
                onChange={(e) =>
                  setTransferData((prev) => ({ ...prev, notes: e.target.value }))
                }
              />
            </div>
          </div>

          <div>
            <Label>Adaugă Produs</Label>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
              <div>
                <Label htmlFor="product">Produs</Label>
                <select
                  id="product"
                  className="w-full px-3 py-2 border rounded"
                  value={newProduct.productId}
                  onChange={(e) => {
                    const selectedProduct = products.find(
                      (p) => p.id === e.target.value
                    );
                    setNewProduct((prev) => ({
                      ...prev,
                      productId: e.target.value,
                      productName: selectedProduct ? selectedProduct.name : "",
                      unit: selectedProduct ? selectedProduct.default_unit : "",
                    }));
                  }}
                >
                  <option value="">Selectează un produs</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="quantity">Cantitate</Label>
                <Input
                  type="number"
                  id="quantity"
                  value={newProduct.quantity.toString()}
                  onChange={(e) =>
                    setNewProduct((prev) => ({
                      ...prev,
                      quantity: Number(e.target.value),
                    }))
                  }
                />
              </div>

              <div>
                <Label htmlFor="unit">Unitate</Label>
                <Input
                  type="text"
                  id="unit"
                  value={newProduct.unit}
                  readOnly
                />
              </div>

              <div className="flex items-end">
                <Button type="button" onClick={addProduct}>
                  Adaugă
                </Button>
              </div>
            </div>
          </div>

          <div>
            <Label>Produse pentru Transfer</Label>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produs</TableHead>
                  <TableHead>Cantitate</TableHead>
                  <TableHead>Unitate</TableHead>
                  <TableHead>Acțiune</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transferData.items.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>{item.productName}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeProduct(index)}
                      >
                        <Trash className="h-4 w-4 text-red-500" />
                      </Button>
                      {transferErrors[index] && (
                        <div className="text-red-500">{transferErrors[index]}</div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <Button type="button" onClick={handleTransfer}>
          Realizează Transfer
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default StockTransferForm;
