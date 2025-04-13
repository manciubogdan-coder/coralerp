
import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import InventoryManagement from "@/components/dashboard/InventoryManagement";

const InventoryPage = () => {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <main className="flex-1 container mx-auto p-4 md:p-6">
        <div className="mb-6 flex items-center">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate("/dashboard")}
            className="mr-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Înapoi la panou
          </Button>
          <h1 className="text-2xl font-bold">Gestionare Inventar</h1>
        </div>
        
        <div className="bg-white rounded-lg shadow-md">
          <InventoryManagement />
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default InventoryPage;
