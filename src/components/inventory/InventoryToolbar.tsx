
import React from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Mail } from "lucide-react";
import StockTransferForm from "@/components/inventory/StockTransferForm";
import { ReceptionRegistration } from "@/components/inventory/ReceptionRegistration";
import { Product, Supplier, Manufacturer, CrateType } from "@/types";
import { exportToExcel } from "@/lib/excelExport";
import { sendEmail } from "@/lib/emailService";
import { toast } from "@/hooks/use-custom-toast";

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

  const handleSendEmail = async () => {
    try {
      const dataForEmail = inventory.map(item => ({
        ...item,
        receipt_date: item.receipt_date ? new Date(item.receipt_date).toLocaleDateString('ro-RO') : ''
      }));
      
      await sendEmail(dataForEmail);
      toast({
        title: "Email trimis",
        description: "Raportul a fost trimis pe email."
      });
    } catch (error) {
      console.error("Error sending email:", error);
      toast({
        variant: "destructive",
        title: "Eroare",
        description: "Nu s-a putut trimite emailul."
      });
    }
  };

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={handleExportExcel}>
        <FileDown className="h-4 w-4 mr-2" /> Export Excel
      </Button>
      <Button variant="outline" size="sm" onClick={handleSendEmail}>
        <Mail className="h-4 w-4 mr-2" /> Trimite Email
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
