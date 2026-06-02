import React, { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Filter, Eye, EyeOff } from "lucide-react";
import { InventoryItem, Supplier, Product, Manufacturer, CrateType } from "@/types";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { exportToExcel } from "@/lib/excelExport";
import { toast } from "@/hooks/use-custom-toast";

interface InventoryTableProps {
  inventory: InventoryItem[];
  showExportButton?: boolean;
  /**
   * Whether to show items with quantity = 0 by default.
   * Useful to keep "Stoc Curent" consistent with other stock views.
   */
  defaultShowEmptyItems?: boolean;
  suppliers?: Record<string, Supplier>;
  products?: Record<string, Product>;
  manufacturers?: Record<string, Manufacturer>;
  crateTypes?: Record<string, CrateType>;
}

const InventoryTable = ({ 
  inventory, 
  showExportButton = false,
  defaultShowEmptyItems = false,
  suppliers: propsSuppliers = {},
  products: propsProducts = {},
  manufacturers: propsManufacturers = {},
  crateTypes: propsCrateTypes = {}
}: InventoryTableProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [groupBySupplier, setGroupBySupplier] = useState(false);
  const [groupByProduct, setGroupByProduct] = useState(false);
  const [showEmptyItems, setShowEmptyItems] = useState(defaultShowEmptyItems);
  const suppliers = propsSuppliers;
  const products = propsProducts;
  const manufacturers = propsManufacturers;
  const crateTypes = propsCrateTypes;
  const isMobile = useIsMobile();
  
  const handleExportExcel = () => {
    console.log('Export started - displayedInventory length:', displayedInventory.length);

    const dataForExport = displayedInventory.map(item => {
      // IMPORTANT: use item.name (the name stored in inventory table) to keep consistency
      // between "Stoc Live" and "Stoc Curent" (products table name can differ).
      const productName = item.name;
      const supplierName = item.supplier_id ? suppliers[item.supplier_id]?.name : item.supplier;
      const manufacturerName = item.manufacturer_id ? manufacturers[item.manufacturer_id]?.name : item.manufacturer;
      const productCode =
        item.products?.cod_produs ||
        (item.product_id ? products[item.product_id]?.cod_produs : undefined) ||
        "-";

      return {
        'Nr.': item.entry_number ?? '-',
        'Data': item.receipt_date ? format(new Date(item.receipt_date), 'dd.MM.yyyy') : '-',
        'Produs': productName || '-',
        'Cod': productCode,
        'Cantitate': Number(item.quantity ?? 0),
        'U.M.': item.unit || '-',
        'Furnizor': supplierName || '-',
        'Producător': manufacturerName || '-',
        'Lot': item.lot_number || '-',
        'Document': item.document_number || '-'
      };
    });

    console.log('Data prepared for export:', dataForExport.length, dataForExport.slice(0, 3));

    if (dataForExport.length === 0) {
      toast({
        title: 'Nu există date pentru export',
        description: 'Nu sunt produse disponibile pentru export.',
        variant: 'destructive'
      });
      return;
    }

    exportToExcel(dataForExport);
    toast({
      title: 'Export realizat',
      description: 'Fișierul Excel a fost generat și descărcat.'
    });
  };
  
  console.log("InventoryTable initialized with", inventory.length, "items");
  
  
  const nonEmptyInventory = showEmptyItems 
    ? inventory 
    : inventory.filter(item => item.quantity > 0);
    
  const filteredInventory = nonEmptyInventory.filter(item => {
    const supplierName = item.supplier_id ? suppliers[item.supplier_id]?.name : item.supplier;
    // IMPORTANT: use item.name (inventory table) - products table name can be different/missing.
    const productName = item.name;
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
      // IMPORTANT: group by inventory name so search/grouping matches the "Stoc Live" view.
      const productName = item.name;
      if (!productMap.has(productName)) {
        productMap.set(productName, []);
      }
      productMap.get(productName)!.push(item);
    });
    
    displayedInventory = Array.from(productMap).flatMap(([product, items]) => {
      const totalNetQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
      const headerItem: InventoryItem = {
        id: `product-${product}`,
        name: `Produs: ${product}`,
        quantity: totalNetQuantity,
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
      const totalNetQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
      const headerItem: InventoryItem = {
        id: `supplier-${supplier}`,
        name: `Furnizor: ${supplier}`,
        quantity: totalNetQuantity,
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

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="w-full overflow-x-auto">
      <div className="p-2 md:p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-2 print:hidden">
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
          <Button 
            variant="outline" 
            size={isMobile ? "sm" : "default"} 
            onClick={handlePrint}
            className="text-xs md:text-sm w-full md:w-auto"
          >
            Print
          </Button>
          {showExportButton && (
            <Button 
              variant="outline" 
              size={isMobile ? "sm" : "default"} 
              onClick={handleExportExcel}
              className="text-xs md:text-sm w-full md:w-auto"
            >
              Export Excel
            </Button>
          )}
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
      
      <div className="max-h-[70vh] overflow-auto print:max-h-none print:overflow-visible">
        <Table className="w-full text-[11px] print:text-xs table-fixed print:table-auto">
          <TableHeader className="sticky top-0 bg-white z-10 print:static">
            <TableRow className="print:break-inside-avoid">
              <TableHead className="w-8 px-1 text-left text-[11px] print:w-[6%] print:px-1 print:py-1 print:border print:border-gray-300">Nr.</TableHead>
              <TableHead className="w-14 px-1 text-left text-[11px] print:w-[8%] print:px-1 print:py-1 print:border print:border-gray-300">Data</TableHead>
              <TableHead className="w-40 px-1 text-left text-[11px] print:w-[18%] print:px-1 print:py-1 print:border print:border-gray-300">Produs</TableHead>
              <TableHead className="w-12 px-1 text-left text-[11px] print:w-[7%] print:px-1 print:py-1 print:border print:border-gray-300">Cod</TableHead>
              <TableHead className="w-14 px-1 text-right text-[11px] print:w-[7%] print:px-1 print:py-1 print:border print:border-gray-300">Cant.</TableHead>
              <TableHead className="w-10 px-1 text-left text-[11px] print:w-[5%] print:px-1 print:py-1 print:border print:border-gray-300">U.M.</TableHead>
              <TableHead className="w-24 px-1 text-left text-[11px] print:w-[13%] print:px-1 print:py-1 print:border print:border-gray-300">Furnizor</TableHead>
              <TableHead className="w-24 px-1 text-left text-[11px] print:w-[13%] print:px-1 print:py-1 print:border print:border-gray-300">Producător</TableHead>
              <TableHead className="w-14 px-1 text-left text-[11px] print:w-[7%] print:px-1 print:py-1 print:border print:border-gray-300">Lot</TableHead>
              <TableHead className="w-20 px-1 text-left text-[11px] print:w-[8%] print:px-1 print:py-1 print:border print:border-gray-300">Doc.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayedInventory.length > 0 ? (
              displayedInventory.map((item) => {
                // IMPORTANT: use item.name from inventory (canonical).
                const productName = item.name;
                const supplierName = item.supplier_id ? suppliers[item.supplier_id]?.name : item.supplier;
                const manufacturerName = item.manufacturer_id ? manufacturers[item.manufacturer_id]?.name : item.manufacturer;
                const productCode =
                  item.products?.cod_produs ||
                  (item.product_id ? products[item.product_id]?.cod_produs : undefined) ||
                  "-";
                const cellCls = "px-1 py-1.5 print:px-1 print:py-1 print:border print:border-gray-300 print:text-xs text-[11px] leading-tight whitespace-normal break-words";
                return (
                  <TableRow key={item.id} className={`print:break-inside-avoid ${item.isHeader ? "bg-gray-100 font-medium print:bg-gray-200" : ""}`}>
                    <TableCell className={cellCls}>{item.entry_number || '-'}</TableCell>
                    <TableCell className={cellCls}>
                      {item.receipt_date 
                        ? format(new Date(item.receipt_date), 'dd.MM.yyyy')
                        : '-'}
                    </TableCell>
                    <TableCell className={`${cellCls} ${item.isHeader ? "font-bold" : "font-medium"}`}>
                      {productName}
                    </TableCell>
                    <TableCell className={cellCls}>{productCode}</TableCell>
                    <TableCell className={`${cellCls} text-right`}>{formatQuantity(item.quantity)}</TableCell>
                    <TableCell className={cellCls}>{item.unit}</TableCell>
                    <TableCell className={cellCls}>{supplierName || '-'}</TableCell>
                    <TableCell className={cellCls}>{manufacturerName || '-'}</TableCell>
                    <TableCell className={cellCls}>{item.lot_number || '-'}</TableCell>
                    <TableCell className={cellCls}>{item.document_number || '-'}</TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-6 text-gray-500 print:py-2">
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
