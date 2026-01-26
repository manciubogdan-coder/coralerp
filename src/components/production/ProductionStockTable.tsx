import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-custom-toast";
import { supabase } from "@/integrations/supabase/client";
import { useInventoryType } from "@/context/inventory-type";
import { ProductionStockItem } from "./ProductionStockManagement";
import { Minus, RotateCcw, Pencil, Trash2, Search, ChevronDown, ChevronRight, ClipboardList } from "lucide-react";
import BulkConsumptionDialog from "./BulkConsumptionDialog";

interface ProductionStockTableProps {
  stock: ProductionStockItem[];
  loading: boolean;
  onDataChange: () => void;
}

type OperationType = 'consumption' | 'return' | 'modify' | 'delete';

// Grup pe produs
interface AggregatedProduct {
  productKey: string; // product_id sau name
  productName: string;
  codProdus: string | null;
  unit: string;
  totalQuantity: number;
  items: ProductionStockItem[];
}

const ProductionStockTable = ({ stock, loading, onDataChange }: ProductionStockTableProps) => {
  const { inventoryType } = useInventoryType();
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [selectedItem, setSelectedItem] = useState<ProductionStockItem | null>(null);
  const [operationType, setOperationType] = useState<OperationType | null>(null);
  const [quantity, setQuantity] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);

  const productionStockTable = inventoryType === 'ambalaje' 
    ? 'ambalaje_production_stock' 
    : 'production_stock';
  const historyTable = inventoryType === 'ambalaje'
    ? 'ambalaje_production_stock_history'
    : 'production_stock_history';
  const inventoryTable = inventoryType === 'ambalaje'
    ? 'ambalaje_inventory'
    : 'inventory';
  const inventoryHistoryTable = inventoryType === 'ambalaje'
    ? 'ambalaje_inventory_history'
    : 'inventory_history';

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
      // Caută în numele produsului
      if (p.productName.toLowerCase().includes(searchLower)) return true;
      // Caută în codul produsului
      if (p.codProdus?.toLowerCase().includes(searchLower)) return true;
      // Caută în loturi/furnizori din items
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

  const openOperation = (item: ProductionStockItem, type: OperationType) => {
    setSelectedItem(item);
    setOperationType(type);
    setQuantity(type === 'modify' ? item.quantity : 0);
    setNotes("");
  };

  const closeDialog = () => {
    setSelectedItem(null);
    setOperationType(null);
    setQuantity(0);
    setNotes("");
  };

  const handleConsumption = async () => {
    if (!selectedItem || quantity <= 0) return;
    if (quantity > selectedItem.quantity) {
      toast({
        variant: "destructive",
        title: "Eroare",
        description: "Cantitatea de scos nu poate fi mai mare decât stocul disponibil.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const newQuantity = selectedItem.quantity - quantity;

      const { error: updateError } = await supabase
        .from(productionStockTable)
        .update({ quantity: newQuantity })
        .eq('id', selectedItem.id);

      if (updateError) throw updateError;

      const { error: historyError } = await supabase
        .from(historyTable)
        .insert({
          production_stock_id: selectedItem.id,
          action: 'consumption',
          quantity: quantity,
          previous_quantity: selectedItem.quantity,
          notes: notes || 'Dare în consum'
        });

      if (historyError) throw historyError;

      toast({
        title: "Succes",
        description: `${quantity} ${selectedItem.unit} au fost date în consum.`,
      });

      closeDialog();
      onDataChange();
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

  const handleReturn = async () => {
    if (!selectedItem || quantity <= 0) return;
    if (quantity > selectedItem.quantity) {
      toast({
        variant: "destructive",
        title: "Eroare",
        description: "Cantitatea de returnat nu poate fi mai mare decât stocul disponibil.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const newProductionQty = selectedItem.quantity - quantity;
      
      const { error: updateError } = await supabase
        .from(productionStockTable)
        .update({ quantity: newProductionQty })
        .eq('id', selectedItem.id);

      if (updateError) throw updateError;

      if (selectedItem.inventory_item_id) {
        const { data: inventoryItem, error: fetchError } = await supabase
          .from(inventoryTable)
          .select('quantity')
          .eq('id', selectedItem.inventory_item_id)
          .single();

        if (!fetchError && inventoryItem) {
          const newInventoryQty = (inventoryItem.quantity || 0) + quantity;
          
          await supabase
            .from(inventoryTable)
            .update({ quantity: newInventoryQty })
            .eq('id', selectedItem.inventory_item_id);

          await supabase
            .from(inventoryHistoryTable)
            .insert({
              inventory_item_id: selectedItem.inventory_item_id,
              name: selectedItem.name,
              action: 'return_from_production',
              quantity: quantity,
              previous_quantity: inventoryItem.quantity,
              unit: selectedItem.unit,
              lot_number: selectedItem.lot_number,
              notes: notes || 'Returnare din producție'
            });
        }
      }

      await supabase
        .from(historyTable)
        .insert({
          production_stock_id: selectedItem.id,
          action: 'return',
          quantity: quantity,
          previous_quantity: selectedItem.quantity,
          notes: notes || 'Returnare în depozit'
        });

      toast({
        title: "Succes",
        description: `${quantity} ${selectedItem.unit} au fost returnate în depozit.`,
      });

      closeDialog();
      onDataChange();
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

  const handleModify = async () => {
    if (!selectedItem || quantity < 0) return;

    setIsSubmitting(true);
    try {
      const { error: updateError } = await supabase
        .from(productionStockTable)
        .update({ quantity: quantity })
        .eq('id', selectedItem.id);

      if (updateError) throw updateError;

      await supabase
        .from(historyTable)
        .insert({
          production_stock_id: selectedItem.id,
          action: 'modify',
          quantity: quantity,
          previous_quantity: selectedItem.quantity,
          notes: notes || 'Modificare cantitate'
        });

      toast({
        title: "Succes",
        description: "Cantitatea a fost modificată.",
      });

      closeDialog();
      onDataChange();
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

  const handleDelete = async () => {
    if (!selectedItem) return;

    setIsSubmitting(true);
    try {
      const { error: updateError } = await supabase
        .from(productionStockTable)
        .update({ quantity: 0 })
        .eq('id', selectedItem.id);

      if (updateError) throw updateError;

      await supabase
        .from(historyTable)
        .insert({
          production_stock_id: selectedItem.id,
          action: 'delete',
          quantity: 0,
          previous_quantity: selectedItem.quantity,
          notes: notes || 'Ștergere din stoc producție'
        });

      toast({
        title: "Succes",
        description: "Articolul a fost șters din stoc.",
      });

      closeDialog();
      onDataChange();
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

  const handleSubmit = () => {
    switch (operationType) {
      case 'consumption':
        handleConsumption();
        break;
      case 'return':
        handleReturn();
        break;
      case 'modify':
        handleModify();
        break;
      case 'delete':
        handleDelete();
        break;
    }
  };

  const getDialogTitle = () => {
    switch (operationType) {
      case 'consumption': return 'Dare în Consum';
      case 'return': return 'Returnare în Depozit';
      case 'modify': return 'Modificare Cantitate';
      case 'delete': return 'Ștergere Articol';
      default: return '';
    }
  };

  const getDialogDescription = () => {
    if (!selectedItem) return '';
    const productName = selectedItem.products?.name || selectedItem.name;
    const lotInfo = selectedItem.lot_number ? ` (Lot: ${selectedItem.lot_number})` : '';
    switch (operationType) {
      case 'consumption': 
        return `Introduceți cantitatea de dat în consum pentru "${productName}"${lotInfo} (Stoc: ${selectedItem.quantity} ${selectedItem.unit})`;
      case 'return': 
        return `Introduceți cantitatea de returnat în depozit pentru "${productName}"${lotInfo} (Stoc: ${selectedItem.quantity} ${selectedItem.unit})`;
      case 'modify': 
        return `Modificați cantitatea pentru "${productName}"${lotInfo} (Stoc curent: ${selectedItem.quantity} ${selectedItem.unit})`;
      case 'delete': 
        return `Sigur doriți să ștergeți "${productName}"${lotInfo} din stocul producție?`;
      default: return '';
    }
  };

  if (loading) {
    return <div className="text-center py-8">Se încarcă stocul...</div>;
  }

  return (
    <>
      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Caută după produs, cod, lot, furnizor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button 
          onClick={() => setIsBulkDialogOpen(true)}
          className="w-full sm:w-auto"
          disabled={stock.length === 0}
        >
          <ClipboardList className="mr-2 h-4 w-4" />
          Bon Consum Bulk
        </Button>
      </div>

      <BulkConsumptionDialog
        open={isBulkDialogOpen}
        onOpenChange={setIsBulkDialogOpen}
        stock={stock.filter(item => item.quantity > 0)}
        onSuccess={onDataChange}
      />

      {filteredProducts.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {aggregatedProducts.length === 0 
            ? "Nu există articole în stocul producție."
            : "Nu s-au găsit articole care să corespundă căutării."
          }
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Produs</TableHead>
                <TableHead className="text-right">Cantitate Totală</TableHead>
                <TableHead>Unitate</TableHead>
                <TableHead className="text-right">Nr. Loturi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => {
                const isExpanded = expandedProducts.has(product.productKey);
                return (
                  <React.Fragment key={product.productKey}>
                    {/* Rând sumar produs */}
                    <TableRow 
                      className="cursor-pointer hover:bg-muted/70"
                      onClick={() => toggleExpand(product.productKey)}
                    >
                      <TableCell className="w-8 p-2">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {product.productName}
                        {product.codProdus && (
                          <span className="text-xs text-muted-foreground ml-2">
                            ({product.codProdus})
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-bold text-lg">
                        {product.totalQuantity.toFixed(2)}
                      </TableCell>
                      <TableCell>{product.unit}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {product.items.length} lot{product.items.length !== 1 ? 'uri' : ''}
                      </TableCell>
                    </TableRow>

                    {/* Detalii pe loturi când expandat */}
                    {isExpanded && product.items.map((item) => (
                      <TableRow key={item.id} className="bg-muted/30">
                        <TableCell></TableCell>
                        <TableCell colSpan={4}>
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-1">
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                              <span>
                                <span className="text-muted-foreground">Lot:</span>{' '}
                                <span className="font-medium">{item.lot_number || '-'}</span>
                              </span>
                              <span>
                                <span className="text-muted-foreground">Furnizor:</span>{' '}
                                {item.suppliers?.name || '-'}
                              </span>
                              <span>
                                <span className="text-muted-foreground">Cantitate:</span>{' '}
                                <span className="font-medium">{item.quantity.toFixed(2)} {item.unit}</span>
                              </span>
                              <span>
                                <span className="text-muted-foreground">Data:</span>{' '}
                                {new Date(item.transfer_date).toLocaleDateString('ro-RO')}
                              </span>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); openOperation(item, 'consumption'); }}
                                title="Dare în consum"
                              >
                                <Minus className="h-3 w-3 mr-1" />
                                Consum
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); openOperation(item, 'return'); }}
                                title="Returnare în depozit"
                              >
                                <RotateCcw className="h-3 w-3 mr-1" />
                                Retur
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => { e.stopPropagation(); openOperation(item, 'modify'); }}
                                title="Modificare"
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={(e) => { e.stopPropagation(); openOperation(item, 'delete'); }}
                                title="Ștergere"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!selectedItem && !!operationType} onOpenChange={() => closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{getDialogTitle()}</DialogTitle>
            <DialogDescription>{getDialogDescription()}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {operationType !== 'delete' && (
              <div className="space-y-2">
                <Label htmlFor="quantity">
                  {operationType === 'modify' ? 'Cantitate nouă' : 'Cantitate'}
                </Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.01"
                  min="0"
                  max={operationType === 'modify' ? undefined : selectedItem?.quantity}
                  value={quantity}
                  onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="notes">Note (opțional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Adăugați note sau observații..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isSubmitting}>
              Anulează
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitting}
              variant={operationType === 'delete' ? 'destructive' : 'default'}
            >
              {isSubmitting ? 'Se procesează...' : 'Confirmă'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ProductionStockTable;
