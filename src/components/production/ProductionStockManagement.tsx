import React, { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useInventoryType } from "@/context/inventory-type";
import ProductionStockTable from "./ProductionStockTable";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-custom-toast";

export interface ProductionStockItem {
  id: string;
  inventory_item_id: string | null;
  transfer_id: string | null;
  product_id: string | null;
  supplier_id: string | null;
  manufacturer_id: string | null;
  name: string;
  quantity: number;
  unit: string;
  lot_number: string | null;
  document_number: string | null;
  transfer_date: string;
  created_at: string;
  updated_at: string;
  products?: { name: string; cod_produs?: string } | null;
  suppliers?: { name: string } | null;
  manufacturers?: { name: string } | null;
}

const ProductionStockManagement = () => {
  const { inventoryType } = useInventoryType();
  const [stock, setStock] = useState<ProductionStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchStock = async () => {
    try {
      setLoading(true);
      const tableName = inventoryType === 'ambalaje' 
        ? 'ambalaje_production_stock' 
        : 'production_stock';

      const { data, error } = await supabase
        .from(tableName)
        .select(`
          *,
          products:product_id (name, cod_produs),
          suppliers:supplier_id (name),
          manufacturers:manufacturer_id (name)
        `)
        .gt('quantity', 0)
        .order('transfer_date', { ascending: false });

      if (error) throw error;
      setStock(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Eroare la încărcarea stocului producție",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStock();
  }, [inventoryType, refreshKey]);

  const handleDataChange = () => {
    setRefreshKey(prev => prev + 1);
  };

  const title = inventoryType === 'ambalaje' 
    ? 'Stoc Producție Ambalaje' 
    : 'Stoc Producție Materii Prime';

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">
          Gestionați stocul din producție - consum, modificare, returnare în depozit
        </p>
      </div>

      <Tabs defaultValue="stock" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="stock">Stoc Curent</TabsTrigger>
          <TabsTrigger value="history">Istoric Operații</TabsTrigger>
        </TabsList>

        <TabsContent value="stock">
          <ProductionStockTable 
            stock={stock}
            loading={loading}
            onDataChange={handleDataChange}
          />
        </TabsContent>

        <TabsContent value="history">
          <ProductionStockHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Componenta pentru istoric
const ProductionStockHistory = () => {
  const { inventoryType } = useInventoryType();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const tableName = inventoryType === 'ambalaje'
          ? 'ambalaje_production_stock_history'
          : 'production_stock_history';

        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);

        if (error) throw error;
        setHistory(data || []);
      } catch (error: any) {
        console.error('Error fetching history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [inventoryType]);

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'consumption': return 'Consum';
      case 'return': return 'Returnare depozit';
      case 'modify': return 'Modificare';
      case 'delete': return 'Ștergere';
      default: return action;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'consumption': return 'text-orange-600';
      case 'return': return 'text-blue-600';
      case 'modify': return 'text-yellow-600';
      case 'delete': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  if (loading) {
    return <div className="text-center py-8">Se încarcă istoricul...</div>;
  }

  if (history.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">Nu există operații în istoric.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left p-2">Data</th>
            <th className="text-left p-2">Acțiune</th>
            <th className="text-right p-2">Cantitate</th>
            <th className="text-right p-2">Cant. Anterioară</th>
            <th className="text-left p-2">Note</th>
          </tr>
        </thead>
        <tbody>
          {history.map((item) => (
            <tr key={item.id} className="border-b hover:bg-muted/50">
              <td className="p-2">
                {new Date(item.created_at).toLocaleString('ro-RO')}
              </td>
              <td className={`p-2 font-medium ${getActionColor(item.action)}`}>
                {getActionLabel(item.action)}
              </td>
              <td className="p-2 text-right">{item.quantity}</td>
              <td className="p-2 text-right">{item.previous_quantity || '-'}</td>
              <td className="p-2">{item.notes || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ProductionStockManagement;
