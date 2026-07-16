
import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, FileSpreadsheet } from "lucide-react";
import { InventoryItem } from "@/types";
import { exportToExcel } from "@/lib/excelExport";
import { useInventoryType } from "@/context/inventory-type";
import { usePersistentState } from "@/hooks/use-persistent-state";

interface SimpleInventoryTableProps {
  inventory: InventoryItem[];
}

const SimpleInventoryTable = ({ inventory }: SimpleInventoryTableProps) => {
  const { inventoryType } = useInventoryType();
  const [searchTerm, setSearchTerm] = usePersistentState(`simple-inventory.search.${inventoryType}`, "");

  // Grupează produsele după nume și sumează cantitățile
  const groupedInventory = inventory.reduce((acc, item) => {
    const key = item.name;
    if (!acc[key]) {
      acc[key] = {
        name: item.name,
        cod_produs: item.products?.cod_produs || '',
        quantity: 0,
        unit: item.unit,
      };
    }
    acc[key].quantity += Number(item.quantity) || 0;
    
    // Păstrează codul produsului dacă nu există sau dacă este mai complet
    if (!acc[key].cod_produs && item.products?.cod_produs) {
      acc[key].cod_produs = item.products.cod_produs;
    }
    
    return acc;
  }, {} as Record<string, { name: string; cod_produs: string; quantity: number; unit: string }>);

  // Filtrează și sortează datele grupate
  const displayData = Object.values(groupedInventory)
    .filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.cod_produs.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  const handleExport = () => {
    const dataToExport = displayData.map(item => ({
      'Cod Produs': item.cod_produs || '-',
      'Produs': item.name,
      'Cantitate': Math.round(item.quantity * 100) / 100,
      'Unitate': item.unit,
    }));
    
    exportToExcel(dataToExport);
  };
  return (
    <div className="w-full">
      <div className="p-2 sm:p-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Caută produs sau cod..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
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
        
        {/* Mobile/tablet: card stacked */}
        <div className="md:hidden print:hidden space-y-2">
          {displayData.length > 0 ? (
            displayData.map((item) => (
              <div key={item.name} className="border rounded-lg p-3 bg-card shadow-sm">
                <div className="font-medium text-sm">{item.name}</div>
                <div className="text-xs text-muted-foreground mt-1">Cod: {item.cod_produs || "-"}</div>
                <div className="flex justify-between items-center mt-2 pt-2 border-t">
                  <span className="text-xs text-muted-foreground">Cant. netă</span>
                  <span className="font-bold text-base">{item.quantity.toFixed(2)} {item.unit}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-6 text-gray-500 text-sm">
              {searchTerm ? `Nu s-au găsit produse pentru "${searchTerm}"` : "Nu există produse în stoc."}
            </div>
          )}
        </div>

        {/* Desktop: table */}
        <div className="hidden md:block print:block border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cod Produs</TableHead>
                <TableHead>Produs</TableHead>
                <TableHead className="text-right">Cantitate Netă</TableHead>
                <TableHead>Unitate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                {displayData.length > 0 ? (
                  displayData.map((item) => (
                    <TableRow key={item.name}>
                      <TableCell className="font-medium">{item.cod_produs || "-"}</TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
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

export default SimpleInventoryTable;
