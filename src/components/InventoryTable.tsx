import React, { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Search, Filter, Eye, EyeOff } from "lucide-react";
import { InventoryItem, Supplier, Product, Manufacturer, CrateType } from "@/types";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";

interface InventoryTableProps {
  inventory: InventoryItem[];
}

const InventoryTable = ({ inventory }: InventoryTableProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [groupBySupplier, setGroupBySupplier] = useState(false);
  const [groupByBatch, setGroupByBatch] = useState(false);
  const [groupByProduct, setGroupByProduct] = useState(false);
  const [showEmptyItems, setShowEmptyItems] = useState(false);
  const [suppliers, setSuppliers] = useState<Record<string, Supplier>>({});
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [manufacturers, setManufacturers] = useState<Record<string, Manufacturer>>({});
  const [crateTypes, setCrateTypes] = useState<Record<string, CrateType>>({});
  const isMobile = useIsMobile();
  
  console.log("InventoryTable initialized with", inventory.length, "items");
  
  React.useEffect(() => {
    const fetchReferenceData = async () => {
      console.log("Fetching reference data for inventory table");
      // Fetch suppliers
      const { data: suppliersData } = await supabase.from('suppliers').select('*');
      if (suppliersData) {
        const suppliersMap = suppliersData.reduce((acc, supplier) => {
          acc[supplier.id] = supplier;
          return acc;
        }, {} as Record<string, Supplier>);
        setSuppliers(suppliersMap);
        console.log("Suppliers data loaded:", suppliersData);
      }

      // Fetch products
      const { data: productsData } = await supabase.from('products').select('*');
      if (productsData) {
        const productsMap = productsData.reduce((acc, product) => {
          acc[product.id] = product;
          return acc;
        }, {} as Record<string, Product>);
        setProducts(productsMap);
      }

      // Fetch manufacturers
      const { data: manufacturersData } = await supabase.from('manufacturers').select('*');
      if (manufacturersData) {
        const manufacturersMap = manufacturersData.reduce((acc, manufacturer) => {
          acc[manufacturer.id] = manufacturer;
          return acc;
        }, {} as Record<string, Manufacturer>);
        setManufacturers(manufacturersMap);
        console.log("Manufacturers data loaded:", manufacturersData);
      }

      // Fetch crate types
      const { data: crateTypesData } = await supabase.from('crate_types').select('*');
      if (crateTypesData) {
        const crateTypesMap = crateTypesData.reduce((acc, crateType) => {
          acc[crateType.id] = crateType;
          return acc;
        }, {} as Record<string, CrateType>);
        setCrateTypes(crateTypesMap);
      }
    };

    fetchReferenceData();
  }, []);
  
  // Filter out items with zero quantity unless explicitly showing empty items
  const nonEmptyInventory = showEmptyItems 
    ? inventory 
    : inventory.filter(item => item.quantity > 0);
    
  const filteredInventory = nonEmptyInventory.filter(item => {
    const supplierName = item.supplier_id ? suppliers[item.supplier_id]?.name : item.supplier;
    const productName = item.product_id ? products[item.product_id]?.name : item.name;
    const manufacturerName = item.manufacturer_id ? manufacturers[item.manufacturer_id]?.name : item.manufacturer;

    return (
      productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (supplierName && supplierName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.batch_number && item.batch_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (manufacturerName && manufacturerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.document_number && item.document_number.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  });
  
  // Log some sample data to help with debugging
  React.useEffect(() => {
    if (filteredInventory.length > 0) {
      const sampleItem = filteredInventory[0];
      console.log("Sample inventory item:", sampleItem);
      console.log("Supplier:", sampleItem.supplier_id ? suppliers[sampleItem.supplier_id]?.name : sampleItem.supplier);
      console.log("Manufacturer:", sampleItem.manufacturer_id ? manufacturers[sampleItem.manufacturer_id]?.name : sampleItem.manufacturer);
    }
  }, [filteredInventory, suppliers, manufacturers]);
  
  // Group inventory items if needed
  let displayedInventory = filteredInventory;
  
  if (groupByProduct) {
    const productMap = new Map<string, InventoryItem[]>();
    
    filteredInventory.forEach(item => {
      const productName = item.product_id ? products[item.product_id]?.name : item.name;
      if (!productMap.has(productName)) {
        productMap.set(productName, []);
      }
      productMap.get(productName)!.push(item);
    });
    
    displayedInventory = Array.from(productMap).flatMap(([product, items]) => {
      // Add a header row
      const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
      const headerItem: InventoryItem = {
        id: `product-${product}`,
        name: `Produs: ${product}`,
        quantity: totalQuantity,
        unit: items[0]?.unit || '',
        isHeader: true
      };
      
      return [headerItem, ...items];
    });
  } else if (groupBySupplier) {
    const supplierMap = new Map<string, InventoryItem[]>();
    
    filteredInventory.forEach(item => {
      const supplierName = item.supplier_id ? suppliers[item.supplier_id]?.name : (item.supplier || 'Necunoscut');
      if (!supplierMap.has(supplierName)) {
        supplierMap.set(supplierName, []);
      }
      supplierMap.get(supplierName)!.push(item);
    });
    
    displayedInventory = Array.from(supplierMap).flatMap(([supplier, items]) => {
      // Add a header row
      const headerItem: InventoryItem = {
        id: `supplier-${supplier}`,
        name: `Furnizor: ${supplier}`,
        quantity: items.reduce((sum, item) => sum + item.quantity, 0),
        unit: items[0]?.unit || '',
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
        batch_number: batch,
        isHeader: true
      };
      
      return [headerItem, ...items];
    });
  }

  // Update visible columns to show all important data regardless of device
  const getVisibleColumns = () => {
    if (isMobile) {
      return {
        entryNumber: true,
        date: true,
        name: true,
        quantity: true, 
        unit: true,
        supplier: true,
        manufacturer: true,
        batch: true,
        documentNumber: true,
        crateType: true,
        netQuantity: true,
        updatedAt: false // Only this one is hidden on mobile to save space
      };
    }
    return {
      entryNumber: true,
      date: true,
      name: true,
      quantity: true,
      unit: true,
      supplier: true,
      manufacturer: true,
      batch: true,
      documentNumber: true,
      crateType: true,
      netQuantity: true,
      updatedAt: true
    };
  };

  const visibleColumns = getVisibleColumns();
  
  return (
    <div>
      <div className="p-2 md:p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
        <div className="relative w-full md:flex-1 md:mr-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Caută produs, furnizor, lot..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <Button 
            variant="outline" 
            size={isMobile ? "sm" : "default"}
            onClick={() => setShowEmptyItems(!showEmptyItems)}
            className="flex items-center text-xs md:text-sm"
          >
            {showEmptyItems ? <EyeOff className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" /> : <Eye className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />}
            {showEmptyItems ? "Ascunde fără stoc" : "Arată fără stoc"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size={isMobile ? "sm" : "default"} className="text-xs md:text-sm">
                <Filter className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
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
        <div className="w-full overflow-x-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-white">
              <TableRow>
                {visibleColumns.entryNumber && <TableHead>Nr. crt</TableHead>}
                {visibleColumns.date && <TableHead>Data</TableHead>}
                <TableHead>Produs</TableHead>
                <TableHead className="text-right">Cantitate</TableHead>
                <TableHead className="text-right">Unitate</TableHead>
                {visibleColumns.supplier && <TableHead>Furnizor</TableHead>}
                {visibleColumns.manufacturer && <TableHead>Producător</TableHead>}
                {visibleColumns.batch && <TableHead>Nr. Lot</TableHead>}
                {visibleColumns.documentNumber && <TableHead>Nr. document</TableHead>}
                {visibleColumns.crateType && <TableHead>Tip ladită</TableHead>}
                {visibleColumns.netQuantity && <TableHead className="text-right">Cant. netă</TableHead>}
                {visibleColumns.updatedAt && <TableHead className="text-right">Ultima actualizare</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedInventory.length > 0 ? (
                displayedInventory.map((item) => {
                  const productName = item.product_id ? products[item.product_id]?.name : item.name;
                  const supplierName = item.supplier_id ? suppliers[item.supplier_id]?.name : item.supplier;
                  const manufacturerName = item.manufacturer_id 
                    ? manufacturers[item.manufacturer_id]?.name 
                    : (item.manufacturer || '-');
                  
                  console.log(`Item ${item.id} manufacturer:`, item.manufacturer || "not set", 
                              "manufacturer_id:", item.manufacturer_id || "not set");
                  
                  const crateTypeName = item.crate_type_id ? crateTypes[item.crate_type_id]?.name : '';
                  
                  return (
                    <TableRow key={item.id} className={item.isHeader ? "bg-gray-100 font-medium" : ""}>
                      {visibleColumns.entryNumber && (
                        <TableCell>{item.entry_number || '-'}</TableCell>
                      )}
                      {visibleColumns.date && (
                        <TableCell>
                          {item.receipt_date 
                            ? new Date(item.receipt_date).toLocaleDateString('ro-RO') 
                            : '-'}
                        </TableCell>
                      )}
                      <TableCell className={item.isHeader ? "font-bold" : "font-medium"}>
                        {productName}
                      </TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">{item.unit}</TableCell>
                      {visibleColumns.supplier && <TableCell>{supplierName || '-'}</TableCell>}
                      {visibleColumns.manufacturer && <TableCell>{manufacturerName}</TableCell>}
                      {visibleColumns.batch && <TableCell>{item.batch_number || '-'}</TableCell>}
                      {visibleColumns.documentNumber && <TableCell>{item.document_number || '-'}</TableCell>}
                      {visibleColumns.crateType && (
                        <TableCell>
                          {crateTypeName ? `${crateTypeName} (${item.crate_count || 0} buc)` : '-'}
                        </TableCell>
                      )}
                      {visibleColumns.netQuantity && (
                        <TableCell className="text-right">{item.net_quantity || item.quantity}</TableCell>
                      )}
                      {visibleColumns.updatedAt && (
                        <TableCell className="text-right">
                          {item.updated_at 
                            ? new Date(item.updated_at).toLocaleString('ro-RO')
                            : item.updatedAt
                              ? new Date(item.updatedAt.seconds * 1000).toLocaleString('ro-RO') 
                              : '-'}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              ) : searchTerm ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-6 text-gray-500">
                    Nu s-au găsit produse pentru "{searchTerm}"
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-6 text-gray-500">
                    Nu există produse în stoc. Adăugați produse folosind comenzi vocale sau text.
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

export default InventoryTable;
