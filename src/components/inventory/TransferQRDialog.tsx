import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { TransferQRLabel, type TransferLabelData } from "./TransferQRLabel";

interface TransferQRDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labels: TransferLabelData[];
}

export const TransferQRDialog: React.FC<TransferQRDialogProps> = ({ open, onOpenChange, labels }) => {
  const handlePrint = () => window.print();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md print:max-w-none print:shadow-none print:border-0 print:p-0">
        <DialogHeader className="print:hidden">
          <DialogTitle>Etichetă QR bon transfer</DialogTitle>
        </DialogHeader>
        <div className="flex justify-center py-4 print:py-0 max-h-[60vh] overflow-y-auto">
          {labels.length > 0 ? (
            <TransferQRLabel labels={labels} />
          ) : (
            <div className="text-sm text-muted-foreground">Nu există date.</div>
          )}
        </div>
        <p className="text-xs text-muted-foreground text-center print:hidden">
          {labels.length > 1
            ? `${labels.length} etichete — se vor printa pe pagini separate.`
            : "Scanează QR-ul pentru a deschide detaliile lotului."}
        </p>
        <DialogFooter className="print:hidden">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Închide</Button>
          <Button onClick={handlePrint} disabled={labels.length === 0}>
            <Printer className="h-4 w-4 mr-2" />
            Printează
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TransferQRDialog;
