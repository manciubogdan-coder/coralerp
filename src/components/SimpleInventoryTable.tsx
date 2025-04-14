
import React, { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { InventoryItem } from "@/types";

interface SimpleInventoryTableProps {
  inventory: InventoryItem[];
}

const SimpleInventoryTable = ({ inventory }: SimpleInventoryTableProps) => {
  const [searchTerm, setSearchTerm] = useState("");

  // Group and sum quantities by product name
  const groupedInventory = inventory.reduce((acc, item) => {
    const key = item.name;
    if (!acc[key]) {
      acc[key] = {
        name: key,
        quantity: 0,
        unit: item.unit
      };
    }
    acc[key].quantity += item.quantity;
    return acc;
  }, {} as Record<string, { name: string; quantity: number; unit: string }>);

  // Convert to array and filter by search
  const displayData = Object.values(groupedInventory)
    .filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="w-full">
      <div className="p-4">
        <div className="relative w-full md:max-w-sm mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Caută produs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produs</TableHead>
                <TableHead className="text-right">Cantitate Totală</TableHead>
                <TableHead>Unitate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayData.length > 0 ? (
                displayData.map((item) => (
                  <TableRow key={item.name}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-right">{item.quantity.toFixed(2)}</TableCell>
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
    </div>
  );
};

export default SimpleInventoryTable;
