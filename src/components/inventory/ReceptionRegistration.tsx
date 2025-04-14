import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-custom-toast";
import { Plus, Save, PackagePlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Product, Supplier, Manufacturer } from "@/types";

interface PalletEntry {
  grossQuantity: number;
  crateTypeId: string | null;
  crateCount: number;
  palletWeight: number;
  netQuantity: number;
}

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
  const [isOpen, setIsOpen] = useState(false);
  const [productId, setProductId] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [manufacturerId, setManufacturerId] = useState<string | null>(null);
  const [documentNumber, setDocumentNumber] = useState('');
  const [pallets, setPallets] = useState<PalletEntry[]>([{
    grossQuantity: 0,
    crateTypeId: null,
    crateCount: 0,
    palletWeight: 0,
    netQuantity: 0
  }]);

  const selectedProduct = products.find(p => p.id === productId);

  const calculateNetQuantity = (pallet: PalletEntry): number => {
    const selectedCrateType = crateTypes.find(ct => ct.id === pallet.crateTypeId);
    const crateWeight = selectedCrateType ? selectedCrateType.weight * pallet.crateCount : 0;
    return Math.max(0, pallet.grossQuantity - crateWeight - pallet.palletWeight);
  };

  const handlePalletChange = (index: number, field: keyof PalletEntry, value: any) => {
    const newPallets = [...pallets];
    newPallets[index] = {
      ...newPallets[index],
      [field]: value
    };
    
    // Recalculate net quantity whenever relevant fields change
    newPallets[index].netQuantity = calculateNetQuantity(newPallets[index]);
    
    setPallets(newPallets);
  };

  const addNewPallet = () => {
    setPallets([...pallets, {
      grossQuantity: 0,
      crateTypeId: null,
      crateCount: 0,
      palletWeight: 0,
      netQuantity: 0
    }]);
  };

  const handleSubmit = async () => {
    try {
      if (!productId || !supplierId || !manufacturerId || !documentNumber) {
        toast({
          title: "Date incomplete",
          description: "Vă rugăm să completați toate câmpurile obligatorii.",
          variant: "destructive"
        });
        return;
      }

      const selectedProduct = products.find(p => p.id === productId);
      if (!selectedProduct) return;

      // Insert each pallet as a separate inventory entry
      for (const pallet of pallets) {
        if (pallet.grossQuantity <= 0) continue;

        const { error } = await supabase
          .from('inventory')
          .insert({
            product_id: productId,
            name: selectedProduct.name,
            supplier_id: supplierId,
            manufacturer_id: manufacturerId,
            document_number: documentNumber,
            quantity: pallet.netQuantity,
            gross_quantity: pallet.grossQuantity,
            net_quantity: pallet.netQuantity,
            unit: selectedProduct.default_unit || 'kg',
            crate_type_id: pallet.crateTypeId,
            crate_count: pallet.crateCount,
            receipt_date: new Date().toISOString()
          });

        if (error) throw error;
      }

      toast({
        title: "Recepție înregistrată",
        description: "Produsele au fost adăugate în inventar cu succes."
      });

      setIsOpen(false);
      onRegistrationComplete();
      
      // Reset form
      setProductId(null);
      setSupplierId(null);
      setManufacturerId(null);
      setDocumentNumber('');
      setPallets([{
        grossQuantity: 0,
        crateTypeId: null,
        crateCount: 0,
        palletWeight: 0,
        netQuantity: 0
      }]);

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
          <DialogTitle>Înregistrare recepție nouă</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Product Selection */}
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

          {/* Supplier Selection */}
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

          {/* Manufacturer Selection */}
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

          {/* Document Number */}
          <div className="space-y-2">
            <label className="font-medium">Număr document</label>
            <Input
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
              placeholder="Introduceți numărul documentului"
            />
          </div>

          {/* Pallets Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Paleți</h3>
              <Button variant="outline" onClick={addNewPallet} disabled={!productId}>
                <PackagePlus className="h-4 w-4 mr-2" />
                Adaugă palet
              </Button>
            </div>

            {pallets.map((pallet, index) => (
              <div key={index} className="p-4 border rounded-lg space-y-4">
                <h4 className="font-medium">Palet {index + 1}</h4>
                <div className="grid grid-cols-2 gap-4">
                  {/* Gross Quantity */}
                  <div className="space-y-2">
                    <label className="text-sm">Cantitate brută (kg)</label>
                    <Input
                      type="number"
                      value={pallet.grossQuantity || ''}
                      onChange={(e) => handlePalletChange(index, 'grossQuantity', parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  {/* Pallet Weight */}
                  <div className="space-y-2">
                    <label className="text-sm">Greutate palet (kg)</label>
                    <Input
                      type="number"
                      value={pallet.palletWeight || ''}
                      onChange={(e) => handlePalletChange(index, 'palletWeight', parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  {/* Crate Type */}
                  <div className="space-y-2">
                    <label className="text-sm">Tip lădiță</label>
                    <Select 
                      value={pallet.crateTypeId || ''} 
                      onValueChange={(value) => handlePalletChange(index, 'crateTypeId', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selectează tipul de lădiță" />
                      </SelectTrigger>
                      <SelectContent>
                        {crateTypes.map(crateType => (
                          <SelectItem key={crateType.id} value={crateType.id}>
                            {crateType.name} ({crateType.weight} kg)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Crate Count */}
                  <div className="space-y-2">
                    <label className="text-sm">Număr lădițe</label>
                    <Input
                      type="number"
                      value={pallet.crateCount || ''}
                      onChange={(e) => handlePalletChange(index, 'crateCount', parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>

                {/* Net Quantity Display */}
                <div className="mt-4 p-3 bg-gray-50 rounded-md">
                  <p className="text-sm font-medium">
                    Cantitate netă: {pallet.netQuantity.toFixed(2)} {selectedProduct?.default_unit || 'kg'}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={handleSubmit} disabled={!productId || !supplierId || !manufacturerId || !documentNumber}>
              <Save className="h-4 w-4 mr-2" />
              Salvează recepția
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
