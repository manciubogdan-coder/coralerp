import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-custom-toast";
import { supabase } from "@/integrations/supabase/client";
import { useInventoryType } from "@/context/inventory-type";
import { ProductionStockItem } from "./ProductionStockManagement";
import { Search, Minus, Loader2 } from "lucide-react";

interface BulkConsumptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stock: ProductionStockItem[];
  onSuccess: () => void;
}

interface ConsumptionItem {
  stockItem: ProductionStockItem;
  quantity: number;
}

const BulkConsumptionDialog = ({
  open,
  onOpenChange,
  stock,
  onSuccess,
}: BulkConsumptionDialogProps) => {
  const { inventoryType } = useInventoryType();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItems, setSelectedItems] = useState<Map<string, ConsumptionItem>>(new Map());
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const productionStockTable = inventoryType === 'ambalaje' 
    ? 'ambalaje_production_stock' 
    : 'production_stock';
  const historyTable = inventoryType === 'ambalaje'
    ? 'ambalaje_production_stock_history'
    : 'production_stock_history';

  // Filtrare stoc
  const filteredStock = useMemo(() => {
    if (!searchTerm.trim()) return stock;
    const searchLower = searchTerm.toLowerCase();
    return stock.filter(item => {
      const productName = item.products?.name || item.name;
      return (
        productName.toLowerCase().includes(searchLower) ||
        item.products?.cod_produs?.toLowerCase().includes(searchLower) ||
        item.lot_number?.toLowerCase().includes(searchLower) ||
        item.suppliers?.name?.toLowerCase().includes(searchLower)
      );
    });
  }, [stock, searchTerm]);

  const toggleItem = (item: ProductionStockItem) => {
    setSelectedItems(prev => {
      const next = new Map(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.set(item.id, { stockItem: item, quantity: 0 });
      }
      return next;
    });
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    setSelectedItems(prev => {
      const next = new Map(prev);
      const existing = next.get(itemId);
      if (existing) {
        next.set(itemId, { ...existing, quantity });
      }
      return next;
    });
  };

  const handleClose = () => {
    setSelectedItems(new Map());
    setSearchTerm("");
    setNotes("");
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    // Validare
    const items = Array.from(selectedItems.values()).filter(i => i.quantity > 0);
    
    if (items.length === 0) {
      toast({
        variant: "destructive",
        title: "Eroare",
        description: "Selectați cel puțin un produs și introduceți cantitatea.",
      });
      return;
    }

    // Verifică cantități
    for (const item of items) {
      if (item.quantity > item.stockItem.quantity) {
        const productName = item.stockItem.products?.name || item.stockItem.name;
        toast({
          variant: "destructive",
          title: "Eroare",
          description: `Cantitatea pentru "${productName}" (${item.quantity}) depășește stocul disponibil (${item.stockItem.quantity}).`,
        });
        return;
      }
    }

    setIsSubmitting(true);
    
    try {
      // Procesează fiecare item
      for (const item of items) {
        const newQuantity = item.stockItem.quantity - item.quantity;

        // Update stoc producție
        const { error: updateError } = await supabase
          .from(productionStockTable)
          .update({ quantity: newQuantity })
          .eq('id', item.stockItem.id);

        if (updateError) throw updateError;

        // Adaugă în istoric
        const { error: historyError } = await supabase
          .from(historyTable)
          .insert({
            production_stock_id: item.stockItem.id,
            action: 'consumption',
            quantity: item.quantity,
            previous_quantity: item.stockItem.quantity,
            notes: notes || 'Dare în consum (bulk)'
          });

        if (historyError) throw historyError;
      }

      toast({
        title: "Succes",
        description: `${items.length} articol${items.length > 1 ? 'e' : ''} ${items.length > 1 ? 'au fost date' : 'a fost dat'} în consum.`,
      });

      handleClose();
      onSuccess();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Eroare",
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalItems = selectedItems.size;
  const itemsWithQuantity = Array.from(selectedItems.values()).filter(i => i.quantity > 0).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Minus className="h-5 w-5" />
            Bon Consum Bulk
          </DialogTitle>
          <DialogDescription>
            Selectați produsele și cantitățile pentru consum rapid. Bifați produsele dorite și introduceți cantitățile.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Căutare */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Caută după produs, cod, lot, furnizor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Tabel produse */}
          <ScrollArea className="flex-1 border rounded-md">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Produs</TableHead>
                  <TableHead>Lot</TableHead>
                  <TableHead>Furnizor</TableHead>
                  <TableHead className="text-right">Stoc</TableHead>
                  <TableHead className="text-right w-32">Cantitate Consum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStock.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nu s-au găsit produse.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStock.map((item) => {
                    const isSelected = selectedItems.has(item.id);
                    const selectedItem = selectedItems.get(item.id);
                    const productName = item.products?.name || item.name;
                    
                    return (
                      <TableRow 
                        key={item.id}
                        className={isSelected ? "bg-primary/5" : ""}
                      >
                        <TableCell>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleItem(item)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{productName}</div>
                          {item.products?.cod_produs && (
                            <div className="text-xs text-muted-foreground">
                              {item.products.cod_produs}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {item.lot_number || '-'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {item.suppliers?.name || '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {item.quantity.toFixed(2)} {item.unit}
                        </TableCell>
                        <TableCell className="text-right">
                          {isSelected && (
                            <Input
                              type="number"
                              min={0}
                              max={item.quantity}
                              step={0.01}
                              value={selectedItem?.quantity || 0}
                              onChange={(e) => updateQuantity(item.id, parseFloat(e.target.value) || 0)}
                              className="w-28 text-right"
                              placeholder="0"
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </ScrollArea>

          {/* Note */}
          <div className="space-y-2">
            <Label htmlFor="bulk-notes">Note (opțional)</Label>
            <Textarea
              id="bulk-notes"
              placeholder="Note pentru bonul de consum..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0">
          <div className="text-sm text-muted-foreground mr-auto">
            {totalItems > 0 && (
              <span>
                {itemsWithQuantity} din {totalItems} produse selectate cu cantitate
              </span>
            )}
          </div>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Anulează
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || itemsWithQuantity === 0}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Se procesează...
              </>
            ) : (
              `Confirmă Consum (${itemsWithQuantity} articole)`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BulkConsumptionDialog;
