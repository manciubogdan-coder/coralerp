
import React from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface InventoryViewOptionsProps {
  activeTab: string;
  setActiveTab: (value: string) => void;
  groupBy: 'product' | 'supplier' | 'manufacturer' | 'lot';
  setGroupBy: (value: 'product' | 'supplier' | 'manufacturer' | 'lot') => void;
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
        <TabsList className="flex w-full overflow-x-auto gap-1 h-auto p-1">
          <TabsTrigger value="all" className="flex-shrink-0 text-xs md:text-sm">Toate</TabsTrigger>
          <TabsTrigger value="today" className="flex-shrink-0 text-xs md:text-sm">Astăzi</TabsTrigger>
          <TabsTrigger value="week" className="flex-shrink-0 text-xs md:text-sm">Ultima săptămână</TabsTrigger>
          <TabsTrigger value="month" className="flex-shrink-0 text-xs md:text-sm">Ultima lună</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mb-4 grid grid-cols-2 md:flex gap-2">
        <Button
          size="sm"
          variant={groupBy === 'product' ? 'default' : 'outline'}
          onClick={() => setGroupBy('product')}
          className="text-xs md:text-sm"
        >
          Grupare Produs
        </Button>
        <Button
          size="sm"
          variant={groupBy === 'supplier' ? 'default' : 'outline'}
          onClick={() => setGroupBy('supplier')}
          className="text-xs md:text-sm"
        >
          Grupare Furnizor
        </Button>
        <Button
          size="sm"
          variant={groupBy === 'manufacturer' ? 'default' : 'outline'}
          onClick={() => setGroupBy('manufacturer')}
          className="text-xs md:text-sm"
        >
          Grupare Producător
        </Button>
        <Button
          size="sm"
          variant={groupBy === 'lot' ? 'default' : 'outline'}
          onClick={() => setGroupBy('lot')}
          className="text-xs md:text-sm"
        >
          Grupare Lot
        </Button>
      </div>
    </>
  );
};
