
import React, { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Search, Filter } from "lucide-react";
import { InventoryItem } from "@/types";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";
import { format } from "date-fns";

interface CurrentInventoryTableProps {
  inventory: InventoryItem[];
}

const CurrentInventoryTable = ({ inventory }: CurrentInventoryTableProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [groupBy, setGroupBy] = useState<"none" | "supplier" | "product">("none");
  const isMobile = useIsMobile();

  // Filtrare după termen de căutare
  const filteredInventory = inventory.filter(item => {
    const productName = item.name?.toLowerCase() || "";
    const supplierName = item.supplier?.toLowerCase() || "";
    
    return (
      productName.includes(searchTerm.toLowerCase()) ||
      supplierName.includes(searchTerm.toLowerCase())
    );
  });

  // Grupare date
  let displayedInventory = filteredInventory;
  if (groupBy === "product") {
    const groups = new Map<string, InventoryItem>();
    
    filteredInventory.forEach(item => {
      const key = item.name;
      if (!groups.has(key)) {
        groups.set(key, {
          ...item,
          quantity: 0,
          isHeader: true
        });
      }
      const group = groups.get(key)!;
      group.quantity += item.quantity;
    });
    
    displayedInventory = Array.from(groups.values());
  } else if (groupBy === "supplier") {
    const groups = new Map<string, InventoryItem>();
    
    filteredInventory.forEach(item => {
      const key = item.supplier || "Necunoscut";
      if (!groups.has(key)) {
        groups.set(key, {
          ...item,
          quantity: 0,
          name: `Furnizor: ${key}`,
          isHeader: true
        });
      }
      const group = groups.get(key)!;
      group.quantity += item.quantity;
    });
    
    displayedInventory = Array.from(groups.values());
  }

  return (
    <div className="w-full overflow-x-auto">
      <div className="p-2 md:p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
        <div className="relative w-full md:flex-1 md:mr-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Caută produs, furnizor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full"
          />
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                size={isMobile ? "sm" : "default"} 
                className="text-xs md:text-sm w-full md:w-auto flex items-center justify-center"
              >
                <Filter className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                Grupare
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="z-50">
              <DropdownMenuItem onClick={() => setGroupBy("none")}>
                Fără grupare
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setGroupBy("product")}>
                Grupare după produs
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setGroupBy("supplier")}>
                Grupare după furnizor
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      <div className="max-h-[70vh] overflow-auto">
        <Table className="w-full">
          <TableHeader className="sticky top-0 bg-white z-10">
            <TableRow>
              <TableHead className="text-left">Produs</TableHead>
              <TableHead className="text-right">Cantitate</TableHead>
              <TableHead className="text-left">Unitate</TableHead>
              <TableHead className="text-left">Furnizor</TableHead>
              <TableHead className="text-left">Data Recepție</TableHead>
              <TableHead className="text-left">Nr. Document</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayedInventory.length > 0 ? (
              displayedInventory.map((item) => (
                <TableRow 
                  key={item.id} 
                  className={item.isHeader ? "bg-gray-100 font-medium" : ""}
                >
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-right">{item.quantity.toFixed(2)}</TableCell>
                  <TableCell>{item.unit}</TableCell>
                  <TableCell>{item.supplier || '-'}</TableCell>
                  <TableCell>
                    {item.receipt_date 
                      ? format(new Date(item.receipt_date), 'dd.MM.yyyy')
                      : '-'}
                  </TableCell>
                  <TableCell>{item.document_number || '-'}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-6 text-gray-500">
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

export default CurrentInventoryTable;
