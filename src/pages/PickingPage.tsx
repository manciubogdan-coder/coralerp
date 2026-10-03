import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, PackageOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import PickingManagementSimple from "@/components/productie/PickingManagementSimple";
import MarfaRestocataView from "@/components/productie/MarfaRestocataView";
import DepozitMP from "@/components/productie/DepozitMP";
import ModAmbalareView from "@/components/productie/ModAmbalareView";

const PickingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1 container mx-auto p-2 md:p-4">
        <div className="mb-4 flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Înapoi la panou
          </Button>
          <h1 className="text-xl md:text-2xl font-bold">Picking</h1>
        </div>

        <Tabs defaultValue="depozit" className="w-full">
          <TabsList className="mb-4 h-auto max-w-full overflow-x-auto">
            <TabsTrigger value="depozit">Depozit MP</TabsTrigger>
            <TabsTrigger value="picking">Picking</TabsTrigger>
            <TabsTrigger value="restocking">Marfă Restocată</TabsTrigger>
            <TabsTrigger value="packaging" className="gap-2"><PackageOpen className="h-4 w-4" />Mod de ambalare</TabsTrigger>
          </TabsList>

          <TabsContent value="depozit">
            <DepozitMP />
          </TabsContent>

          <TabsContent value="picking">
            <PickingManagementSimple />
          </TabsContent>

          <TabsContent value="restocking">
            <MarfaRestocataView />
          </TabsContent>

          <TabsContent value="packaging">
            <ModAmbalareView />
          </TabsContent>
        </Tabs>

      </main>
    </div>
  );
};

export default PickingPage;
