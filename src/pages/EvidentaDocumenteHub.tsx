import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Package, Boxes, Tag } from "lucide-react";
import { ForceInventoryType, type InventoryType } from "@/context/inventory-type";
import ReceptionReport from "@/components/inventory/ReceptionReport";
import ReceptionAnalyticsReport from "@/components/inventory/ReceptionAnalyticsReport";
import BackToHubButton from "@/components/BackToHubButton";

type DepotKey = "materii-prime" | "ambalaje" | "etichete";

const DEPOTS: { key: DepotKey; label: string; type: InventoryType; icon: typeof Package }[] = [
  { key: "materii-prime", label: "Materii Prime", type: "materii-prime", icon: Package },
  { key: "ambalaje", label: "Ambalaje", type: "ambalaje", icon: Boxes },
  { key: "etichete", label: "Etichete", type: "etichete", icon: Tag },
];

const SUB_TABS = [
  { key: "receptie", label: "Recepție" },
  { key: "rapoarte", label: "Rapoarte" },
] as const;

type SubTabKey = (typeof SUB_TABS)[number]["key"];

const DepotPanel: React.FC<{ type: InventoryType }> = ({ type }) => {
  const storageKey = `evidentaDocumente.subtab.${type}`;
  const [sub, setSub] = useState<SubTabKey>(() => {
    if (typeof window === "undefined") return "receptie";
    const v = localStorage.getItem(storageKey) as SubTabKey | null;
    return v && SUB_TABS.some((t) => t.key === v) ? v : "receptie";
  });
  React.useEffect(() => { localStorage.setItem(storageKey, sub); }, [sub, storageKey]);

  return (
    <ForceInventoryType type={type}>
      <Tabs value={sub} onValueChange={(v) => setSub(v as SubTabKey)} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          {SUB_TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key} className="text-xs sm:text-sm">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="receptie">
          <Card>
            <CardContent className="p-4">
              <ReceptionReport />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rapoarte">
          <Card>
            <CardContent className="p-4">
              <ReceptionAnalyticsReport />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </ForceInventoryType>
  );
};

const EvidentaDocumenteHub: React.FC = () => {
  const [depot, setDepot] = useState<DepotKey>(() => {
    if (typeof window === "undefined") return "materii-prime";
    const v = localStorage.getItem("evidentaDocumente.depot") as DepotKey | null;
    return v && DEPOTS.some((d) => d.key === v) ? v : "materii-prime";
  });
  React.useEffect(() => { localStorage.setItem("evidentaDocumente.depot", depot); }, [depot]);

  return (
    <div className="container mx-auto px-2 md:px-6 py-3 md:py-6 space-y-3 md:space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Evidență Documente</h1>
            <p className="text-sm text-muted-foreground">
              Recepții și rapoarte agregate pe interval de timp și furnizor.
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
            {depot === d.key && <DepotPanel type={d.type} />}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default EvidentaDocumenteHub;
