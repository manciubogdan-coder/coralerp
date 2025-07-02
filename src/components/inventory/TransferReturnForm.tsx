
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
      const { data, error } = await supabase
        .from('crate_types')
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

    if (netQuantity > transfer.quantity) {
      toast({
        variant: "destructive",
        title: "Eroare",
        description: "Nu poți returna mai mult decât cantitatea transferată inițial"
      });
      return;
    }

    try {
      setIsSubmitting(true);
      
      // 1. Actualizează cantitatea din stock_transfer_items
      const newTransferQuantity = transfer.quantity - netQuantity;
      
      console.log('=== DEBUGGING TRANSFER UPDATE ===');
      console.log('Original quantity:', transfer.quantity);
      console.log('Returned net quantity:', netQuantity);
      console.log('New transfer quantity:', newTransferQuantity);
      
      if (newTransferQuantity <= 0) {
        // Dacă s-a returnat tot, șterge item-ul din transfer
        const { error: deleteError } = await supabase
          .from('stock_transfer_items')
          .delete()
          .eq('transfer_id', transfer.transfer_id)
          .eq('inventory_item_id', transfer.inventory_item_id);
          
        if (deleteError) throw deleteError;
        
        console.log("Transfer item complet returnat și șters din istoric");
      } else {
        // Calculează noua cantitate netă proporțional
        const originalNetQuantity = transfer.net_quantity || transfer.quantity;
        const reductionRatio = netQuantity / originalNetQuantity;
        const newNetQuantity = originalNetQuantity - netQuantity;
        
        // Actualizează ambele cantități în stock_transfer_items
        const { error: updateError } = await supabase
          .from('stock_transfer_items')
          .update({ 
            quantity: newTransferQuantity,
            net_quantity: newNetQuantity
          })
          .eq('transfer_id', transfer.transfer_id)
          .eq('inventory_item_id', transfer.inventory_item_id);
          
        if (updateError) throw updateError;
        
        console.log("Transfer item actualizat cu cantitățile rămase:", {
          quantity: newTransferQuantity,
          net_quantity: newNetQuantity
        });
      }
      
      // 2. Actualizează notele în stock_transfers
      const { error: notesError } = await supabase
        .from('stock_transfers')
        .update({ 
          notes: `${transfer.notes || ''} [Actualizat după returnare parțială]`.trim()
        })
        .eq('id', transfer.transfer_id);
        
      if (notesError) throw notesError;
      
      // 2. Adaugă cantitatea returnată în stoc
      const { data: originalItem, error: fetchError } = await supabase
        .from('inventory')
        .select('*')
        .eq('id', transfer.inventory_item_id)
        .single();
      
      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      let updatedId;
      
      if (originalItem) {
        const newQuantity = originalItem.quantity + netQuantity;
        
        const { error: updateError } = await supabase
          .from('inventory')
          .update({ 
            quantity: newQuantity,
            crate_count: originalItem.crate_count + crateCount
          })
          .eq('id', transfer.inventory_item_id);
          
        if (updateError) throw updateError;
        updatedId = transfer.inventory_item_id;
        
        console.log("Actualizat item existent în inventar:", {
          id: transfer.inventory_item_id,
          newQuantity,
          newCrateCount: originalItem.crate_count + crateCount
        });
      } else {
        // Creează un nou item în inventar dacă nu există
        const { data: inventoryData, error: insertError } = await supabase
          .from('inventory')
          .insert({
            name: transfer.product_name,
            product_id: transfer.product_id || null,
            supplier_id: transfer.supplier_id || null,
            supplier: transfer.supplier_name || null,
            manufacturer_id: transfer.manufacturer_id || null,
            document_number: transfer.document_number || null,
            entry_number: transfer.entry_number || null,
            quantity: netQuantity,
            unit: transfer.unit,
            crate_count: crateCount,
            crate_type_id: selectedCrateTypeId || null,
            crate_weight: crateWeight || null,
            gross_quantity: grossQuantity,
            net_quantity: netQuantity,
            lot_number: transfer.lot_number
          })
          .select()
          .single();
          
        if (insertError) throw insertError;
        updatedId = inventoryData.id;
        
        console.log("Creat nou item în inventar:", inventoryData);
      }
      
      // 3. Înregistrează în istoric
      console.log('=== DEBUGGING RETURN HISTORY ===');
      console.log('Inserting into inventory_history:', {
        inventory_item_id: updatedId,
        action: 'add',
        name: transfer.product_name,
        quantity: grossQuantity,
        net_quantity: netQuantity,
        unit: transfer.unit,
        operation_date: new Date().toISOString(),
        document_number: transfer.document_number,
        lot_number: transfer.lot_number,
        notes: `Returnat din ${transfer.destination}. ${notes}`.trim()
      });
      
      const { error: historyError } = await supabase
        .from('inventory_history')
        .insert({
          inventory_item_id: updatedId,
          action: 'add',
          name: transfer.product_name,
          quantity: grossQuantity,
          net_quantity: netQuantity,
          unit: transfer.unit,
          operation_date: new Date().toISOString(),
          document_number: transfer.document_number,
          lot_number: transfer.lot_number,
          crate_count: crateCount,
          crate_type_id: selectedCrateTypeId || null,
          crate_weight: crateWeight || null,
          notes: `Returnat din ${transfer.destination}. ${notes}`.trim()
        });
        
      if (historyError) {
        console.error('History error:', historyError);
        throw historyError;
      }
      
      console.log('Successfully inserted into inventory_history');
      
      toast({
        title: "Succes",
        description: `Cantitate de ${netQuantity} ${transfer.unit} returnată și transferul actualizat.`
      });
      
      // Refresh the page to update all tabs
      window.location.reload();
      
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
