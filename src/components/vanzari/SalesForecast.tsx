import React, { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Boxes, Tag } from "lucide-react";
import ForecastView from "@/components/forecast/ForecastView";
import ClientOrdersForecast from "@/components/forecast/ClientOrdersForecast";
import StockSufficiency from "@/components/forecast/StockSufficiency";
import OrderManagement from "@/components/forecast/OrderManagement";
import OrderHistory from "@/components/forecast/OrderHistory";
import ProductOrderSettings from "@/components/forecast/ProductOrderSettings";
import { useInventoryType, type InventoryType } from "@/context/inventory-type";

type W = "materii-prime" | "ambalaje" | "etichete";
const WAREHOUSES = [
  { id: "materii-prime" as W, label: "Materii Prime", icon: Package },
  { id: "ambalaje" as W, label: "Ambalaje", icon: Boxes },
  { id: "etichete" as W, label: "Etichete", icon: Tag },
];

const Sync: React.FC<{ type: InventoryType; children: React.ReactNode }> = ({ type, children }) => {
  const { inventoryType, setInventoryType } = useInventoryType();
  useEffect(() => { if (inventoryType !== type) setInventoryType(type); }, [type, inventoryType, setInventoryType]);
  if (inventoryType !== type) return null;
  return <>{children}</>;
};

const SalesForecast: React.FC = () => {
  const [w, setW] = useState<W>("materii-prime");
  const mp = w === "materii-prime";
  return (
    <div className="space-y-4">
      <Tabs value={w} onValueChange={(v) => setW(v as W)}>
        <TabsList className="grid w-full grid-cols-3">
          {WAREHOUSES.map(({ id, label, icon: Icon }) => (
            <TabsTrigger key={id} value={id} className="gap-2 text-xs md:text-sm">
              <Icon className="h-4 w-4" /><span className="truncate">{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <Sync type={w}>
        <Tabs key={w} defaultValue={mp ? "forecast-orders" : "forecast"} className="w-full">
          <TabsList className={`flex w-full mb-4 gap-1 overflow-x-auto ${mp ? "md:grid md:grid-cols-6" : "md:grid md:grid-cols-5"}`}>
            {mp && <TabsTrigger value="forecast-orders" className="flex-shrink-0 text-xs md:text-sm">Forecast din comenzi client</TabsTrigger>}
            <TabsTrigger value="forecast" className="flex-shrink-0 text-xs md:text-sm">Forecast din transferuri</TabsTrigger>
            <TabsTrigger value="orders" className="flex-shrink-0 text-xs md:text-sm">Gestionare Comenzi</TabsTrigger>
            <TabsTrigger value="history" className="flex-shrink-0 text-xs md:text-sm">Istoric Comenzi</TabsTrigger>
            <TabsTrigger value="sufficiency" className="flex-shrink-0 text-xs md:text-sm">Zile Stoc</TabsTrigger>
            <TabsTrigger value="settings" className="flex-shrink-0 text-xs md:text-sm">Setări Produse</TabsTrigger>
          </TabsList>
          {mp && <TabsContent value="forecast-orders"><ClientOrdersForecast inventoryType={w} /></TabsContent>}
          <TabsContent value="forecast"><ForecastView inventoryType={w} /></TabsContent>
          <TabsContent value="orders"><OrderManagement inventoryType={w} /></TabsContent>
          <TabsContent value="history"><OrderHistory inventoryType={w} /></TabsContent>
          <TabsContent value="sufficiency"><StockSufficiency inventoryType={w} /></TabsContent>
          <TabsContent value="settings"><ProductOrderSettings inventoryType={w} /></TabsContent>
        </Tabs>
      </Sync>
    </div>
  );
};

export default SalesForecast;
