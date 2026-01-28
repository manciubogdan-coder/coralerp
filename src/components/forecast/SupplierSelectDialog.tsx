import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FileSpreadsheet, Truck } from "lucide-react";

interface Supplier {
  id: string;
  name: string;
}

interface SupplierSelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suppliers: Supplier[];
  onConfirm: (supplierId: string, supplierName: string) => void;
  productCount: number;
}

const SupplierSelectDialog: React.FC<SupplierSelectDialogProps> = ({
  open,
  onOpenChange,
  suppliers,
  onConfirm,
  productCount
}) => {
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");

  const handleConfirm = () => {
    if (!selectedSupplierId) return;
    
    const supplier = suppliers.find(s => s.id === selectedSupplierId);
    if (supplier) {
      onConfirm(supplier.id, supplier.name);
      setSelectedSupplierId("");
      onOpenChange(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedSupplierId("");
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            Selectează Furnizorul
          </DialogTitle>
          <DialogDescription>
            Pentru a genera comanda de achiziție, te rog să selectezi furnizorul 
            pentru cele {productCount} produse fără furnizor alocat.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="supplier">Furnizor</Label>
            <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
              <SelectTrigger id="supplier" className="w-full">
                <SelectValue placeholder="Alege un furnizor..." />
              </SelectTrigger>
              <SelectContent>
                {suppliers.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    Nu există furnizori înregistrați
                  </div>
                ) : (
                  suppliers.map(supplier => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Anulează
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedSupplierId}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Generează Comandă
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SupplierSelectDialog;
