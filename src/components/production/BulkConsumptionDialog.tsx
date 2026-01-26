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
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-custom-toast";
import { supabase } from "@/integrations/supabase/client";
import { useInventoryType } from "@/context/inventory-type";
import { ProductionStockItem } from "./ProductionStockManagement";
import { Search, Minus, Loader2, ChevronDown, ChevronRight } from "lucide-react";

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

interface AggregatedProduct {
  productKey: string;
  productName: string;
  codProdus: string | null;
  unit: string;
  totalQuantity: number;
  items: ProductionStockItem[];
}

const BulkConsumptionDialog = ({
  open,
  onOpenChange,
  stock,
  onSuccess,
}: BulkConsumptionDialogProps) => {
  const { inventoryType } = useInventoryType();
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [selectedItems, setSelectedItems] = useState<Map<string, ConsumptionItem>>(new Map());
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const productionStockTable = inventoryType === 'ambalaje' 
    ? 'ambalaje_production_stock' 
    : 'production_stock';
  const historyTable = inventoryType === 'ambalaje'
    ? 'ambalaje_production_stock_history'
    : 'production_stock_history';

  // Agregare pe produs
  const aggregatedProducts = useMemo((): AggregatedProduct[] => {
    const grouped = new Map<string, AggregatedProduct>();
    
    for (const item of stock) {
      const productName = item.products?.name || item.name;
      const productKey = item.product_id || productName;
      
      if (!grouped.has(productKey)) {
        grouped.set(productKey, {
          productKey,
          productName,
          codProdus: item.products?.cod_produs || null,
          unit: item.unit,
          totalQuantity: 0,
          items: [],
        });
      }
      
      const group = grouped.get(productKey)!;
      group.totalQuantity += item.quantity;
      group.items.push(item);
    }
    
    return Array.from(grouped.values()).sort((a, b) => 
      a.productName.localeCompare(b.productName)
    );
  }, [stock]);

  // Filtrare pe baza căutării
  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return aggregatedProducts;
    const searchLower = searchTerm.toLowerCase();
    return aggregatedProducts.filter(p => {
      if (p.productName.toLowerCase().includes(searchLower)) return true;
      if (p.codProdus?.toLowerCase().includes(searchLower)) return true;
      return p.items.some(item => 
        item.lot_number?.toLowerCase().includes(searchLower) ||
        item.suppliers?.name?.toLowerCase().includes(searchLower)
      );
    });
  }, [aggregatedProducts, searchTerm]);

  const toggleExpand = (productKey: string) => {
    setExpandedProducts(prev => {
      const next = new Set(prev);
      if (next.has(productKey)) {
        next.delete(productKey);
      } else {
        next.add(productKey);
      }
      return next;
    });
  };

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
    setExpandedProducts(new Set());
    setSearchTerm("");
    setNotes("");
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    const items = Array.from(selectedItems.values()).filter(i => i.quantity > 0);
    
    if (items.length === 0) {
      toast({
        variant: "destructive",
        title: "Eroare",
        description: "Selectați cel puțin un lot și introduceți cantitatea.",
      });
      return;
    }

    for (const item of items) {
      if (item.quantity > item.stockItem.quantity) {
        const productName = item.stockItem.products?.name || item.stockItem.name;
        toast({
          variant: "destructive",
          title: "Eroare",
          description: `Cantitatea pentru "${productName}" (Lot: ${item.stockItem.lot_number}) - ${item.quantity} depășește stocul disponibil (${item.stockItem.quantity}).`,
        });
        return;
      }
    }

    setIsSubmitting(true);
    
    try {
      for (const item of items) {
        const newQuantity = item.stockItem.quantity - item.quantity;

        const { error: updateError } = await supabase
          .from(productionStockTable)
          .update({ quantity: newQuantity })
          .eq('id', item.stockItem.id);

        if (updateError) throw updateError;

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
        description: `${items.length} lot${items.length > 1 ? 'uri' : ''} ${items.length > 1 ? 'au fost date' : 'a fost dat'} în consum.`,
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

  const itemsWithQuantity = Array.from(selectedItems.values()).filter(i => i.quantity > 0).length;

  // Calculează câte loturi sunt selectate per produs
  const getSelectedLotsCount = (product: AggregatedProduct) => {
    return product.items.filter(item => selectedItems.has(item.id)).length;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Minus className="h-5 w-5" />
            Bon Consum Bulk
          </DialogTitle>
          <DialogDescription>
            Selectați produsele și loturile pentru consum rapid. Expandați produsele pentru a vedea loturile.
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

          {/* Lista produse cu scroll */}
          <ScrollArea className="flex-1 h-[400px] border rounded-md">
            <div className="p-2">
              {filteredProducts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nu s-au găsit produse.
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredProducts.map((product) => {
                    const isExpanded = expandedProducts.has(product.productKey);
                    const selectedLotsCount = getSelectedLotsCount(product);
                    
                    return (
                      <div key={product.productKey} className="border rounded-md overflow-hidden">
                        {/* Header produs */}
                        <div 
                          className="flex items-center gap-3 p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => toggleExpand(product.productKey)}
                        >
                          <div className="flex-shrink-0">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">
                              {product.productName}
                              {product.codProdus && (
                                <span className="text-xs text-muted-foreground ml-2">
                                  ({product.codProdus})
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {product.items.length} lot{product.items.length !== 1 ? 'uri' : ''} disponibil{product.items.length !== 1 ? 'e' : ''}
                              {selectedLotsCount > 0 && (
                                <span className="text-primary ml-2">
                                  • {selectedLotsCount} selectat{selectedLotsCount !== 1 ? 'e' : ''}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="text-right flex-shrink-0">
                            <div className="font-bold">
                              {product.totalQuantity.toFixed(2)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {product.unit}
                            </div>
                          </div>
                        </div>
                        
                        {/* Loturi expandate */}
                        {isExpanded && (
                          <div className="border-t bg-background">
                            {product.items.map((item) => {
                              const isSelected = selectedItems.has(item.id);
                              const selectedItem = selectedItems.get(item.id);
                              
                              return (
                                <div 
                                  key={item.id}
                                  className={`flex items-center gap-3 p-3 border-b last:border-b-0 ${isSelected ? 'bg-primary/5' : ''}`}
                                >
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => toggleItem(item)}
                                  />
                                  
                                  <div className="flex-1 grid grid-cols-3 gap-2 text-sm">
                                    <div>
                                      <span className="text-muted-foreground">Lot:</span>{' '}
                                      <span className="font-medium">{item.lot_number || '-'}</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Furnizor:</span>{' '}
                                      {item.suppliers?.name || '-'}
                                    </div>
                                    <div className="text-right">
                                      <span className="text-muted-foreground">Stoc:</span>{' '}
                                      <span className="font-medium">{item.quantity.toFixed(2)} {item.unit}</span>
                                    </div>
                                  </div>
                                  
                                  <div className="w-28 flex-shrink-0">
                                    {isSelected && (
                                      <Input
                                        type="number"
                                        min={0}
                                        max={item.quantity}
                                        step={0.01}
                                        value={selectedItem?.quantity || 0}
                                        onChange={(e) => updateQuantity(item.id, parseFloat(e.target.value) || 0)}
                                        className="text-right h-8"
                                        placeholder="0"
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
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
            {selectedItems.size > 0 && (
              <span>
                {itemsWithQuantity} lot{itemsWithQuantity !== 1 ? 'uri' : ''} cu cantitate specificată
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
              `Confirmă Consum (${itemsWithQuantity} loturi)`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BulkConsumptionDialog;
