import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarIcon, FileSpreadsheet, Download, BarChart3, TrendingUp, Users, PieChart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { exportToExcel } from "@/lib/excelExport";
import { toast } from "@/hooks/use-custom-toast";
import { useInventoryType } from "@/context/inventory-type";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart as RechartsPieChart,
  Pie,
  Cell
} from "recharts";

interface ReportFilters {
  startDate: string;
  endDate: string;
  products: string[];
  suppliers: string[];
  actions: string[];
  reportType: string;
}

interface ChartFilters {
  dailyConsumption: { days: number; };
  topProducts: { limit: number; };
  dailyActivity: { days: number; };
  supplierDistribution: { limit: number; };
}

interface ChartData {
  dailyConsumption: Array<{ date: string; cantitate: number; operatii: number; }>;
  topProducts: Array<{ produs: string; cantitate: number; operatii: number; }>;
  dailyActivity: Array<{ date: string; intrari: number; iesiri: number; }>;
  supplierDistribution: Array<{ furnizor: string; cantitate: number; procent: number; }>;
}

export const ReportsManagement = () => {
  const { inventoryType } = useInventoryType();
  const [filters, setFilters] = useState<ReportFilters>({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    products: [],
    suppliers: [],
    actions: [],
    reportType: 'inventory_history'
  });
  const [loading, setLoading] = useState(false);
  const [chartData, setChartData] = useState<ChartData>({
    dailyConsumption: [],
    topProducts: [],
    dailyActivity: [],
    supplierDistribution: []
  });
  
  const [chartFilters, setChartFilters] = useState<ChartFilters>({
    dailyConsumption: { days: 14 },
    topProducts: { limit: 8 },
    dailyActivity: { days: 10 },
    supplierDistribution: { limit: 6 }
  });

  // Culori pentru grafice
  const CHART_COLORS = [
    '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', 
    '#ef4444', '#ec4899', '#84cc16', '#6366f1'
  ];

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
    const historyTable = inventoryType === 'ambalaje' ? 'ambalaje_inventory_history' : 'inventory_history';
    
    // Fetch all data with pagination to avoid 1000 record limit
    let allData: any[] = [];
    let from = 0;
    const pageSize = 1000;

    while (true) {
      let query = supabase
        .from(historyTable)
        .select(`
          operation_date,
          action,
          name,
          lot_number,
          quantity,
          unit,
          notes,
          document_number,
          supplier
        `)
        .gte('operation_date', `${filters.startDate}T00:00:00`)
        .lte('operation_date', `${filters.endDate}T23:59:59`)
        .order('operation_date', { ascending: false })
        .range(from, from + pageSize - 1);

      if (filters.actions.length > 0) {
        query = query.in('action', filters.actions);
      }

      const { data: pageData, error } = await query;
      if (error) throw error;
      if (!pageData || pageData.length === 0) break;
      
      allData = [...allData, ...pageData];
      if (pageData.length < pageSize) break;
      from += pageSize;
    }

    return allData.map(item => ({
      'Data Operație': new Date(item.operation_date).toLocaleString('ro-RO'),
      'Acțiune': item.action === 'add' ? 'Intrare' : 'Ieșire',
      'Produs': item.name,
      'Lot': item.lot_number || 'Fără lot',
      'Cantitate': item.quantity,
      'Unitate': item.unit,
      'Furnizor': item.supplier || '-',
      'Document': item.document_number || '-',
      'Observații': item.notes || '-'
    })) || [];
  };

  const generateCurrentInventoryReport = async () => {
    const inventoryTable = inventoryType === 'ambalaje' ? 'ambalaje_inventory' : 'inventory';
    
    // Fetch all data with pagination
    let allData: any[] = [];
    let from = 0;
    const pageSize = 1000;

    while (true) {
      const { data: pageData, error } = await supabase
        .from(inventoryTable)
        .select(`
          name,
          lot_number,
          quantity,
          unit,
          receipt_date,
          document_number,
          entry_number,
          supplier,
          products:product_id (name, cod_produs),
          suppliers:supplier_id (name),
          manufacturers:manufacturer_id (name)
        `)
        .order('name')
        .range(from, from + pageSize - 1);

      if (error) throw error;
      if (!pageData || pageData.length === 0) break;
      
      allData = [...allData, ...pageData];
      if (pageData.length < pageSize) break;
      from += pageSize;
    }

    return allData.map(item => ({
      'Produs': item.name,
      'Cod Produs': item.products?.cod_produs || '-',
      'Lot': item.lot_number || 'Fără lot',
      'Cantitate': `${item.quantity.toFixed(2)} ${item.unit}`,
      'Unitate': item.unit,
      'Nr. Intrare': item.entry_number,
      'Data Recepție': item.receipt_date ? new Date(item.receipt_date).toLocaleDateString('ro-RO') : '-',
      'Furnizor': item.suppliers?.name || item.supplier || '-',
      'Producător': item.manufacturers?.name || '-',
      'Nr. Document': item.document_number || '-'
    })) || [];
  };

  const generateConsumptionAnalysisReport = async () => {
    const historyTable = inventoryType === 'ambalaje' ? 'ambalaje_inventory_history' : 'inventory_history';
    
    // Fetch all data with pagination
    let allData: any[] = [];
    let from = 0;
    const pageSize = 1000;

    while (true) {
      const { data: pageData, error } = await supabase
        .from(historyTable)
        .select('name, quantity, unit, operation_date')
        .eq('action', 'remove')
        .gte('operation_date', `${filters.startDate}T00:00:00`)
        .lte('operation_date', `${filters.endDate}T23:59:59`)
        .range(from, from + pageSize - 1);

      if (error) throw error;
      if (!pageData || pageData.length === 0) break;
      
      allData = [...allData, ...pageData];
      if (pageData.length < pageSize) break;
      from += pageSize;
    }

    // Group by product
    const productConsumption = new Map<string, { total: number; count: number; unit: string; dates: string[] }>();
    
    allData.forEach(item => {
      const quantity = item.quantity;
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
    const snapshotsTable = inventoryType === 'ambalaje' ? 'ambalaje_daily_stock_snapshots' : 'daily_stock_snapshots';
    
    // Fetch all data with pagination
    let allData: any[] = [];
    let from = 0;
    const pageSize = 1000;

    while (true) {
      const { data: pageData, error } = await supabase
        .from(snapshotsTable)
        .select('*')
        .gte('snapshot_date', filters.startDate)
        .lte('snapshot_date', filters.endDate)
        .order('snapshot_date', { ascending: false })
        .range(from, from + pageSize - 1);

      if (error) throw error;
      if (!pageData || pageData.length === 0) break;
      
      allData = [...allData, ...pageData];
      if (pageData.length < pageSize) break;
      from += pageSize;
    }

    return allData.map(item => ({
      'Data Snapshot': item.snapshot_date,
      'Produs': item.name,
      'Lot': item.lot_number || 'Fără lot',
      'Cantitate': item.quantity,
      'Unitate': item.unit,
      'Nr. Intrare': item.entry_number || '-',
      'Document': item.document_number || '-'
    })) || [];
  };

  const generateTransfersSummaryReport = async () => {
    const historyTable = inventoryType === 'ambalaje' ? 'ambalaje_inventory_history' : 'inventory_history';
    
    // Fetch all data with pagination
    let allData: any[] = [];
    let from = 0;
    const pageSize = 1000;

    while (true) {
      const { data: pageData, error } = await supabase
        .from(historyTable)
        .select('*')
        .like('notes', '%Transfer%')
        .gte('operation_date', `${filters.startDate}T00:00:00`)
        .lte('operation_date', `${filters.endDate}T23:59:59`)
        .order('operation_date', { ascending: false })
        .range(from, from + pageSize - 1);

      if (error) throw error;
      if (!pageData || pageData.length === 0) break;
      
      allData = [...allData, ...pageData];
      if (pageData.length < pageSize) break;
      from += pageSize;
    }

    return allData.map(item => ({
      'Data Transfer': new Date(item.operation_date).toLocaleString('ro-RO'),
      'Tip': item.action === 'add' ? 'Retur' : 'Transfer',
      'Produs': item.name,
      'Lot': item.lot_number || 'Fără lot',
      'Cantitate': item.quantity,
      'Unitate': item.unit,
      'Observații': item.notes || '-',
      'Furnizor': item.supplier || '-'
    })) || [];
  };

  // Funcții pentru generarea datelor pentru grafice
  const loadChartData = async () => {
    try {
      const [dailyConsumption, topProducts, dailyActivity, supplierDistribution] = await Promise.all([
        generateDailyConsumptionData(),
        generateTopProductsData(),
        generateDailyActivityData(),
        generateSupplierDistributionData()
      ]);

      setChartData({
        dailyConsumption,
        topProducts,
        dailyActivity,
        supplierDistribution
      });
    } catch (error) {
      console.error('Error loading chart data:', error);
    }
  };

  const generateDailyConsumptionData = async () => {
    const historyTable = inventoryType === 'ambalaje' ? 'ambalaje_inventory_history' : 'inventory_history';
    
    // Fetch all data with pagination
    let allData: any[] = [];
    let from = 0;
    const pageSize = 1000;

    while (true) {
      const { data: pageData, error } = await supabase
        .from(historyTable)
        .select('operation_date, quantity')
        .eq('action', 'remove')
        .gte('operation_date', `${filters.startDate}T00:00:00`)
        .lte('operation_date', `${filters.endDate}T23:59:59`)
        .range(from, from + pageSize - 1);

      if (error) throw error;
      if (!pageData || pageData.length === 0) break;
      
      allData = [...allData, ...pageData];
      if (pageData.length < pageSize) break;
      from += pageSize;
    }

    const dailyData = new Map<string, { cantitate: number; operatii: number; }>();
    
    allData.forEach(item => {
      const date = item.operation_date.split('T')[0];
      const quantity = item.quantity;
      
      if (!dailyData.has(date)) {
        dailyData.set(date, { cantitate: 0, operatii: 0 });
      }
      
      const dayData = dailyData.get(date)!;
      dayData.cantitate += quantity;
      dayData.operatii += 1;
    });

    return Array.from(dailyData.entries())
      .map(([date, data]) => ({
        date: new Date(date).toLocaleDateString('ro-RO', { month: 'short', day: 'numeric' }),
        cantitate: Math.round(data.cantitate * 100) / 100,
        operatii: data.operatii
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-chartFilters.dailyConsumption.days);
  };

  const generateTopProductsData = async () => {
    const historyTable = inventoryType === 'ambalaje' ? 'ambalaje_inventory_history' : 'inventory_history';
    
    // Fetch all data with pagination
    let allData: any[] = [];
    let from = 0;
    const pageSize = 1000;

    while (true) {
      const { data: pageData, error } = await supabase
        .from(historyTable)
        .select('name, quantity')
        .eq('action', 'remove')
        .gte('operation_date', `${filters.startDate}T00:00:00`)
        .lte('operation_date', `${filters.endDate}T23:59:59`)
        .range(from, from + pageSize - 1);

      if (error) throw error;
      if (!pageData || pageData.length === 0) break;
      
      allData = [...allData, ...pageData];
      if (pageData.length < pageSize) break;
      from += pageSize;
    }

    const productData = new Map<string, { cantitate: number; operatii: number; }>();
    
    allData.forEach(item => {
      const quantity = item.quantity;
      
      if (!productData.has(item.name)) {
        productData.set(item.name, { cantitate: 0, operatii: 0 });
      }
      
      const prodData = productData.get(item.name)!;
      prodData.cantitate += quantity;
      prodData.operatii += 1;
    });

    return Array.from(productData.entries())
      .map(([produs, data]) => ({
        produs: produs.length > 15 ? produs.substring(0, 15) + '...' : produs,
        cantitate: Math.round(data.cantitate * 100) / 100,
        operatii: data.operatii
      }))
      .sort((a, b) => b.cantitate - a.cantitate)
      .slice(0, chartFilters.topProducts.limit);
  };

  const generateDailyActivityData = async () => {
    const historyTable = inventoryType === 'ambalaje' ? 'ambalaje_inventory_history' : 'inventory_history';
    
    // Fetch all data with pagination
    let allData: any[] = [];
    let from = 0;
    const pageSize = 1000;

    while (true) {
      const { data: pageData, error } = await supabase
        .from(historyTable)
        .select('operation_date, action, quantity')
        .gte('operation_date', `${filters.startDate}T00:00:00`)
        .lte('operation_date', `${filters.endDate}T23:59:59`)
        .range(from, from + pageSize - 1);

      if (error) throw error;
      if (!pageData || pageData.length === 0) break;
      
      allData = [...allData, ...pageData];
      if (pageData.length < pageSize) break;
      from += pageSize;
    }

    const dailyData = new Map<string, { intrari: number; iesiri: number; }>();
    
    allData.forEach(item => {
      const date = item.operation_date.split('T')[0];
      const quantity = item.quantity;
      
      if (!dailyData.has(date)) {
        dailyData.set(date, { intrari: 0, iesiri: 0 });
      }
      
      const dayData = dailyData.get(date)!;
      if (item.action === 'add') {
        dayData.intrari += quantity;
      } else {
        dayData.iesiri += quantity;
      }
    });

    return Array.from(dailyData.entries())
      .map(([date, data]) => ({
        date: new Date(date).toLocaleDateString('ro-RO', { month: 'short', day: 'numeric' }),
        intrari: Math.round(data.intrari * 100) / 100,
        iesiri: Math.round(data.iesiri * 100) / 100
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-chartFilters.dailyActivity.days);
  };

  const generateSupplierDistributionData = async () => {
    const historyTable = inventoryType === 'ambalaje' ? 'ambalaje_inventory_history' : 'inventory_history';
    
    // Fetch all data with pagination
    let allData: any[] = [];
    let from = 0;
    const pageSize = 1000;

    while (true) {
      const { data: pageData, error } = await supabase
        .from(historyTable)
        .select('supplier, quantity')
        .eq('action', 'remove')
        .gte('operation_date', `${filters.startDate}T00:00:00`)
        .lte('operation_date', `${filters.endDate}T23:59:59`)
        .range(from, from + pageSize - 1);

      if (error) throw error;
      if (!pageData || pageData.length === 0) break;
      
      allData = [...allData, ...pageData];
      if (pageData.length < pageSize) break;
      from += pageSize;
    }

    const supplierData = new Map<string, number>();
    let total = 0;
    
    allData.forEach(item => {
      const supplier = item.supplier || 'Necunoscut';
      const quantity = item.quantity;
      
      supplierData.set(supplier, (supplierData.get(supplier) || 0) + quantity);
      total += quantity;
    });

    return Array.from(supplierData.entries())
      .map(([furnizor, cantitate]) => ({
        furnizor: furnizor.length > 12 ? furnizor.substring(0, 12) + '...' : furnizor,
        cantitate: Math.round(cantitate * 100) / 100,
        procent: Math.round((cantitate / total) * 100 * 100) / 100
      }))
      .sort((a, b) => b.cantitate - a.cantitate)
      .slice(0, chartFilters.supplierDistribution.limit);
  };

  useEffect(() => {
    loadChartData();
  }, [filters.startDate, filters.endDate, inventoryType]);

  return (
    <div className="space-y-6">
      {/* Grafice Interactive */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-600" />
              Consum Zilnic
            </CardTitle>
            <div className="flex items-center gap-4 mt-4">
              <Label className="text-sm">Zile afișate:</Label>
              <Select
                value={chartFilters.dailyConsumption.days.toString()}
                onValueChange={(value) => {
                  setChartFilters(prev => ({
                    ...prev,
                    dailyConsumption: { days: parseInt(value) }
                  }));
                  loadChartData();
                }}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7</SelectItem>
                  <SelectItem value="14">14</SelectItem>
                  <SelectItem value="21">21</SelectItem>
                  <SelectItem value="30">30</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData.dailyConsumption}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="date" 
                  stroke="#666"
                  fontSize={12}
                />
                <YAxis stroke="#666" fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                  formatter={(value: any, name: string) => [
                    `${value} ${name === 'cantitate' ? 'kg' : 'operații'}`,
                    name === 'cantitate' ? 'Cantitate' : 'Operații'
                  ]}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="cantitate" 
                  stroke="#8b5cf6" 
                  strokeWidth={3}
                  dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: '#8b5cf6', strokeWidth: 2 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="operatii" 
                  stroke="#06b6d4" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: '#06b6d4', strokeWidth: 2, r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-cyan-600" />
              Top Produse Consumate
            </CardTitle>
            <div className="flex items-center gap-4 mt-4">
              <Label className="text-sm">Nr. produse:</Label>
              <Select
                value={chartFilters.topProducts.limit.toString()}
                onValueChange={(value) => {
                  setChartFilters(prev => ({
                    ...prev,
                    topProducts: { limit: parseInt(value) }
                  }));
                  loadChartData();
                }}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="8">8</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="15">15</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData.topProducts} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" stroke="#666" fontSize={12} />
                <YAxis 
                  type="category" 
                  dataKey="produs" 
                  stroke="#666" 
                  fontSize={10}
                  width={100}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                  formatter={(value: any, name: string) => [
                    `${value} ${name === 'cantitate' ? 'kg' : 'operații'}`,
                    name === 'cantitate' ? 'Cantitate' : 'Operații'
                  ]}
                />
                <Bar 
                  dataKey="cantitate" 
                  fill="#06b6d4"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-600" />
              Activitate Zilnică (Intrări vs Ieșiri)
            </CardTitle>
            <div className="flex items-center gap-4 mt-4">
              <Label className="text-sm">Zile afișate:</Label>
              <Select
                value={chartFilters.dailyActivity.days.toString()}
                onValueChange={(value) => {
                  setChartFilters(prev => ({
                    ...prev,
                    dailyActivity: { days: parseInt(value) }
                  }));
                  loadChartData();
                }}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="14">14</SelectItem>
                  <SelectItem value="21">21</SelectItem>
                  <SelectItem value="30">30</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData.dailyActivity}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" stroke="#666" fontSize={12} />
                <YAxis stroke="#666" fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                  formatter={(value: any, name: string) => [
                    `${value} kg`,
                    name === 'intrari' ? 'Intrări' : 'Ieșiri'
                  ]}
                />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="intrari" 
                  stackId="1"
                  stroke="#10b981" 
                  fill="#10b981"
                  fillOpacity={0.6}
                />
                <Area 
                  type="monotone" 
                  dataKey="iesiri" 
                  stackId="2"
                  stroke="#ef4444" 
                  fill="#ef4444"
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-amber-600" />
              Distribuție pe Furnizori
            </CardTitle>
            <div className="flex items-center gap-4 mt-4">
              <Label className="text-sm">Nr. furnizori:</Label>
              <Select
                value={chartFilters.supplierDistribution.limit.toString()}
                onValueChange={(value) => {
                  setChartFilters(prev => ({
                    ...prev,
                    supplierDistribution: { limit: parseInt(value) }
                  }));
                  loadChartData();
                }}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="4">4</SelectItem>
                  <SelectItem value="6">6</SelectItem>
                  <SelectItem value="8">8</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RechartsPieChart>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                  formatter={(value: any, name: string) => [
                    `${value} kg (${chartData.supplierDistribution.find(item => item.furnizor === name)?.procent}%)`,
                    'Cantitate'
                  ]}
                />
                <Pie 
                  data={chartData.supplierDistribution}
                  cx="50%" 
                  cy="50%" 
                  label={({ furnizor, procent }) => `${furnizor} (${procent}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="cantitate"
                >
                  {chartData.supplierDistribution.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={CHART_COLORS[index % CHART_COLORS.length]} 
                    />
                  ))}
                </Pie>
              </RechartsPieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Rapoarte */}
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