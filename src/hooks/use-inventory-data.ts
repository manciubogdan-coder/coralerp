
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { InventoryItem, Supplier, Product, Manufacturer, CrateType } from "@/types";
import { toast } from "@/hooks/use-custom-toast";

export const useInventoryData = () => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [crateTypes, setCrateTypes] = useState<CrateType[]>([]);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("inventory")
        .select(`
          *,
          suppliers:supplier_id (name),
          products:product_id (name),
          manufacturers:manufacturer_id (name),
          crate_types:crate_type_id (name, weight)
        `)
        .order("entry_number", { ascending: false });

      if (error) {
        throw error;
      }

      console.log("Inventory data:", data);
      setInventory(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Eroare la încărcarea inventarului",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchReferenceData = async () => {
    try {
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

      if (suppliersData) setSuppliers(suppliersData);
      if (productsData) setProducts(productsData);
      if (manufacturersData) setManufacturers(manufacturersData);
      if (crateTypesData) setCrateTypes(crateTypesData);
      
    } catch (error: any) {
      console.error("Error fetching reference data:", error);
    }
  };

  useEffect(() => {
    fetchInventory();
    fetchReferenceData();
  }, []);

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
