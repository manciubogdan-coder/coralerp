import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipboardList, ShoppingBag, Package, TrendingDown, FileStack, Truck } from "lucide-react";

import { DailyStockGroupView } from "@/components/inventory/DailyStockGroupView";
import ConsumptionAnalytics from "@/components/productie/ConsumptionAnalytics";
import MarfaRestocataView from "@/components/productie/MarfaRestocataView";
import BackToHubButton from "@/components/BackToHubButton";
import PrereceptieView from "@/components/inventory/PrereceptieView";
import { ForceInventoryType } from "@/context/inventory-type";
import NecesarComenzi from "@/components/vanzari/NecesarComenzi";

const TABS = [
  { key: "necesar", label: "Comenzi & Necesar", icon: FileStack },
  { key: "stoc-marfa", label: "Stoc Marfă Început Zi", icon: Package },
  { key: "consumuri", label: "Analiză Consumuri", icon: TrendingDown },
  { key: "restocari", label: "Restocări Marfă", icon: Truck },
  { key: "prereceptie", label: "Prerecepție", icon: ClipboardList },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const VanzariHub: React.FC = () => {
  const [tab, setTab] = useState<TabKey>("stoc-marfa");

  return (
    <div className="container mx-auto px-2 md:px-6 py-3 md:py-6 space-y-3 md:space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <ShoppingBag className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Vânzări</h1>
            <p className="text-sm text-muted-foreground">
              Stoc marfă început zi, analiză consumuri și restocări.
            </p>
          </div>
        </div>
        <BackToHubButton />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="w-full">
        <TabsList className="grid w-full grid-cols-5 mb-4 h-auto">
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

        <TabsContent value="necesar">
          <Card><CardContent className="p-4"><NecesarComenzi /></CardContent></Card>
        </TabsContent>

        <TabsContent value="stoc-marfa">
          <Card>
            <CardContent className="p-4">
              <DailyStockGroupView />
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

        <TabsContent value="restocari">
          <Card>
            <CardContent className="p-4">
              <MarfaRestocataView />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prereceptie">
          <Card>
            <CardContent className="p-4">
              <ForceInventoryType type="materii-prime">
                <PrereceptieView />
              </ForceInventoryType>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
};

export default VanzariHub;
