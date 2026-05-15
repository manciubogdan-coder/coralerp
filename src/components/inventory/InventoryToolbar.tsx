
import React, { useEffect } from "react";
import { StockTransferForm } from "@/components/inventory/StockTransferForm";
import { ReceptionRegistration } from "@/components/inventory/ReceptionRegistration";
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
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || !e.altKey || e.shiftKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;

      const key = e.key.toLowerCase();
      if (key === "b") {
        e.preventDefault();
        window.dispatchEvent(new Event("open-transfer-form"));
      } else if (key === "r") {
        e.preventDefault();
        window.dispatchEvent(new Event("open-reception-form"));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="flex flex-wrap gap-2">
      <StockTransferForm onTransferComplete={onTransferComplete} />
      <ReceptionRegistration
        products={products}
        suppliers={suppliers}
        manufacturers={manufacturers}
        crateTypes={crateTypes}
        onRegistrationComplete={onTransferComplete}
      />
    </div>
  );
};
