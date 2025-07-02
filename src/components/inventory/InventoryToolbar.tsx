
import React from "react";
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
