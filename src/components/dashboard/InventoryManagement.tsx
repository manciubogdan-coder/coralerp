import React, { useState, useEffect } from "react";
import { toast } from "@/hooks/use-custom-toast";
import { Pencil, Trash, Plus, Save, X, FileDown, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { exportToExcel } from "@/lib/excelExport";
import { sendEmail } from "@/lib/emailService";

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
}

interface Supplier {
  id: string;
  name: string;
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

  useEffect(() => {
    fetchInventory();
    fetchSuppliers();
    fetchProducts();
    fetchManufacturers();
    fetchCrateTypes();
  }, []);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("inventory")
        .select("*")
        .order("name");

      if (error) {
        throw error;
      }

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
        .select("id, name")
        .order("name");

      if (error) {
        throw error;
      }

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
    if (!gross || !crateTypeId || !crateCount) {
      return gross || 0;
    }
    
    const crateType = crateTypes.find(ct => ct.id === crateTypeId);
    if (!crateType) return gross;
    
    const totalCrateWeight = crateType.weight * crateCount;
    return Math.max(0, gross - totalCrateWeight);
  };

  const handleSaveNew = async () => {
    try {
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

      let netQuantity = newItem.quantity;
      if (newItem.crate_type_id && newItem.crate_count && newItem.crate_count > 0) {
        netQuantity = calculateNetQuantity(
          newItem.quantity, 
          newItem.crate_type_id, 
          newItem.crate_count
        );
      }

      const receiptDate = newItem.receipt_date 
        ? new Date(newItem.receipt_date).toISOString() 
        : new Date().toISOString();

      const { data, error } = await supabase
        .from("inventory")
        .insert([
          {
            name: newItem.name,
            quantity: Number(newItem.quantity),
            unit: newItem.unit,
            supplier_id: newItem.supplier_id || null,
            product_id: newItem.product_id || null,
            manufacturer_id: newItem.manufacturer_id || null,
            batch_number: newItem.batch_number || null,
            receipt_date: receiptDate,
            crate_type_id: newItem.crate_type_id || null,
            crate_count: newItem.crate_count || null,
            gross_quantity: newItem.quantity,
            net_quantity: netQuantity,
            document_number: newItem.document_number || null,
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
      
      const newData = data as InventoryItem[];
      setInventory([...newData, ...inventory]);
      
      fetchInventory();
    } catch (error: any) {
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

      let netQuantity = editItem.quantity;
      if (editItem.crate_type_id && editItem.crate_count && editItem.crate_count > 0) {
        netQuantity = calculateNetQuantity(
          editItem.quantity, 
          editItem.crate_type_id, 
          editItem.crate_count
        );
      }

      const receiptDate = editItem.receipt_date 
        ? new Date(editItem.receipt_date).toISOString() 
        : null;

      const { error } = await supabase
        .from("inventory")
        .update({
          name: editItem.name,
          quantity: Number(editItem.quantity),
          unit: editItem.unit,
          supplier_id: editItem.supplier_id || null,
          product_id: editItem.product_id || null,
          manufacturer_id: editItem.manufacturer_id || null,
          batch_number: editItem.batch_number || null,
          receipt_date: receiptDate,
          crate_type_id: editItem.crate_type_id || null,
          crate_count: editItem.crate_count || null,
          gross_quantity: editItem.quantity,
          net_quantity: netQuantity,
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
    
    if (selectedCrateType && targetState.crate_count && targetState.quantity) {
      const crateWeight = selectedCrateType.weight;
      const totalCrateWeight = crateWeight * targetState.crate_count;
      const netQuantity = Math.max(0, targetState.quantity - totalCrateWeight);
      
      setTargetState({
        ...targetState,
        crate_type_id: crateTypeId,
        crate_weight: crateWeight,
        net_quantity: netQuantity
      });
    } else {
      setTargetState({
        ...targetState,
        crate_type_id: crateTypeId,
        crate_weight: selectedCrateType?.weight || 0
      });
    }
  };

  const filteredInventory = activeTab === "all" 
    ? inventory 
    : inventory.filter(item => {
        const today = new Date();
        const itemDate = item.receipt_date ? new Date(item.receipt_date) : null;
        
        if (!itemDate) return false;
        
        if (activeTab === "today") {
          return itemDate.toDateString() === today.toDateString();
        } else if (activeTab === "week") {
          const weekAgo = new Date();
          weekAgo.setDate(today.getDate() - 7);
          return itemDate >= weekAgo;
        } else if (activeTab === "month") {
          const monthAgo = new Date();
          monthAgo.setMonth(today.getMonth() - 1);
          return itemDate >= monthAgo;
        }
        
        return true;
      });

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
        <h2 className="text-xl font-semibold">Inventar</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            <FileDown className="h-4 w-4 mr-2" /> Export Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handleSendEmail}>
            <Mail className="h-4 w-4 mr-2" /> Trimite Email
          </Button>
          <Button onClick={handleAddNew} disabled={isAddingNew}>
            <Plus className="h-4 w-4 mr-2" /> Adaugă în inventar
          </Button>
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

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nume</TableHead>
            <TableHead>Cantitate</TableHead>
            <TableHead className="hidden md:table-cell">Furnizor</TableHead>
            <TableHead className="hidden md:table-cell">Lot</TableHead>
            <TableHead className="hidden md:table-cell">Data recepție</TableHead>
            <TableHead className="w-[150px]">Acțiuni</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isAddingNew && (
            <TableRow>
              <TableCell>
                <div className="space-y-2">
                  <Label>Produs</Label>
                  <Select 
                    onValueChange={(value) => handleProductChange(value, newItem, setNewItem)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selectează produs" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map(product => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {!newItem.product_id && (
                    <Input
                      value={newItem.name || ""}
                      onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                      placeholder="Nume produs"
                      className="mt-2"
                    />
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-2">
                  <Label>Cantitate</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={newItem.quantity?.toString() || ""}
                      onChange={(e) => setNewItem({ ...newItem, quantity: parseFloat(e.target.value) || 0 })}
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Cantitate"
                      className="w-24"
                    />
                    <Select 
                      value={newItem.unit || "kg"} 
                      onValueChange={(value) => setNewItem({ ...newItem, unit: value })}
                      disabled={!!newItem.product_id}
                    >
                      <SelectTrigger className="w-20">
                        <SelectValue placeholder="Unitate" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kg">kg</SelectItem>
                        <SelectItem value="buc">buc</SelectItem>
                        <SelectItem value="l">l</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="mt-2">
                    <Label>Lădițe</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        value={newItem.crate_count?.toString() || ""}
                        onChange={(e) => setNewItem({ ...newItem, crate_count: parseInt(e.target.value) || 0 })}
                        type="number"
                        min="0"
                        placeholder="Nr. lădițe"
                        className="w-24"
                      />
                      <Select 
                        onValueChange={(value) => handleCrateTypeChange(value, newItem, setNewItem)}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Tip lădiță" />
                        </SelectTrigger>
                        <SelectContent>
                          {crateTypes.map(crateType => (
                            <SelectItem key={crateType.id} value={crateType.id}>
                              {crateType.name} ({crateType.weight} kg)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <Label>Furnizor</Label>
                <Select 
                  onValueChange={(value) => setNewItem({ ...newItem, supplier_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selectează furnizor" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map(supplier => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Label className="mt-2 block">Producător</Label>
                <Select 
                  onValueChange={(value) => setNewItem({ ...newItem, manufacturer_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selectează producător" />
                  </SelectTrigger>
                  <SelectContent>
                    {manufacturers.map(manufacturer => (
                      <SelectItem key={manufacturer.id} value={manufacturer.id}>
                        {manufacturer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <Label>Lot</Label>
                <Input
                  value={newItem.batch_number || ""}
                  onChange={(e) => setNewItem({ ...newItem, batch_number: e.target.value })}
                  placeholder="Număr lot"
                />
                
                <Label className="mt-2 block">Document</Label>
                <Input
                  value={newItem.document_number || ""}
                  onChange={(e) => setNewItem({ ...newItem, document_number: e.target.value })}
                  placeholder="Număr document"
                />
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <Label>Data recepție</Label>
                <Input
                  type="date"
                  value={formatDate(newItem.receipt_date)}
                  onChange={(e) => setNewItem({ ...newItem, receipt_date: e.target.value ? new Date(e.target.value).toISOString() : null })}
                />
              </TableCell>
              <TableCell>
                <div className="flex space-x-2">
                  <Button size="sm" onClick={handleSaveNew}>
                    <Save className="h-4 w-4 mr-1" /> Salvează
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleCancelAdd}>
                    <X className="h-4 w-4 mr-1" /> Anulează
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          )}

          {filteredInventory.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                {editingId === item.id ? (
                  <div className="space-y-2">
                    <Label>Produs</Label>
                    <Select 
                      value={editItem?.product_id || ""}
                      onValueChange={(value) => handleProductChange(value, editItem, setEditItem)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selectează produs" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map(product => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {!editItem?.product_id && (
                      <Input
                        value={editItem?.name || ""}
                        onChange={(e) => setEditItem({ ...editItem!, name: e.target.value })}
                        placeholder="Nume produs"
                        className="mt-2"
                      />
                    )}
                  </div>
                ) : (
                  item.name
                )}
              </TableCell>
              <TableCell>
                {editingId === item.id ? (
                  <div className="space-y-2">
                    <Label>Cantitate</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={editItem?.quantity?.toString() || ""}
                        onChange={(e) => setEditItem({ ...editItem!, quantity: parseFloat(e.target.value) || 0 })}
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-24"
                      />
                      <Select 
                        value={editItem?.unit || "kg"} 
                        onValueChange={(value) => setEditItem({ ...editItem!, unit: value })}
                        disabled={!!editItem?.product_id}
                      >
                        <SelectTrigger className="w-20">
                          <SelectValue placeholder="Unitate" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="kg">kg</SelectItem>
                          <SelectItem value="buc">buc</SelectItem>
                          <SelectItem value="l">l</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="mt-2">
                      <Label>Lădițe</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          value={editItem?.crate_count?.toString() || ""}
                          onChange={(e) => setEditItem({ ...editItem!, crate_count: parseInt(e.target.value) || 0 })}
                          type="number"
                          min="0"
                          placeholder="Nr. lădițe"
                          className="w-24"
                        />
                        <Select 
                          value={editItem?.crate_type_id || ""}
                          onValueChange={(value) => handleCrateTypeChange(value, editItem, setEditItem)}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Tip lădiță" />
                          </SelectTrigger>
                          <SelectContent>
                            {crateTypes.map(crateType => (
                              <SelectItem key={crateType.id} value={crateType.id}>
                                {crateType.name} ({crateType.weight} kg)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {item.quantity} {item.unit}
                    {item.crate_count && item.crate_count > 0 && (
                      <div className="text-xs text-gray-500">
                        {item.crate_count} lădițe, net: {item.net_quantity} {item.unit}
                      </div>
                    )}
                  </>
                )}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                {editingId === item.id ? (
                  <div className="space-y-2">
                    <Label>Furnizor</Label>
                    <Select 
                      value={editItem?.supplier_id || ""}
                      onValueChange={(value) => setEditItem({ ...editItem!, supplier_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selectează furnizor" />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers.map(supplier => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Label className="mt-2 block">Producător</Label>
                    <Select 
                      value={editItem?.manufacturer_id || ""}
                      onValueChange={(value) => setEditItem({ ...editItem!, manufacturer_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selectează producător" />
                      </SelectTrigger>
                      <SelectContent>
                        {manufacturers.map(manufacturer => (
                          <SelectItem key={manufacturer.id} value={manufacturer.id}>
                            {manufacturer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div>
                    {suppliers.find(s => s.id === item.supplier_id)?.name || item.supplier || "-"}
                    {item.manufacturer_id && (
                      <div className="text-xs text-gray-500">
                        Prod: {manufacturers.find(m => m.id === item.manufacturer_id)?.name || "-"}
                      </div>
                    )}
                  </div>
                )}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                {editingId === item.id ? (
                  <div className="space-y-2">
                    <Label>Lot</Label>
                    <Input
                      value={editItem?.batch_number || ""}
                      onChange={(e) => setEditItem({ ...editItem!, batch_number: e.target.value })}
                      placeholder="Număr lot"
                    />
                    
                    <Label className="mt-2 block">Document</Label>
                    <Input
                      value={editItem?.document_number || ""}
                      onChange={(e) => setEditItem({ ...editItem!, document_number: e.target.value })}
                      placeholder="Număr document"
                    />
                  </div>
                ) : (
                  <>
                    {item.batch_number || "-"}
                    {item.document_number && (
                      <div className="text-xs text-gray-500">
                        Doc: {item.document_number}
                      </div>
                    )}
                  </>
                )}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                {editingId === item.id ? (
                  <div>
                    <Label>Data recepție</Label>
                    <Input
                      type="date"
                      value={formatDate(editItem?.receipt_date)}
                      onChange={(e) => setEditItem({ 
                        ...editItem!, 
                        receipt_date: e.target.value ? new Date(e.target.value).toISOString() : null
                      })}
                    />
                  </div>
                ) : (
                  item.receipt_date ? new Date(item.receipt_date).toLocaleDateString() : "-"
                )}
              </TableCell>
              <TableCell>
                {editingId === item.id ? (
                  <div className="flex space-x-2">
                    <Button size="sm" onClick={handleSaveEdit}>
                      <Save className="h-4 w-4 mr-1" /> Salvează
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                      <X className="h-4 w-4 mr-1" /> Anulează
                    </Button>
                  </div>
                ) : (
                  <div className="flex space-x-2">
                    <Button size="sm" variant="outline" onClick={() => handleEdit(item)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => handleDelete(item.id, item.name)}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}

          {filteredInventory.length === 0 && !isAddingNew && !loading && (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                Nu există articole în inventar. Adăugați unul nou folosind butonul de mai sus.
              </TableCell>
            </TableRow>
          )}

          {loading && (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                Se încarcă inventarul...
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default InventoryManagement;
