import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductionStockManagement from "@/components/production/ProductionStockManagement";

const ProductionStockPage = () => {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1 container mx-auto p-2 md:p-6">
        <div className="mb-4 md:mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-0">
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate("/dashboard")}
              className="w-full md:w-auto justify-center md:justify-start"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Înapoi la panou
            </Button>
            <h1 className="text-xl md:text-2xl font-bold">Stoc Producție</h1>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <ProductionStockManagement />
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default ProductionStockPage;
