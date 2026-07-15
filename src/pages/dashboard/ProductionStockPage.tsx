import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import ProductionStockManagement from "@/components/production/ProductionStockManagement";

// Componente migrate din productiecoral-18
import ProductionDashboardReal from "@/components/productie/ProductionDashboardReal";
import OrderManagementReal from "@/components/productie/OrderManagementReal";
import AdvanceProductionManagement from "@/components/productie/AdvanceProductionManagement";
import ProductionForecast from "@/components/productie/ProductionForecast";
import ReportsOrders from "@/components/productie/ReportsOrders";
import OrderOCR from "@/components/productie/OrderOCR";
import OperatorInterface from "@/components/productie/OperatorInterface";
import LineManagement from "@/components/productie/LineManagement";
import RecipeManagement from "@/components/productie/RecipeManagement";
import ProductManagement from "@/components/productie/ProductManagement";
import IngredientManagement from "@/components/productie/IngredientManagement";
import ClientManagement from "@/components/productie/ClientManagement";
import DeliveryZoneManagement from "@/components/productie/DeliveryZoneManagement";
import LineDistribution from "@/components/productie/LineDistribution";
import ShiftManagement from "@/components/productie/ShiftManagement";
import StockManagement from "@/components/productie/StockManagement";
import ConsumptionAnalytics from "@/components/productie/ConsumptionAnalytics";
import MarfaRestocataView from "@/components/productie/MarfaRestocataView";
import Reports from "@/components/productie/Reports";
import SeniorErpImport from "@/components/productie/SeniorErpImport";

const ProductionStockPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedLine, setSelectedLine] = useState("");

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto p-2 md:p-4 pb-24">
        <div className="mb-4 flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Înapoi la panou
          </Button>
          <h1 className="text-xl md:text-2xl font-bold">Producție</h1>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex flex-wrap justify-start gap-1 h-auto p-2 mb-4 bg-muted">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="orders">Comenzi</TabsTrigger>
            <TabsTrigger value="advance">Prod. Avans</TabsTrigger>
            <TabsTrigger value="forecast">Forecast</TabsTrigger>
            <TabsTrigger value="ocr">OCR</TabsTrigger>
            <TabsTrigger value="operator">Operator</TabsTrigger>
            <TabsTrigger value="stoc-transferat">Stoc Transferat</TabsTrigger>
            <TabsTrigger value="stocks">Stocuri Producție</TabsTrigger>
            <TabsTrigger value="consumption">Consumuri</TabsTrigger>
            <TabsTrigger value="restocking">Restocări</TabsTrigger>
            <TabsTrigger value="reports">Rapoarte</TabsTrigger>
            <TabsTrigger value="erp">Import ERP</TabsTrigger>
            <TabsTrigger value="config">Configurări</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <ProductionDashboardReal />
          </TabsContent>

          <TabsContent value="orders">
            <OrderManagementReal />
          </TabsContent>

          <TabsContent value="advance">
            <AdvanceProductionManagement />
          </TabsContent>

          <TabsContent value="forecast">
            <Tabs defaultValue="capacity" className="w-full">
              <TabsList>
                <TabsTrigger value="capacity">Forecast Capacitate</TabsTrigger>
                <TabsTrigger value="orders">Rapoarte pe Comenzi</TabsTrigger>
              </TabsList>
              <TabsContent value="capacity" className="mt-4">
                <ProductionForecast />
              </TabsContent>
              <TabsContent value="orders" className="mt-4">
                <ReportsOrders />
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="ocr">
            <OrderOCR />
          </TabsContent>

          <TabsContent value="operator">
            <OperatorInterface
              selectedLine={selectedLine}
              onLineSelect={setSelectedLine}
            />
          </TabsContent>

          <TabsContent value="stoc-transferat">
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <ProductionStockManagement />
            </div>
          </TabsContent>

          <TabsContent value="stocks">
            <StockManagement />
          </TabsContent>

          <TabsContent value="consumption">
            <ConsumptionAnalytics />
          </TabsContent>

          <TabsContent value="restocking">
            <MarfaRestocataView />
          </TabsContent>

          <TabsContent value="reports">
            <Tabs defaultValue="prod" className="w-full">
              <TabsList>
                <TabsTrigger value="prod">Rapoarte Producție</TabsTrigger>
                <TabsTrigger value="shifts">Schimburi</TabsTrigger>
              </TabsList>
              <TabsContent value="prod" className="mt-4">
                <Reports />
              </TabsContent>
              <TabsContent value="shifts" className="mt-4">
                <ShiftManagement />
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="erp">
            <SeniorErpImport />
          </TabsContent>

          <TabsContent value="config">
            <Tabs defaultValue="lines" className="w-full">
              <TabsList className="flex flex-wrap gap-1 h-auto">
                <TabsTrigger value="lines">Linii</TabsTrigger>
                <TabsTrigger value="products">Produse</TabsTrigger>
                <TabsTrigger value="recipes">Rețete</TabsTrigger>
                <TabsTrigger value="ingredients">Ingrediente</TabsTrigger>
                <TabsTrigger value="clients">Clienți</TabsTrigger>
                <TabsTrigger value="zones">Zone Livrare</TabsTrigger>
                <TabsTrigger value="distribution">Distribuție</TabsTrigger>
              </TabsList>
              <TabsContent value="lines" className="mt-4">
                <LineManagement />
              </TabsContent>
              <TabsContent value="products" className="mt-4">
                <ProductManagement />
              </TabsContent>
              <TabsContent value="recipes" className="mt-4">
                <RecipeManagement />
              </TabsContent>
              <TabsContent value="ingredients" className="mt-4">
                <IngredientManagement />
              </TabsContent>
              <TabsContent value="clients" className="mt-4">
                <ClientManagement />
              </TabsContent>
              <TabsContent value="zones" className="mt-4">
                <DeliveryZoneManagement />
              </TabsContent>
              <TabsContent value="distribution" className="mt-4">
                <LineDistribution />
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default ProductionStockPage;
