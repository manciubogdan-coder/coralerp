
import React, { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Calendar, FileSpreadsheet, Edit, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { exportToExcel } from "@/lib/excelExport";
import { toast } from "@/hooks/use-custom-toast";
import { useGroupedReceptions } from "@/hooks/use-grouped-receptions";
import { useInventoryType } from "@/App";

interface ReceptionItem {
  id: string;
  entry_number: number;
  receipt_date: string;
  name: string;
  quantity: number;
  gross_quantity: number;
  net_quantity: number;
  unit: string;
  document_number: string;
  lot_number: string;
  suppliers?: { name: string };
  manufacturers?: { name: string };
  crate_types?: { name: string; weight: number };
  products?: { name: string; cod_produs: string };
  crate_count: number;
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
  const [editFormData, setEditFormData] = useState({
    name: '',
    quantity: 0,
    gross_quantity: 0,
    net_quantity: 0,
    unit: '',
    document_number: '',
    lot_number: '',
    crate_count: 0,
    receipt_date: ''
  });

  const groupedData = useGroupedReceptions(filteredReceptions, groupBy);

  const fetchReceptions = async () => {
    try {
      setLoading(true);
      // Use the correct table based on inventory type
      const tableName = inventoryType === 'ambalaje' ? 'ambalaje_inventory' : 'inventory';
      
      let query = supabase
        .from(tableName)
        .select(`
          id,
          entry_number,
          receipt_date,
          name,
          quantity,
          gross_quantity,
          net_quantity,
          unit,
          document_number,
          lot_number,
          crate_count,
          suppliers:supplier_id (name),
          manufacturers:manufacturer_id (name),
          crate_types:crate_type_id (name, weight),
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

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      console.log("Reception history data:", data);
      const receptionsData = data || [];
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
  }, [dateFrom, dateTo]);

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

  const handleEdit = (item: ReceptionItem) => {
    setEditingItem(item);
    setEditFormData({
      name: item.name,
      quantity: item.quantity,
      gross_quantity: item.gross_quantity || item.quantity,
      net_quantity: item.net_quantity || item.quantity,
      unit: item.unit,
      document_number: item.document_number || '',
      lot_number: item.lot_number || '',
      crate_count: item.crate_count || 0,
      receipt_date: item.receipt_date ? item.receipt_date.split('T')[0] : ''
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;

    try {
      const tableName = inventoryType === 'ambalaje' ? 'ambalaje_inventory' : 'inventory';
      
      const { error } = await supabase
        .from(tableName)
        .update({
          name: editFormData.name,
          quantity: editFormData.quantity,
          gross_quantity: editFormData.gross_quantity,
          net_quantity: editFormData.net_quantity,
          unit: editFormData.unit,
          document_number: editFormData.document_number,
          lot_number: editFormData.lot_number,
          crate_count: editFormData.crate_count,
          receipt_date: editFormData.receipt_date ? new Date(editFormData.receipt_date).toISOString() : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingItem.id);

      if (error) throw error;

      toast({
        title: "Recepție actualizată",
        description: "Recepția a fost actualizată cu succes."
      });

      setIsEditDialogOpen(false);
      setEditingItem(null);
      fetchReceptions();
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
      const tableName = inventoryType === 'ambalaje' ? 'ambalaje_inventory' : 'inventory';
      
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', item.id);

      if (error) throw error;

      toast({
        title: "Recepție ștearsă",
        description: "Recepția a fost ștearsă cu succes."
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
      'Cantitate Netă': item.net_quantity?.toFixed(2) || item.quantity.toFixed(2),
      'Unitate': item.unit,
      'Document': item.document_number || '',
      'Furnizor': item.suppliers?.name || '',
      'Producător': item.manufacturers?.name || '',
      'Tip Lădiță': item.crate_types?.name || '',
      'Nr. Lădițe': item.crate_count || ''
    }));
    
    const filename = `istoric_receptii_${dateFrom || 'toate'}_${dateTo || 'toate'}.xlsx`;
    exportToExcel(dataToExport, filename);
    
    toast({
      title: "Export realizat",
      description: "Istoricul recepțiilor a fost exportat cu succes."
    });
  };

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
              className="w-auto"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              placeholder="Până la"
              className="w-auto"
            />
          </div>
          <Input
            type="text"
            placeholder="Filtrează după produs..."
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="w-auto min-w-[200px]"
          />
        </div>
        
        <Button onClick={handleExport} disabled={filteredReceptions.length === 0}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export Excel
        </Button>
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

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nr. Intrare</TableHead>
              <TableHead>Data Recepție</TableHead>
              <TableHead>Produs</TableHead>
              <TableHead>Cod Produs</TableHead>
              <TableHead>Nr Lot</TableHead>
              <TableHead className="text-right">Cantitate Netă</TableHead>
              <TableHead>Unitate</TableHead>
              <TableHead>Document</TableHead>
              <TableHead>Furnizor</TableHead>
              <TableHead>Producător</TableHead>
              <TableHead className="text-center">Acțiuni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groupedData.length > 0 ? (
              groupedData.map((item) => {
                const isGroupHeader = 'isGroupHeader' in item && item.isGroupHeader;
                return (
                  <TableRow key={item.id} className={isGroupHeader ? "bg-muted font-semibold" : ""}>
                    <TableCell className="font-medium">
                      {isGroupHeader ? '' : item.entry_number}
                    </TableCell>
                    <TableCell>
                      {isGroupHeader ? '' : (item.receipt_date ? new Date(item.receipt_date).toLocaleDateString('ro-RO') : '-')}
                    </TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{isGroupHeader ? '' : (item.products?.cod_produs || '-')}</TableCell>
                    <TableCell>{isGroupHeader ? '' : (item.lot_number || '-')}</TableCell>
                    <TableCell className="text-right">
                      {isGroupHeader ? '' : (item.net_quantity || item.quantity).toFixed(2)}
                    </TableCell>
                    <TableCell>{isGroupHeader ? '' : item.unit}</TableCell>
                    <TableCell>{isGroupHeader ? '' : (item.document_number || '-')}</TableCell>
                    <TableCell>{isGroupHeader ? '' : (item.suppliers?.name || '-')}</TableCell>
                    <TableCell>{isGroupHeader ? '' : (item.manufacturers?.name || '-')}</TableCell>
                    <TableCell className="text-center">
                      {!isGroupHeader && (
                        <div className="flex gap-2 justify-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(item)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(item)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-6 text-gray-500">
                  Nu s-au găsit recepții în intervalul selectat.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editare Recepție</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nume Produs</Label>
              <Input
                id="name"
                value={editFormData.name}
                onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-2">
                <Label htmlFor="quantity">Cantitate Brută</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.01"
                  value={editFormData.quantity}
                  onChange={(e) => setEditFormData({...editFormData, quantity: parseFloat(e.target.value) || 0})}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="net_quantity">Cantitate Netă</Label>
                <Input
                  id="net_quantity"
                  type="number"
                  step="0.01"
                  value={editFormData.net_quantity}
                  onChange={(e) => setEditFormData({...editFormData, net_quantity: parseFloat(e.target.value) || 0})}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="unit">Unitate</Label>
              <Input
                id="unit"
                value={editFormData.unit}
                onChange={(e) => setEditFormData({...editFormData, unit: e.target.value})}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="receipt_date">Data Recepție</Label>
              <Input
                id="receipt_date"
                type="date"
                value={editFormData.receipt_date}
                onChange={(e) => setEditFormData({...editFormData, receipt_date: e.target.value})}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="document_number">Număr Document</Label>
              <Input
                id="document_number"
                value={editFormData.document_number}
                onChange={(e) => setEditFormData({...editFormData, document_number: e.target.value})}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lot_number">Număr Lot</Label>
              <Input
                id="lot_number"
                value={editFormData.lot_number}
                onChange={(e) => setEditFormData({...editFormData, lot_number: e.target.value})}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="crate_count">Număr Lădițe</Label>
              <Input
                id="crate_count"
                type="number"
                value={editFormData.crate_count}
                onChange={(e) => setEditFormData({...editFormData, crate_count: parseInt(e.target.value) || 0})}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Anulează
            </Button>
            <Button onClick={handleSaveEdit}>
              Salvează
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
