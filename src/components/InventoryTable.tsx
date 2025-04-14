
import React, { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { InventoryItem } from "@/types";

interface InventoryTableProps {
  inventory: InventoryItem[];
}

const InventoryTable = ({ inventory }: InventoryTableProps) => {
  const [searchTerm, setSearchTerm] = useState("");

  // Aggregate inventory by product name - this is the critical part
  const aggregatedInventory = inventory.reduce((acc, item) => {
    const productName = item.name;
    
    if (!acc[productName]) {
      acc[productName] = {
        name: productName,
        quantity: 0,
        unit: item.unit
      };
    }
    
    // Sum the quantities
    acc[productName].quantity += item.quantity;
    return acc;
  }, {} as Record<string, { name: string; quantity: number; unit: string }>);

  // Convert to array and filter out zero quantity items
  const displayInventory = Object.values(aggregatedInventory)
    .filter(item => item.quantity > 0)
    .filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

  const formatQuantity = (quantity: number) => {
    return quantity.toFixed(2);
  };

  return (
    <div className="w-full overflow-x-auto">
      <div className="p-4">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Caută produs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nume</TableHead>
              <TableHead className="text-right">Cantitate</TableHead>
              <TableHead>Unitate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayInventory.length > 0 ? (
              displayInventory.map((item) => (
                <TableRow key={item.name}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-right">{formatQuantity(item.quantity)}</TableCell>
                  <TableCell>{item.unit}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-6 text-gray-500">
                  {searchTerm
                    ? `Nu s-au găsit produse pentru "${searchTerm}"`
                    : "Nu există produse în stoc."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default InventoryTable;
