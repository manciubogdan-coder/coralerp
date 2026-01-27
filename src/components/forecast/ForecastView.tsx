import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import OrderToday from "./OrderToday";
import FutureOrders from "./FutureOrders";

interface ForecastViewProps {
  inventoryType: "materii-prime" | "ambalaje" | "etichete";
}

const ForecastView: React.FC<ForecastViewProps> = ({ inventoryType }) => {
  return (
    <Tabs defaultValue="today" className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="today">De Comandat Azi</TabsTrigger>
        <TabsTrigger value="future">Comenzi Viitoare</TabsTrigger>
      </TabsList>
      
      <TabsContent value="today">
        <OrderToday inventoryType={inventoryType} />
      </TabsContent>
      
      <TabsContent value="future">
        <FutureOrders inventoryType={inventoryType} />
      </TabsContent>
    </Tabs>
  );
};

export default ForecastView;
