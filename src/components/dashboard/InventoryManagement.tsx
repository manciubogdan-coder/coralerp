import React, { useState, useEffect } from "react";
import { toast } from "@/hooks/use-custom-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ReceptionRegistration } from "@/components/inventory/ReceptionRegistration";
import { Pencil, Trash, Plus, Save, X, FileDown, Mail } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { exportToExcel } from "@/lib/excelExport";
import { sendEmail } from "@/lib/emailService";
import { useAggregatedStock } from "@/hooks/use-aggregated-stock";

interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  supplier?: string;
  supplier_id?: string;
  product_id?: string;
  manufacturer_id?: string;
  batch_number?: string | null;
  receipt_date?: string | null;
  crate_type_id?: string | null;
  crate_count?: number | null;
  gross_quantity?: number | null;
  crate_weight?: number | null;
  net_quantity?: number | null;
  document_number?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  entry_number?: number;
  suppliers?: { name: string };
  products?: { name: string };
  manufacturers?: { name: string };
  crate_types?: { name: string; weight: number };
}

interface Supplier {
  id: string;
  name: string;
  contact?: string;
  phone?: string;
  email?: string;
}

interface Product {
  id: string;
  name: string;
  default_unit: string;
}

interface Manufacturer {
  id: string;
  name: string;
}

interface CrateType {
  id: string;
  name: string;
  weight: number;
}

