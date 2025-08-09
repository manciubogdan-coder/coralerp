import React, { useEffect, useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-custom-toast";
import { useInventoryType } from "@/App";

interface DailyStockItem {
  id: string;
  snapshot_date: string;
  name: string;
  quantity: number;
  net_quantity: number | null;
  gross_quantity: number | null;
  unit: string;
  lot_number: string | null;
  document_number: string | null;
  entry_number: number | null;
  receipt_date: string | null;
  crate_count: number | null;
  suppliers?: { name: string } | null;
  manufacturers?: { name: string } | null;
  crate_types?: { name: string; weight: number } | null;
  products?: { name: string; cod_produs: string } | null;
}

interface QualityRow {
  id?: string;
  snapshot_id: string;
  obs: string | null;
  nonconform_percent: number;
  consider_quantity: number;
}

export const DailyStockQuality = () => {
  const { inventoryType } = useInventoryType();
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [productFilter, setProductFilter] = useState("");
const [loading, setLoading] = useState(true);
const [snapshots, setSnapshots] = useState<DailyStockItem[]>([]);
const [qualityMap, setQualityMap] = useState<Record<string, QualityRow>>({});
const [obsDraft, setObsDraft] = useState<Record<string, string>>({});
const [percentDraft, setPercentDraft] = useState<Record<string, number>>({});

  const tableName = inventoryType === "ambalaje" ? "ambalaje_daily_stock_snapshots" : "daily_stock_snapshots";
  const qualityTable = inventoryType === "ambalaje" ? "ambalaje_daily_stock_quality" : "daily_stock_quality";

  const fetchData = async () => {
    try {
      setLoading(true);

      if (inventoryType === "ambalaje") {
        console.log(`Skipping quality view for ${inventoryType} - snapshots not available`);
        setSnapshots([]);
        setQualityMap({});
        return;
      }

      const { data: snapData, error: snapErr } = await supabase
        .from(tableName)
        .select(`
          id,
          snapshot_date,
          name,
          quantity,
          net_quantity,
          gross_quantity,
          unit,
          lot_number,
          document_number,
          entry_number,
          receipt_date,
          crate_count,
          suppliers:supplier_id (name),
          manufacturers:manufacturer_id (name),
          crate_types:crate_type_id (name, weight),
          products:product_id (name, cod_produs)
        `)
        .eq("snapshot_date", selectedDate)
        .order("name", { ascending: true });

      if (snapErr) throw snapErr;

      const snaps = snapData as DailyStockItem[] | null;
      const snapshotList = snaps ?? [];
      setSnapshots(snapshotList);

      if (snapshotList.length === 0) {
        setQualityMap({});
        return;
      }

      const ids = snapshotList.map((s) => s.id);
      const { data: qData, error: qErr } = await supabase
        .from(qualityTable)
        .select("id, snapshot_id, obs, nonconform_percent, consider_quantity")
        .in("snapshot_id", ids);

      if (qErr) throw qErr;

      const map: Record<string, QualityRow> = {};
      (qData ?? []).forEach((row: any) => {
        map[row.snapshot_id] = row as QualityRow;
      });
      setQualityMap(map);
    } catch (error: any) {
      console.error("Error fetching daily quality data:", error);
      toast({
        variant: "destructive",
        title: "Eroare la încărcarea datelor",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const filteredSnapshots = useMemo(() => {
    if (!productFilter.trim()) return snapshots;
    const term = productFilter.toLowerCase();
    return snapshots.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        (s.products?.cod_produs && s.products.cod_produs.toLowerCase().includes(term))
    );
  }, [productFilter, snapshots]);

  const baseQty = (s: DailyStockItem) => (s.net_quantity ?? s.quantity);

  // Group snapshots by product (name) so rows are grouped by product instead of lot
  const groupedByProduct = useMemo(() => {
    const groups = new Map<string, { name: string; code: string; items: DailyStockItem[]; totalQty: number; totalComputed: number; unit: string }>();

    filteredSnapshots.forEach((item) => {
      const key = item.products?.name || item.name;
      const code = item.products?.cod_produs || '';
      const q = qualityMap[item.id];
      const currentPercent = percentDraft[item.id] ?? (q?.nonconform_percent ?? 0);
      const computed = q?.consider_quantity ?? baseQty(item) * (1 - (currentPercent || 0) / 100);

      if (!groups.has(key)) {
        groups.set(key, {
          name: key,
          code,
          items: [item],
          totalQty: item.quantity || 0,
          totalComputed: computed,
          unit: item.unit,
        });
      } else {
        const g = groups.get(key)!;
        g.items.push(item);
        g.totalQty += item.quantity || 0;
        g.totalComputed += computed;
      }
    });

    return Array.from(groups.values());
  }, [filteredSnapshots, qualityMap, percentDraft]);

  const handleUpsert = async (snapshotId: string, patch: Partial<QualityRow>) => {
    try {
      const current = qualityMap[snapshotId] || {
        snapshot_id: snapshotId,
        obs: null,
        nonconform_percent: 0,
        consider_quantity: 0,
      };
      const payload = {
        snapshot_id: snapshotId,
        obs: patch.obs ?? current.obs,
        nonconform_percent:
          typeof patch.nonconform_percent === "number"
            ? Math.max(0, Math.min(100, patch.nonconform_percent))
            : current.nonconform_percent,
      };

      const { error } = await supabase
        .from(qualityTable)
        .upsert(payload, { onConflict: "snapshot_id" });

      if (error) throw error;

      // Fetch back the row to get computed consider_quantity
      const { data: fresh, error: fetchErr } = await supabase
        .from(qualityTable)
        .select("id, snapshot_id, obs, nonconform_percent, consider_quantity")
        .eq("snapshot_id", snapshotId)
        .maybeSingle();

      if (fetchErr) throw fetchErr;
      if (fresh) {
        setQualityMap((prev) => ({ ...prev, [snapshotId]: fresh as QualityRow }));
      }

      toast({ title: "Salvat", description: "Calitatea a fost actualizată." });
    } catch (error: any) {
      console.error("Error saving quality row:", error);
      toast({ variant: "destructive", title: "Eroare la salvare", description: error.message });
    }
  };

  if (loading) {
    return <div className="p-4 text-center">Se încarcă datele de calitate...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="text-sm font-medium">Selectează data:</span>
          </div>
          <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-auto" />
          <Input
            type="text"
            placeholder="Filtrează după produs..."
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="w-auto min-w-[200px]"
          />
        </div>
        <div className="flex gap-2 items-center">
          <Button onClick={() => window.print()} variant="outline">
            Printează
          </Button>
        </div>
      </div>

      {filteredSnapshots.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          {productFilter ? <p>Nu există produse care să se potrivească cu filtrul.</p> : <p>Nu există snapshot pentru data selectată.</p>}
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nr. Intrare</TableHead>
                <TableHead>Produs</TableHead>
                <TableHead>Cod Produs</TableHead>
                <TableHead>Nr Lot</TableHead>
                <TableHead className="text-right">Cantitate</TableHead>
                <TableHead>Unitate</TableHead>
                <TableHead>Document</TableHead>
                <TableHead>Data Recepție</TableHead>
                <TableHead>Furnizor</TableHead>
                <TableHead>Producător</TableHead>
                <TableHead>Obs</TableHead>
                <TableHead>% marfă neconformă</TableHead>
                <TableHead className="text-right">Cant de luat în considerare</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupedByProduct.map((group) => (
                <React.Fragment key={group.name}>
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={13} className="font-semibold">
                      {group.name}
                      {group.code ? ` — ${group.code}` : ''} • {group.items.length} loturi • Total: {group.totalQty.toFixed(2)} {group.unit} • Considerat: {group.totalComputed.toFixed(2)} {group.unit}
                    </TableCell>
                  </TableRow>
                  {group.items.map((item) => {
                    const q = qualityMap[item.id];
                    const currentPercent = percentDraft[item.id] ?? (q?.nonconform_percent ?? 0);
                    const computed = q?.consider_quantity ?? baseQty(item) * (1 - (currentPercent || 0) / 100);
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.entry_number ?? '-'}</TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{item.products?.cod_produs || '-'}</TableCell>
                        <TableCell>{item.lot_number || '-'}</TableCell>
                        <TableCell className="text-right">{item.quantity.toFixed(2)}</TableCell>
                        <TableCell>{item.unit}</TableCell>
                        <TableCell>{item.document_number || '-'}</TableCell>
                        <TableCell>{item.receipt_date ? new Date(item.receipt_date).toLocaleDateString('ro-RO') : '-'}</TableCell>
                        <TableCell>{item.suppliers?.name || '-'}</TableCell>
                        <TableCell>{item.manufacturers?.name || '-'}</TableCell>
                        <TableCell>
                          <Textarea
                            rows={3}
                            placeholder="Observații..."
                            value={obsDraft[item.id] ?? (q?.obs ?? '')}
                            onChange={(e) => setObsDraft((prev) => ({ ...prev, [item.id]: (e.target as HTMLTextAreaElement).value }))}
                            onBlur={(e) => {
                              const val = (e.target as HTMLTextAreaElement)?.value ?? '';
                              handleUpsert(item.id, { obs: val });
                            }}
                            className="min-w-[360px] whitespace-pre-wrap break-words"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            value={String(percentDraft[item.id] ?? (q?.nonconform_percent ?? 0))}
                            onChange={(e) => {
                              const v = Number((e.target as HTMLInputElement).value);
                              setPercentDraft((prev) => ({ ...prev, [item.id]: isNaN(v) ? 0 : Math.max(0, Math.min(100, v)) }));
                            }}
                            onBlur={(e) => {
                              const raw = (e.target as HTMLInputElement).value;
                              const v = Number(raw);
                              handleUpsert(item.id, { nonconform_percent: isNaN(v) ? 0 : Math.max(0, Math.min(100, v)) });
                            }}
                            className="w-24"
                          />
                        </TableCell>
                        <TableCell className="text-right">{computed.toFixed(2)}</TableCell>
                      </TableRow>
                    );
                  })}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default DailyStockQuality;
