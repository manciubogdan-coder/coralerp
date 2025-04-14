
import React from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface InventoryViewOptionsProps {
  activeTab: string;
  setActiveTab: (value: string) => void;
  groupBy: 'product' | 'supplier' | 'manufacturer';
  setGroupBy: (value: 'product' | 'supplier' | 'manufacturer') => void;
}

export const InventoryViewOptions = ({
  activeTab,
  setActiveTab,
  groupBy,
  setGroupBy
}: InventoryViewOptionsProps) => {
  return (
    <>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
        <TabsList>
          <TabsTrigger value="all">Toate</TabsTrigger>
          <TabsTrigger value="today">Astăzi</TabsTrigger>
          <TabsTrigger value="week">Ultima săptămână</TabsTrigger>
          <TabsTrigger value="month">Ultima lună</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mb-4 flex gap-2">
        <Button
          variant={groupBy === 'product' ? 'default' : 'outline'}
          onClick={() => setGroupBy('product')}
        >
          Grupare după Produs
        </Button>
        <Button
          variant={groupBy === 'supplier' ? 'default' : 'outline'}
          onClick={() => setGroupBy('supplier')}
        >
          Grupare după Furnizor
        </Button>
        <Button
          variant={groupBy === 'manufacturer' ? 'default' : 'outline'}
          onClick={() => setGroupBy('manufacturer')}
        >
          Grupare după Producător
        </Button>
      </div>
    </>
  );
};