const InventoryManagement = () => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newItem, setNewItem] = useState<Partial<InventoryItem>>({
    name: "",
    quantity: 0,
    unit: "kg",
  });
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [crateTypes, setCrateTypes] = useState<CrateType[]>([]);
  const [activeTab, setActiveTab] = useState("all");
  const [nextEntryNumber, setNextEntryNumber] = useState<number>(1);
  const { aggregatedData, groupBy, setGroupBy } = useAggregatedStock(inventory);

  useEffect(() => {
    console.log("InventoryManagement mounted or refreshed");
    fetchInventory();
    fetchSuppliers();
    fetchProducts();
    fetchManufacturers();
    fetchCrateTypes();
    getNextEntryNumber();
  }, []);

  const getNextEntryNumber = async () => {
    try {
      const { data, error } = await supabase.rpc('get_next_inventory_entry');
      
      if (error) throw error;
      
      if (data) {
        setNextEntryNumber(data);
        console.log("Next entry number:", data);
      }
    } catch (error) {
      console.error("Error fetching next entry number:", error);
      const { data } = await supabase
        .from("inventory")
        .select("entry_number")
        .order("entry_number", { ascending: false })
        .limit(1);
      
      setNextEntryNumber(data && data.length > 0 ? (data[0].entry_number + 1) : 1);
    }
  };

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

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name, contact, phone, email")
        .order("name");

      if (error) {
        throw error;
      }

      console.log("Suppliers data:", data);
      setSuppliers(data || []);
    } catch (error: any) {
      console.error("Error fetching suppliers:", error);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, default_unit")
        .order("name");

      if (error) {
        throw error;
      }

      console.log("Products data:", data);
      setProducts(data || []);
    } catch (error: any) {
      console.error("Error fetching products:", error);
    }
  };

  const fetchManufacturers = async () => {
    try {
      const { data, error } = await supabase
        .from("manufacturers")
        .select("id, name")
        .order("name");

      if (error) {
        throw error;
      }

      console.log("Manufacturers data:", data);
      setManufacturers(data || []);
    } catch (error: any) {
      console.error("Error fetching manufacturers:", error);
    }
  };

  const fetchCrateTypes = async () => {
    try {
      const { data, error } = await supabase
        .from("crate_types")
        .select("id, name, weight")
        .order("name");

      if (error) {
        throw error;
      }

      console.log("Crate types data:", data);
      setCrateTypes(data || []);
    } catch (error: any) {
      console.error("Error fetching crate types:", error);
    }
  };

  const handleAddNew = () => {
    setIsAddingNew(true);
    setNewItem({ 
      name: "",
      quantity: 0,
      unit: "kg",
      receipt_date: new Date().toISOString(),
      entry_number: nextEntryNumber
    });
  };

  const handleCancelAdd = () => {
    setIsAddingNew(false);
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingId(item.id);
    setEditItem({ ...item });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditItem(null);
  };

  const calculateNetQuantity = (
    gross: number | undefined | null, 
    crateTypeId: string | undefined | null, 
    crateCount: number | undefined | null
  ) => {
    if (!gross || !crateTypeId || !crateCount || crateCount <= 0) {
      return gross || 0;
    }
    
    const crateType = crateTypes.find(ct => ct.id === crateTypeId);
    if (!crateType) return gross;
    
    const totalCrateWeight = crateType.weight * crateCount;
    return Math.max(0, gross - totalCrateWeight);
  };

  const handleSaveNew = async () => {
    try {
      console.log("Starting handleSaveNew with data:", newItem);
      
      if (!newItem.name) {
        toast({
          variant: "destructive",
          title: "Nume articol lipsă",
          description: "Vă rugăm să introduceți un nume pentru articol.",
        });
        return;
      }

      if (isNaN(Number(newItem.quantity)) || Number(newItem.quantity) < 0) {
        toast({
          variant: "destructive",
          title: "Cantitate invalidă",
          description: "Vă rugăm să introduceți o cantitate validă (număr pozitiv).",
        });
        return;
      }

      if (newItem.product_id) {
        const selectedProduct = products.find(p => p.id === newItem.product_id);
        if (selectedProduct) {
          newItem.name = selectedProduct.name;
          if (!newItem.unit) {
            newItem.unit = selectedProduct.default_unit;
          }
        }
      }

      const grossQuantity = Number(newItem.gross_quantity || newItem.quantity || 0);
      let netQuantity = grossQuantity;
      
      if (newItem.crate_type_id && newItem.crate_count && newItem.crate_count > 0) {
        const selectedCrateType = crateTypes.find(ct => ct.id === newItem.crate_type_id);
        if (selectedCrateType) {
          newItem.crate_weight = selectedCrateType.weight;
          const totalCrateWeight = selectedCrateType.weight * newItem.crate_count;
          netQuantity = Math.max(0, grossQuantity - totalCrateWeight);
        }
      }

      const receiptDate = newItem.receipt_date 
        ? new Date(newItem.receipt_date).toISOString() 
        : new Date().toISOString();

      console.log("Saving new item with data:", {
        name: newItem.name,
        quantity: netQuantity,
        gross_quantity: grossQuantity,
        net_quantity: netQuantity,
        unit: newItem.unit,
        supplier_id: newItem.supplier_id,
        product_id: newItem.product_id,
        manufacturer_id: newItem.manufacturer_id,
        batch_number: newItem.batch_number,
        document_number: newItem.document_number,
        crate_type_id: newItem.crate_type_id,
        crate_count: newItem.crate_count,
        crate_weight: newItem.crate_weight,
        receipt_date: receiptDate
      });

      const { data, error } = await supabase
        .from("inventory")
        .insert([
          {
            name: newItem.name,
            quantity: netQuantity,
            gross_quantity: grossQuantity,
            net_quantity: netQuantity,
            unit: newItem.unit,
            supplier_id: newItem.supplier_id || null,
            product_id: newItem.product_id || null,
            manufacturer_id: newItem.manufacturer_id || null,
            batch_number: newItem.batch_number || null,
            receipt_date: receiptDate,
            crate_type_id: newItem.crate_type_id || null,
            crate_count: newItem.crate_count || null,
            crate_weight: newItem.crate_weight || null,
            document_number: newItem.document_number || null
          },
        ])
        .select();

      if (error) {
        throw error;
      }

      toast({
        title: "Articol adăugat",
        description: `Articolul ${newItem.name} a fost adăugat cu succes în inventar.`,
      });

      setIsAddingNew(false);
      await getNextEntryNumber();
      fetchInventory();
    } catch (error: any) {
      console.error("Error saving new item:", error);
      toast({
        variant: "destructive",
        title: "Eroare la adăugarea articolului",
        description: error.message,
      });
    }
  };

  const handleSaveEdit = async () => {
    if (!editItem) return;
    
    try {
      console.log("Starting handleSaveEdit with data:", editItem);
      
      if (!editItem.name) {
        toast({
          variant: "destructive",
          title: "Nume articol lipsă",
          description: "Vă rugăm să introduceți un nume pentru articol.",
        });
        return;
      }

      if (isNaN(Number(editItem.quantity)) || Number(editItem.quantity) < 0) {
        toast({
          variant: "destructive",
          title: "Cantitate invalidă",
          description: "Vă rugăm să introduceți o cantitate validă (număr pozitiv).",
        });
        return;
      }

      if (editItem.product_id) {
        const selectedProduct = products.find(p => p.id === editItem.product_id);
        if (selectedProduct) {
          editItem.name = selectedProduct.name;
          if (!editItem.unit) {
            editItem.unit = selectedProduct.default_unit;
          }
        }
      }

      const grossQuantity = Number(editItem.gross_quantity || editItem.quantity || 0);
      let netQuantity = grossQuantity;
      
      if (editItem.crate_type_id && editItem.crate_count && editItem.crate_count > 0) {
        const selectedCrateType = crateTypes.find(ct => ct.id === editItem.crate_type_id);
        if (selectedCrateType) {
          editItem.crate_weight = selectedCrateType.weight;
          const totalCrateWeight = selectedCrateType.weight * editItem.crate_count;
          netQuantity = Math.max(0, grossQuantity - totalCrateWeight);
        }
      }

      const receiptDate = editItem.receipt_date 
        ? new Date(editItem.receipt_date).toISOString() 
        : null;

      console.log("Updating item with data:", {
        id: editItem.id,
        name: editItem.name,
        quantity: netQuantity,
        gross_quantity: grossQuantity,
        net_quantity: netQuantity,
        unit: editItem.unit,
        supplier_id: editItem.supplier_id,
        product_id: editItem.product_id,
        manufacturer_id: editItem.manufacturer_id,
        batch_number: editItem.batch_number,
        document_number: editItem.document_number,
        crate_type_id: editItem.crate_type_id,
        crate_count: editItem.crate_count,
        crate_weight: editItem.crate_weight,
        receipt_date: receiptDate
      });

      const { error } = await supabase
        .from("inventory")
        .update({
          name: editItem.name,
          quantity: netQuantity,
          gross_quantity: grossQuantity,
          net_quantity: netQuantity,
          unit: editItem.unit,
          supplier_id: editItem.supplier_id || null,
          product_id: editItem.product_id || null,
          manufacturer_id: editItem.manufacturer_id || null,
          batch_number: editItem.batch_number || null,
          receipt_date: receiptDate,
          crate_type_id: editItem.crate_type_id || null,
          crate_count: editItem.crate_count || null,
          crate_weight: editItem.crate_weight || null,
          document_number: editItem.document_number || null,
        })
        .eq("id", editItem.id);

      if (error) {
        throw error;
      }

      toast({
        title: "Articol actualizat",
        description: `Articolul ${editItem.name} a fost actualizat cu succes.`,
      });

      setEditingId(null);
      fetchInventory();
    } catch (error: any) {
      console.error("Error updating item:", error);
      toast({
        variant: "destructive",
        title: "Eroare la actualizarea articolului",
        description: error.message,
      });
    }
  };

  const handleDelete = async (itemId: string, itemName: string) => {
    if (window.confirm(`Sigur doriți să ștergeți articolul "${itemName}" din inventar?`)) {
      try {
        const { error } = await supabase
          .from("inventory")
          .delete()
          .eq("id", itemId);

        if (error) {
          throw error;
        }

        toast({
          title: "Articol șters",
          description: `Articolul ${itemName} a fost șters cu succes din inventar.`,
        });

        setInventory(inventory.filter((item) => item.id !== itemId));
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Eroare la ștergerea articolului",
          description: error.message,
        });
      }
    }
  };

  const handleExportExcel = () => {
    const dataForExport = inventory.map(item => ({
      ...item,
      receipt_date: item.receipt_date ? formatDate(item.receipt_date) : ''
    }));
    
    exportToExcel(dataForExport);
    toast({
      title: "Export realizat",
      description: "Fișierul Excel a fost generat și descărcat."
    });
  };

  const handleSendEmail = async () => {
    try {
      const dataForEmail = inventory.map(item => ({
        ...item,
        receipt_date: item.receipt_date ? formatDate(item.receipt_date) : ''
      }));
      
      await sendEmail(dataForEmail);
      toast({
        title: "Email trimis",
        description: "Raportul a fost trimis pe email."
      });
    } catch (error) {
      console.error("Error sending email:", error);
      toast({
        variant: "destructive",
        title: "Eroare",
        description: "Nu s-a putut trimite emailul."
      });
    }
  };

  const handleProductChange = (productId: string, targetState: any, setTargetState: any) => {
    const selectedProduct = products.find(p => p.id === productId);
    if (selectedProduct) {
      setTargetState({
        ...targetState,
        product_id: productId,
        name: selectedProduct.name,
        unit: selectedProduct.default_unit
      });
    } else {
      setTargetState({
        ...targetState,
        product_id: productId
      });
    }
  };

  const handleCrateTypeChange = (crateTypeId: string, targetState: any, setTargetState: any) => {
    const selectedCrateType = crateTypes.find(ct => ct.id === crateTypeId);
    
    if (selectedCrateType && targetState.crate_count && targetState.crate_count > 0) {
      const crateWeight = selectedCrateType.weight;
      const totalCrateWeight = crateWeight * targetState.crate_count;
      const grossQuantity = targetState.gross_quantity || targetState.quantity || 0;
      const netQuantity = Math.max(0, grossQuantity - totalCrateWeight);
      
      setTargetState({
        ...targetState,
        crate_type_id: crateTypeId,
        crate_weight: crateWeight,
        net_quantity: netQuantity,
        quantity: netQuantity // Actualizăm și cantitatea netă
      });
    } else {
      setTargetState({
        ...targetState,
        crate_type_id: crateTypeId,
        crate_weight: selectedCrateType?.weight || 0
      });
    }
  };

  const handleCrateCountChange = (crateCount: number, targetState: any, setTargetState: any) => {
    if (targetState.crate_type_id) {
      const selectedCrateType = crateTypes.find(ct => ct.id === targetState.crate_type_id);
      if (selectedCrateType) {
        const grossQuantity = targetState.gross_quantity || targetState.quantity || 0;
        const totalCrateWeight = selectedCrateType.weight * crateCount;
        const netQuantity = Math.max(0, grossQuantity - totalCrateWeight);
        
        setTargetState({
          ...targetState,
          crate_count: crateCount,
          net_quantity: netQuantity,
          quantity: netQuantity // Actualizăm și cantitatea netă
        });
      } else {
        setTargetState({
          ...targetState,
          crate_count: crateCount
        });
      }
    } else {
      setTargetState({
        ...targetState,
        crate_count: crateCount
      });
    }
  };

  const handleGrossQuantityChange = (grossQuantity: number, targetState: any, setTargetState: any) => {
    let netQuantity = grossQuantity;
    
    if (targetState.crate_type_id && targetState.crate_count && targetState.crate_count > 0) {
      const selectedCrateType = crateTypes.find(ct => ct.id === targetState.crate_type_id);
      if (selectedCrateType) {
        const totalCrateWeight = selectedCrateType.weight * targetState.crate_count;
        netQuantity = Math.max(0, grossQuantity - totalCrateWeight);
      }
    }
    
    setTargetState({
      ...targetState,
      gross_quantity: grossQuantity,
      quantity: netQuantity,
      net_quantity: netQuantity
    });
  };

  const formatDate = (dateValue: string | Date | null | undefined): string => {
    if (!dateValue) return "";
    try {
      if (dateValue instanceof Date) {
        return dateValue.toISOString().substring(0, 10);
      }
      return new Date(dateValue).toISOString().substring(0, 10);
    } catch (e) {
      return "";
    }
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Stoc Depozit</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            <FileDown className="h-4 w-4 mr-2" /> Export Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handleSendEmail}>
            <Mail className="h-4 w-4 mr-2" /> Trimite Email
          </Button>
          <ReceptionRegistration
            products={products}
            suppliers={suppliers}
            manufacturers={manufacturers}
            crateTypes={crateTypes}
            onRegistrationComplete={fetchInventory}
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
        <TabsList>
          <TabsTrigger value="all">Toate</TabsTrigger>
          <TabsTrigger value="today">Astăzi</TabsTrigger>
          <TabsTrigger value="week">Ultima săptămână</TabsTrigger>
          <TabsTrigger value="month">Ultima lună</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mb-4 flex gap-2">
        <Button
          variant={groupBy === 'product' ? 'default' : 'outline'}
          onClick={() => setGroupBy('product')}
        >
          Grupare după Produs
        </Button>
        <Button
          variant={groupBy === 'supplier' ? 'default' : 'outline'}
          onClick={() => setGroupBy('supplier')}
        >
          Grupare după Furnizor
        </Button>
        <Button
          variant={groupBy === 'manufacturer' ? 'default' : 'outline'}
          onClick={() => setGroupBy('manufacturer')}
        >
          Grupare după Producător
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produs</TableHead>
              <TableHead className="text-right">Cantitate Totală</TableHead>
              <TableHead className="text-right">Paleți</TableHead>
              <TableHead className="text-right">Lădițe</TableHead>
              <TableHead>Furnizor</TableHead>
              <TableHead>Producător</TableHead>
              <TableHead>Lot</TableHead>
              <TableHead>Data Recepție</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {aggregatedData.map((item) => (
              <TableRow 
                key={item.id}
                className={item.isHeader ? "bg-gray-50 font-medium" : ""}
              >
                <TableCell>{item.products?.name || item.name}</TableCell>
                <TableCell className="text-right">
                  {item.quantity} {item.unit}
                  {item.gross_quantity !== item.quantity && (
                    <div className="text-xs text-gray-500">
                      Brut: {item.gross_quantity} {item.unit}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right">{item.total_pallets || '-'}</TableCell>
                <TableCell className="text-right">{item.total_crates || '-'}</TableCell>
                <TableCell>{item.suppliers?.name || item.supplier || '-'}</TableCell>
                <TableCell>{item.manufacturers?.name || item.manufacturer || '-'}</TableCell>
                <TableCell>{item.batch_number || '-'}</TableCell>
                <TableCell>
                  {item.receipt_date ? new Date(item.receipt_date).toLocaleDateString('ro-RO') : '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default InventoryManagement;
