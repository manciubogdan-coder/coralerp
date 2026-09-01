import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LotQRLabel, type LotLabelData } from "./LotQRLabel";
import type { InventoryType } from "@/context/inventory-type";
import { fetchGgnCode } from "@/lib/ggnCodes";

interface LotQRDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inventoryId: string | null;
  inventoryType: InventoryType;
}

const tableFor = (t: InventoryType) =>
  t === "ambalaje" ? "ambalaje_inventory" : t === "etichete" ? "etichete_inventory" : "inventory";

export const LotQRDialog: React.FC<LotQRDialogProps> = ({
  open,
  onOpenChange,
  inventoryId,
  inventoryType,
}) => {
  const [data, setData] = useState<LotLabelData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !inventoryId) return;
    setLoading(true);
    (async () => {
      const { data: row, error } = await (supabase as any)
        .from(tableFor(inventoryType))
        .select(`
          id, name, quantity, unit, lot_number, receipt_date, entry_number, document_number,
          suppliers:supplier_id(name),
          manufacturers:manufacturer_id(name)
        `)
        .eq("id", inventoryId)
        .maybeSingle();
      if (!error && row) {
        const supplierName = row.suppliers?.name || null;
        const manufacturerName = row.manufacturers?.name || null;
        const ggn =
          (await fetchGgnCode("supplier", inventoryType, supplierName)) ||
          (await fetchGgnCode("manufacturer", inventoryType, manufacturerName));
        setData({
          id: row.id,
          name: row.name,
          quantity: Number(row.quantity || 0),
          unit: row.unit || "",
          lot_number: row.lot_number,
          receipt_date: row.receipt_date,
          entry_number: row.entry_number,
          document_number: row.document_number,
          supplier: supplierName,
          manufacturer: manufacturerName,
          ggn_code: ggn,
          inventory_type: inventoryType,
        });
      }
      setLoading(false);
    })();
  }, [open, inventoryId, inventoryType]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md print:max-w-none print:shadow-none print:border-0 print:p-0">
        <DialogHeader className="print:hidden">
          <DialogTitle>Etichetă QR lot</DialogTitle>
        </DialogHeader>
        <div className="flex justify-center py-4 print:py-0">
          {loading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Se încarcă…
            </div>
          )}
          {!loading && data && <LotQRLabel data={data} />}
          {!loading && !data && (
            <div className="text-sm text-muted-foreground">Lotul nu a putut fi încărcat.</div>
          )}
        </div>
        <p className="text-xs text-muted-foreground text-center print:hidden">
          Scanează QR-ul pentru a deschide detaliile lotului și a face bon de transfer sau returnare.
        </p>
        <DialogFooter className="print:hidden">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Închide</Button>
          <Button onClick={handlePrint} disabled={!data}>
            <Printer className="h-4 w-4 mr-2" />
            Printează
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LotQRDialog;
