import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import PickingManagementSimple from "@/components/productie/PickingManagementSimple";
import MarfaRestocataView from "@/components/productie/MarfaRestocataView";

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

        <Tabs defaultValue="picking" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="picking">Picking</TabsTrigger>
            <TabsTrigger value="restocking">Marfă Restocată</TabsTrigger>
          </TabsList>

          <TabsContent value="picking">
            <PickingManagementSimple />
          </TabsContent>

          <TabsContent value="restocking">
            <MarfaRestocataView />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default PickingPage;
