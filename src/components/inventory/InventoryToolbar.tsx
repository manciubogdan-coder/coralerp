
import React from "react";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import { StockTransferForm } from "@/components/inventory/StockTransferForm";
import { ReceptionRegistration } from "@/components/inventory/ReceptionRegistration";
import { Product, Supplier, Manufacturer, CrateType } from "@/types";
import { exportToExcel } from "@/lib/excelExport";
import { toast } from "@/hooks/use-custom-toast";
import { useIsMobile } from "@/hooks/use-mobile";

interface InventoryToolbarProps {
  inventory: any[];
  onTransferComplete: () => void;
  products: Product[];
  suppliers: Supplier[];
  manufacturers: Manufacturer[];
  crateTypes: CrateType[];
}

export const InventoryToolbar = ({
  inventory,
  onTransferComplete,
  products,
  suppliers,
  manufacturers,
  crateTypes
}: InventoryToolbarProps) => {
  const isMobile = useIsMobile();
  
  const handleExportExcel = () => {
    const dataForExport = inventory.map(item => ({
      ...item,
      receipt_date: item.receipt_date ? new Date(item.receipt_date).toLocaleDateString('ro-RO') : ''
    }));
    
    exportToExcel(dataForExport);
    toast({
      title: "Export realizat",
      description: "Fișierul Excel a fost generat și descărcat."
    });
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size={isMobile ? "default" : "sm"} onClick={handleExportExcel}>
        <FileDown className="h-4 w-4 mr-2" /> Export Excel
      </Button>
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
