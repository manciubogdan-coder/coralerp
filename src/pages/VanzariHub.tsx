import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShoppingBag, Package, TrendingDown, ClipboardList, Truck, Users } from "lucide-react";

import ProductionStockManagement from "@/components/production/ProductionStockManagement";
import ConsumptionAnalytics from "@/components/productie/ConsumptionAnalytics";
import OrderOCR from "@/components/productie/OrderOCR";
import MarfaRestocataView from "@/components/productie/MarfaRestocataView";
import OcrOrdersByClient from "@/components/productie/OcrOrdersByClient";

const TABS = [
  { key: "stoc-marfa", label: "Stoc Marfă Început Zi", icon: Package },
  { key: "consumuri", label: "Analiză Consumuri", icon: TrendingDown },
  { key: "necesar-mp", label: "Necesar Materie Primă", icon: ClipboardList },
  { key: "restocari", label: "Restocări Marfă", icon: Truck },
  { key: "comenzi-client", label: "Comenzi pe Client", icon: Users },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const VanzariHub: React.FC = () => {
  const [tab, setTab] = useState<TabKey>("stoc-marfa");

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10 text-primary">
          <ShoppingBag className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Vânzări</h1>
          <p className="text-sm text-muted-foreground">
            Stoc marfă, consumuri, necesar materie primă, restocări și comenzi pe client.
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 mb-4 h-auto">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <TabsTrigger key={t.key} value={t.key} className="gap-2 py-2">
                <Icon className="h-4 w-4" />
                <span className="hidden md:inline">{t.label}</span>
                <span className="md:hidden text-xs">{t.label.split(" ")[0]}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="stoc-marfa">
          <Card>
            <CardContent className="p-4">
              <ProductionStockManagement />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="consumuri">
          <Card>
            <CardContent className="p-4">
              <ConsumptionAnalytics />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="necesar-mp">
          <Card>
            <CardContent className="p-4">
              <OrderOCR />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="restocari">
          <Card>
            <CardContent className="p-4">
              <MarfaRestocataView />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comenzi-client">
          <Card>
            <CardContent className="p-4">
              <OcrOrdersByClient />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default VanzariHub;
