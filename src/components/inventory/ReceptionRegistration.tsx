import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-custom-toast";
import { Plus, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Product, Supplier, Manufacturer } from "@/types";
import { useInventoryType } from "@/context/inventory-type";

interface ReceptionRegistrationProps {
  products: Product[];
  suppliers: Supplier[];
  manufacturers: Manufacturer[];
  crateTypes: { id: string; name: string; weight: number; }[];
  onRegistrationComplete: () => void;
}

export function ReceptionRegistration({ 
  products, 
  suppliers, 
  manufacturers, 
  crateTypes,
  onRegistrationComplete 
}: ReceptionRegistrationProps) {
  const { inventoryType } = useInventoryType();
  const [isOpen, setIsOpen] = useState(false);
  const [productId, setProductId] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [manufacturerId, setManufacturerId] = useState<string | null>(null);
  const [documentNumber, setDocumentNumber] = useState('');
  
  // Câmpuri pentru calcul - nu se salvează
  const [grossQuantity, setGrossQuantity] = useState<number>(0);
  const [crateTypeId, setCrateTypeId] = useState<string | null>(null);
  const [crateCount, setCrateCount] = useState<number>(0);
  const [palletWeight, setPalletWeight] = useState<number>(0);
  
  // Cantitatea netă calculată - aceasta se salvează
  const [netQuantity, setNetQuantity] = useState<number>(0);

  const selectedProduct = products.find(p => p.id === productId);

  const calculateNetQuantity = () => {
    const selectedCrateType = crateTypes.find(ct => ct.id === crateTypeId);
    const crateWeight = selectedCrateType && crateTypeId !== "no-crate" ? selectedCrateType.weight * crateCount : 0;
    const calculatedNet = Math.max(0, grossQuantity - crateWeight - palletWeight);
    setNetQuantity(calculatedNet);
  };

  // Recalculez cantitatea netă când se schimbă valorile
  React.useEffect(() => {
    calculateNetQuantity();
  }, [grossQuantity, crateTypeId, crateCount, palletWeight]);

  const handleSubmit = async () => {
    try {
      const isManufacturerRequired = inventoryType === 'materii-prime';
      if (!productId || !supplierId || (isManufacturerRequired && !manufacturerId) || !documentNumber || netQuantity <= 0) {
        toast({
          title: "Date incomplete",
          description: "Vă rugăm să completați toate câmpurile și asigurați-vă că cantitatea netă este pozitivă.",
          variant: "destructive"
        });
        return;
      }

      const selectedProduct = products.find(p => p.id === productId);
      if (!selectedProduct) return;

      const inventoryTable = inventoryType === 'ambalaje' ? 'ambalaje_inventory' : 'inventory';
      
      console.log('Salvez recepție cu cantitate netă:', {
        productName: selectedProduct.name,
        grossQuantity,
        netQuantity,
        calculationDetails: { crateTypeId, crateCount, palletWeight }
      });

      // Salvez DOAR cantitatea netă - informațiile despre lăzi sunt doar pentru calcul
      const { error } = await supabase
        .from(inventoryTable)
        .insert({
          product_id: productId,
          name: selectedProduct.name,
          supplier_id: supplierId,
          manufacturer_id: manufacturerId,
          document_number: documentNumber,
          quantity: netQuantity, // DOAR cantitatea netă
          unit: selectedProduct.default_unit || 'kg',
          receipt_date: new Date().toISOString()
        });

      if (error) throw error;

      toast({
        title: "Recepție înregistrată",
        description: `Cantitate netă stocată: ${netQuantity.toFixed(2)} ${selectedProduct.default_unit || 'kg'}`
      });

      setIsOpen(false);
      onRegistrationComplete();
      
      // Reset form
      setProductId(null);
      setSupplierId(null);
      setManufacturerId(null);
      setDocumentNumber('');
      setGrossQuantity(0);
      setCrateTypeId(null);
      setCrateCount(0);
      setPalletWeight(0);
      setNetQuantity(0);
    } catch (error: any) {
      toast({
        title: "Eroare",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Înregistrare recepție
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Înregistrare recepție nouă (cantitate netă)</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <label className="font-medium">Produs</label>
            <Select value={productId || ''} onValueChange={setProductId}>
              <SelectTrigger>
                <SelectValue placeholder="Selectează produsul" />
              </SelectTrigger>
              <SelectContent>
                {products.map(product => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="font-medium">Furnizor</label>
            <Select value={supplierId || ''} onValueChange={setSupplierId}>
              <SelectTrigger>
                <SelectValue placeholder="Selectează furnizorul" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map(supplier => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {inventoryType === 'materii-prime' && (
            <div className="space-y-2">
              <label className="font-medium">Producător</label>
              <Select value={manufacturerId || ''} onValueChange={setManufacturerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selectează producătorul" />
                </SelectTrigger>
                <SelectContent>
                  {manufacturers.map(manufacturer => (
                    <SelectItem key={manufacturer.id} value={manufacturer.id}>
                      {manufacturer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
                </Select>
            </div>
          )}

          <div className="space-y-2">
            <label className="font-medium">Număr document</label>
            <Input
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
              placeholder="Introduceți numărul documentului"
            />
          </div>

          {/* Secțiune calcul cantitate netă */}
          <div className="p-4 border rounded-lg bg-gray-50 space-y-4">
            <h3 className="font-semibold text-lg">Calcul cantitate netă</h3>
            <p className="text-sm text-gray-600">
              Introduceți cantitatea brută și detaliile pentru lăzi/paleți. Sistemul va calcula și stoca doar cantitatea netă.
            </p>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Cantitate brută (kg)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={grossQuantity || ''}
                  onChange={(e) => setGrossQuantity(parseFloat(e.target.value) || 0)}
                  placeholder="Cantitatea totală brută"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Greutate palet (kg)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={palletWeight || ''}
                  onChange={(e) => setPalletWeight(parseFloat(e.target.value) || 0)}
                  placeholder="Greutatea paletului"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Tip lădiță</label>
                <Select value={crateTypeId || ''} onValueChange={setCrateTypeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selectează tipul de lădiță" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no-crate">Fără lăzi</SelectItem>
                    {crateTypes.map(crateType => (
                      <SelectItem key={crateType.id} value={crateType.id}>
                        {crateType.name} ({crateType.weight} kg)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Număr lădițe</label>
                <Input
                  type="number"
                  value={crateCount || ''}
                  onChange={(e) => setCrateCount(parseInt(e.target.value) || 0)}
                  placeholder="Numărul de lăzi"
                  disabled={!crateTypeId || crateTypeId === "no-crate"}
                />
              </div>
            </div>

            <div className="mt-4 p-4 bg-white rounded-md border-2 border-green-200">
              <div className="text-lg font-bold text-green-700">
                Cantitate netă: {netQuantity.toFixed(2)} {selectedProduct?.default_unit || 'kg'}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                Aceasta este cantitatea care va fi stocată în sistem
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button 
              onClick={handleSubmit} 
              disabled={!productId || !supplierId || (inventoryType === 'materii-prime' && !manufacturerId) || !documentNumber || netQuantity <= 0}
            >
              <Save className="h-4 w-4 mr-2" />
              Salvează recepția (cantitate netă)
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}