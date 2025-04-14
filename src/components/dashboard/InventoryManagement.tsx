
import React, { useState } from "react";
import { useInventoryData } from "@/hooks/use-inventory-data";
import { useAggregatedStock } from "@/hooks/use-aggregated-stock";
import { InventoryToolbar } from "@/components/inventory/InventoryToolbar";
import { InventoryViewOptions } from "@/components/inventory/InventoryViewOptions";
import { InventoryTable } from "@/components/InventoryTable";

const InventoryManagement = () => {
  const [activeTab, setActiveTab] = useState("all");
  const { 
    inventory,
    loading,
    suppliers,
    products,
    manufacturers,
    crateTypes,
    fetchInventory
  } = useInventoryData();
  
  const { aggregatedData, groupBy, setGroupBy } = useAggregatedStock(inventory);

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Stoc Depozit</h2>
        <InventoryToolbar
          inventory={inventory}
          onTransferComplete={fetchInventory}
          products={products}
          suppliers={suppliers}
          manufacturers={manufacturers}
          crateTypes={crateTypes}
        />
      </div>

      <InventoryViewOptions
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        groupBy={groupBy}
        setGroupBy={setGroupBy}
      />

      <div className="bg-white rounded-lg shadow-md">
        <InventoryTable inventory={aggregatedData} />
      </div>
    </div>
  );
};

export default InventoryManagement;
