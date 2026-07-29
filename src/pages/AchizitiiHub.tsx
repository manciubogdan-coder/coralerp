import React, { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Boxes, Tag, TrendingUp, Warehouse } from "lucide-react";
import InventoryManagement from "@/components/dashboard/InventoryManagement";
import ReceptionReport from "@/components/inventory/ReceptionReport";
import ForecastView from "@/components/forecast/ForecastView";
import StockSufficiency from "@/components/forecast/StockSufficiency";
import OrderManagement from "@/components/forecast/OrderManagement";
import OrderHistory from "@/components/forecast/OrderHistory";
import ConsumptionReport from "@/components/forecast/ConsumptionReport";
import ProductOrderSettings from "@/components/forecast/ProductOrderSettings";
import { useInventoryType, type InventoryType } from "@/context/inventory-type";
import BackToHubButton from "@/components/BackToHubButton";

type WarehouseTab = "materii-prime" | "ambalaje" | "etichete";

const WAREHOUSES: { id: WarehouseTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "materii-prime", label: "Materii Prime", icon: Package },
  { id: "ambalaje", label: "Ambalaje", icon: Boxes },
  { id: "etichete", label: "Etichete", icon: Tag },
];

const InventoryTypeSync: React.FC<{ type: InventoryType; children: React.ReactNode }> = ({ type, children }) => {
  const { inventoryType, setInventoryType } = useInventoryType();
  const [ready, setReady] = useState(inventoryType === type);

  useEffect(() => {
    if (inventoryType !== type) {
      setInventoryType(type);
      setReady(false);
    } else {
      setReady(true);
    }
  }, [type, inventoryType, setInventoryType]);

  if (!ready || inventoryType !== type) return null;
  return <>{children}</>;
};

const WarehouseSelector: React.FC<{
  value: WarehouseTab;
  onChange: (v: WarehouseTab) => void;
}> = ({ value, onChange }) => (
  <Tabs value={value} onValueChange={(v) => onChange(v as WarehouseTab)} className="w-full">
    <TabsList className="grid w-full grid-cols-3">
      {WAREHOUSES.map((w) => {
        const Icon = w.icon;
        return (
          <TabsTrigger key={w.id} value={w.id} className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
            <Icon className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{w.label}</span>
          </TabsTrigger>
        );
      })}
    </TabsList>
  </Tabs>
);

const AchizitiiHub: React.FC = () => {
  const [section, setSection] = useState<"stocuri" | "forecast">("stocuri");
  const [stocWarehouse, setStocWarehouse] = useState<WarehouseTab>("materii-prime");
  const [forecastWarehouse, setForecastWarehouse] = useState<WarehouseTab>("materii-prime");

  return (
    <div className="container mx-auto px-2 md:px-6 py-3 md:py-6 space-y-3 md:space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Warehouse className="h-6 w-6 text-primary" />
            Hub Achiziții
          </h1>
          <p className="text-muted-foreground">
            Stocuri și planificare aprovizionare pentru toate cele trei depozite.
          </p>
        </div>
        <BackToHubButton />
      </div>

      <Tabs value={section} onValueChange={(v) => setSection(v as typeof section)} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="stocuri" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Stocuri
          </TabsTrigger>
          <TabsTrigger value="forecast" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Forecast
          </TabsTrigger>
        </TabsList>

        {/* ========== STOCURI ========== */}
        <TabsContent value="stocuri" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Selectează depozitul</CardTitle>
            </CardHeader>
            <CardContent>
              <WarehouseSelector value={stocWarehouse} onChange={setStocWarehouse} />
            </CardContent>
          </Card>

          <InventoryTypeSync type={stocWarehouse}>
            <Tabs defaultValue="stoc" className="w-full">
              <TabsList className="grid w-full grid-cols-2 max-w-md mb-4">
                <TabsTrigger value="stoc">Stoc</TabsTrigger>
                <TabsTrigger value="receptie">Recepție</TabsTrigger>
              </TabsList>
              <TabsContent value="stoc">
                <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                  <InventoryManagement />
                </div>
              </TabsContent>
              <TabsContent value="receptie">
                <div className="bg-white rounded-lg shadow-sm border p-3 md:p-4">
                  <ReceptionReport />
                </div>
              </TabsContent>
            </Tabs>
          </InventoryTypeSync>
        </TabsContent>

        {/* ========== FORECAST ========== */}
        <TabsContent value="forecast" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Selectează depozitul pentru forecast</CardTitle>
            </CardHeader>
            <CardContent>
              <WarehouseSelector value={forecastWarehouse} onChange={setForecastWarehouse} />
            </CardContent>
          </Card>

          <div className="bg-white rounded-lg shadow-sm border p-3 md:p-4">
            <InventoryTypeSync type={forecastWarehouse}>
              <Tabs defaultValue="orders" className="w-full">
                <TabsList className="flex w-full md:grid md:grid-cols-7 mb-4 gap-1 overflow-x-auto">
                  <TabsTrigger value="orders" className="flex-shrink-0 text-xs md:text-sm">Gestionare Comenzi</TabsTrigger>
                  <TabsTrigger value="history" className="flex-shrink-0 text-xs md:text-sm">Istoric Comenzi</TabsTrigger>
                  <TabsTrigger value="consumption" className="flex-shrink-0 text-xs md:text-sm">Raport Consum</TabsTrigger>
                  <TabsTrigger value="forecast" className="flex-shrink-0 text-xs md:text-sm">Forecast din transferuri</TabsTrigger>
                  <TabsTrigger value="forecast-orders" className="flex-shrink-0 text-xs md:text-sm">Forecast din comenzi client</TabsTrigger>
                  <TabsTrigger value="sufficiency" className="flex-shrink-0 text-xs md:text-sm">Zile Stoc</TabsTrigger>
                  <TabsTrigger value="settings" className="flex-shrink-0 text-xs md:text-sm">Setări Produse</TabsTrigger>
                </TabsList>

                <TabsContent value="orders">
                  <OrderManagement inventoryType={forecastWarehouse} />
                </TabsContent>
                <TabsContent value="history">
                  <OrderHistory inventoryType={forecastWarehouse} />
                </TabsContent>
                <TabsContent value="consumption">
                  <ConsumptionReport inventoryType={forecastWarehouse} />
                </TabsContent>
                <TabsContent value="forecast">
                  <ForecastView inventoryType={forecastWarehouse} />
                </TabsContent>
                <TabsContent value="forecast-orders">
                  <ClientOrdersForecast inventoryType={forecastWarehouse} />
                </TabsContent>
                <TabsContent value="sufficiency">
                  <StockSufficiency inventoryType={forecastWarehouse} />
                </TabsContent>
                <TabsContent value="settings">
                  <ProductOrderSettings inventoryType={forecastWarehouse} />
                </TabsContent>
              </Tabs>

            </InventoryTypeSync>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AchizitiiHub;
