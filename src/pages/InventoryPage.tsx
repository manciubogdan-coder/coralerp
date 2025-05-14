
import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SimpleInventoryTable from "@/components/SimpleInventoryTable";
import { useInventoryData } from "@/hooks/use-inventory-data";

const InventoryPage = () => {
  const navigate = useNavigate();
  const { inventory, loading } = useInventoryData();

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <main className="flex-1 container mx-auto px-2 sm:px-4 py-2 sm:py-6">
        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h1 className="text-xl sm:text-2xl font-bold">Stoc Produse</h1>
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
