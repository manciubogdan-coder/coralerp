
import React, { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, FileSpreadsheet } from "lucide-react";
import { InventoryItem } from "@/types";
import { exportToExcel } from "@/lib/excelExport";
import { supabase } from "@/integrations/supabase/client";
import { useInventoryType } from "@/App";

interface SimpleInventoryTableProps {
  inventory: InventoryItem[];
}

const SimpleInventoryTable = ({ inventory }: SimpleInventoryTableProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const { inventoryType } = useInventoryType();
  const [todayAgg, setTodayAgg] = useState<Record<string, { pt: number | null; percent: number | null; consider: number | null }>>({});
  const [liveStock, setLiveStock] = useState<Record<string, { quantity: number; unit: string; cod_produs?: string }>>({});

  useEffect(() => {
    const fetchToday = async () => {
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        const tableName = inventoryType === 'ambalaje' ? 'ambalaje_daily_stock_snapshots' : 'daily_stock_snapshots';
        const qualityTable = inventoryType === 'ambalaje' ? 'ambalaje_daily_stock_quality' : 'daily_stock_quality';
        const { data, error } = await supabase
          .from(tableName)
          .select(`
            id,
            name,
            quantity,
            net_quantity,
            unit,
            products:product_id (pt_percent, cod_produs)
          `)
          .eq('snapshot_date', todayStr);
        if (error) throw error;
        const snapshots = data || [];
        const ids = snapshots.map((s: any) => s.id);
        let qMap: Record<string, { nonconform_percent: number | null; consider_quantity: number | null }> = {};
        if (ids.length > 0) {
          const { data: qData, error: qErr } = await supabase
            .from(qualityTable)
            .select('snapshot_id, nonconform_percent, consider_quantity')
            .in('snapshot_id', ids);
          if (qErr) throw qErr;
          (qData ?? []).forEach((r: any) => {
            qMap[r.snapshot_id] = {
              nonconform_percent: r.nonconform_percent ?? null,
              consider_quantity: r.consider_quantity ?? null,
            };
          });
        }
        const grouped: Record<string, { base: number; consider: number; pt: number | null }> = {};
        snapshots.forEach((it: any) => {
          const key = it.name;
          const base = Number(it.net_quantity ?? it.quantity) || 0;
          const pt = it.products?.pt_percent ?? 0;
          const q = qMap[it.id];
          let consider = 0;
          if (q) {
            const nonconf = q.nonconform_percent ?? 0;
            consider = q.consider_quantity != null
              ? Number(q.consider_quantity)
              : base * (1 - nonconf / 100) * (1 - pt / 100);
          } else {
            consider = base * (1 - pt / 100);
          }
          if (!grouped[key]) {
            grouped[key] = { base: 0, consider: 0, pt: pt ?? null };
          }
          grouped[key].base += base;
          grouped[key].consider += consider;
          if (grouped[key].pt == null && pt != null) grouped[key].pt = pt;
        });
        const result: Record<string, { pt: number | null; percent: number | null; consider: number | null }> = {};
        Object.entries(grouped).forEach(([k, v]) => {
          const percent = v.base > 0 ? (1 - v.consider / v.base) * 100 : null;
          result[k] = { pt: v.pt ?? null, percent, consider: v.base > 0 ? Number(v.consider) : null };
        });
        setTodayAgg(result);
      } catch (e) {
        console.error('Error fetching today quality for live stock:', e);
        setTodayAgg({});
      }
    };
    fetchToday();
  }, [inventoryType]);

