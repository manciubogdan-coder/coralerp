
import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SimpleInventoryTable from "@/components/SimpleInventoryTable";
import { useInventoryData } from "@/hooks/use-inventory-data";

const InventoryPage = () => {
  const navigate = useNavigate();
  const { inventory, loading } = useInventoryData();

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <main className="flex-1 container mx-auto px-2 sm:px-4 py-2 sm:py-6">
        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/dashboard")}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Înapoi la Panou
            </Button>
            <h1 className="text-xl sm:text-2xl font-bold">Stoc Produse</h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="flex items-center gap-2"
          >
            <Printer className="h-4 w-4" />
            Printează
          </Button>
        </div>
        
        <div className="bg-white rounded-lg shadow-md">
          {loading ? (
            <div className="p-4 sm:p-8 text-center text-gray-500">Se încarcă datele...</div>
          ) : (
            <SimpleInventoryTable inventory={inventory} />
          )}
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default InventoryPage;
