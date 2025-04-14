
import React, { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, FileSpreadsheet } from "lucide-react";
import { InventoryItem } from "@/types";
import { exportToExcel } from "@/lib/excelExport";

interface SimpleInventoryTableProps {
  inventory: InventoryItem[];
}

const SimpleInventoryTable = ({ inventory }: SimpleInventoryTableProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [showGrossQuantity, setShowGrossQuantity] = useState(false);

  // Group and sum quantities by product name
  const groupedInventory = inventory.reduce((acc, item) => {
    const key = item.name;
    if (!acc[key]) {
      acc[key] = {
        name: key,
        quantity: 0,
        gross_quantity: 0,
        unit: item.unit
      };
    }
    acc[key].quantity += item.quantity;
    acc[key].gross_quantity += item.gross_quantity || item.quantity;
    return acc;
  }, {} as Record<string, { name: string; quantity: number; gross_quantity: number; unit: string }>);

  // Convert to array and filter by search
  const displayData = Object.values(groupedInventory)
    .filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  const handleExport = () => {
    const dataToExport = displayData.map(item => ({
      Produs: item.name,
      'Cantitate Netă': item.quantity.toFixed(2),
      'Cantitate Brută': item.gross_quantity.toFixed(2),
      Unitate: item.unit
    }));
    
    exportToExcel(dataToExport);
  };

  const toggleQuantityType = () => {
    setShowGrossQuantity(!showGrossQuantity);
  };

  return (
    <div className="w-full">
      <div className="p-2 sm:p-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Caută produs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleQuantityType}
              className="w-full sm:w-auto whitespace-nowrap"
            >
              {showGrossQuantity ? "Arată cantitate netă" : "Arată cantitate brută"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="w-full sm:w-auto"
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
          </div>
        </div>
        
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produs</TableHead>
                <TableHead className="text-right">
                  {showGrossQuantity ? "Cantitate Brută" : "Cantitate Netă"}
                </TableHead>
                <TableHead>Unitate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayData.length > 0 ? (
                displayData.map((item) => (
                  <TableRow key={item.name}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-right">
                      {showGrossQuantity 
                        ? item.gross_quantity.toFixed(2) 
                        : item.quantity.toFixed(2)
                      }
                    </TableCell>
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