// Calculează stocul live: snapshot dimineață + recepții azi − consum azi
useEffect(() => {
  const run = async () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const snapshotTable = inventoryType === 'ambalaje' ? 'ambalaje_daily_stock_snapshots' : 'daily_stock_snapshots';
      const receiptsTable = inventoryType === 'ambalaje' ? 'ambalaje_reception_records' : 'reception_records';
      const historyTable = inventoryType === 'ambalaje' ? 'ambalaje_inventory_history' : 'inventory_history';

      const [snapRes, recRes, histRes] = await Promise.all([
        supabase
          .from(snapshotTable)
          .select('name, quantity, net_quantity, unit, products:product_id (cod_produs)')
          .eq('snapshot_date', todayStr),
        supabase
          .from(receiptsTable)
          .select('name, original_quantity, gross_quantity, net_quantity, unit, products:product_id (cod_produs)')
          .gte('receipt_date', `${todayStr}T00:00:00`)
          .lt('receipt_date', `${todayStr}T23:59:59`),
        supabase
          .from(historyTable)
          .select('name, action, quantity, unit, previous_quantity, product_id')
          .gte('operation_date', `${todayStr}T00:00:00`)
          .lt('operation_date', `${todayStr}T23:59:59`)
      ]);

      const snaps = (snapRes.data as any[]) ?? [];
      const receipts = (recRes.data as any[]) ?? [];
      const history = (histRes.data as any[]) ?? [];

      const baseByName = new Map<string, { qty: number; unit?: string; cod?: string }>();
      snaps.forEach((it: any) => {
        const key = it.name;
        const base = Number(it.net_quantity ?? it.quantity) || 0;
        const cod = it.products?.cod_produs || undefined;
        const unit = it.unit;
        const prev = baseByName.get(key) || { qty: 0, unit, cod };
        prev.qty += base;
        prev.unit = unit || prev.unit;
        prev.cod = cod || prev.cod;
        baseByName.set(key, prev);
      });

      const receiptsByName = new Map<string, number>();
      receipts.forEach((r: any) => {
        const key = r.name;
        const val = Number(r.net_quantity ?? r.gross_quantity ?? r.original_quantity) || 0;
        receiptsByName.set(key, (receiptsByName.get(key) || 0) + val);
        const exist = baseByName.get(key) || { qty: 0, unit: r.unit, cod: r.products?.cod_produs };
        baseByName.set(key, { ...exist, unit: exist.unit || r.unit, cod: exist.cod || r.products?.cod_produs });
      });

      // Calculăm delta din istoric pentru fiecare produs, grupat după product_id
      const deltaByProductId = new Map<string, number>();
      history.forEach((h: any) => {
        const productId = h.product_id;
        if (!productId) return; // Skip if no product_id
        
        const qty = Number(h.quantity) || 0;
        const previousQty = Number(h.previous_quantity) || 0;

        if (h.action === 'remove' || h.action === 'transfer_out') {
          // Scădem cantitatea pentru acțiunile de ieșire
          deltaByProductId.set(productId, (deltaByProductId.get(productId) || 0) - qty);
        } else if (h.action === 'transfer_in') {
          // Adăugăm retururile din producție (nu apar în recepții)
          deltaByProductId.set(productId, (deltaByProductId.get(productId) || 0) + qty);
        } else if (h.action === 'add') {
          // Pentru 'add', adăugăm diferența față de cantitatea anterioară
          const addedQty = qty - previousQty;
          deltaByProductId.set(productId, (deltaByProductId.get(productId) || 0) + addedQty);
        } else if (h.action === 'set') {
          // Pentru 'set', calculăm diferența față de cantitatea anterioară
          const setDelta = qty - previousQty;
          deltaByProductId.set(productId, (deltaByProductId.get(productId) || 0) + setDelta);
        }
        
        // Debug pentru acțiuni neașteptate
        if (!['remove', 'transfer_out', 'transfer_in', 'add', 'set'].includes(h.action)) {
          console.log(`ACȚIUNE NECUNOSCUTĂ în istoric:`, h.action, `pentru produsul ${productId}`);
        }
      });

      // Convertim delta-urile de la product_id la nume produs
      const deltaByName = new Map<string, number>();
      deltaByProductId.forEach((delta, productId) => {
        // Găsim numele produsului cu acest product_id
        for (const [productName, productData] of baseByName.entries()) {
          if (productData.cod === productId) {
            deltaByName.set(productName, (deltaByName.get(productName) || 0) + delta);
            break;
          }
        }
      });

      const out: Record<string, { quantity: number; unit: string; cod_produs?: string }> = {};
      baseByName.forEach((v, k) => {
        const baseQty = v.qty;
        const receiptsQty = receiptsByName.get(k) || 0;
        const deltaQty = deltaByName.get(k) || 0;
        const qty = baseQty + receiptsQty + deltaQty;
        
        // Debug log pentru produsul "test" și probleme
        if (k.toLowerCase().includes('test') || qty < 0 || k.toLowerCase().includes('rucola') || Math.abs(qty) > 5000) {
          console.log(`STOC DEBUG - ${k}:`, {
            base: baseQty,
            receipts: receiptsQty,
            delta: deltaQty,
            final: qty,
            productCod: v.cod
          });
        }
        
        out[k] = { quantity: qty, unit: v.unit || '', cod_produs: v.cod };
      });
      setLiveStock(out);
    } catch (e) {
      console.error('Error computing live stock:', e);
      setLiveStock({});
    }
  };
  run();
}, [inventoryType]);

// Convert to array din stocul live și filtrează după căutare
const displayData = Object.entries(liveStock)
  .map(([name, info]) => ({
    name,
    cod_produs: info.cod_produs || '',
    quantity: Number(info.quantity) || 0,
    unit: info.unit,
  }))
  .filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.cod_produs.toLowerCase().includes(searchTerm.toLowerCase())
  )
  .sort((a, b) => a.name.localeCompare(b.name));

  const handleExport = () => {
    const dataToExport = displayData.map(item => {
      const agg = todayAgg[item.name];
      return {
        'Cod Produs': item.cod_produs || '-',
        'Produs': item.name,
        'Cantitate Netă': item.quantity.toFixed(2),
        'Unitate': item.unit,
        '% PT': agg?.pt != null ? `${agg.pt}%` : '-',
        '% marfă neconformă': agg?.percent != null ? `${agg.percent.toFixed(2)}%` : '-',
        'Cant de luat în considerare': agg?.consider != null ? agg.consider.toFixed(2) : '-',
      };
    });
    
    exportToExcel(dataToExport);
  };

  return (
    <div className="w-full">
      <div className="p-2 sm:p-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Caută produs sau cod..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="w-full sm:w-auto"
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
        </div>
        
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cod Produs</TableHead>
                <TableHead>Produs</TableHead>
                <TableHead className="text-right">Cantitate Netă</TableHead>
                <TableHead>Unitate</TableHead>
                <TableHead>% PT</TableHead>
                <TableHead>% marfă neconformă</TableHead>
                <TableHead className="text-right">Cant de luat în considerare</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                {displayData.length > 0 ? (
                  displayData.map((item) => {
                    const agg = todayAgg[item.name];
                    return (
                      <TableRow key={item.name}>
                        <TableCell className="font-medium">{item.cod_produs || "-"}</TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="text-right">{item.quantity.toFixed(2)}</TableCell>
                        <TableCell>{item.unit}</TableCell>
                        <TableCell>{agg?.pt != null ? `${agg.pt}%` : '-'}</TableCell>
                        <TableCell>{agg?.percent != null ? `${agg.percent.toFixed(2)}%` : '-'}</TableCell>
                        <TableCell className="text-right">{agg?.consider != null ? agg.consider.toFixed(2) : '-'}</TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-6 text-gray-500">
                    {searchTerm
                      ? `Nu s-au găsit produse pentru "${searchTerm}"`
                      : "Nu există produse în stoc."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default SimpleInventoryTable;
