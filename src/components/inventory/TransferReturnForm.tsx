
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-custom-toast";
import { 
  Dialog, 
  DialogContent, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { CornerDownLeft } from "lucide-react";
import { CrateType } from "@/types";
import { useInventoryType } from "@/App";

interface TransferItem {
  transfer_id: string;
  transfer_date: string;
  destination: string;
  product_name: string;
  supplier_name?: string;
  manufacturer_name?: string;
  document_number?: string;
  entry_number?: number;
  quantity: number;
  net_quantity?: number;
  unit: string;
  crate_count?: number;
  notes?: string;
  inventory_item_id: string;
  product_id?: string;
  supplier_id?: string;
  manufacturer_id?: string;
  created_at?: string;
  crate_type_id?: string;
  crate_weight?: number;
  lot_number?: string;
}

interface TransferReturnFormProps {
  transfer: TransferItem;
  onReturnComplete?: () => void;
}

export const TransferReturnForm = ({ transfer, onReturnComplete }: TransferReturnFormProps) => {
  const { inventoryType } = useInventoryType();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [grossQuantity, setGrossQuantity] = useState<number>(transfer.quantity);
  const [crateCount, setCrateCount] = useState<number>(transfer.crate_count || 0);
  const [selectedCrateTypeId, setSelectedCrateTypeId] = useState<string>(transfer.crate_type_id || '');
  const [crateWeight, setCrateWeight] = useState<number>(transfer.crate_weight || 0);
  const [palletCount, setPalletCount] = useState<number>(0);
  const [palletWeight, setPalletWeight] = useState<number>(0);
  const [notes, setNotes] = useState<string>("");
  const [crateTypes, setCrateTypes] = useState<CrateType[]>([]);
  
  useEffect(() => {
    const fetchCrateTypes = async () => {
      const crateTypesTable = inventoryType === 'ambalaje' ? 'ambalaje_crate_types' : 'crate_types';
      const { data, error } = await supabase
        .from(crateTypesTable)
        .select('*')
        .order('name');
        
      if (error) {
        console.error("Error fetching crate types:", error);
        toast({
          variant: "destructive",
          title: "Eroare",
          description: "Nu s-au putut încărca tipurile de lădițe"
        });
        return;
      }
      
      setCrateTypes(data || []);
    };
    
    fetchCrateTypes();
  }, []);
  
  useEffect(() => {
    if (selectedCrateTypeId) {
      const selectedType = crateTypes.find(type => type.id === selectedCrateTypeId);
      if (selectedType) {
        setCrateWeight(selectedType.weight);
      }
    }
  }, [selectedCrateTypeId, crateTypes]);
  
  const calculateNetQuantity = () => {
    const totalCrateWeight = crateWeight * crateCount;
    const totalPalletWeight = palletWeight;
    return Math.max(0, grossQuantity - totalCrateWeight - totalPalletWeight);
  };
  
  const netQuantity = calculateNetQuantity();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (grossQuantity <= 0) {
      toast({
        variant: "destructive",
        title: "Eroare",
        description: "Cantitatea brută trebuie să fie mai mare de 0"
      });
      return;
    }

    // Validez pe NET: nu poți returna mai mult decât net-ul transferat
    const originalNetQuantity = transfer.net_quantity ?? transfer.quantity;
    if (netQuantity > originalNetQuantity) {
      toast({
        variant: "destructive",
        title: "Eroare",
        description: "Nu poți returna mai mult decât cantitatea netă transferată inițial"
      });
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Determină tabelele în funcție de tipul de inventar
      const transferItemsTable = inventoryType === 'ambalaje' ? 'ambalaje_stock_transfer_items' : 'stock_transfer_items';
      const transfersTable = inventoryType === 'ambalaje' ? 'ambalaje_stock_transfers' : 'stock_transfers';
      const inventoryTable = inventoryType === 'ambalaje' ? 'ambalaje_inventory' : 'inventory';
      const historyTable = inventoryType === 'ambalaje' ? 'ambalaje_inventory_history' : 'inventory_history';
      
      // 1. Actualizează cantitățile din transfer item (scad atât BRUT cât și NET)
      const newGrossQuantity = transfer.quantity - grossQuantity; // quantity = BRUT
      const newNetQuantity = originalNetQuantity - netQuantity;   // net_quantity = NET
      
      console.log('=== DEBUGGING TRANSFER UPDATE (RETURN) ===');
      console.log({ originalGross: transfer.quantity, originalNet: originalNetQuantity, returnedGross: grossQuantity, returnedNet: netQuantity, newGrossQuantity, newNetQuantity });
      
      if (newGrossQuantity <= 0 || newNetQuantity <= 0) {
        // Dacă s-a returnat tot, șterg item-ul din transfer
        const { error: deleteError } = await supabase
          .from(transferItemsTable)
          .delete()
          .eq('transfer_id', transfer.transfer_id)
          .eq('inventory_item_id', transfer.inventory_item_id);
        if (deleteError) throw deleteError;
        console.log("Transfer item complet returnat și șters din istoric");
      } else {
        // Actualizez ambele cantități
        const { error: updateError } = await supabase
          .from(transferItemsTable)
          .update({ 
            quantity: newGrossQuantity,
            net_quantity: newNetQuantity
          })
          .eq('transfer_id', transfer.transfer_id)
          .eq('inventory_item_id', transfer.inventory_item_id);
        if (updateError) throw updateError;
        console.log("Transfer item actualizat cu cantitățile rămase:", { quantity: newGrossQuantity, net_quantity: newNetQuantity });
      }
      
      // 2. Actualizează notele în transfers
      const { error: notesError } = await supabase
        .from(transfersTable)
        .update({ 
          notes: `${transfer.notes || ''} [Actualizat după returnare parțială]`.trim()
        })
        .eq('id', transfer.transfer_id);
      if (notesError) throw notesError;
      
      // 3. Adaugă cantitatea NET returnată în stocul inventarului
      const { data: originalItem, error: fetchError } = await supabase
        .from(inventoryTable)
        .select('*')
        .eq('id', transfer.inventory_item_id)
        .maybeSingle();
      if (fetchError) throw fetchError;

      let updatedId;
      
      if (originalItem) {
        const newQuantityInInventory = (originalItem.quantity || 0) + netQuantity; // quantity = NET în inventar
        const { error: updateError } = await supabase
          .from(inventoryTable)
          .update({ quantity: newQuantityInInventory })
          .eq('id', transfer.inventory_item_id);
        if (updateError) throw updateError;
        updatedId = transfer.inventory_item_id;
        console.log("Actualizat item existent în inventar:", { id: transfer.inventory_item_id, newQuantityInInventory });
      } else {
        // Creează un nou item în inventar dacă nu există
        const { data: inventoryData, error: insertError } = await supabase
          .from(inventoryTable)
          .insert({
            name: transfer.product_name,
            product_id: transfer.product_id || null,
            supplier_id: transfer.supplier_id || null,
            supplier: transfer.supplier_name || null,
            manufacturer_id: transfer.manufacturer_id || null,
            document_number: transfer.document_number || null,
            entry_number: transfer.entry_number || null,
            quantity: netQuantity, // NET în inventar
            unit: transfer.unit,
            lot_number: transfer.lot_number
          })
          .select()
          .single();
        if (insertError) throw insertError;
        updatedId = inventoryData.id;
        console.log("Creat nou item în inventar:", inventoryData);
      }
      
      // 4. Înregistrează în istoric (NET)
      console.log('=== DEBUGGING RETURN HISTORY ===');
      const historyDate = new Date().toISOString();
      
      const actualLotNumber = transfer.lot_number || (originalItem && originalItem.lot_number) || null;
      
      const { error: historyError } = await supabase
        .from(historyTable)
        .insert({
          inventory_item_id: updatedId,
          action: 'transfer_in',
          name: transfer.product_name,
          quantity: netQuantity, // NET
          unit: transfer.unit,
          operation_date: historyDate,
          document_number: transfer.document_number,
          lot_number: actualLotNumber,
          notes: `Returnat din ${transfer.destination}. ${notes}`.trim()
        });
      if (historyError) throw historyError;
      
      toast({
        title: "Succes",
        description: `Cantitate de ${netQuantity} ${transfer.unit} returnată și transferul actualizat.`
      });
      
      setIsOpen(false);
      if (onReturnComplete) onReturnComplete();
      
    } catch (error: any) {
      console.error("Error returning stock:", error);
      toast({
        variant: "destructive",
        title: "Eroare la returnare",
        description: error.message
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Returnează în stoc">
          <CornerDownLeft className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Returnare în stoc</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="font-medium">Produs</div>
            <div>{transfer.product_name}</div>
          </div>
          
          <div className="space-y-2">
            <div className="font-medium text-sm text-muted-foreground">
              Cantitate transferată inițial: {transfer.quantity} {transfer.unit}
            </div>
          </div>
          
          <div className="space-y-2">
            <label htmlFor="grossQuantity" className="font-medium">
              Cantitate brută returnată ({transfer.unit})
            </label>
            <Input
              id="grossQuantity"
              type="number"
              min="0.01"
              max={transfer.quantity}
              step="0.01"
              value={grossQuantity}
              onChange={(e) => setGrossQuantity(parseFloat(e.target.value) || 0)}
              required
            />
          </div>
          
          <div className="space-y-2">
            <label htmlFor="crateCount" className="font-medium">
              Număr lădițe returnate
            </label>
            <Input
              id="crateCount"
              type="number"
              min="0"
              value={crateCount}
              onChange={(e) => setCrateCount(parseInt(e.target.value) || 0)}
            />
          </div>
          
          {crateCount > 0 && (
            <div className="space-y-2">
              <label htmlFor="crateType" className="font-medium">
                Tip lădiță
              </label>
              <Select value={selectedCrateTypeId} onValueChange={setSelectedCrateTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Alege tipul de lădiță" />
                </SelectTrigger>
                <SelectContent>
                  {crateTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name} ({type.weight} kg)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {selectedCrateTypeId && (
                <div className="text-sm text-muted-foreground">
                  Greutate totală lădițe: {(crateWeight * crateCount).toFixed(2)} kg
                </div>
              )}
            </div>
          )}
          
          <div className="space-y-2">
            <label htmlFor="palletCount" className="font-medium">
              Număr paleți returnați
            </label>
            <Input
              id="palletCount"
              type="number"
              min="0"
              value={palletCount}
              onChange={(e) => setPalletCount(parseInt(e.target.value) || 0)}
            />
          </div>
          
          <div className="space-y-2">
            <label htmlFor="palletWeight" className="font-medium">
              Greutate totală paleți (kg)
            </label>
            <Input
              id="palletWeight"
              type="number"
              min="0"
              step="0.01"
              value={palletWeight}
              onChange={(e) => setPalletWeight(parseFloat(e.target.value) || 0)}
            />
          </div>
          
          <div className="space-y-2">
            <div className="font-medium">Cantitate netă calculată</div>
            <div className="px-4 py-2 bg-gray-100 rounded border">
              {netQuantity.toFixed(2)} {transfer.unit}
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="font-medium text-sm text-muted-foreground">
              Cantitate rămasă la destinație: {(transfer.quantity - netQuantity).toFixed(2)} {transfer.unit}
            </div>
          </div>
          
          <div className="space-y-2">
            <label htmlFor="notes" className="font-medium">
              Note (opțional)
            </label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalii despre returnare"
            />
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Anulează
            </Button>
            <Button type="submit" disabled={isSubmitting || grossQuantity <= 0}>
              {isSubmitting ? "Se procesează..." : "Returnează în stoc"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
