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
import { ConfirmationDialog } from "./ConfirmationDialog";
import { Badge } from "@/components/ui/badge";
import { emitNotification } from "@/lib/notifications";

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
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  // Tip palet + nr paleți recepționați (se salvează în reception_records)
  const [palletTypeId, setPalletTypeId] = useState<string | null>(null);
  const [palletCount, setPalletCount] = useState<number>(0);
  const [palletTypes, setPalletTypes] = useState<{ id: string; name: string }[]>([]);

  const palletTypesTable = inventoryType === "ambalaje"
    ? "ambalaje_pallet_types"
    : inventoryType === "etichete"
      ? "etichete_pallet_types"
      : "pallet_types";

  React.useEffect(() => {
    (async () => {
      const { data, error } = await (supabase as any)
        .from(palletTypesTable)
        .select("id, name")
        .order("name");
      if (!error) setPalletTypes((data as { id: string; name: string }[]) || []);
    })();
  }, [palletTypesTable, isOpen]);

  const selectedProduct = products.find(p => p.id === productId);

  // Recalculez cantitatea netă când se schimbă valorile
  React.useEffect(() => {
    const selectedCrateType = crateTypes.find(ct => ct.id === crateTypeId);
    const crateWeight = selectedCrateType && crateTypeId !== "no-crate" ? selectedCrateType.weight * crateCount : 0;
    const calculatedNet = Math.max(0, grossQuantity - crateWeight - palletWeight);
    setNetQuantity(calculatedNet);
  }, [crateCount, crateTypeId, crateTypes, grossQuantity, palletWeight]);

  // Pentru etichete, cantitatea netă = cantitatea introdusă direct (fără calcul lăzi/paleți)
  const isEtichete = inventoryType === 'etichete';
  
  const isManufacturerRequired = inventoryType === 'materii-prime';
  const quantityToSave = isEtichete ? grossQuantity : netQuantity;
  const unitToSave = selectedProduct?.default_unit || (isEtichete ? 'buc' : 'kg');
  const selectedSupplier = suppliers.find(s => s.id === supplierId);
  const selectedManufacturer = manufacturers.find(m => m.id === manufacturerId);

  const zoneLabel = inventoryType === 'ambalaje'
    ? 'Ambalaje'
    : inventoryType === 'etichete'
      ? 'Etichete'
      : 'Materii Prime';

  const handleSubmit = () => {
    if (!productId || !supplierId || (isManufacturerRequired && !manufacturerId) || !documentNumber || quantityToSave <= 0) {
      toast({
        title: "Date incomplete",
        description: "Vă rugăm să completați toate câmpurile și asigurați-vă că cantitatea este pozitivă.",
        variant: "destructive"
      });
      return;
    }
    setShowConfirm(true);
  };

  const executeSave = async () => {
    try {
      setIsSubmitting(true);
      if (!productId || !selectedProduct) return;

      const inventoryTable = inventoryType === 'ambalaje'
        ? 'ambalaje_inventory'
        : inventoryType === 'etichete'
          ? 'etichete_inventory'
          : 'inventory';

      const validCrateTypeId = !isEtichete && crateTypeId && crateTypeId !== "no-crate" ? crateTypeId : null;
      const selectedCrateType = crateTypes.find(ct => ct.id === validCrateTypeId);
      const totalCrateWeight = selectedCrateType ? selectedCrateType.weight * crateCount : 0;

      console.log('Salvez recepție:', {
        productName: selectedProduct.name,
        grossQuantity,
        quantityToSave,
        isEtichete,
        calculationDetails: isEtichete ? 'N/A' : { crateTypeId, crateCount, palletWeight }
      });

      const { error } = await supabase
        .from(inventoryTable)
        .insert({
          product_id: productId,
          name: selectedProduct.name,
          supplier_id: supplierId,
          manufacturer_id: isManufacturerRequired ? manufacturerId : null,
          document_number: documentNumber,
          quantity: quantityToSave,
          gross_quantity: grossQuantity,
          net_quantity: isEtichete ? grossQuantity : netQuantity,
          crate_type_id: validCrateTypeId,
          crate_count: validCrateTypeId ? crateCount : 0,
          crate_weight: totalCrateWeight + (!isEtichete ? palletWeight : 0),
          unit: unitToSave,
          pallet_type_id: palletTypeId || null,
          pallet_count: palletCount || 0,
          receipt_date: new Date().toISOString()
        } as any);

      if (error) throw error;

      toast({
        title: "Recepție înregistrată",
        description: `Cantitate stocată: ${quantityToSave.toFixed(isEtichete ? 0 : 2)} ${unitToSave}`
      });

      await emitNotification("reception.completed", "Recepție finalizată", {
        body: `${zoneLabel}: ${selectedProduct.name} — ${quantityToSave.toFixed(isEtichete ? 0 : 2)} ${unitToSave}${selectedSupplier ? `, furnizor ${selectedSupplier.name}` : ""}`,
        link: "/calitate",
        payload: {
          inventoryType,
          product_id: productId,
          product_name: selectedProduct.name,
          supplier_id: supplierId,
          supplier_name: selectedSupplier?.name ?? null,
          manufacturer_id: manufacturerId,
          manufacturer_name: selectedManufacturer?.name ?? null,
          document_number: documentNumber,
          quantity: quantityToSave,
          unit: unitToSave,
        },
      });

      setShowConfirm(false);
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
      setPalletTypeId(null);
      setPalletCount(0);
    } catch (error: unknown) {
      toast({
        title: "Eroare",
        description: error instanceof Error ? error.message : "A apărut o eroare la salvare.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
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
          <DialogTitle>
            {isEtichete ? 'Înregistrare recepție etichete' : 'Înregistrare recepție nouă (cantitate netă)'}
          </DialogTitle>
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

          {/* Secțiune simplificată pentru Etichete - doar cantitate în bucăți */}
          {isEtichete ? (
            <div className="p-4 border rounded-lg bg-muted/50 space-y-4">
              <h3 className="font-semibold text-lg">Cantitate etichete</h3>
              <p className="text-sm text-muted-foreground">
                Introduceți cantitatea de etichete în bucăți.
              </p>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Cantitate (buc)</label>
                <Input
                  type="number"
                  step="1"
                  value={grossQuantity || ''}
                  onChange={(e) => setGrossQuantity(parseInt(e.target.value) || 0)}
                  placeholder="Numărul de etichete"
                />
              </div>

              <div className="mt-4 p-4 bg-background rounded-md border-2 border-primary/30">
                <div className="text-lg font-bold text-primary">
                  Cantitate: {grossQuantity} buc
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Aceasta este cantitatea care va fi stocată în sistem
                </div>
              </div>
            </div>
          ) : (
            /* Secțiune calcul cantitate netă pentru Materii Prime și Ambalaje */
            <div className="p-4 border rounded-lg bg-muted/50 space-y-4">
              <h3 className="font-semibold text-lg">Calcul cantitate netă</h3>
              <p className="text-sm text-muted-foreground">
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

              <div className="mt-4 p-4 bg-background rounded-md border-2 border-primary/30">
                <div className="text-lg font-bold text-primary">
                  Cantitate netă: {netQuantity.toFixed(2)} {selectedProduct?.default_unit || 'kg'}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Aceasta este cantitatea care va fi stocată în sistem
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-4">
            <Button 
              onClick={handleSubmit} 
              disabled={!productId || !supplierId || (inventoryType === 'materii-prime' && !manufacturerId) || !documentNumber || (isEtichete ? grossQuantity <= 0 : netQuantity <= 0)}
            >
              <Save className="h-4 w-4 mr-2" />
              {isEtichete ? 'Salvează recepția' : 'Salvează recepția (cantitate netă)'}
            </Button>
          </div>
        </div>
      </DialogContent>

      <ConfirmationDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        onConfirm={executeSave}
        isSubmitting={isSubmitting}
        title="CONFIRMĂ RECEPȚIA"
        description="Verifică cu atenție datele de mai jos. Această recepție va modifica stocul scriptic."
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-muted/40 border p-5 space-y-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Produs</div>
              <div className="text-2xl font-bold mt-1">{selectedProduct?.name || '—'}</div>
            </div>

            <div className="border-t pt-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Cantitate de adăugat în stoc</div>
              <div className="text-4xl font-extrabold text-primary mt-1">
                {quantityToSave.toFixed(isEtichete ? 0 : 2)}{' '}
                <span className="text-2xl font-bold">{unitToSave}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Furnizor</div>
                <div className="text-base font-semibold mt-1">{selectedSupplier?.name || '—'}</div>
              </div>
              {isManufacturerRequired && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Producător</div>
                  <div className="text-base font-semibold mt-1">{selectedManufacturer?.name || '—'}</div>
                </div>
              )}
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Document</div>
                <div className="text-base font-semibold mt-1">{documentNumber || '—'}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Zonă</div>
                <div className="mt-1">
                  <Badge variant="secondary" className="text-sm">{zoneLabel}</Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ConfirmationDialog>
    </Dialog>
  );
}