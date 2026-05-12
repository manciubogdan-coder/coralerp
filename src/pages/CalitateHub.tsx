import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck, Package, Boxes, Tag } from "lucide-react";
import { ForceInventoryType, type InventoryType } from "@/context/inventory-type";
import { DailyStockGroupView } from "@/components/inventory/DailyStockGroupView";
import DailyStockQuality from "@/components/inventory/DailyStockQuality";
import { DailyLotConsumption } from "@/components/inventory/DailyLotConsumption";
import ReceptionReport from "@/components/inventory/ReceptionReport";
import MarfaRestocataView from "@/components/productie/MarfaRestocataView";
import BackToHubButton from "@/components/BackToHubButton";

type DepotKey = "materii-prime" | "ambalaje" | "etichete";

const DEPOTS: { key: DepotKey; label: string; type: InventoryType; icon: typeof Package }[] = [
  { key: "materii-prime", label: "Materii Prime", type: "materii-prime", icon: Package },
  { key: "ambalaje", label: "Ambalaje", type: "ambalaje", icon: Boxes },
  { key: "etichete", label: "Etichete", type: "etichete", icon: Tag },
];

const SUB_TABS = [
  { key: "stoc-inceput", label: "Stoc Început Zi" },
  { key: "stoc-calitate", label: "Stoc Zilnic Calitate" },
  { key: "consum-loturi", label: "Consum pe Loturi" },
  { key: "receptie", label: "Recepție" },
  { key: "restocari", label: "Restocări" },
] as const;

type SubTabKey = (typeof SUB_TABS)[number]["key"];

const DepotPanel: React.FC<{ type: InventoryType }> = ({ type }) => {
  const storageKey = `calitate.subtab.${type}`;
  const [sub, setSub] = useState<SubTabKey>(() => {
    if (typeof window === "undefined") return "stoc-inceput";
    const v = localStorage.getItem(storageKey) as SubTabKey | null;
    return v && SUB_TABS.some((t) => t.key === v) ? v : "stoc-inceput";
  });
  React.useEffect(() => { localStorage.setItem(storageKey, sub); }, [sub, storageKey]);
  // ForceInventoryType garantează că toate componentele copil citesc tipul corect
  return (
    <ForceInventoryType type={type}>
      <Tabs value={sub} onValueChange={(v) => setSub(v as SubTabKey)} className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 mb-4 h-auto gap-1 p-1">
          {SUB_TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key} className="text-xs sm:text-sm whitespace-normal h-auto py-2">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="stoc-inceput">
          <Card>
            <CardContent className="p-4 print:p-0">
              <DailyStockGroupView />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stoc-calitate">
          <Card>
            <CardContent className="p-4">
              <DailyStockQuality />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="consum-loturi">
          <Card>
            <CardContent className="p-4">
              <DailyLotConsumption />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="receptie">
          <Card>
            <CardContent className="p-4">
              <ReceptionReport />
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
      </Tabs>
    </ForceInventoryType>
  );
};

const CalitateHub: React.FC = () => {
  const [depot, setDepot] = useState<DepotKey>(() => {
    if (typeof window === "undefined") return "materii-prime";
    const v = localStorage.getItem("calitate.depot") as DepotKey | null;
    return v && DEPOTS.some((d) => d.key === v) ? v : "materii-prime";
  });
  React.useEffect(() => { localStorage.setItem("calitate.depot", depot); }, [depot]);

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Calitate</h1>
            <p className="text-sm text-muted-foreground">
              Stocuri, calitate, consum pe loturi și recepții — pe fiecare depozit.
            </p>
          </div>
        </div>
        <BackToHubButton />
      </div>

      <Tabs value={depot} onValueChange={(v) => setDepot(v as DepotKey)} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          {DEPOTS.map((d) => {
            const Icon = d.icon;
            return (
              <TabsTrigger key={d.key} value={d.key} className="gap-2">
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{d.label}</span>
                <span className="sm:hidden">{d.label.split(" ")[0]}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {DEPOTS.map((d) => (
          <TabsContent key={d.key} value={d.key}>
            {/* Render-uim doar dacă e activ pentru a evita request-uri inutile */}
            {depot === d.key && <DepotPanel type={d.type} />}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default CalitateHub;
