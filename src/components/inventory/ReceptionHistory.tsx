
import React, { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, FileSpreadsheet, Edit, Trash2, Printer, QrCode } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { exportToExcel } from "@/lib/excelExport";
import { toast } from "@/hooks/use-custom-toast";
import { useGroupedReceptions } from "@/hooks/use-grouped-receptions";
import { useInventoryType } from "@/context/inventory-type";
import { LotQRDialog } from "./LotQRDialog";

interface ReceptionItem {
  id: string;
  entry_number: number;
  receipt_date: string;
  name: string;
  quantity: number;
  unit: string;
  document_number: string;
  lot_number: string;
  supplier_id?: string;
  manufacturer_id?: string;
  product_id?: string;
  suppliers?: { name: string };
  manufacturers?: { name: string };
  products?: { name: string; cod_produs: string };
  // New optional fields for post-reception quality notes
  obs?: string | null;
  nonconform_percent?: number | null;
  consider_quantity?: number | null;
  net_quantity?: number | null;
  gross_quantity?: number | null;
}

type GroupingMode = 'none' | 'product' | 'supplier' | 'lot';

export const ReceptionHistory = () => {
  const { inventoryType } = useInventoryType();
  const [receptions, setReceptions] = useState<ReceptionItem[]>([]);
  const [filteredReceptions, setFilteredReceptions] = useState<ReceptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [groupBy, setGroupBy] = useState<GroupingMode>('none');
  const [editingItem, setEditingItem] = useState<ReceptionItem | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [qrLotId, setQrLotId] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [suppliersList, setSuppliersList] = useState<Array<{ id: string; name: string }>>([]);
  const [manufacturersList, setManufacturersList] = useState<Array<{ id: string; name: string }>>([]);
  const [productsList, setProductsList] = useState<Array<{ id: string; name: string; cod_produs?: string; unit?: string }>>([]);
  const [auditEntries, setAuditEntries] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    quantity: 0,
    unit: '',
    document_number: '',
    lot_number: '',
    receipt_date: '',
    obs: '',
    nonconform_percent: 0,
    supplier_id: '',
    manufacturer_id: '',
    product_id: '',
  });

  const groupedData = useGroupedReceptions(filteredReceptions, groupBy);

  const fetchReceptions = async () => {
    try {
      setLoading(true);
      // Use the correct reception table based on inventory type
      const tableName = inventoryType === 'ambalaje'
        ? 'ambalaje_reception_records'
        : inventoryType === 'etichete'
          ? 'etichete_reception_records'
          : 'reception_records';
      
      let query = (supabase as any)
        .from(tableName)
        .select(`
          id,
          entry_number,
          receipt_date,
          created_at,
          name,
          original_quantity,
          gross_quantity,
          net_quantity,
          unit,
          document_number,
          lot_number,
          obs,
          nonconform_percent,
          consider_quantity,
          supplier_id,
          manufacturer_id,
          product_id,
          suppliers:supplier_id (name),
          manufacturers:manufacturer_id (name),
          products:product_id (name, cod_produs)
        `)
        .not('receipt_date', 'is', null)
        .order("receipt_date", { ascending: false });

      // Set default date range if none provided (last 30 days)
      if (!dateFrom && !dateTo) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        query = query.gte('receipt_date', thirtyDaysAgo.toISOString().split('T')[0]);
      } else {
        if (dateFrom) {
          query = query.gte('receipt_date', dateFrom);
        }
        if (dateTo) {
          query = query.lte('receipt_date', dateTo + 'T23:59:59');
        }
      }

      // Bypass limita de 1000 rânduri din Supabase folosind .range() în buclă
      const pageSize = 1000;
      let offset = 0;
      let allRows: any[] = [];
      while (true) {
        const { data, error } = await (query.range(offset, offset + pageSize - 1) as any);
        if (error) throw error;
        const chunk = (data as any[]) || [];
        allRows = allRows.concat(chunk);
        if (chunk.length < pageSize) break;
        offset += pageSize;
      }

      console.log("Reception history total rows:", allRows.length);
      const receptionsData = allRows.map((item: any) => ({
        ...item,
        quantity: item.original_quantity
      }));
      setReceptions(receptionsData);
      setFilteredReceptions(receptionsData);
    } catch (error: any) {
      console.error("Error fetching reception history:", error);
      toast({
        variant: "destructive",
        title: "Eroare la încărcarea istoricului recepțiilor",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceptions();
  }, [dateFrom, dateTo, inventoryType]);

  useEffect(() => {
    const loadLists = async () => {
      const suppliersTable = inventoryType === 'ambalaje' ? 'ambalaje_suppliers'
        : inventoryType === 'etichete' ? 'etichete_suppliers' : 'suppliers';
      const manufacturersTable = inventoryType === 'ambalaje' ? 'ambalaje_manufacturers'
        : inventoryType === 'etichete' ? 'etichete_manufacturers' : 'manufacturers';
      const productsTable = inventoryType === 'ambalaje' ? 'ambalaje_products'
        : inventoryType === 'etichete' ? 'etichete_products' : 'products';
      try {
        const [s, m, p] = await Promise.all([
          (supabase as any).from(suppliersTable).select('id, name').order('name'),
          (supabase as any).from(manufacturersTable).select('id, name').order('name'),
          (supabase as any).from(productsTable).select('id, name, cod_produs, unit').order('name'),
        ]);
        setSuppliersList((s.data as any) || []);
        setManufacturersList((m.data as any) || []);
        setProductsList((p.data as any) || []);
      } catch (e) {
        console.error('Error loading lists:', e);
      }
    };
    loadLists();
  }, [inventoryType]);

  useEffect(() => {
    if (productFilter.trim() === "") {
      setFilteredReceptions(receptions);
    } else {
      const filtered = receptions.filter(item =>
        item.name.toLowerCase().includes(productFilter.toLowerCase()) ||
        (item.products?.cod_produs && item.products.cod_produs.toLowerCase().includes(productFilter.toLowerCase()))
      );
      setFilteredReceptions(filtered);
    }
  }, [productFilter, receptions]);

  const loadAuditEntries = async (receptionId: string) => {
    setAuditLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('reception_audit_log')
        .select('id, user_email, changes, created_at')
        .eq('reception_id', receptionId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAuditEntries(data || []);
    } catch (e) {
      console.error('Error loading audit log:', e);
      setAuditEntries([]);
    } finally {
      setAuditLoading(false);
    }
  };

  const handleEdit = (item: ReceptionItem) => {
    setEditingItem(item);
    setEditFormData({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      document_number: item.document_number || '',
      lot_number: item.lot_number || '',
      receipt_date: item.receipt_date ? item.receipt_date.split('T')[0] : '',
      obs: item.obs ?? '',
      nonconform_percent: item.nonconform_percent ?? 0,
      supplier_id: item.supplier_id || '',
      manufacturer_id: item.manufacturer_id || '',
      product_id: item.product_id || '',
    });
    setIsEditDialogOpen(true);
    loadAuditEntries(item.id);
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;

    try {
      // Update in reception records table (permanent record)
      const receptionTableName = inventoryType === 'ambalaje'
        ? 'ambalaje_reception_records'
        : inventoryType === 'etichete'
          ? 'etichete_reception_records'
          : 'reception_records';
      
      console.log('Updating reception with data:', {
        id: editingItem.id,
        receptionTableName,
        formData: editFormData
      });

      const updateData = {
        name: editFormData.name,
        original_quantity: editFormData.quantity,
        unit: editFormData.unit,
        document_number: editFormData.document_number || null,
        lot_number: editFormData.lot_number || null,
        receipt_date: editFormData.receipt_date ? new Date(editFormData.receipt_date + 'T00:00:00.000Z').toISOString() : null,
        obs: editFormData.obs || null,
        nonconform_percent: editFormData.nonconform_percent ?? 0,
        supplier_id: editFormData.supplier_id || null,
        manufacturer_id: editFormData.manufacturer_id || null,
        product_id: editFormData.product_id || null,
        updated_at: new Date().toISOString()
      };

      console.log('Update data to send:', updateData);
      
      const { data, error } = await (supabase as any)
        .from(receptionTableName)
        .update(updateData)
        .eq('id', editingItem.id)
        .select();

      console.log('Update result:', { data, error });

      if (error) throw error;

      // Actualizez și în tabelul de inventar curent (stocul curent)
      const inventoryTableName = inventoryType === 'ambalaje'
        ? 'ambalaje_inventory'
        : inventoryType === 'etichete'
          ? 'etichete_inventory'
          : 'inventory';
      
      const inventoryUpdateData = {
        name: editFormData.name,
        quantity: editFormData.quantity,
        unit: editFormData.unit,
        document_number: editFormData.document_number || null,
        lot_number: editFormData.lot_number || null,
        receipt_date: editFormData.receipt_date ? new Date(editFormData.receipt_date + 'T00:00:00.000Z').toISOString() : null,
        supplier_id: editFormData.supplier_id || null,
        manufacturer_id: editFormData.manufacturer_id || null,
        product_id: editFormData.product_id || null,
        updated_at: new Date().toISOString()
      };

      const { error: inventoryError } = await (supabase as any)
        .from(inventoryTableName)
        .update(inventoryUpdateData)
        .eq('entry_number', editingItem.entry_number);

      if (inventoryError) {
        console.warn("Could not update inventory (may not exist):", inventoryError);
      }

      // === Audit log: detect changes and persist ===
      try {
        const supplierName = (id: string) => suppliersList.find(s => s.id === id)?.name || '';
        const manufacturerName = (id: string) => manufacturersList.find(m => m.id === id)?.name || '';
        const productLabel = (id: string) => {
          const p = productsList.find(x => x.id === id);
          return p ? `${p.name}${p.cod_produs ? ` (${p.cod_produs})` : ''}` : '';
        };
        const oldDateIso = editingItem.receipt_date ? editingItem.receipt_date.split('T')[0] : '';
        const fields: Array<{ field: string; old: any; new: any }> = [
          { field: 'Nume produs', old: editingItem.name || '', new: editFormData.name || '' },
          { field: 'Cantitate', old: Number(editingItem.quantity ?? 0), new: Number(editFormData.quantity ?? 0) },
          { field: 'UM', old: editingItem.unit || '', new: editFormData.unit || '' },
          { field: 'Data recepție', old: oldDateIso, new: editFormData.receipt_date || '' },
          { field: 'Document', old: editingItem.document_number || '', new: editFormData.document_number || '' },
          { field: 'Lot', old: editingItem.lot_number || '', new: editFormData.lot_number || '' },
          { field: 'Observații', old: editingItem.obs || '', new: editFormData.obs || '' },
          { field: '% pierdere', old: Number(editingItem.nonconform_percent ?? 0), new: Number(editFormData.nonconform_percent ?? 0) },
          { field: 'Furnizor', old: editingItem.suppliers?.name || supplierName(editingItem.supplier_id || ''), new: supplierName(editFormData.supplier_id) },
          { field: 'Producător', old: editingItem.manufacturers?.name || manufacturerName(editingItem.manufacturer_id || ''), new: manufacturerName(editFormData.manufacturer_id) },
          { field: 'Produs nomenclator', old: editingItem.products ? `${editingItem.products.name}${editingItem.products.cod_produs ? ` (${editingItem.products.cod_produs})` : ''}` : productLabel(editingItem.product_id || ''), new: productLabel(editFormData.product_id) },
        ];
        const diffs = fields.filter(f => String(f.old ?? '') !== String(f.new ?? ''));
        if (diffs.length > 0) {
          const { data: authData } = await supabase.auth.getUser();
          const uid = authData?.user?.id || null;
          const email = authData?.user?.email || null;
          const { error: auditError } = await (supabase as any)
            .from('reception_audit_log')
            .insert({
              reception_id: editingItem.id,
              reception_table: receptionTableName,
              inventory_type: inventoryType,
              user_id: uid,
              user_email: email,
              changes: diffs,
            });
          if (auditError) console.warn('Audit log insert failed:', auditError);
        }
      } catch (auditEx) {
        console.warn('Audit log error:', auditEx);
      }

      toast({
        title: "Recepție actualizată",
        description: "Recepția și stocul au fost actualizate cu succes."
      });

      setIsEditDialogOpen(false);
      setEditingItem(null);
      
      
      // Reîncărcare completă pentru a reflecta modificările
      await fetchReceptions();
    } catch (error: any) {
      console.error("Error updating reception:", error);
      toast({
        variant: "destructive",
        title: "Eroare la actualizare",
        description: error.message
      });
    }
  };

  const handleDelete = async (item: ReceptionItem) => {
    if (!confirm('Sigur doriți să ștergeți această recepție?')) return;

    try {
      const receptionTableName = inventoryType === 'ambalaje'
        ? 'ambalaje_reception_records'
        : inventoryType === 'etichete'
          ? 'etichete_reception_records'
          : 'reception_records';
      const inventoryTableName = inventoryType === 'ambalaje'
        ? 'ambalaje_inventory'
        : inventoryType === 'etichete'
          ? 'etichete_inventory'
          : 'inventory';
      const historyTable = inventoryType === 'ambalaje'
        ? 'ambalaje_inventory_history'
        : inventoryType === 'etichete'
          ? 'etichete_inventory_history'
          : 'inventory_history';
      
      // Găsește înregistrarea din stocul curent bazată pe entry_number
      const { data: currentStockItem, error: stockFindError } = await supabase
        .from(inventoryTableName)
        .select('*')
        .eq('entry_number', item.entry_number)
        .single();

      if (stockFindError && stockFindError.code !== 'PGRST116') {
        console.error("Error finding stock item:", stockFindError);
      }

      // Șterge mai întâi toate intrările din istoric care fac referire la acest item
      if (currentStockItem) {
        const { error: historyDeleteError } = await supabase
          .from(historyTable)
          .delete()
          .eq('inventory_item_id', currentStockItem.id);

        if (historyDeleteError) {
          console.error("Error deleting history entries:", historyDeleteError);
        }
      }
      
      // Șterge din inventarul curent dacă există (bazat pe entry_number)
      if (currentStockItem) {
        const { error: inventoryError } = await supabase
          .from(inventoryTableName)
          .delete()
          .eq('entry_number', item.entry_number);

        if (inventoryError) {
          console.error("Error deleting from inventory:", inventoryError);
          throw inventoryError;
        }
      }

      // Șterge recepția din tabelul de recepții
      const { error: receptionError } = await supabase
        .from(receptionTableName)
        .delete()
        .eq('id', item.id);

      if (receptionError) throw receptionError;

      toast({
        title: "Recepție ștearsă",
        description: "Recepția și toate datele aferente au fost șterse cu succes."
      });

      fetchReceptions();
    } catch (error: any) {
      console.error("Error deleting reception:", error);
      toast({
        variant: "destructive",
        title: "Eroare la ștergere",
        description: error.message
      });
    }
  };

  const handleExport = () => {
    const dataToExport = filteredReceptions.map(item => ({
      'Nr. Intrare': item.entry_number,
      'Data Recepție': item.receipt_date ? new Date(item.receipt_date).toLocaleDateString('ro-RO') : '',
      'Produs': item.name,
      'Cod Produs': item.products?.cod_produs || '',
      'Nr Lot': item.lot_number || '',
      'Cantitate': item.quantity.toFixed(2),
      'Unitate': item.unit,
      'Document': item.document_number || '',
      'Furnizor': item.suppliers?.name || '',
      'Producător': item.manufacturers?.name || '',
      'Observații': (item as any).obs || '',
      '% Pierdere': `${((item as any).nonconform_percent ?? 0).toFixed(1)}%`,
      'Cant. de luat în considerare': (typeof (item as any).consider_quantity === 'number'
        ? (item as any).consider_quantity
        : (((item as any).net_quantity ?? (item as any).quantity) * (1 - (((item as any).nonconform_percent ?? 0) / 100)))).toFixed(2)
    }));
    
    const filename = `istoric_receptii_${dateFrom || 'toate'}_${dateTo || 'toate'}.xlsx`;
    exportToExcel(dataToExport, filename);
    
    toast({
      title: "Export realizat",
      description: "Istoricul recepțiilor a fost exportat cu succes."
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleOpenQR = async (item: ReceptionItem) => {
    try {
      const inventoryTable = inventoryType === 'ambalaje'
        ? 'ambalaje_inventory'
        : inventoryType === 'etichete'
          ? 'etichete_inventory'
          : 'inventory';
      const { data, error } = await (supabase as any)
        .from(inventoryTable)
        .select('id')
        .eq('entry_number', item.entry_number)
        .maybeSingle();
      if (error) throw error;
      if (!data?.id) {
        toast({
          title: 'Lot indisponibil',
          description: 'Lotul a fost șters din stocul curent — nu pot regenera QR-ul.',
          variant: 'destructive',
        });
        return;
      }
      setQrLotId(data.id);
      setQrOpen(true);
    } catch (e: any) {
      toast({ title: 'Eroare', description: e.message, variant: 'destructive' });
    }
  };

  // Calculate pagination
  const totalPages = Math.ceil(groupedData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = groupedData.slice(startIndex, endIndex);

  if (loading) {
    return <div className="p-4 text-center">Se încarcă istoricul recepțiilor...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="text-sm font-medium">Filtrare pe dată:</span>
          </div>
          <div className="flex gap-2">
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              placeholder="De la"
              className="w-auto h-9 text-sm"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              placeholder="Până la"
              className="w-auto h-9 text-sm"
            />
          </div>
          <Input
            type="text"
            placeholder="Filtrează după produs..."
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="w-auto min-w-[200px] h-9 text-sm"
          />
        </div>
        
        <div className="flex gap-2">
          <Button onClick={handlePrint} variant="outline">
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button onClick={handleExport} disabled={filteredReceptions.length === 0}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
        </div>
      </div>

      <div className="mb-4 flex gap-2 flex-wrap">
        <Button
          variant={groupBy === 'none' ? 'default' : 'outline'}
          onClick={() => setGroupBy('none')}
        >
          Fără grupare
        </Button>
        <Button
          variant={groupBy === 'product' ? 'default' : 'outline'}
          onClick={() => setGroupBy('product')}
        >
          Grupare după produs
        </Button>
        <Button
          variant={groupBy === 'supplier' ? 'default' : 'outline'}
          onClick={() => setGroupBy('supplier')}
        >
          Grupare după furnizor
        </Button>
        <Button
          variant={groupBy === 'lot' ? 'default' : 'outline'}
          onClick={() => setGroupBy('lot')}
        >
          Grupare după lot
        </Button>
      </div>

      <div className="border rounded-lg overflow-x-auto print:overflow-visible print:border-0">
        <Table className="text-xs print:text-[8px] table-fixed w-full min-w-fit print:min-w-full">
          <TableHeader>
            <TableRow className="print:break-inside-avoid">
              <TableHead className="w-12 px-2 py-3 print:table-cell print:w-auto print:text-[8px] print:border print:border-gray-300 print:px-1 print:py-1">Nr.</TableHead>
              <TableHead className="w-16 px-2 py-3 print:table-cell print:w-auto print:text-[8px] print:border print:border-gray-300 print:px-1 print:py-1">Data</TableHead>
              <TableHead className="w-24 px-2 py-3 max-w-24 print:table-cell print:w-auto print:text-[8px] print:border print:border-gray-300 print:px-1 print:py-1">Produs</TableHead>
              <TableHead className="w-12 px-2 py-3 hidden md:table-cell print:table-cell print:w-auto print:text-[8px] print:border print:border-gray-300 print:px-1 print:py-1">Cod</TableHead>
              <TableHead className="w-12 px-2 py-3 hidden lg:table-cell print:table-cell print:w-auto print:text-[8px] print:border print:border-gray-300 print:px-1 print:py-1">Lot</TableHead>
              <TableHead className="w-12 px-2 py-3 text-right print:table-cell print:w-auto print:text-[8px] print:border print:border-gray-300 print:px-1 print:py-1">Cant.</TableHead>
              <TableHead className="w-8 px-2 py-3 hidden md:table-cell print:table-cell print:w-auto print:text-[8px] print:border print:border-gray-300 print:px-1 print:py-1">U.M.</TableHead>
              <TableHead className="w-12 px-2 py-3 hidden lg:table-cell print:table-cell print:w-auto print:text-[8px] print:border print:border-gray-300 print:px-1 print:py-1">Doc.</TableHead>
              <TableHead className="w-16 px-2 py-3 hidden xl:table-cell print:table-cell print:w-auto print:text-[8px] print:border print:border-gray-300 print:px-1 print:py-1">Furnizor</TableHead>
              <TableHead className="w-16 px-2 py-3 hidden xl:table-cell print:table-cell print:w-auto print:text-[8px] print:border print:border-gray-300 print:px-1 print:py-1">Producător</TableHead>
              <TableHead className="w-16 px-2 py-3 hidden lg:table-cell print:table-cell print:w-auto print:text-[8px] print:border print:border-gray-300 print:px-1 print:py-1">Obs</TableHead>
              <TableHead className="w-10 px-2 py-3 text-right hidden md:table-cell print:table-cell print:w-auto print:text-[8px] print:border print:border-gray-300 print:px-1 print:py-1">%P</TableHead>
              <TableHead className="w-12 px-2 py-3 text-right print:table-cell print:w-auto print:text-[8px] print:border print:border-gray-300 print:px-1 print:py-1">C.Cons.</TableHead>
              <TableHead className="w-12 px-2 py-3 text-center print:hidden">Act.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length > 0 ? (
              paginatedData.map((item) => {
                const isGroupHeader = 'isGroupHeader' in item && item.isGroupHeader;
                const considerQty = isGroupHeader
                  ? null
                  : (typeof (item as any).consider_quantity === 'number'
                    ? (item as any).consider_quantity
                    : (((item as any).net_quantity ?? (item as any).quantity) * (1 - (((item as any).nonconform_percent ?? 0) / 100))));
                return (
                  <TableRow key={item.id} className={isGroupHeader ? "bg-muted font-semibold print:bg-gray-100" : "print:break-inside-avoid"}>
                    <TableCell className="px-2 py-3 font-medium text-xs print:table-cell print:text-[8px] print:border print:border-gray-300 print:px-1 print:py-1">
                      {isGroupHeader ? '' : item.entry_number}
                    </TableCell>
                    <TableCell className="px-2 py-3 text-xs print:table-cell print:text-[8px] print:border print:border-gray-300 print:px-1 print:py-1"
                      title={!isGroupHeader && (item as any).created_at ? `Înregistrat în sistem: ${new Date((item as any).created_at).toLocaleString('ro-RO')}` : undefined}
                    >
                      {isGroupHeader ? '' : (item.receipt_date ? new Date(item.receipt_date).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit' }) : '-')}
                      {!isGroupHeader && (item as any).created_at && item.receipt_date &&
                        new Date((item as any).created_at).toISOString().split('T')[0] !== new Date(item.receipt_date).toISOString().split('T')[0] && (
                          <span className="block text-[9px] text-amber-600 leading-none mt-0.5 print:text-[7px]">
                            (creat {new Date((item as any).created_at).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit' })} {new Date((item as any).created_at).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })})
                          </span>
                        )}
                    </TableCell>
                    <TableCell className="px-2 py-3 font-medium text-xs print:table-cell print:text-[8px] print:border print:border-gray-300 print:px-1 print:py-1" title={item.name}>{item.name}</TableCell>
                    <TableCell className="px-2 py-3 text-xs hidden md:table-cell print:table-cell print:text-[8px] print:border print:border-gray-300 print:px-1 print:py-1">{isGroupHeader ? '' : (item.products?.cod_produs || '-')}</TableCell>
                    <TableCell className="px-2 py-3 text-xs hidden lg:table-cell print:table-cell print:text-[8px] print:border print:border-gray-300 print:px-1 print:py-1">{isGroupHeader ? '' : (item.lot_number || '-')}</TableCell>
                    <TableCell className="px-2 py-3 text-right text-xs print:table-cell print:text-[8px] print:border print:border-gray-300 print:px-1 print:py-1">
                      {isGroupHeader ? '' : item.quantity.toFixed(2)}
                    </TableCell>
                    <TableCell className="px-2 py-3 text-xs hidden md:table-cell print:table-cell print:text-[8px] print:border print:border-gray-300 print:px-1 print:py-1">{isGroupHeader ? '' : item.unit}</TableCell>
                    <TableCell className="px-2 py-3 text-xs hidden lg:table-cell print:table-cell print:text-[8px] print:border print:border-gray-300 print:px-1 print:py-1">{isGroupHeader ? '' : (item.document_number || '-')}</TableCell>
                    <TableCell className="px-2 py-3 text-xs hidden xl:table-cell print:table-cell print:text-[8px] print:border print:border-gray-300 print:px-1 print:py-1">{isGroupHeader ? '' : (item.suppliers?.name || '-')}</TableCell>
                    <TableCell className="px-2 py-3 text-xs hidden xl:table-cell print:table-cell print:text-[8px] print:border print:border-gray-300 print:px-1 print:py-1">{isGroupHeader ? '' : (item.manufacturers?.name || '-')}</TableCell>
                    <TableCell className="px-2 py-3 text-xs hidden lg:table-cell print:table-cell print:text-[8px] print:border print:border-gray-300 print:px-1 print:py-1 whitespace-normal break-words min-h-[2.5rem]" title={(item as any).obs ?? '-'}>
                      <div className="max-w-[150px] whitespace-normal break-words">{(item as any).obs ?? '-'}</div>
                    </TableCell>
                    <TableCell className="px-2 py-3 text-right text-xs hidden md:table-cell print:table-cell print:text-[8px] print:border print:border-gray-300 print:px-1 print:py-1">{isGroupHeader ? '' : `${((item as any).nonconform_percent ?? 0).toFixed(1)}%`}</TableCell>
                    <TableCell className="px-2 py-3 text-right text-xs print:table-cell print:text-[8px] print:border print:border-gray-300 print:px-1 print:py-1">{isGroupHeader ? '' : (considerQty as number).toFixed(2)}</TableCell>
                    <TableCell className="px-2 py-3 text-center print:hidden">
                      {!isGroupHeader && (
                        <div className="flex gap-1 justify-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenQR(item)}
                            className="h-6 w-6 p-0"
                            title="Printează QR lot"
                          >
                            <QrCode className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(item)}
                            className="h-6 w-6 p-0"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(item)}
                            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={14} className="text-center py-6 text-gray-500">
                  Nu s-au găsit recepții în intervalul selectat.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between print:hidden">
          <div className="text-sm text-muted-foreground">
            Pagina {currentPage} din {totalPages} ({groupedData.length} înregistrări)
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              ← Anterior
            </Button>
            
            {/* Page numbers */}
            <div className="flex space-x-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else {
                  if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                }
                
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                    className="w-8 h-8 p-0"
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
            >
              Următor →
            </Button>
          </div>
        </div>
      )}

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="p-0 gap-0 flex flex-col w-screen h-[100dvh] max-w-full top-0 left-0 translate-x-0 translate-y-0 rounded-none border-0 sm:w-auto sm:max-w-lg sm:h-auto sm:max-h-[90vh] sm:top-[50%] sm:left-[50%] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:border">
          <DialogHeader className="px-4 py-3 border-b shrink-0">
            <DialogTitle>Editare Recepție</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-4 py-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="name">Nume Produs</Label>
                <Input
                  id="name"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
                  className="h-9 text-sm"
                />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="name">Nume Produs</Label>
                <Input
                  id="name"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
                  className="h-9 text-sm"
                />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label>Furnizor</Label>
                <Select
                  value={editFormData.supplier_id || 'none'}
                  onValueChange={(v) => setEditFormData({ ...editFormData, supplier_id: v === 'none' ? '' : v })}
                >
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selectează furnizor" /></SelectTrigger>
                  <SelectContent className="max-h-[300px] overflow-y-auto">
                    <SelectItem value="none">— fără —</SelectItem>
                    {suppliersList.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label>Producător</Label>
                <Select
                  value={editFormData.manufacturer_id || 'none'}
                  onValueChange={(v) => setEditFormData({ ...editFormData, manufacturer_id: v === 'none' ? '' : v })}
                >
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selectează producător" /></SelectTrigger>
                  <SelectContent className="max-h-[300px] overflow-y-auto">
                    <SelectItem value="none">— fără —</SelectItem>
                    {manufacturersList.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="quantity">Cantitate</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.01"
                  value={editFormData.quantity}
                  onChange={(e) => setEditFormData({...editFormData, quantity: parseFloat(e.target.value) || 0})}
                  className="h-9 text-sm"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="unit">Unitate</Label>
                <Input
                  id="unit"
                  value={editFormData.unit}
                  onChange={(e) => setEditFormData({...editFormData, unit: e.target.value})}
                  className="h-9 text-sm"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="receipt_date">Data Recepție</Label>
                <Input
                  id="receipt_date"
                  type="date"
                  value={editFormData.receipt_date}
                  onChange={(e) => setEditFormData({...editFormData, receipt_date: e.target.value})}
                  className="h-9 text-sm"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="document_number">Număr Document</Label>
                <Input
                  id="document_number"
                  value={editFormData.document_number}
                  onChange={(e) => setEditFormData({...editFormData, document_number: e.target.value})}
                  className="h-9 text-sm"
                />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="lot_number">Număr Lot</Label>
                <Input
                  id="lot_number"
                  value={editFormData.lot_number}
                  onChange={(e) => setEditFormData({...editFormData, lot_number: e.target.value})}
                  className="h-9 text-sm"
                />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="obs">Observații</Label>
                <Textarea
                  id="obs"
                  value={editFormData.obs}
                  onChange={(e) => setEditFormData({ ...editFormData, obs: e.target.value })}
                  className="text-sm min-h-[60px]"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="nonconform_percent">% pierdere</Label>
                <Input
                  id="nonconform_percent"
                  type="number"
                  step="0.1"
                  min={0}
                  max={100}
                  value={editFormData.nonconform_percent}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      nonconform_percent: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="h-9 text-sm"
                />
              </div>
              <div className="grid gap-2">
                <Label>Cant. luată în considerare</Label>
                <Input
                  readOnly
                  value={`${Math.max(0, ((editingItem?.net_quantity ?? editingItem?.gross_quantity ?? editFormData.quantity) * (1 - ((editFormData.nonconform_percent ?? 0) / 100)))).toFixed(2)}`}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            {/* Audit log section */}
            <div className="mt-6 pt-4 border-t">
              <h3 className="text-sm font-semibold mb-2">Istoric modificări</h3>
              {auditLoading ? (
                <p className="text-xs text-muted-foreground">Se încarcă...</p>
              ) : auditEntries.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nicio modificare înregistrată.</p>
              ) : (
                <div className="space-y-2">
                  {auditEntries.map((entry) => (
                    <div key={entry.id} className="text-xs border rounded p-2 bg-muted/30">
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <span className="font-medium">{entry.user_email || 'utilizator necunoscut'}</span>
                        <span className="text-muted-foreground whitespace-nowrap">
                          {new Date(entry.created_at).toLocaleString('ro-RO', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <ul className="space-y-0.5">
                        {(entry.changes as any[]).map((c, i) => (
                          <li key={i} className="text-[11px]">
                            <span className="font-medium">{c.field}:</span>{' '}
                            <span className="text-red-600 line-through">{String(c.old ?? '—')}</span>
                            {' → '}
                            <span className="text-green-700">{String(c.new ?? '—')}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 px-4 py-3 border-t shrink-0 bg-background">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Anulează
            </Button>
            <Button onClick={handleSaveEdit}>
              Salvează
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <LotQRDialog
        open={qrOpen}
        onOpenChange={setQrOpen}
        inventoryId={qrLotId}
        inventoryType={inventoryType}
      />
    </div>
  );
};
