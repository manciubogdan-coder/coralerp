
import React, { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { InventoryItem } from "@/types";
import { useIsMobile } from "@/hooks/use-mobile";

interface CurrentInventoryTableProps {
  inventory: InventoryItem[];
}

const CurrentInventoryTable = ({ inventory }: CurrentInventoryTableProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const isMobile = useIsMobile();

  // Group inventory items by product name and sum their quantities
  const groupedInventory = inventory.reduce((acc, item) => {
    const productName = item.name;
    if (!acc[productName]) {
      acc[productName] = {
        name: productName,
        cod_produs: item.products?.cod_produs || '',
        quantity: 0,
        unit: item.unit
      };
    }
    acc[productName].quantity += item.quantity;
    // Update product code if this item has one and the existing doesn't
    if (!acc[productName].cod_produs && item.products?.cod_produs) {
      acc[productName].cod_produs = item.products.cod_produs;
    }
    return acc;
  }, {} as Record<string, { name: string; cod_produs: string; quantity: number; unit: string }>);

  // Convert grouped object to array, filter by search term, and sort
  const displayedInventory = Object.values(groupedInventory)
    .filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="w-full overflow-x-auto">
      <div className="p-2 md:p-4">
        <div className="relative w-full md:max-w-sm mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Caută produs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      
        <div className="max-h-[70vh] overflow-auto">
          <Table>
              <TableHeader className="sticky top-0 bg-white z-10">
                <TableRow>
                  <TableHead className="text-left">Produs</TableHead>
                  <TableHead className="text-left">Cod Produs</TableHead>
                  <TableHead className="text-right">Cantitate Totală</TableHead>
                  <TableHead className="text-left">Unitate</TableHead>
                </TableRow>
              </TableHeader>
            <TableBody>
              {displayedInventory.length > 0 ? (
                  displayedInventory.map((item) => (
                    <TableRow key={item.name}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.cod_produs || "-"}</TableCell>
                      <TableCell className="text-right">{item.quantity.toFixed(2)}</TableCell>
                      <TableCell>{item.unit}</TableCell>
                    </TableRow>
                  ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-6 text-gray-500">
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

export default CurrentInventoryTable;
