import React, { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Boxes, Tag, TrendingUp, Warehouse } from "lucide-react";
import InventoryManagement from "@/components/dashboard/InventoryManagement";
import ForecastView from "@/components/forecast/ForecastView";
import StockSufficiency from "@/components/forecast/StockSufficiency";
import { useInventoryType, type InventoryType } from "@/context/inventory-type";

type WarehouseTab = "materii-prime" | "ambalaje" | "etichete";

const WAREHOUSES: { id: WarehouseTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "materii-prime", label: "Materii Prime", icon: Package },
  { id: "ambalaje", label: "Ambalaje", icon: Boxes },
  { id: "etichete", label: "Etichete", icon: Tag },
];

/**
 * Sincronizează tipul de inventar din context cu tabul activ,
 * astfel încât componentele copil (InventoryManagement, ForecastView etc.)
 * să citească datele din tabelele corecte.
 */
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

const AchizitiiHub: React.FC = () => {
  const [section, setSection] = useState<"stoc" | "forecast" | "zile">("stoc");
  const [warehouse, setWarehouse] = useState<WarehouseTab>("materii-prime");

  return (
    <div className="container mx-auto py-4 md:py-6 space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Warehouse className="h-6 w-6 text-primary" />
          Hub Achiziții
        </h1>
        <p className="text-muted-foreground">
          Vizualizare rapidă a stocurilor și a forecastului pe toate cele trei depozite.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Selectează depozitul</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={warehouse} onValueChange={(v) => setWarehouse(v as WarehouseTab)} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              {WAREHOUSES.map((w) => {
                const Icon = w.icon;
                return (
                  <TabsTrigger key={w.id} value={w.id} className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span>{w.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      <Tabs value={section} onValueChange={(v) => setSection(v as typeof section)} className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-xl">
          <TabsTrigger value="stoc" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Stoc
          </TabsTrigger>
          <TabsTrigger value="forecast" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Forecast
          </TabsTrigger>
          <TabsTrigger value="zile" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Zile Stoc
          </TabsTrigger>
        </TabsList>

        <div className="mt-4 bg-white rounded-lg shadow-sm border p-3 md:p-4">
          <InventoryTypeSync type={warehouse}>
            <TabsContent value="stoc" className="mt-0">
              <InventoryManagement />
            </TabsContent>
            <TabsContent value="forecast" className="mt-0">
              <ForecastView inventoryType={warehouse} />
            </TabsContent>
            <TabsContent value="zile" className="mt-0">
              <StockSufficiency inventoryType={warehouse} />
            </TabsContent>
          </InventoryTypeSync>
        </div>
      </Tabs>
    </div>
  );
};

export default AchizitiiHub;
