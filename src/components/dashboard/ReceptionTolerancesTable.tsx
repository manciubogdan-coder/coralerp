import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Search } from "lucide-react";
import { useInventoryType } from "@/context/inventory-type";

type Product = { id: string; name: string; cod_produs?: string | null };
type ToleranceRow = {
  product_id: string;
  tolerance_under_percent: number;
  tolerance_over_kg: number;
};

const DEFAULT_UNDER = 3;
const DEFAULT_OVER = 105;

const getProductTable = (t: string) =>
  t === "ambalaje" ? "ambalaje_products" : t === "etichete" ? "etichete_products" : "products";

const ReceptionTolerancesTable: React.FC = () => {
  const { inventoryType } = useInventoryType();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [tolMap, setTolMap] = useState<Map<string, { under: string; over: string }>>(new Map());
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data: prodData, error: prodErr } = await (supabase as any)
        .from(getProductTable(inventoryType))
        .select("id, name, cod_produs")
        .order("name");
      if (prodErr) throw prodErr;
      const prods: Product[] = (prodData as any[]) || [];
      setProducts(prods);

      const ids = prods.map((p) => p.id);
      const map = new Map<string, { under: string; over: string }>();
      if (ids.length > 0) {
        for (let i = 0; i < ids.length; i += 100) {
          const slice = ids.slice(i, i + 100);
          const { data: tolData } = await (supabase as any)
            .from("product_reception_tolerances")
            .select("product_id, tolerance_under_percent, tolerance_over_kg")
            .eq("inventory_type", inventoryType)
            .in("product_id", slice);
          ((tolData || []) as ToleranceRow[]).forEach((t) => {
            map.set(t.product_id, {
              under: String(t.tolerance_under_percent ?? DEFAULT_UNDER),
              over: String(t.tolerance_over_kg ?? DEFAULT_OVER),
            });
          });
        }
      }
      setTolMap(map);
    } catch (e: any) {
      console.error(e);
      toast({ title: "Eroare la încărcare", description: e.message || "", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventoryType]);

  const getRow = (id: string) =>
    tolMap.get(id) || { under: String(DEFAULT_UNDER), over: String(DEFAULT_OVER) };

  const updateField = (id: string, field: "under" | "over", value: string) => {
    setTolMap((prev) => {
      const next = new Map(prev);
      const cur = next.get(id) || { under: String(DEFAULT_UNDER), over: String(DEFAULT_OVER) };
      next.set(id, { ...cur, [field]: value });
      return next;
    });
  };

  const save = async (id: string) => {
    setSavingId(id);
    try {
      const row = getRow(id);
      const under = parseFloat(row.under);
      const over = parseFloat(row.over);
      if (isNaN(under) || isNaN(over) || under < 0 || over < 0) {
        throw new Error("Valori invalide.");
      }
      const { error } = await (supabase as any)
        .from("product_reception_tolerances")
        .upsert(
          [{
            product_id: id,
            inventory_type: inventoryType,
            tolerance_under_percent: under,
            tolerance_over_kg: over,
            updated_at: new Date().toISOString(),
          }],
          { onConflict: "product_id" }
        );
      if (error) throw error;
      toast({ title: "Salvat" });
    } catch (e: any) {
      toast({ title: "Eroare la salvare", description: e.message || "", variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.cod_produs || "").toLowerCase().includes(q)
    );
  }, [products, search]);

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold">Toleranțe recepție per produs</h3>
          <p className="text-sm text-muted-foreground">
            Implicit: <strong>{DEFAULT_UNDER}%</strong> sub document (diferența rămâne 0, pierderea se calculează din document) și{" "}
            <strong>{DEFAULT_OVER} kg</strong> peste document (apare „Cant. declarată").
          </p>
        </div>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Caută produs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produs</TableHead>
                <TableHead className="w-[80px]">Cod</TableHead>
                <TableHead className="w-[160px]">Toleranță sub doc (%)</TableHead>
                <TableHead className="w-[160px]">Prag surplus (kg)</TableHead>
                <TableHead className="w-[100px]">Acțiune</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const r = getRow(p.id);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.cod_produs || "—"}</TableCell>
                    <TableCell>
                      <Input
                        type="number" step="0.01" min="0"
                        value={r.under}
                        onChange={(e) => updateField(p.id, "under", e.target.value)}
                        className="h-9"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number" step="0.1" min="0"
                        value={r.over}
                        onChange={(e) => updateField(p.id, "over", e.target.value)}
                        className="h-9"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        onClick={() => save(p.id)}
                        disabled={savingId === p.id}
                      >
                        {savingId === p.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <><Save className="h-4 w-4 mr-1" />Salvează</>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    Niciun produs.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default ReceptionTolerancesTable;
