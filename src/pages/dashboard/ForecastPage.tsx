import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useInventoryType } from "@/context/inventory-type";
import ProductOrderSettings from "@/components/forecast/ProductOrderSettings";
import ForecastView from "@/components/forecast/ForecastView";
import ClientOrdersForecast from "@/components/forecast/ClientOrdersForecast";
import StockSufficiency from "@/components/forecast/StockSufficiency";
import OrderManagement from "@/components/forecast/OrderManagement";
import OrderHistory from "@/components/forecast/OrderHistory";

const ForecastPage = () => {
  const navigate = useNavigate();
  const { inventoryType } = useInventoryType();

  const getTitle = () => {
    switch (inventoryType) {
      case "materii-prime": return "Planificare & Forecast - Materii Prime";
      case "ambalaje": return "Planificare & Forecast - Ambalaje";
      case "etichete": return "Planificare & Forecast - Etichete";
      default: return "Planificare & Forecast";
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <main className="flex-1 container mx-auto p-2 md:p-6">
        <div className="mb-4 md:mb-6 flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate("/")}
            className="w-full md:w-auto justify-center md:justify-start"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Înapoi la panou
          </Button>
          <h1 className="text-xl md:text-2xl font-bold">{getTitle()}</h1>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-4">
        <Tabs
          key={inventoryType}
          defaultValue={inventoryType === "materii-prime" ? "forecast-orders" : "forecast"}
          className="w-full"
        >
            <TabsList className={`grid w-full mb-4 ${inventoryType === "materii-prime" ? "grid-cols-6" : "grid-cols-5"}`}>
              {inventoryType === "materii-prime" && (
                <TabsTrigger value="forecast-orders">Forecast din comenzi client</TabsTrigger>
              )}
              <TabsTrigger value="forecast">Forecast din transferuri</TabsTrigger>
              <TabsTrigger value="orders">Gestionare Comenzi</TabsTrigger>
              <TabsTrigger value="history">Istoric Comenzi</TabsTrigger>
              <TabsTrigger value="sufficiency">Zile Stoc</TabsTrigger>
              <TabsTrigger value="settings">Setări Produse</TabsTrigger>
            </TabsList>
            
            <TabsContent value="orders">
              <OrderManagement inventoryType={inventoryType} />
            </TabsContent>

            <TabsContent value="history">
              <OrderHistory inventoryType={inventoryType} />
            </TabsContent>
            
            <TabsContent value="forecast">
              <ForecastView inventoryType={inventoryType} />
            </TabsContent>
            
            {inventoryType === "materii-prime" && (
              <TabsContent value="forecast-orders">
                <ClientOrdersForecast inventoryType={inventoryType} />
              </TabsContent>
            )}


            <TabsContent value="sufficiency">
              <StockSufficiency inventoryType={inventoryType} />
            </TabsContent>
            
            <TabsContent value="settings">
              <ProductOrderSettings inventoryType={inventoryType} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default ForecastPage;
