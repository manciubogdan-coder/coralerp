import React, { useState } from "react";
import { Navigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipboardList, Package, Boxes, Tag, Loader2 } from "lucide-react";
import { ForceInventoryType, type InventoryType } from "@/context/inventory-type";
import EvidentaAndrada from "@/components/inventory/EvidentaAndrada";
import BackToHubButton from "@/components/BackToHubButton";
import { useEvidentaAndradaAccess } from "@/hooks/use-evidenta-andrada-access";

type DepotKey = "materii-prime" | "ambalaje" | "etichete";

const DEPOTS: { key: DepotKey; label: string; type: InventoryType; icon: typeof Package }[] = [
  { key: "materii-prime", label: "Materii Prime", type: "materii-prime", icon: Package },
  { key: "ambalaje", label: "Ambalaje", type: "ambalaje", icon: Boxes },
  { key: "etichete", label: "Etichete", type: "etichete", icon: Tag },
];

const EvidentaAndradaHub: React.FC = () => {
  const [depot, setDepot] = useState<DepotKey>(() => {
    if (typeof window === "undefined") return "materii-prime";
    const v = localStorage.getItem("evidenta-andrada.depot") as DepotKey | null;
    return v && DEPOTS.some((d) => d.key === v) ? v : "materii-prime";
  });
  React.useEffect(() => { localStorage.setItem("evidenta-andrada.depot", depot); }, [depot]);

  return (
    <div className="container mx-auto px-2 md:px-6 py-3 md:py-6 space-y-3 md:space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <ClipboardList className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Evidență Andrada</h1>
            <p className="text-sm text-muted-foreground">
              Evidență loturi pe producători cu pierdere estimată vs. reală (rebut, PT, cântar).
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
            {depot === d.key && (
              <ForceInventoryType type={d.type}>
                <Card>
                  <CardContent className="p-4">
                    <EvidentaAndrada />
                  </CardContent>
                </Card>
              </ForceInventoryType>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default EvidentaAndradaHub;
