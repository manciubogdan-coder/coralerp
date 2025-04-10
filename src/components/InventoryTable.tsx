
import React, { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Search, Filter, Eye, EyeOff } from "lucide-react";
import { InventoryItem } from "@/types";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface InventoryTableProps {
  inventory: InventoryItem[];
}

const InventoryTable = ({ inventory }: InventoryTableProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [groupBySupplier, setGroupBySupplier] = useState(false);
  const [groupByBatch, setGroupByBatch] = useState(false);
  const [groupByProduct, setGroupByProduct] = useState(false);
  const [showEmptyItems, setShowEmptyItems] = useState(false);
  
  // Filter out items with zero quantity unless explicitly showing empty items
  const nonEmptyInventory = showEmptyItems 
    ? inventory 
    : inventory.filter(item => item.quantity > 0);
    
  const filteredInventory = nonEmptyInventory.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.supplier && item.supplier.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (item.batch_number && item.batch_number.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  // Group inventory items if needed
  let displayedInventory = filteredInventory;
  
  if (groupByProduct) {
    const productMap = new Map<string, InventoryItem[]>();
    
    filteredInventory.forEach(item => {
      if (!productMap.has(item.name)) {
        productMap.set(item.name, []);
      }
      productMap.get(item.name)!.push(item);
    });
    
    displayedInventory = Array.from(productMap).flatMap(([product, items]) => {
      // Add a header row
      const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
      const headerItem: InventoryItem = {
        id: `product-${product}`,
        name: `Produs: ${product}`,
        quantity: totalQuantity,
        unit: items[0]?.unit || '',
        pallets: items.reduce((sum, item) => sum + (item.pallets || 0), 0),
        isHeader: true
      };
      
      return [headerItem, ...items];
    });
  } else if (groupBySupplier) {
    const supplierMap = new Map<string, InventoryItem[]>();
    
    filteredInventory.forEach(item => {
      const supplier = item.supplier || 'Necunoscut';
      if (!supplierMap.has(supplier)) {
        supplierMap.set(supplier, []);
      }
      supplierMap.get(supplier)!.push(item);
    });
    
    displayedInventory = Array.from(supplierMap).flatMap(([supplier, items]) => {
      // Add a header row
      const headerItem: InventoryItem = {
        id: `supplier-${supplier}`,
        name: `Furnizor: ${supplier}`,
        quantity: items.reduce((sum, item) => sum + item.quantity, 0),
        unit: items[0]?.unit || '',
        pallets: items.reduce((sum, item) => sum + (item.pallets || 0), 0),
        supplier: supplier,
        isHeader: true
      };
      
      return [headerItem, ...items];
    });
  } else if (groupByBatch) {
    const batchMap = new Map<string, InventoryItem[]>();
    
    filteredInventory.forEach(item => {
      const batch = item.batch_number || 'Necunoscut';
      if (!batchMap.has(batch)) {
        batchMap.set(batch, []);
      }
      batchMap.get(batch)!.push(item);
    });
    
    displayedInventory = Array.from(batchMap).flatMap(([batch, items]) => {
      // Add a header row
      const headerItem: InventoryItem = {
        id: `batch-${batch}`,
        name: `Lot: ${batch}`,
        quantity: items.reduce((sum, item) => sum + item.quantity, 0),
        unit: items[0]?.unit || '',
        pallets: items.reduce((sum, item) => sum + (item.pallets || 0), 0),
        batch_number: batch,
        isHeader: true
      };
      
      return [headerItem, ...items];
    });
  }
  
  return (
    <div>
      <div className="p-4 flex justify-between items-center">
        <div className="relative flex-1 mr-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Caută produs, furnizor, lot..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowEmptyItems(!showEmptyItems)}
            className="flex items-center"
          >
            {showEmptyItems ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            {showEmptyItems ? "Ascunde fără stoc" : "Arată fără stoc"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Grupare
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => {
                setGroupBySupplier(false);
                setGroupByBatch(false);
                setGroupByProduct(false);
              }}>
                Fără grupare
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                setGroupByProduct(true);
                setGroupBySupplier(false);
                setGroupByBatch(false);
              }}>
                Grupare după produs
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                setGroupBySupplier(true);
                setGroupByBatch(false);
                setGroupByProduct(false);
              }}>
                Grupare după furnizor
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                setGroupBySupplier(false);
                setGroupByBatch(true);
                setGroupByProduct(false);
              }}>
                Grupare după lot
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      <div className="max-h-[400px] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-white">
            <TableRow>
              <TableHead>Produs</TableHead>
              <TableHead className="text-right">Cantitate</TableHead>
              <TableHead className="text-right">Unitate</TableHead>
              <TableHead className="text-right">Paleți</TableHead>
              <TableHead>Furnizor</TableHead>
              <TableHead>Nr. Lot</TableHead>
              <TableHead className="text-right">Data recepției</TableHead>
              <TableHead className="text-right">Ultima actualizare</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayedInventory.length > 0 ? (
              displayedInventory.map((item) => (
                <TableRow key={item.id} className={item.isHeader ? "bg-gray-100 font-medium" : ""}>
                  <TableCell className={item.isHeader ? "font-bold" : "font-medium"}>
                    {item.name}
                  </TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">{item.unit}</TableCell>
                  <TableCell className="text-right">{item.pallets || 0}</TableCell>
                  <TableCell>{item.supplier || '-'}</TableCell>
                  <TableCell>{item.batch_number || '-'}</TableCell>
                  <TableCell className="text-right">
                    {item.receipt_date 
                      ? new Date(item.receipt_date).toLocaleDateString('ro-RO') 
                      : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.updatedAt 
                      ? new Date(item.updatedAt.seconds * 1000).toLocaleString('ro-RO') 
                      : '-'}
                  </TableCell>
                </TableRow>
              ))
            ) : searchTerm ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-6 text-gray-500">
                  Nu s-au găsit produse pentru "{searchTerm}"
                </TableCell>
              </TableRow>
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-6 text-gray-500">
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
