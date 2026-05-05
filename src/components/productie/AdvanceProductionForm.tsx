
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Info } from "lucide-react";
import { useProducts, useProductionLines, useCreateOrder, useAutoDistributeToLine } from "@/hooks/productie/useProductionData";
import { toast } from "sonner";

interface AdvanceProductionFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

import DateProductiePicker, { todayISO } from "./DateProductiePicker";

const AdvanceProductionForm = ({ onClose, onSuccess }: AdvanceProductionFormProps) => {
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [selectedLine, setSelectedLine] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [dataProductie, setDataProductie] = useState<string>(todayISO());

  const { data: products, isLoading: productsLoading } = useProducts();
  const { data: lines, isLoading: linesLoading } = useProductionLines();
  const createOrderMutation = useCreateOrder();
  const autoDistributeMutation = useAutoDistributeToLine();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedProduct || !quantity) {
      toast.error("Te rog completează toate câmpurile obligatorii");
      return;
    }

    const quantityNum = parseInt(quantity);
    if (quantityNum <= 0) {
      toast.error("Cantitatea trebuie să fie mai mare decât 0");
      return;
    }

    try {
      console.log('🚀 Creez comandă de producție în avans cu datele:', {
        selectedProduct,
        quantity: quantityNum,
        selectedLine,
        notes
      });

      // Creez comanda cu magazin "PRODUCTIE_AVANS"
      const orderData = {
        magazin: "PRODUCTIE_AVANS",
        punct_livrare: "PRODUCTIE_AVANS",
        produs_id: selectedProduct,
        cantitate: quantityNum,
        baxare: notes || undefined,
        linie_id: selectedLine === 'auto-distribute' ? null : selectedLine || null,
        status: 'pending',
        tip_comanda: 'PRODUCTIE_AVANS',
        data_productie: dataProductie || null,
      };

      const newOrder = await createOrderMutation.mutateAsync(orderData);
      console.log('✅ Comandă creată cu succes:', newOrder);

      // Dacă nu s-a selectat o linie specifică sau s-a ales auto-distribuirea, fac auto-distribuirea
      if (!selectedLine || selectedLine === 'auto-distribute') {
        console.log('🔄 Nu s-a selectat linie specifică - încep auto-distribuirea pentru comanda:', newOrder.id);
        
        try {
          await autoDistributeMutation.mutateAsync(newOrder.id);
          console.log('✅ Auto-distribuirea s-a realizat cu succes');
          toast.success(`Comandă de producție în avans creată și distribuită automat pe linie: ${quantityNum} bucăți`);
        } catch (autoDistributeError: any) {
          console.error('❌ Eroare la auto-distribuire:', autoDistributeError);
          toast.warning(`Comanda a fost creată cu succes, dar auto-distribuirea a eșuat: ${autoDistributeError.message}`);
        }
      } else {
        toast.success(`Comandă de producție în avans creată cu succes: ${quantityNum} bucăți`);
      }

      // Resetez formularul
      setSelectedProduct('');
      setQuantity('');
      setSelectedLine('');
      setNotes('');
      
      onSuccess();
    } catch (error: any) {
      console.error('❌ Eroare la crearea comenzii de producție în avans:', error);
      toast.error(`Eroare la crearea comenzii: ${error.message || 'Eroare necunoscută'}`);
    }
  };

  const selectedProductData = products?.find(p => p.id === selectedProduct);

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <span className="text-blue-600 font-semibold text-sm">PA</span>
          </div>
          Producție în Avans
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Creează comenzi de producție preventivă pentru a avea stoc disponibil
        </p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Selectare Produs */}
          <div className="space-y-2">
            <Label htmlFor="product" className="text-sm font-medium flex items-center gap-1">
              Produs <span className="text-red-500">*</span>
            </Label>
            <Select value={selectedProduct} onValueChange={setSelectedProduct}>
              <SelectTrigger>
                <SelectValue placeholder="Selectează produsul pentru producția în avans" />
              </SelectTrigger>
              <SelectContent>
                {productsLoading ? (
                  <SelectItem value="loading" disabled>Se încarcă produsele...</SelectItem>
                ) : (
                  products?.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.nume} ({product.unitate_masura})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Cantitate */}
          <div className="space-y-2">
            <Label htmlFor="quantity" className="text-sm font-medium flex items-center gap-1">
              Cantitate de produs <span className="text-red-500">*</span>
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="quantity"
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="50"
                className="flex-1"
              />
              {selectedProductData && (
                <span className="text-sm text-muted-foreground">
                  {selectedProductData.unitate_masura}
                </span>
              )}
            </div>
          </div>

          {/* Linie de Producție */}
          <div className="space-y-2">
            <Label htmlFor="line" className="text-sm font-medium">
              Linie de Producție (opțional)
            </Label>
            <Select value={selectedLine} onValueChange={setSelectedLine}>
              <SelectTrigger>
                <SelectValue placeholder="Selectați linia sau lăsați gol pentru auto-distribuire" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto-distribute">Auto-distribuire (recomandată)</SelectItem>
                {linesLoading ? (
                  <SelectItem value="loading" disabled>Se încarcă liniile...</SelectItem>
                ) : (
                  lines?.filter(line => line.status === 'activa').map((line) => (
                    <SelectItem key={line.id} value={line.id}>
                      {line.nume} (Capacitate: {line.capacitate_ora}/h)
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Observații */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm font-medium">
              Observații / Prioritate
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Prioritate mare, pentru sezonul de sărbători"
              className="resize-none"
              rows={3}
            />
          </div>

          {/* Informații despre funcționare */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="space-y-2">
                <h4 className="font-medium text-blue-900">Cum funcționează?</h4>
                <p className="text-sm text-blue-800">
                  Comanda va fi creată ca "PRODUCTIE_AVANS" și când va fi produsă, surplus-ul va fi 
                  disponibil automat pentru comenzile reale care vin mai târziu.
                </p>
              </div>
            </div>
          </div>

          {/* Butoane */}
          <div className="flex justify-end gap-3 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              disabled={createOrderMutation.isPending || autoDistributeMutation.isPending}
            >
              Anulează
            </Button>
            <Button 
              type="submit" 
              disabled={createOrderMutation.isPending || autoDistributeMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {(createOrderMutation.isPending || autoDistributeMutation.isPending) ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {createOrderMutation.isPending ? 'Creez comanda...' : 'Auto-distribui...'}
                </>
              ) : (
                <>
                  <span className="mr-2">+</span>
                  Creează Producție în Avans
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default AdvanceProductionForm;
