import React, { useEffect, useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Calendar, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-custom-toast";
import { useInventoryType } from "@/context/inventory-type";

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
  products?: { name: string; cod_produs: string; pt_percent?: number } | null;
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
  const [groupMode, setGroupMode] = useState<'product' | 'lot'>('product');
  const [groupObsDraft, setGroupObsDraft] = useState<Record<string, string>>({});
  const [groupPercentDraft, setGroupPercentDraft] = useState<Record<string, number>>({});

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
          products:product_id (name, cod_produs, pt_percent)
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
      const pt = item.products?.pt_percent ?? 0;
      const computed = q?.consider_quantity ?? baseQty(item) * (1 - (currentPercent || 0) / 100) * (1 - (pt || 0) / 100);

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

  const handleApplyToGroup = async (groupName: string, items: DailyStockItem[]) => {
    try {
      const obsVal = groupObsDraft[groupName];
      const pctRaw = groupPercentDraft[groupName];
      const hasObs = typeof obsVal === 'string';
      const hasPct = Number.isFinite(pctRaw);

      if (!hasObs && !hasPct) {
        toast({ variant: 'destructive', title: 'Nimic de aplicat', description: 'Completați observații sau procent pentru grup.' });
        return;
      }

      const clamp = (n: number) => Math.max(0, Math.min(100, n));
      const payloads = items.map((it) => ({
        snapshot_id: it.id,
        ...(hasObs ? { obs: obsVal } : {}),
        ...(hasPct ? { nonconform_percent: clamp(Number(pctRaw)) } : {}),
      }));

      const { error } = await supabase
        .from(qualityTable)
        .upsert(payloads, { onConflict: 'snapshot_id' });
      if (error) throw error;

      const ids = items.map((i) => i.id);
      const { data: fresh, error: selErr } = await supabase
        .from(qualityTable)
        .select('id, snapshot_id, obs, nonconform_percent, consider_quantity')
        .in('snapshot_id', ids);
      if (selErr) throw selErr;

      const updates: Record<string, QualityRow> = {};
      (fresh ?? []).forEach((r: any) => {
        updates[r.snapshot_id] = r as QualityRow;
      });
      setQualityMap((prev) => ({ ...prev, ...updates }));

      // clear drafts for group
      setGroupObsDraft((prev) => {
        const n = { ...prev };
        delete (n as any)[groupName];
        return n;
      });
      setGroupPercentDraft((prev) => {
        const n = { ...prev } as Record<string, number>;
        delete (n as any)[groupName];
        return n as Record<string, number>;
      });

      toast({ title: 'Aplicat', description: 'Valori aplicate tuturor loturilor din grup.' });
    } catch (error: any) {
      console.error('Error applying group changes:', error);
      toast({ variant: 'destructive', title: 'Eroare', description: error.message });
    }
  };

  if (loading) {
    return <div className="p-4 text-center">Se încarcă datele de calitate...</div>;
  }

  return (
    <div className="space-y-3 text-xs md:text-sm">
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="text-sm font-medium">Selectează data:</span>
          </div>
          <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-auto h-8 text-xs" />
          <Input
            type="text"
            placeholder="Filtrează după produs..."
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="w-auto min-w-[160px] h-8 text-xs"
          />
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-sm font-medium">Grupare:</span>
          <Button size="sm" variant={groupMode === 'product' ? 'default' : 'outline'} onClick={() => setGroupMode('product')}>Produs</Button>
          <Button size="sm" variant={groupMode === 'lot' ? 'default' : 'outline'} onClick={() => setGroupMode('lot')}>Lot</Button>
          <Button onClick={() => window.print()} variant="outline" size="sm">
            Printează
          </Button>
        </div>
      </div>

      {filteredSnapshots.length === 0 ? (
        <div className="text-center py-6 text-gray-500">
          {productFilter ? <p>Nu există produse care să se potrivească cu filtrul.</p> : <p>Nu există snapshot pentru data selectată.</p>}
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto print:overflow-visible print:border-0">
          <Table className="text-xs print:text-[8px] table-fixed w-full min-w-fit print:min-w-full [&_th]:py-3 [&_th]:px-2 [&_th]:whitespace-nowrap [&_td]:py-3 [&_td]:px-2 [&_td]:align-middle print:[&_th]:py-1 print:[&_td]:py-1">
            <TableHeader>
              <TableRow className="print:break-inside-avoid">
                <TableHead className="w-12 print:table-cell print:w-auto print:text-[8px] print:border print:border-gray-300">Nr.</TableHead>
                <TableHead className="w-24 print:table-cell print:w-auto print:text-[8px] print:border print:border-gray-300">Produs</TableHead>
                <TableHead className="w-16 hidden md:table-cell print:table-cell print:w-auto print:text-[8px] print:border print:border-gray-300">Cod</TableHead>
                <TableHead className="w-12 hidden lg:table-cell print:table-cell print:w-auto print:text-[8px] print:border print:border-gray-300">Lot</TableHead>
                <TableHead className="w-12 text-right print:table-cell print:w-auto print:text-[8px] print:border print:border-gray-300">Cant.</TableHead>
                <TableHead className="w-8 hidden md:table-cell print:table-cell print:w-auto print:text-[8px] print:border print:border-gray-300">U.M.</TableHead>
                <TableHead className="w-12 hidden lg:table-cell print:table-cell print:w-auto print:text-[8px] print:border print:border-gray-300">Doc.</TableHead>
                <TableHead className="w-16 hidden xl:table-cell print:table-cell print:w-auto print:text-[8px] print:border print:border-gray-300">Data Rec.</TableHead>
                <TableHead className="w-16 hidden xl:table-cell print:table-cell print:w-auto print:text-[8px] print:border print:border-gray-300">Furnizor</TableHead>
                <TableHead className="w-16 hidden xl:table-cell print:table-cell print:w-auto print:text-[8px] print:border print:border-gray-300">Producător</TableHead>
                <TableHead className="w-20 hidden lg:table-cell print:hidden">Obs</TableHead>
                <TableHead className="w-16 hidden md:table-cell print:hidden">% neconf.</TableHead>
                <TableHead className="w-16 text-right print:table-cell print:w-auto print:text-[8px] print:border print:border-gray-300">C. Cons.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupMode === 'product' ? (
                groupedByProduct.map((group) => (
                  <TableRow key={group.name} className="bg-muted/50">
                    <TableCell colSpan={13} className="font-semibold">
                      <div className="flex flex-col gap-2">
                        <div>
                          {group.name}
                          {group.code ? ` — ${group.code}` : ''} • {group.items.length} loturi • Total: {group.totalQty.toFixed(2)} {group.unit} • Considerat: {group.totalComputed.toFixed(2)} {group.unit}
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                          <Textarea
                            rows={2}
                            placeholder="Obs pentru produs"
                            value={groupObsDraft[group.name] ?? ''}
                            onChange={(e) => setGroupObsDraft((prev) => ({ ...prev, [group.name]: (e.target as HTMLTextAreaElement).value }))}
                            className="min-w-[140px] whitespace-pre-wrap break-words text-xs"
                          />
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            placeholder="% neconform"
                            value={groupPercentDraft[group.name] !== undefined && Number.isFinite(groupPercentDraft[group.name]) ? String(groupPercentDraft[group.name]) : ''}
                            onChange={(e) => {
                              const raw = (e.target as HTMLInputElement).value;
                              const num = Number(raw);
                              setGroupPercentDraft((prev) => ({ ...prev, [group.name]: isNaN(num) ? NaN : Math.max(0, Math.min(100, num)) }));
                            }}
                            className="w-20 h-8 text-xs"
                          />
                          <Button size="sm" onClick={() => handleApplyToGroup(group.name, group.items)}>Aplică la toate loturile</Button>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                filteredSnapshots.map((item) => {
                  const q = qualityMap[item.id];
                  const currentPercent = percentDraft[item.id] ?? (q?.nonconform_percent ?? 0);
                  const pt = item.products?.pt_percent ?? 0;
                  const computed = q?.consider_quantity ?? baseQty(item) * (1 - (currentPercent || 0) / 100) * (1 - (pt || 0) / 100);
                  return (
                    <TableRow key={item.id} className="print:break-inside-avoid">
                      <TableCell className="font-medium print:table-cell print:text-[8px] print:border print:border-gray-300">{item.entry_number ?? '-'}</TableCell>
                      <TableCell className="font-medium truncate print:table-cell print:text-[8px] print:border print:border-gray-300 print:overflow-visible print:max-w-none" title={item.name}>{item.name}</TableCell>
                      <TableCell className="hidden md:table-cell print:table-cell print:text-[8px] print:border print:border-gray-300">{item.products?.cod_produs || '-'}</TableCell>
                      <TableCell className="hidden lg:table-cell print:table-cell print:text-[8px] print:border print:border-gray-300">{item.lot_number || '-'}</TableCell>
                      <TableCell className="text-right print:table-cell print:text-[8px] print:border print:border-gray-300">{item.quantity.toFixed(2)}</TableCell>
                      <TableCell className="hidden md:table-cell print:table-cell print:text-[8px] print:border print:border-gray-300">{item.unit}</TableCell>
                      <TableCell className="hidden lg:table-cell print:table-cell print:text-[8px] print:border print:border-gray-300">{item.document_number || '-'}</TableCell>
                      <TableCell className="hidden xl:table-cell print:table-cell print:text-[8px] print:border print:border-gray-300">{item.receipt_date ? new Date(item.receipt_date).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit' }) : '-'}</TableCell>
                      <TableCell className="hidden xl:table-cell print:table-cell print:text-[8px] print:border print:border-gray-300">{item.suppliers?.name || '-'}</TableCell>
                      <TableCell className="hidden xl:table-cell print:table-cell print:text-[8px] print:border print:border-gray-300">{item.manufacturers?.name || '-'}</TableCell>
                      <TableCell className="hidden lg:table-cell print:hidden">
                        <Textarea
                          rows={3}
                          placeholder="Observații..."
                          value={obsDraft[item.id] ?? (q?.obs ?? '')}
                          onChange={(e) => setObsDraft((prev) => ({ ...prev, [item.id]: (e.target as HTMLTextAreaElement).value }))}
                          onBlur={(e) => {
                            const val = (e.target as HTMLTextAreaElement)?.value ?? '';
                            handleUpsert(item.id, { obs: val });
                          }}
                          className="min-w-[120px] whitespace-pre-wrap break-words text-xs"
                        />
                      </TableCell>
                      <TableCell className="hidden md:table-cell print:hidden">
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
                          className="w-20 h-8 text-xs"
                        />
                      </TableCell>
                      <TableCell className="text-right print:table-cell print:text-[8px] print:border print:border-gray-300">{computed.toFixed(2)}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default DailyStockQuality;
