import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import OrderToday from "./OrderToday";
import FutureOrders from "./FutureOrders";

interface ForecastViewProps {
  inventoryType: "materii-prime" | "ambalaje" | "etichete";
}

const ForecastView: React.FC<ForecastViewProps> = ({ inventoryType }) => {
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Caută produs..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <Tabs defaultValue="today" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="today">De Comandat Azi</TabsTrigger>
          <TabsTrigger value="future">Comenzi Viitoare</TabsTrigger>
        </TabsList>
        
        <TabsContent value="today">
          <OrderToday inventoryType={inventoryType} searchTerm={searchTerm} />
        </TabsContent>
        
        <TabsContent value="future">
          <FutureOrders inventoryType={inventoryType} searchTerm={searchTerm} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ForecastView;
