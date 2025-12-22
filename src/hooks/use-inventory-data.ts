
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { InventoryItem, Supplier, Product, Manufacturer, CrateType } from "@/types";
import { toast } from "@/hooks/use-custom-toast";
import { useInventoryType } from "@/App";

export const useInventoryData = () => {
  const { inventoryType } = useInventoryType();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [crateTypes, setCrateTypes] = useState<CrateType[]>([]);


  const fetchInventory = async () => {
    try {
      setLoading(true);
      // Prevent showing stale data when switching between Materii Prime / Ambalaje
      setInventory([]);
      console.log('[useInventoryData] fetchInventory inventoryType:', inventoryType);

      const pageSize = 1000;
      let allData: any[] = [];
      let offset = 0;
      let hasMore = true;

      if (inventoryType === 'ambalaje') {
        while (hasMore) {
          console.log(`Fetching ambalaje inventory data - offset ${offset}, inventoryType: ${inventoryType}`);
          const { data, error } = await supabase
            .from("ambalaje_inventory")
            .select(`
              *,
              suppliers:supplier_id (name),
              products:product_id (name, cod_produs),
              manufacturers:manufacturer_id (name)
            `)
            .order("entry_number", { ascending: false })
            .range(offset, offset + pageSize - 1);

          if (error) throw error;

          if (data && data.length > 0) {
            allData = [...allData, ...data];
            offset += pageSize;
            hasMore = data.length === pageSize;
          } else {
            hasMore = false;
          }
        }
      } else {
        while (hasMore) {
          const { data, error } = await supabase
            .from("inventory")
            .select(`
              *,
              suppliers:supplier_id (name),
              products:product_id (name, cod_produs),
              manufacturers:manufacturer_id (name)
            `)
            .order("entry_number", { ascending: false })
            .range(offset, offset + pageSize - 1);

          if (error) throw error;

          if (data && data.length > 0) {
            allData = [...allData, ...data];
            offset += pageSize;
            hasMore = data.length === pageSize;
          } else {
            hasMore = false;
          }
        }
      }
      
      console.log(`${inventoryType} inventory data (total: ${allData.length}):`, allData);
      const testProducts = allData.filter(item => item.name && item.name.toLowerCase().includes('test'));
      console.log(`Found ${testProducts.length} test products in inventory:`, testProducts);
      setInventory(allData || []);
    } catch (error: any) {
      // Clear inventory so we don't keep showing previous inventory type's data
      setInventory([]);
      toast({
        variant: "destructive",
        title: `Eroare la încărcarea inventarului ${inventoryType}`,
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchReferenceData = async () => {
    try {
      if (inventoryType === 'ambalaje') {
        const [
          { data: suppliersData }, 
          { data: productsData },
          { data: manufacturersData },
          { data: crateTypesData }
        ] = await Promise.all([
          supabase.from('ambalaje_suppliers').select('*').order('name'),
          supabase.from('ambalaje_products').select('*').order('name'),
          supabase.from('ambalaje_manufacturers').select('*').order('name'),
          supabase.from('ambalaje_crate_types').select('*').order('name')
        ]);

        if (suppliersData) setSuppliers(suppliersData as Supplier[]);
        if (productsData) setProducts(productsData as Product[]);
        if (manufacturersData) setManufacturers(manufacturersData as Manufacturer[]);
        if (crateTypesData) setCrateTypes(crateTypesData as CrateType[]);
      } else {
        const [
          { data: suppliersData }, 
          { data: productsData },
          { data: manufacturersData },
          { data: crateTypesData }
        ] = await Promise.all([
          supabase.from('suppliers').select('*').order('name'),
          supabase.from('products').select('*').order('name'),
          supabase.from('manufacturers').select('*').order('name'),
          supabase.from('crate_types').select('*').order('name')
        ]);

        if (suppliersData) setSuppliers(suppliersData as Supplier[]);
        if (productsData) setProducts(productsData as Product[]);
        if (manufacturersData) setManufacturers(manufacturersData as Manufacturer[]);
        if (crateTypesData) setCrateTypes(crateTypesData as CrateType[]);
      }
    } catch (error: any) {
      console.error(`Error fetching ${inventoryType} reference data:`, error);
    }
  };

  useEffect(() => {
    fetchInventory();
    fetchReferenceData();
  }, [inventoryType]); // Re-fetch when inventory type changes

  return {
    inventory,
    loading,
    suppliers,
    products,
    manufacturers,
    crateTypes,
    fetchInventory,
    fetchReferenceData
  };
};
