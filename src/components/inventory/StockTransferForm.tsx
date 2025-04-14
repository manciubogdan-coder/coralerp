
import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-custom-toast";
import { InventoryItem } from "@/types";

interface TransferItem {
  product_id: string;
  quantity: number;
  unit: string;
  crate_count?: number | null;
  notes?: string | null;
  entry_number?: number;
}

interface StockTransferFormProps {
  onTransferComplete?: () => void;
}

const StockTransferForm = ({ onTransferComplete }: StockTransferFormProps) => {
  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [transferItems, setTransferItems] = useState<TransferItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number | ''>('');
  const [unit, setUnit] = useState<string>('buc');
  const [crateCount, setCrateCount] = useState<number | ''>('');
  const [notes, setNotes] = useState<string>('');
  const [destination, setDestination] = useState<string>('Distrugere');
  const [loading, setLoading] = useState(false);
  const [entryNumberInput, setEntryNumberInput] = useState<string>('');

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .order('name');

        if (error) {
          throw error;
        }

        // Cast the data as InventoryItem[] to ensure TypeScript compatibility
        setProducts(data as unknown as InventoryItem[]);
      } catch (error) {
        console.error("Error fetching products:", error);
        toast({
          variant: "destructive",
          title: "Eroare",
          description: "Nu s-au putut încărca produsele."
        });
      }
    };

    fetchProducts();
  }, []);

  const handleAddTransferItem = () => {
    if (!selectedProductId || quantity === '' || quantity <= 0) {
      toast({
        variant: "destructive",
        title: "Eroare",
        description: "Selectează un produs și specifică o cantitate validă."
      });
      return;
    }

    const newTransferItem: TransferItem = {
      product_id: selectedProductId,
      quantity: Number(quantity),
      unit: unit,
      crate_count: crateCount !== '' ? Number(crateCount) : null,
      notes: notes,
    };

    setTransferItems([...transferItems, newTransferItem]);
    setSelectedProductId(null);
    setQuantity('');
    setUnit('buc');
    setCrateCount('');
    setNotes('');
  };

  const handleRemoveTransferItem = (index: number) => {
    const updatedTransferItems = [...transferItems];
    updatedTransferItems.splice(index, 1);
    setTransferItems(updatedTransferItems);
  };

  const createStockTransfer = async (items: TransferItem[]) => {
    try {
      setLoading(true);

      const transferDate = new Date().toISOString();

      for (const item of items) {
        const { error } = await supabase
          .from('stock_transfers')
          .insert([
            {
              transfer_date: transferDate,
              product_id: item.product_id,
              quantity: item.quantity,
              unit: item.unit,
              crate_count: item.crate_count,
              notes: item.notes,
              destination: destination,
              entry_number: item.entry_number,
            },
          ]);

        if (error) {
          throw error;
        }
      }

      return { success: true, message: "Transfer realizat cu succes." };
    } catch (error: any) {
      console.error("Error creating stock transfer:", error);
      return { success: false, message: `Eroare la transfer: ${error.message}` };
    } finally {
      setLoading(false);
    }
  };

  const handleTransferItemsSubmit = async () => {
    if (transferItems.length === 0) {
      toast({
        variant: "destructive",
        title: "Eroare",
        description: "Selectează cel puțin un produs pentru transfer."
      });
      return;
    }

    try {
      const modifiedTransferItems = transferItems.map((item, index) => {
        if (index === 0 && entryNumberInput) {
          return {
            ...item,
            entry_number: Number(entryNumberInput)
          };
        }
        return item;
      });

      const transferResult = await createStockTransfer(modifiedTransferItems);

      if (transferResult.success) {
        toast({
          title: "Succes",
          description: transferResult.message
        });
        setTransferItems([]);
        setEntryNumberInput('');
        
        // Call the onTransferComplete callback if provided
        if (onTransferComplete) {
          onTransferComplete();
        }
      } else {
        toast({
          variant: "destructive",
          title: "Eroare",
          description: transferResult.message
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Eroare",
        description: `Eroare neașteptată: ${error.message}`
      });
    }
  };

  const isSubmitDisabled = useMemo(() => {
    return loading || transferItems.length === 0;
  }, [loading, transferItems]);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Adaugă Produse pentru Transfer</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="entryNumber">Nr. Intrare (primul produs):</Label>
          <Input
            type="number"
            id="entryNumber"
            value={entryNumberInput}
            onChange={(e) => setEntryNumberInput(e.target.value)}
            placeholder="Număr intrare"
          />
        </div>
        <div>
          <Label htmlFor="destination">Destinație:</Label>
          <Select value={destination} onValueChange={setDestination}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selectează destinația" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Distrugere">Distrugere</SelectItem>
              <SelectItem value="Retur Furnizor">Retur Furnizor</SelectItem>
              <SelectItem value="Alt Depozit">Alt Depozit</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="product">Produs:</Label>
          <Select value={selectedProductId || ''} onValueChange={setSelectedProductId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selectează un produs" />
            </SelectTrigger>
            <SelectContent>
              {products.map((product) => (
                <SelectItem key={product.id} value={product.id || ''}>
                  {product.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="quantity">Cantitate:</Label>
          <Input
            type="number"
            id="quantity"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder="Cantitate"
          />
        </div>
        <div>
          <Label htmlFor="unit">Unitate:</Label>
          <Select value={unit} onValueChange={setUnit}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selectează unitatea" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="buc">Bucăți</SelectItem>
              <SelectItem value="kg">Kilograme</SelectItem>
              <SelectItem value="m">Metri</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="crateCount">Număr Lăzi (opțional):</Label>
          <Input
            type="number"
            id="crateCount"
            value={crateCount}
            onChange={(e) => setCrateCount(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder="Număr lăzi"
          />
        </div>
        <div>
          <Label htmlFor="notes">Note (opțional):</Label>
          <Input
            type="text"
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Note"
          />
        </div>
      </div>

      <Button type="button" onClick={handleAddTransferItem}>
        Adaugă Produs
      </Button>

      {transferItems.length > 0 && (
        <div className="mt-6">
          <h4 className="text-md font-medium">Produse Selectate pentru Transfer:</h4>
          <ul>
            {transferItems.map((item, index) => {
              const product = products.find((p) => p.id === item.product_id);
              return (
                <li key={index} className="py-2 border-b">
                  {product ? product.name : 'Produs Necunoscut'} - Cantitate: {item.quantity} {item.unit}
                  {item.crate_count !== null && `, Lăzi: ${item.crate_count}`}
                  {item.notes && `, Note: ${item.notes}`}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveTransferItem(index)}
                    className="ml-2"
                  >
                    Șterge
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <Button
        type="button"
        onClick={handleTransferItemsSubmit}
        disabled={isSubmitDisabled}
        className="mt-4"
      >
        {loading ? "Se transferă..." : "Finalizează Transferul"}
      </Button>
    </div>
  );
};

export default StockTransferForm;
