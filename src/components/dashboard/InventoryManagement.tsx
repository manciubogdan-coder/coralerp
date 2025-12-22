
import React, { useState, useEffect } from "react";
import { useInventoryType } from "@/context/inventory-type";
import { useInventoryData } from "@/hooks/use-inventory-data";
import { useAggregatedStock } from "@/hooks/use-aggregated-stock";
import { InventoryToolbar } from "@/components/inventory/InventoryToolbar";
import { InventoryViewOptions } from "@/components/inventory/InventoryViewOptions";
import InventoryTable from "@/components/InventoryTable";
import { TransferHistory } from "@/components/inventory/TransferHistory";
import { ReceptionHistory } from "@/components/inventory/ReceptionHistory";
import { DailyStockGroupView } from "@/components/inventory/DailyStockGroupView";
import { DailyLotConsumption } from "@/components/inventory/DailyLotConsumption";
import DailyStockQuality from "@/components/inventory/DailyStockQuality";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const InventoryManagement = () => {
  const { inventoryType } = useInventoryType();
  const [activeTab, setActiveTab] = useState("all");
  const [viewMode, setViewMode] = useState<"inventory" | "transfers" | "receptions" | "daily-stock" | "daily-consumption" | "daily-quality">("inventory");
  const [refreshKey, setRefreshKey] = useState(0);
  
  const { 
    inventory,
    loading,
    suppliers,
    products,
    manufacturers,
    crateTypes,
    fetchInventory
  } = useInventoryData();
  
  // Apply date filtering before aggregation
  const filteredInventory = inventory.filter(item => {
    if (!item.receipt_date) return activeTab === "all";
    
    const receiptDate = new Date(item.receipt_date);
    const now = new Date();
    
    switch (activeTab) {
      case "today":
        return receiptDate.toDateString() === now.toDateString();
      case "week":
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return receiptDate >= weekAgo;
      case "month":
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return receiptDate >= monthAgo;
      case "all":
      default:
        return true;
    }
  });

  const { aggregatedData, groupBy, setGroupBy } = useAggregatedStock(filteredInventory);
  
  // Debug pentru produsul "test"
  useEffect(() => {
    const testProducts = filteredInventory.filter(item => item.name && item.name.toLowerCase().includes('test'));
    console.log(`InventoryManagement - Found ${testProducts.length} test products in filteredInventory:`, testProducts);
    
    const testAggregated = aggregatedData.filter(item => item.name && item.name.toLowerCase().includes('test'));
    console.log(`InventoryManagement - Found ${testAggregated.length} test products in aggregatedData:`, testAggregated);
  }, [filteredInventory, aggregatedData]);

  const handleTransferReturned = () => {
    console.log("Transfer returned, refreshing all data");
    fetchInventory();
    setRefreshKey(prev => prev + 1);
  };

  const handleAnyDataChange = () => {
    console.log("Data changed, refreshing all tabs");
    fetchInventory();
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">
          Stoc Depozit 
          <span className="text-sm font-normal text-muted-foreground">({inventoryType === 'ambalaje' ? 'Ambalaje' : 'Materii Prime'})</span>
        </h2>
        <InventoryToolbar
          onTransferComplete={handleAnyDataChange}
          products={products}
          suppliers={suppliers}
          manufacturers={manufacturers}
          crateTypes={crateTypes}
        />
      </div>

      <Tabs 
        value={viewMode} 
        onValueChange={(value) => setViewMode(value as "inventory" | "transfers" | "receptions" | "daily-stock" | "daily-consumption" | "daily-quality")}
        className="mb-4"
      >
        <TabsList>
          <TabsTrigger value="inventory">Stoc Curent</TabsTrigger>
          <TabsTrigger value="transfers">Istoric Transferuri</TabsTrigger>
          <TabsTrigger value="receptions">Istoric Recepții</TabsTrigger>
          <TabsTrigger value="daily-stock">Stoc Început Zi</TabsTrigger>
          <TabsTrigger value="daily-quality">Stoc Zilnic Calitate</TabsTrigger>
          <TabsTrigger value="daily-consumption">Consum Zilnic pe Loturi</TabsTrigger>
        </TabsList>
        
        <TabsContent value="inventory">
          <InventoryViewOptions
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            groupBy={groupBy}
            setGroupBy={setGroupBy}
          />
          <div className="bg-white rounded-lg shadow-md">
            <InventoryTable 
              inventory={aggregatedData} 
              showExportButton={true}
              suppliers={suppliers.reduce((acc, supplier) => ({ ...acc, [supplier.id]: supplier }), {})}
              products={products.reduce((acc, product) => ({ ...acc, [product.id]: product }), {})}
              manufacturers={manufacturers.reduce((acc, manufacturer) => ({ ...acc, [manufacturer.id]: manufacturer }), {})}
              crateTypes={crateTypes.reduce((acc, crateType) => ({ ...acc, [crateType.id]: crateType }), {})}
            />
          </div>
        </TabsContent>
        
        <TabsContent value="transfers">
          <div className="bg-white rounded-lg shadow-md p-4">
            <h3 className="text-lg font-medium mb-4">Istoric Transferuri Gestiune</h3>
            <TransferHistory key={refreshKey} onTransferReturned={handleTransferReturned} />
          </div>
        </TabsContent>
        
        <TabsContent value="receptions">
          <div className="bg-white rounded-lg shadow-md p-4">
            <h3 className="text-lg font-medium mb-4">Istoric Recepții</h3>
            <ReceptionHistory key={refreshKey} />
          </div>
        </TabsContent>
        
        <TabsContent value="daily-stock">
          <div className="bg-white rounded-lg shadow-md p-4 print:p-0 print:shadow-none">
            <h3 className="text-lg font-medium mb-4 print:text-sm print:mb-2">Stoc Început Zi</h3>
            <DailyStockGroupView key={refreshKey} />
          </div>
        </TabsContent>

        <TabsContent value="daily-quality">
          <div className="bg-white rounded-lg shadow-md p-4">
            <h3 className="text-lg font-medium mb-4">Stoc Zilnic Calitate</h3>
            <DailyStockQuality key={refreshKey} />
          </div>
        </TabsContent>
        
        <TabsContent value="daily-consumption">
          <div className="bg-white rounded-lg shadow-md p-4">
            <h3 className="text-lg font-medium mb-4">Consum Zilnic pe Loturi</h3>
            <DailyLotConsumption key={refreshKey} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default InventoryManagement;
