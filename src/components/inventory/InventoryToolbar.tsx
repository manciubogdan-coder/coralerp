
import React, { useEffect, useState } from "react";
import { StockTransferForm } from "@/components/inventory/StockTransferForm";
import { ReceptionRegistration } from "@/components/inventory/ReceptionRegistration";
import { QRScannerDialog } from "@/components/inventory/QRScannerDialog";
import { Button } from "@/components/ui/button";
import { ScanLine } from "lucide-react";
import { Product, Supplier, Manufacturer, CrateType } from "@/types";

interface InventoryToolbarProps {
  onTransferComplete: () => void;
  products: Product[];
  suppliers: Supplier[];
  manufacturers: Manufacturer[];
  crateTypes: CrateType[];
}

export const InventoryToolbar = ({
  onTransferComplete,
  products,
  suppliers,
  manufacturers,
  crateTypes
}: InventoryToolbarProps) => {
  const [scanOpen, setScanOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || !e.altKey || e.shiftKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;

      const code = e.code;
      const key = e.key.toLowerCase();
      if (code === "KeyB" || key === "b") {
        e.preventDefault();
        e.stopPropagation();
        window.dispatchEvent(new Event("open-transfer-form"));
      } else if (code === "KeyN" || key === "n") {
        e.preventDefault();
        e.stopPropagation();
        window.dispatchEvent(new Event("open-reception-form"));
      } else if (code === "KeyS" || key === "s") {
        e.preventDefault();
        e.stopPropagation();
        setScanOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Also listen for a global event so other places (sidebar, mobile FAB) can open the scanner
  useEffect(() => {
    const h = () => setScanOpen(true);
    window.addEventListener("open-qr-scanner", h);
    return () => window.removeEventListener("open-qr-scanner", h);
  }, []);

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => setScanOpen(true)}>
        <ScanLine className="h-4 w-4 mr-2" />
        Scanează QR
      </Button>
      <StockTransferForm onTransferComplete={onTransferComplete} />
      <ReceptionRegistration
        products={products}
        suppliers={suppliers}
        manufacturers={manufacturers}
        crateTypes={crateTypes}
        onRegistrationComplete={onTransferComplete}
      />
      <QRScannerDialog open={scanOpen} onOpenChange={setScanOpen} />
    </div>
  );
};
