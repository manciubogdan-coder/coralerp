import React, { useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-custom-toast";
import { supabase } from "@/integrations/supabase/client";
import { useInventoryType } from "@/context/inventory-type";
import { ProductionStockItem } from "./ProductionStockManagement";
import { Minus, RotateCcw, Pencil, Trash2, Search } from "lucide-react";

interface ProductionStockTableProps {
  stock: ProductionStockItem[];
  loading: boolean;
  onDataChange: () => void;
}

type OperationType = 'consumption' | 'return' | 'modify' | 'delete';

const ProductionStockTable = ({ stock, loading, onDataChange }: ProductionStockTableProps) => {
  const { inventoryType } = useInventoryType();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItem, setSelectedItem] = useState<ProductionStockItem | null>(null);
  const [operationType, setOperationType] = useState<OperationType | null>(null);
  const [quantity, setQuantity] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const filteredStock = stock.filter(item => {
    const name = item.products?.name || item.name || '';
    const lotNumber = item.lot_number || '';
    const supplier = item.suppliers?.name || '';
    const searchLower = searchTerm.toLowerCase();
    
    return name.toLowerCase().includes(searchLower) ||
           lotNumber.toLowerCase().includes(searchLower) ||
           supplier.toLowerCase().includes(searchLower);
  });

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

      // Actualizează stocul
      const { error: updateError } = await supabase
        .from(productionStockTable)
        .update({ quantity: newQuantity })
        .eq('id', selectedItem.id);

      if (updateError) throw updateError;

      // Adaugă în istoric
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
      // Scade din stocul producție
      const newProductionQty = selectedItem.quantity - quantity;
      
      const { error: updateError } = await supabase
        .from(productionStockTable)
        .update({ quantity: newProductionQty })
        .eq('id', selectedItem.id);

      if (updateError) throw updateError;

      // Adaugă înapoi în inventar dacă avem inventory_item_id
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

          // Adaugă în istoricul inventarului
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

      // Adaugă în istoricul producției
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
      // Ștergem înregistrarea (sau setăm cantitatea la 0)
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
    switch (operationType) {
      case 'consumption': 
        return `Introduceți cantitatea de dat în consum pentru "${productName}" (Stoc: ${selectedItem.quantity} ${selectedItem.unit})`;
      case 'return': 
        return `Introduceți cantitatea de returnat în depozit pentru "${productName}" (Stoc: ${selectedItem.quantity} ${selectedItem.unit})`;
      case 'modify': 
        return `Modificați cantitatea pentru "${productName}" (Stoc curent: ${selectedItem.quantity} ${selectedItem.unit})`;
      case 'delete': 
        return `Sigur doriți să ștergeți "${productName}" din stocul producție?`;
      default: return '';
    }
  };

  if (loading) {
    return <div className="text-center py-8">Se încarcă stocul...</div>;
  }

  return (
    <>
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Caută după produs, lot, furnizor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {filteredStock.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {stock.length === 0 
            ? "Nu există articole în stocul producție."
            : "Nu s-au găsit articole care să corespundă căutării."
          }
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produs</TableHead>
                <TableHead>Lot</TableHead>
                <TableHead>Furnizor</TableHead>
                <TableHead className="text-right">Cantitate</TableHead>
                <TableHead>Unitate</TableHead>
                <TableHead>Data Transfer</TableHead>
                <TableHead className="text-right">Acțiuni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStock.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    {item.products?.name || item.name}
                    {item.products?.cod_produs && (
                      <span className="text-xs text-muted-foreground ml-2">
                        ({item.products.cod_produs})
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{item.lot_number || '-'}</TableCell>
                  <TableCell>{item.suppliers?.name || '-'}</TableCell>
                  <TableCell className="text-right font-medium">
                    {item.quantity.toFixed(2)}
                  </TableCell>
                  <TableCell>{item.unit}</TableCell>
                  <TableCell>
                    {new Date(item.transfer_date).toLocaleDateString('ro-RO')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => openOperation(item, 'consumption')}
                        title="Dare în consum"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => openOperation(item, 'return')}
                        title="Returnare în depozit"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => openOperation(item, 'modify')}
                        title="Modificare"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => openOperation(item, 'delete')}
                        title="Ștergere"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
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
