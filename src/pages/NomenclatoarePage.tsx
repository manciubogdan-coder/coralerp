import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SuppliersTable from "@/components/dashboard/SuppliersTable";
import ProductsTable from "@/components/dashboard/ProductsTable";
import ManufacturersTable from "@/components/dashboard/ManufacturersTable";
import CrateTypesTable from "@/components/dashboard/CrateTypesTable";
import PalletTypesTable from "@/components/dashboard/PalletTypesTable";
import QualityDefectsTable from "@/components/dashboard/QualityDefectsTable";
import { useInventoryType } from "@/context/inventory-type";

const LABELS: Record<string, { title: string; back: string; backLabel: string }> = {
  "materii-prime": { title: "Nomenclatoare — Materii Prime", back: "/depozit-mp", backLabel: "Depozit MP" },
  ambalaje: { title: "Nomenclatoare — Ambalaje", back: "/depozit-ambalaje", backLabel: "Depozit Ambalaje" },
  etichete: { title: "Nomenclatoare — Etichete", back: "/etichete", backLabel: "Etichete" },
};

const NomenclatoarePage: React.FC = () => {
  const navigate = useNavigate();
  const { inventoryType } = useInventoryType();
  const meta = LABELS[inventoryType];
  const showCrates = inventoryType === "materii-prime";

  return (
    <div className="container mx-auto py-4 space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => navigate(meta.back)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Înapoi la {meta.backLabel}
        </Button>
        <h1 className="text-2xl font-bold">{meta.title}</h1>
      </div>

      <Tabs defaultValue="furnizori" className="w-full">
        <TabsList>
          <TabsTrigger value="furnizori">Furnizori</TabsTrigger>
          <TabsTrigger value="produse">Produse</TabsTrigger>
          <TabsTrigger value="producatori">Producători</TabsTrigger>
          {showCrates && <TabsTrigger value="laditе">Lădițe</TabsTrigger>}
          <TabsTrigger value="paleti">Tip paleți</TabsTrigger>
          <TabsTrigger value="defecte">Defecte calitate</TabsTrigger>
        </TabsList>

        <TabsContent value="furnizori">
          <div className="bg-card rounded-lg shadow-sm border">
            <SuppliersTable />
          </div>
        </TabsContent>
        <TabsContent value="produse">
          <div className="bg-card rounded-lg shadow-sm border">
            <ProductsTable />
          </div>
        </TabsContent>
        <TabsContent value="producatori">
          <div className="bg-card rounded-lg shadow-sm border">
            <ManufacturersTable />
          </div>
        </TabsContent>
        {showCrates && (
          <TabsContent value="laditе">
            <div className="bg-card rounded-lg shadow-sm border">
              <CrateTypesTable />
            </div>
          </TabsContent>
        )}
        <TabsContent value="paleti">
          <div className="bg-card rounded-lg shadow-sm border">
            <PalletTypesTable />
          </div>
        </TabsContent>
        <TabsContent value="defecte">
          <div className="bg-card rounded-lg shadow-sm border">
            <QualityDefectsTable />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default NomenclatoarePage;
