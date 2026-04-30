
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Edit3, AlertTriangle, CheckCircle } from "lucide-react";
import { useQuantityCorrection } from "@/hooks/useQuantityCorrection";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface QuantityCorrectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  order: {
    id: string;
    numar_comanda: string;
    cantitate: number;
    cantitate_reala_produsa: number;
    produs_id: string;
    productie_produse?: {
      nume: string;
      unitate_masura: string;
    };
  };
}

const QuantityCorrectionDialog = ({
  isOpen,
  onClose,
  order
}: QuantityCorrectionDialogProps) => {
  const [cantitateNoua, setCantitateNoua] = useState(0);
  const [currentOrderData, setCurrentOrderData] = useState<any>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const quantityCorrectionMutation = useQuantityCorrection();

  // Citire directă din baza de date
  const fetchDirectFromDB = async () => {
    if (!isOpen || !order.id) return;
    
    console.log('🔍 === CITIRE DIRECTĂ DIN DB ===');
    console.log('📊 Order ID:', order.id);
    
    setIsLoadingData(true);
    
    try {
      const { data, error } = await supabase
        .from('productie_comenzi')
        .select(`
          *,
          productie_produse (
            id,
            nume,
            unitate_masura
          )
        `)
        .eq('id', order.id)
        .single();
      
      if (error) {
        console.error('❌ Eroare la citire directă:', error);
        setCurrentOrderData(order); // fallback la datele originale
        return;
      }
      
      console.log('✅ Date citite direct din DB:', {
        id: data.id,
        numar_comanda: data.numar_comanda,
        cantitate_comandata: data.cantitate,
        cantitate_reala_produsa: data.cantitate_reala_produsa,
        updated_at: data.updated_at
      });
      
      setCurrentOrderData(data);
    } catch (error) {
      console.error('💥 Eroare neașteptată:', error);
      setCurrentOrderData(order); // fallback
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDirectFromDB();
    }
  }, [isOpen, order.id]);

  useEffect(() => {
    if (currentOrderData) {
      const cantitateInitiala = currentOrderData.cantitate_reala_produsa || 0;
      setCantitateNoua(cantitateInitiala);
      console.log('🔢 Cantitate setată în formular:', cantitateInitiala);
    }
  }, [currentOrderData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentOrderData) {
      toast.error("Datele comenzii nu sunt disponibile!");
      return;
    }
    
    console.log('🚀 === SUBMIT CORECȚIE ===');
    
    const cantitateVeche = currentOrderData.cantitate_reala_produsa || 0;
    
    // Validări - îndepărtez restricția de cantitate minimă
    if (cantitateNoua < 0) {
      toast.error("Cantitatea nu poate fi negativă!");
      return;
    }

    if (cantitateNoua === cantitateVeche) {
      toast.error("Cantitatea nu s-a modificat!");
      return;
    }

    console.log('📊 Execut corecția:', {
      comandaId: currentOrderData.id,
      cantitateVeche,
      cantitateNoua,
      diferenta: cantitateNoua - cantitateVeche,
      cantitateComandada: currentOrderData.cantitate
    });

    try {
      await quantityCorrectionMutation.mutateAsync({
        comandaId: currentOrderData.id,
        cantitateNoua,
        cantitateVeche,
        produsId: currentOrderData.produs_id
      });
      
      console.log('✅ Corecția finalizată cu succes!');
      
      // Aștept ca toate cache-urile să se reseteze complet
      console.log('⏳ Aștept resetarea completă a cache-urilor...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('🚪 Închid dialogul...');
      onClose();
      
    } catch (error) {
      console.error('💥 Eroare în corecție:', error);
      toast.error('Eroare la salvarea corecției!');
    }
  };

  if (!currentOrderData && isLoadingData) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Se încarcă datele...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const orderToDisplay = currentOrderData || order;
  const cantitateComandată = orderToDisplay.cantitate;
  const cantitateVeche = orderToDisplay.cantitate_reala_produsa || 0;
  const diferenta = cantitateNoua - cantitateVeche;
  const diferentaFataComandata = cantitateNoua - cantitateComandată;

  // Calculez noul status al comenzii bazat pe cantitatea nouă
  const getNewOrderStatus = () => {
    if (cantitateNoua === 0) return 'pending';
    if (cantitateNoua < cantitateComandată) return 'in_progress';
    if (cantitateNoua >= cantitateComandată) return 'completed';
    return 'in_progress';
  };

  const newStatus = getNewOrderStatus();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit3 className="h-5 w-5 text-amber-600" />
            Corecție Cantitate Produsă
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-sm font-medium">Comandă:</span>
              <span className="text-sm">{orderToDisplay.numar_comanda}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-medium">Produs:</span>
              <span className="text-sm">{orderToDisplay.productie_produse?.nume}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-medium">Cantitate comandată:</span>
              <span className="text-sm font-semibold">{cantitateComandată} {orderToDisplay.productie_produse?.unitate_masura}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-medium">Cantitate actuală (DB):</span>
              <span className="text-sm font-semibold text-blue-600">
                {cantitateVeche} {orderToDisplay.productie_produse?.unitate_masura}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cantitateNoua">Cantitate reală produsă</Label>
            <Input
              id="cantitateNoua"
              type="number"
              min="0"
              step="1"
              value={cantitateNoua}
              onChange={(e) => {
                const value = parseInt(e.target.value) || 0;
                setCantitateNoua(value);
              }}
              placeholder="Introduceți cantitatea corectă"
              className="text-lg"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Poți introduce orice cantitate ≥ 0. Comanda se va actualiza automat.
            </p>
          </div>

          {/* Status nou al comenzii */}
          {diferenta !== 0 && (
            <div className="p-3 rounded-lg border bg-blue-50 border-blue-200">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 mt-0.5 text-blue-600" />
                <div className="text-sm">
                  <p className="font-medium mb-1">Status nou al comenzii:</p>
                  <Badge 
                    variant={
                      newStatus === 'completed' ? 'default' : 
                      newStatus === 'in_progress' ? 'secondary' : 
                      'outline'
                    }
                    className="mb-2"
                  >
                    {newStatus === 'completed' ? 'Finalizată' : 
                     newStatus === 'in_progress' ? 'În progres' : 
                     'Pending'}
                  </Badge>
                  <p className="text-muted-foreground">
                    Progres: {cantitateNoua}/{cantitateComandată} = {cantitateComandată > 0 ? Math.round((cantitateNoua / cantitateComandată) * 100) : 0}%
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Diferențe */}
          {diferenta !== 0 && (
            <div className={`p-3 rounded-lg border ${
              diferenta > 0 
                ? 'bg-green-50 border-green-200' 
                : 'bg-amber-50 border-amber-200'
            }`}>
              <div className="flex items-start gap-2">
                <AlertTriangle className={`h-4 w-4 mt-0.5 ${
                  diferenta > 0 ? 'text-green-600' : 'text-amber-600'
                }`} />
                <div className="text-sm space-y-2">
                  <p className="font-medium">
                    {diferenta > 0 ? 'Adăugare produse' : 'Scădere produse'}
                  </p>
                  <p className="text-muted-foreground">
                    Diferența: {diferenta > 0 ? '+' : ''}{diferenta} {orderToDisplay.productie_produse?.unitate_masura}
                  </p>
                  
                  {/* Diferența față de cantitatea comandată */}
                  <div className="flex flex-wrap gap-1">
                    <Badge 
                      variant={diferenta > 0 ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {diferenta > 0 ? '+' : ''}{diferenta} {orderToDisplay.productie_produse?.unitate_masura}
                    </Badge>
                    
                    {diferentaFataComandata !== 0 && (
                      <Badge 
                        variant={diferentaFataComandata > 0 ? "default" : "outline"}
                        className={`text-xs ${
                          diferentaFataComandata > 0 ? 'bg-green-600' : 'bg-red-100 text-red-700 border-red-200'
                        }`}
                      >
                        {diferentaFataComandata > 0 ? 'Surplus: +' : 'Lipsă: '}
                        {Math.abs(diferentaFataComandata)} {orderToDisplay.productie_produse?.unitate_masura}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={quantityCorrectionMutation.isPending}
            >
              Anulează
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-amber-600 hover:bg-amber-700"
              disabled={
                quantityCorrectionMutation.isPending || 
                cantitateNoua < 0 || 
                cantitateNoua === cantitateVeche
              }
            >
              {quantityCorrectionMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Se corectează...
                </>
              ) : (
                'Confirmă Corecția'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default QuantityCorrectionDialog;
