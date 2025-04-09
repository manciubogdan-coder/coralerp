
import React, { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { InventoryItem } from "@/types";

interface InventoryTableProps {
  inventory: InventoryItem[];
}

const InventoryTable = ({ inventory }: InventoryTableProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  
  const filteredInventory = inventory.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  return (
    <div>
      <div className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Caută produs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>
      
      <div className="max-h-[400px] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-white">
            <TableRow>
              <TableHead className="w-[300px]">Produs</TableHead>
              <TableHead className="text-right">Cantitate</TableHead>
              <TableHead className="text-right">Unitate</TableHead>
              <TableHead className="text-right">Ultima actualizare</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInventory.length > 0 ? (
              filteredInventory.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">{item.unit}</TableCell>
                  <TableCell className="text-right">
                    {item.updatedAt ? new Date(item.updatedAt.seconds * 1000).toLocaleString('ro-RO') : 'N/A'}
                  </TableCell>
                </TableRow>
              ))
            ) : searchTerm ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-6 text-gray-500">
                  Nu s-au găsit produse pentru "{searchTerm}"
                </TableCell>
              </TableRow>
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-6 text-gray-500">
                  Nu există produse în stoc. Adăugați produse folosind comenzi vocale sau text.
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
