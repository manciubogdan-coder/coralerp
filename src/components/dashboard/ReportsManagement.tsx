import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarIcon, FileSpreadsheet, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { exportToExcel } from "@/lib/excelExport";
import { toast } from "@/hooks/use-custom-toast";

interface ReportFilters {
  startDate: string;
  endDate: string;
  products: string[];
  suppliers: string[];
  actions: string[];
  reportType: string;
}

export const ReportsManagement = () => {
  const [filters, setFilters] = useState<ReportFilters>({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    products: [],
    suppliers: [],
    actions: [],
    reportType: 'inventory_history'
  });
  const [loading, setLoading] = useState(false);

  const reportTypes = [
    { value: 'inventory_history', label: 'Istoric Mișcări Stoc' },
    { value: 'current_inventory', label: 'Stoc Curent' },
    { value: 'consumption_analysis', label: 'Analiză Consum' },
    { value: 'daily_snapshots', label: 'Snapshot-uri Zilnice' },
    { value: 'transfers_summary', label: 'Sumar Transferuri' }
  ];

  const actionTypes = [
    { value: 'add', label: 'Intrări' },
    { value: 'remove', label: 'Ieșiri' }
  ];

  const generateReport = async () => {
    try {
      setLoading(true);
      let data: any[] = [];
      let filename = '';

      switch (filters.reportType) {
        case 'inventory_history':
          data = await generateInventoryHistoryReport();
          filename = `istoric_miscari_${filters.startDate}_${filters.endDate}.xlsx`;
          break;
        
        case 'current_inventory':
          data = await generateCurrentInventoryReport();
          filename = `stoc_curent_${new Date().toISOString().split('T')[0]}.xlsx`;
          break;
        
        case 'consumption_analysis':
          data = await generateConsumptionAnalysisReport();
          filename = `analiza_consum_${filters.startDate}_${filters.endDate}.xlsx`;
          break;
        
        case 'daily_snapshots':
          data = await generateDailySnapshotsReport();
          filename = `snapshots_zilnice_${filters.startDate}_${filters.endDate}.xlsx`;
          break;
        
        case 'transfers_summary':
          data = await generateTransfersSummaryReport();
          filename = `sumar_transferuri_${filters.startDate}_${filters.endDate}.xlsx`;
          break;
      }

      if (data.length === 0) {
        toast({
          variant: "destructive",
          title: "Niciun rezultat",
          description: "Nu s-au găsit date pentru criteriile selectate."
        });
        return;
      }

      exportToExcel(data, filename);
      
      toast({
        title: "Raport generat",
        description: `Raportul a fost generat cu succes. ${data.length} înregistrări exportate.`
      });

    } catch (error: any) {
      console.error('Error generating report:', error);
      toast({
        variant: "destructive",
        title: "Eroare la generarea raportului",
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const generateInventoryHistoryReport = async () => {
    let query = supabase
      .from('inventory_history')
      .select(`
        operation_date,
        action,
        name,
        lot_number,
        quantity,
        net_quantity,
        unit,
        notes,
        document_number,
        supplier
      `)
      .gte('operation_date', `${filters.startDate}T00:00:00`)
      .lte('operation_date', `${filters.endDate}T23:59:59`)
      .order('operation_date', { ascending: false });

    if (filters.actions.length > 0) {
      query = query.in('action', filters.actions);
    }

    const { data, error } = await query;
    if (error) throw error;

    return data?.map(item => ({
      'Data Operație': new Date(item.operation_date).toLocaleString('ro-RO'),
      'Acțiune': item.action === 'add' ? 'Intrare' : 'Ieșire',
      'Produs': item.name,
      'Lot': item.lot_number || 'Fără lot',
      'Cantitate Brută': item.quantity,
      'Cantitate Netă': item.net_quantity || item.quantity,
      'Unitate': item.unit,
      'Furnizor': item.supplier || '-',
      'Document': item.document_number || '-',
      'Observații': item.notes || '-'
    })) || [];
  };

  const generateCurrentInventoryReport = async () => {
    const { data, error } = await supabase
      .from('inventory')
      .select(`
        name,
        lot_number,
        quantity,
        net_quantity,
        gross_quantity,
        unit,
        receipt_date,
        document_number,
        entry_number,
        supplier,
        crate_count,
        crate_weight,
        products:product_id (name, cod_produs),
        suppliers:supplier_id (name),
        manufacturers:manufacturer_id (name)
      `)
      .order('name');

    if (error) throw error;

    return data?.map(item => ({
      'Produs': item.name,
      'Cod Produs': item.products?.cod_produs || '-',
      'Lot': item.lot_number || 'Fără lot',
      'Cantitate Brută': item.gross_quantity || item.quantity,
      'Cantitate Netă': item.net_quantity || item.quantity,
      'Unitate': item.unit,
      'Nr. Intrare': item.entry_number,
      'Data Recepție': item.receipt_date ? new Date(item.receipt_date).toLocaleDateString('ro-RO') : '-',
      'Furnizor': item.suppliers?.name || item.supplier || '-',
      'Producător': item.manufacturers?.name || '-',
      'Nr. Document': item.document_number || '-',
      'Nr. Lăzi': item.crate_count || 0,
      'Greutate Lăzi': item.crate_weight || 0
    })) || [];
  };

  const generateConsumptionAnalysisReport = async () => {
    const { data, error } = await supabase
      .from('inventory_history')
      .select('name, quantity, net_quantity, unit, operation_date')
      .eq('action', 'remove')
      .gte('operation_date', `${filters.startDate}T00:00:00`)
      .lte('operation_date', `${filters.endDate}T23:59:59`);

    if (error) throw error;

    // Group by product
    const productConsumption = new Map<string, { total: number; count: number; unit: string; dates: string[] }>();
    
    data?.forEach(item => {
      const quantity = item.net_quantity || item.quantity;
      const date = item.operation_date.split('T')[0];
      
      if (!productConsumption.has(item.name)) {
        productConsumption.set(item.name, { 
          total: 0, 
          count: 0, 
          unit: item.unit,
          dates: []
        });
      }
      
      const productData = productConsumption.get(item.name)!;
      productData.total += quantity;
      productData.count += 1;
      productData.dates.push(date);
    });

    return Array.from(productConsumption.entries()).map(([name, data]) => ({
      'Produs': name,
      'Cantitate Totală Consumată': data.total.toFixed(2),
      'Unitate': data.unit,
      'Nr. Operații': data.count,
      'Medie pe Operație': (data.total / data.count).toFixed(2),
      'Prima Dată': data.dates.sort()[0],
      'Ultima Dată': data.dates.sort().pop(),
      'Zile Active': new Set(data.dates).size
    }));
  };

  const generateDailySnapshotsReport = async () => {
    const { data, error } = await supabase
      .from('daily_stock_snapshots')
      .select('*')
      .gte('snapshot_date', filters.startDate)
      .lte('snapshot_date', filters.endDate)
      .order('snapshot_date', { ascending: false });

    if (error) throw error;

    return data?.map(item => ({
      'Data Snapshot': item.snapshot_date,
      'Produs': item.name,
      'Lot': item.lot_number || 'Fără lot',
      'Cantitate': item.quantity,
      'Cantitate Netă': item.net_quantity || item.quantity,
      'Unitate': item.unit,
      'Nr. Intrare': item.entry_number || '-',
      'Document': item.document_number || '-'
    })) || [];
  };

  const generateTransfersSummaryReport = async () => {
    const { data, error } = await supabase
      .from('inventory_history')
      .select('*')
      .like('notes', '%Transfer%')
      .gte('operation_date', `${filters.startDate}T00:00:00`)
      .lte('operation_date', `${filters.endDate}T23:59:59`)
      .order('operation_date', { ascending: false });

    if (error) throw error;

    return data?.map(item => ({
      'Data Transfer': new Date(item.operation_date).toLocaleString('ro-RO'),
      'Tip': item.action === 'add' ? 'Retur' : 'Transfer',
      'Produs': item.name,
      'Lot': item.lot_number || 'Fără lot',
      'Cantitate': item.net_quantity || item.quantity,
      'Unitate': item.unit,
      'Observații': item.notes || '-',
      'Furnizor': item.supplier || '-'
    })) || [];
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Generare Rapoarte Avansate
          </CardTitle>
          <CardDescription>
            Configurează și generează rapoarte personalizate pentru analiza stocului
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="reportType">Tip Raport</Label>
              <Select
                value={filters.reportType}
                onValueChange={(value) => setFilters(prev => ({ ...prev, reportType: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selectează tipul raportului" />
                </SelectTrigger>
                <SelectContent>
                  {reportTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate">Data Început</Label>
              <Input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">Data Sfârșit</Label>
              <Input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
              />
            </div>
          </div>

          {filters.reportType === 'inventory_history' && (
            <div className="space-y-4">
              <Label>Filtre Acțiuni</Label>
              <div className="flex gap-4">
                {actionTypes.map(action => (
                  <div key={action.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={action.value}
                      checked={filters.actions.includes(action.value)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFilters(prev => ({
                            ...prev,
                            actions: [...prev.actions, action.value]
                          }));
                        } else {
                          setFilters(prev => ({
                            ...prev,
                            actions: prev.actions.filter(a => a !== action.value)
                          }));
                        }
                      }}
                    />
                    <Label htmlFor={action.value}>{action.label}</Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button 
              onClick={generateReport}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              {loading ? 'Se generează...' : 'Generează Raport'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};