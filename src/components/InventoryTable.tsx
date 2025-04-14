import React, { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Search, Filter, Eye, EyeOff } from "lucide-react";
import { InventoryItem, Supplier, Product, Manufacturer, CrateType } from "@/types";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface InventoryTableProps {
  inventory: InventoryItem[];
}

const InventoryTable = ({ inventory }: InventoryTableProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [groupBySupplier, setGroupBySupplier] = useState(false);
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
      const { data: suppliersData } = await supabase.from('suppliers').select('*');
      if (suppliersData) {
        const suppliersMap = suppliersData.reduce((acc, supplier) => {
          acc[supplier.id] = supplier;
          return acc;
        }, {} as Record<string, Supplier>);
        setSuppliers(suppliersMap);
        console.log("Suppliers data loaded:", suppliersData);
      }

      const { data: productsData } = await supabase.from('products').select('*');
      if (productsData) {
        const productsMap = productsData.reduce((acc, product) => {
          acc[product.id] = product;
          return acc;
        }, {} as Record<string, Product>);
        setProducts(productsMap);
      }

      const { data: manufacturersData } = await supabase.from('manufacturers').select('*');
      if (manufacturersData) {
        const manufacturersMap = manufacturersData.reduce((acc, manufacturer) => {
          acc[manufacturer.id] = manufacturer;
          return acc;
        }, {} as Record<string, Manufacturer>);
        setManufacturers(manufacturersMap);
        console.log("Manufacturers data loaded:", manufacturersData);
      }

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
      (manufacturerName && manufacturerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.document_number && item.document_number.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  });
  
  React.useEffect(() => {
    if (filteredInventory.length > 0) {
      const sampleItem = filteredInventory[0];
      console.log("Sample inventory item:", sampleItem);
      console.log("Supplier:", sampleItem.supplier_id ? suppliers[sampleItem.supplier_id]?.name : sampleItem.supplier);
      console.log("Manufacturer:", sampleItem.manufacturer_id ? manufacturers[sampleItem.manufacturer_id]?.name : sampleItem.manufacturer);
    }
  }, [filteredInventory, suppliers, manufacturers]);
  
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
  }

  const formatQuantity = (quantity: number) => {
    return quantity.toFixed(2);
  };

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
          <Button 
            variant="outline" 
            size={isMobile ? "sm" : "default"}
            onClick={() => setShowEmptyItems(!showEmptyItems)}
            className="flex items-center text-xs md:text-sm w-full md:w-auto"
          >
            {showEmptyItems ? <EyeOff className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" /> : <Eye className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />}
            {showEmptyItems ? "Ascunde fără stoc" : "Arată fără stoc"}
          </Button>
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
              <DropdownMenuItem onClick={() => {
                setGroupBySupplier(false);
                setGroupByProduct(false);
              }}>
                Fără grupare
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                setGroupByProduct(true);
                setGroupBySupplier(false);
              }}>
                Grupare după produs
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                setGroupBySupplier(true);
                setGroupByProduct(false);
              }}>
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
              <TableHead className="text-left">Data</TableHead>
              <TableHead className="text-left">Nr. Intrare</TableHead>
              <TableHead className="text-left">Produs</TableHead>
              <TableHead className="text-right">Cantitate</TableHead>
              <TableHead className="text-left">Unitate</TableHead>
              <TableHead className="text-left">Furnizor</TableHead>
              <TableHead className="text-left">Producător</TableHead>
              <TableHead className="text-left">Nr. Document</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayedInventory.length > 0 ? (
              displayedInventory.map((item) => {
                const productName = item.product_id ? products[item.product_id]?.name : item.name;
                const supplierName = item.supplier_id ? suppliers[item.supplier_id]?.name : item.supplier;
                const manufacturerName = item.manufacturer_id ? manufacturers[item.manufacturer_id]?.name : item.manufacturer;
                
                return (
                  <TableRow key={item.id} className={item.isHeader ? "bg-gray-100 font-medium" : ""}>
                    <TableCell>
                      {item.receipt_date 
                        ? format(new Date(item.receipt_date), 'dd.MM.yyyy')
                        : '-'}
                    </TableCell>
                    <TableCell>{item.entry_number || '-'}</TableCell>
                    <TableCell className={`${item.isHeader ? "font-bold" : "font-medium"} whitespace-nowrap`}>
                      {productName}
                    </TableCell>
                    <TableCell className="text-right">{formatQuantity(item.quantity)}</TableCell>
                    <TableCell className="text-left">{item.unit}</TableCell>
                    <TableCell>{supplierName || '-'}</TableCell>
                    <TableCell>{manufacturerName || '-'}</TableCell>
                    <TableCell>{item.document_number || '-'}</TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-6 text-gray-500">
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
