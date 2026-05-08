import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-custom-toast";
import { Plus, Save, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Product, Supplier, Manufacturer } from "@/types";
import { useInventoryType } from "@/context/inventory-type";
import { ConfirmationDialog } from "./ConfirmationDialog";
import { Badge } from "@/components/ui/badge";
import { emitNotification } from "@/lib/notifications";
import {
  type BreakdownEntry,
  encodePalDoc,
  emptyBreakdown,
  summarizeBreakdown,
  totalBreakdown,
} from "@/lib/receptionBreakdown";

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
  const [palletWeight, setPalletWeight] = useState<number>(0);

  // Breakdown multi-tip pentru lăzi recepționate (înlocuiește single crateTypeId/crateCount)
  const [crateRows, setCrateRows] = useState<BreakdownEntry[]>([
    { id: null, name: "", count: 0 },
  ]);

  // Breakdown multi-tip pentru paleți recepționați (înlocuiește single palletTypeId/palletCount)
  const [palletRows, setPalletRows] = useState<BreakdownEntry[]>([
    { id: null, name: "", count: 0 },
  ]);

  // Cantitatea netă calculată - aceasta se salvează
  const [netQuantity, setNetQuantity] = useState<number>(0);

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

  // Recalculez cantitatea netă pe baza tuturor tipurilor de lăzi alese
  React.useEffect(() => {
    const totalCrateWeight = crateRows.reduce((sum, row) => {
      if (!row.id) return sum;
      const ct = crateTypes.find((c) => c.id === row.id);
      if (!ct) return sum;
      return sum + ct.weight * (Number(row.count) || 0);
    }, 0);
    const calculatedNet = Math.max(0, grossQuantity - totalCrateWeight - palletWeight);
    setNetQuantity(calculatedNet);
  }, [crateRows, crateTypes, grossQuantity, palletWeight]);

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

  const cleanCrateRows = (): BreakdownEntry[] =>
    crateRows
      .filter((r) => r.id && (Number(r.count) || 0) > 0)
      .map((r) => {
        const ct = crateTypes.find((c) => c.id === r.id);
        return { id: r.id, name: ct?.name || r.name || "", count: Number(r.count) || 0 };
      });

  const cleanPalletRows = (): BreakdownEntry[] =>
    palletRows
      .filter((r) => r.id && (Number(r.count) || 0) > 0)
      .map((r) => {
        const pt = palletTypes.find((p) => p.id === r.id);
        return { id: r.id, name: pt?.name || r.name || "", count: Number(r.count) || 0 };
      });

  const totalPalletCount = totalBreakdown(palletRows);
  const totalCrateCount = totalBreakdown(crateRows);

  const executeSave = async () => {
    try {
      setIsSubmitting(true);
      if (!productId || !selectedProduct) return;

      const inventoryTable = inventoryType === 'ambalaje'
        ? 'ambalaje_inventory'
        : inventoryType === 'etichete'
          ? 'etichete_inventory'
          : 'inventory';

      const cleanedCrates = cleanCrateRows();
      const cleanedPallets = cleanPalletRows();

      // Tip "dominant" pentru compatibilitate cu coloanele single-FK
      const dominantCrateId = !isEtichete && cleanedCrates[0]?.id ? cleanedCrates[0].id : null;
      const dominantPalletId = cleanedPallets[0]?.id || null;
      const totalCrateWeight = !isEtichete
        ? cleanedCrates.reduce((sum, r) => {
            const ct = crateTypes.find((c) => c.id === r.id);
            return sum + (ct ? ct.weight * r.count : 0);
          }, 0)
        : 0;

      console.log('Salvez recepție:', {
        productName: selectedProduct.name,
        grossQuantity,
        quantityToSave,
        isEtichete,
        crates: cleanedCrates,
        pallets: cleanedPallets,
      });

      const { data: insertedInv, error } = await (supabase as any)
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
          crate_type_id: dominantCrateId,
          crate_count: dominantCrateId ? totalCrateCount : 0,
          crate_weight: totalCrateWeight + (!isEtichete ? palletWeight : 0),
          unit: unitToSave,
          pallet_type_id: dominantPalletId,
          pallet_count: totalPalletCount || 0,
          receipt_date: new Date().toISOString()
        } as any);

      if (error) throw error;

      // Asigură-te că pallet_type_id și pallet_count ajung și în reception_records
      // și salvăm breakdown-ul multi-tip pentru raportul de Calitate.
      let latestRecordId: string | null = null;
      try {
        const receptionTable = inventoryType === 'ambalaje'
          ? 'ambalaje_reception_records'
          : inventoryType === 'etichete'
            ? 'etichete_reception_records'
            : 'reception_records';
        const { data: latest } = await (supabase as any)
          .from(receptionTable)
          .select('id')
          .eq('product_id', productId)
          .eq('document_number', documentNumber)
          .order('receipt_date', { ascending: false })
          .limit(1);
        latestRecordId = (latest as any[])?.[0]?.id || null;
        if (latestRecordId) {
          await (supabase as any)
            .from(receptionTable)
            .update({
              pallet_type_id: dominantPalletId,
              pallet_count: totalPalletCount || 0,
            })
            .eq('id', latestRecordId);
        }
      } catch (e) {
        console.warn('Nu am putut sincroniza paleții în reception_records:', e);
      }

      // Salvează breakdown-ul recepției în reception_report_data (doc rămâne gol)
      if (latestRecordId && (cleanedPallets.length > 0 || cleanedCrates.length > 0)) {
        try {
          const encoded = encodePalDoc({
            ...emptyBreakdown(),
            rec_pallets: cleanedPallets,
            rec_crates: cleanedCrates,
          });
          await (supabase as any)
            .from('reception_report_data')
            .upsert([{
              inventory_id: latestRecordId,
              inventory_type: inventoryType,
              paleti_lazi_document: encoded || null,
              cantitate_receptionata: quantityToSave,
              tip_palet: cleanedPallets[0]?.name || null,
              tip_lada_culoare: cleanedCrates[0]?.name || null,
              nr_lazi: totalCrateCount || null,
            }], { onConflict: 'inventory_id' });
        } catch (e) {
          console.warn('Nu am putut salva breakdown-ul în reception_report_data:', e);
        }
      }

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
      setPalletWeight(0);
      setNetQuantity(0);
      setCrateRows([{ id: null, name: "", count: 0 }]);
      setPalletRows([{ id: null, name: "", count: 0 }]);
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

              </div>

              {/* Lădițe multi-tip */}
              <div className="space-y-3 mt-4 border-t pt-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Lădițe (multiple tipuri)</label>
                  <Button type="button" size="sm" variant="outline"
                    onClick={() => setCrateRows((rows) => [...rows, { id: null, name: "", count: 0 }])}>
                    <Plus className="h-3 w-3 mr-1" /> Adaugă tip
                  </Button>
                </div>
                {crateRows.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr,110px,40px] gap-2 items-center">
                    <Select
                      value={row.id || ''}
                      onValueChange={(v) => setCrateRows((rows) => rows.map((r, i) => i === idx
                        ? { ...r, id: v || null, name: crateTypes.find((c) => c.id === v)?.name || "" }
                        : r))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selectează tipul de lădiță" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px] overflow-y-auto">
                        {crateTypes.map((crateType) => (
                          <SelectItem key={crateType.id} value={crateType.id}>
                            {crateType.name} ({crateType.weight} kg)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={row.count || ''}
                      onChange={(e) => setCrateRows((rows) => rows.map((r, i) => i === idx
                        ? { ...r, count: parseInt(e.target.value) || 0 }
                        : r))}
                      placeholder="Nr. lăzi"
                      disabled={!row.id}
                    />
                    <Button type="button" size="sm" variant="ghost"
                      className="h-9 w-9 p-0"
                      disabled={crateRows.length <= 1}
                      onClick={() => setCrateRows((rows) => rows.filter((_, i) => i !== idx))}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  Total lăzi: <strong>{totalCrateCount}</strong>
                  {crateRows.some((r) => r.id && r.count > 0) && (
                    <> · {summarizeBreakdown(crateRows.filter((r) => r.id && r.count > 0).map((r) => ({ ...r, name: crateTypes.find((c) => c.id === r.id)?.name || "" })))}</>
                  )}
                </p>
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

          {/* Paleți recepționați - multi-tip */}
          <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Paleți recepționați</h3>
              <Button type="button" size="sm" variant="outline"
                onClick={() => setPalletRows((rows) => [...rows, { id: null, name: "", count: 0 }])}>
                <Plus className="h-3 w-3 mr-1" /> Adaugă tip
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Poți adăuga mai multe tipuri de paleți pentru același articol. Apar în raportul de Calitate.
            </p>
            {palletRows.map((row, idx) => (
              <div key={idx} className="grid grid-cols-[1fr,110px,40px] gap-2 items-center">
                <Select
                  value={row.id || ''}
                  onValueChange={(v) => setPalletRows((rows) => rows.map((r, i) => i === idx
                    ? { ...r, id: v || null, name: palletTypes.find((p) => p.id === v)?.name || "" }
                    : r))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selectează tipul de palet" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] overflow-y-auto">
                    {palletTypes.length === 0 && (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">
                        Nu există tipuri. Adaugă în Nomenclatoare → Tip paleți.
                      </div>
                    )}
                    {palletTypes.map((pt) => (
                      <SelectItem key={pt.id} value={pt.id}>{pt.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={row.count || ''}
                  onChange={(e) => setPalletRows((rows) => rows.map((r, i) => i === idx
                    ? { ...r, count: parseInt(e.target.value) || 0 }
                    : r))}
                  placeholder="ex: 2"
                  disabled={!row.id}
                />
                <Button type="button" size="sm" variant="ghost"
                  className="h-9 w-9 p-0"
                  disabled={palletRows.length <= 1}
                  onClick={() => setPalletRows((rows) => rows.filter((_, i) => i !== idx))}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Total paleți: <strong>{totalPalletCount}</strong>
              {palletRows.some((r) => r.id && r.count > 0) && (
                <> · {summarizeBreakdown(palletRows.filter((r) => r.id && r.count > 0).map((r) => ({ ...r, name: palletTypes.find((p) => p.id === r.id)?.name || "" })))}</>
              )}
            </p>
          </div>

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