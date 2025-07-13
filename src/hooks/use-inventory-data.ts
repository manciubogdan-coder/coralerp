
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
      
      if (inventoryType === 'ambalaje') {
        const { data, error } = await supabase
          .from("ambalaje_inventory")
          .select(`
            *,
            suppliers:supplier_id (name),
            products:product_id (name, cod_produs),
            manufacturers:manufacturer_id (name)
          `)
          .order("entry_number", { ascending: false });

        if (error) throw error;
        console.log("Ambalaje inventory data:", data);
        setInventory(data || []);
      } else {
        const { data, error } = await supabase
          .from("inventory")
          .select(`
            *,
            suppliers:supplier_id (name),
            products:product_id (name, cod_produs),
            manufacturers:manufacturer_id (name)
          `)
          .order("entry_number", { ascending: false });

        if (error) throw error;
        console.log("Materii prime inventory data:", data);
        setInventory(data || []);
      }
    } catch (error: any) {
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
