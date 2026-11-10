import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { parseTransferLine } from "@/lib/transferLine";
import { businessDay, dayBounds, materialKey, readPages, transferStockQuantity } from "@/lib/forecastReconciliation";

interface Props {
  produsId?: string | null;
  comandaId?: string | null;
  /** Numele liniilor (fizice) pe care lucrează comanda. */
  lineNames: string[];
  /** Ziua de producție a comenzii (yyyy-MM-dd sau ISO); implicit azi. */
  day?: string | null;
}

interface LotRow { produs: string; lot: string; kg: number; unit: string; linie: string; ora: string }

const prevDay = (day: string) => {
  const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

/** Materia primă trimisă pe linie (bon de transfer MP → Producție, linia aleasă), ziua producției și ziua dinainte. */
export default function LineMaterialLotsCard({ produsId, comandaId, lineNames, day }: Props) {
  const zi = businessDay(day || new Date().toISOString());
  const lineKeys = lineNames.filter(Boolean).map(materialKey);

  const { data, isLoading } = useQuery({
    queryKey: ["line-material-lots", zi, lineKeys.join("|"), produsId, comandaId],
    enabled: lineKeys.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const [items, recipes, customs] = await Promise.all([
        readPages(() => supabase.from("stock_transfer_items")
          .select("id, quantity, net_quantity, unit, created_at, stock_transfers:transfer_id!inner(notes, created_at), inventory:inventory_item_id(name, lot_number, unit, products:product_id(name))")
          .ilike("stock_transfers.notes", "Linia:%")
          .gte("created_at", dayBounds(prevDay(zi)).start).lte("created_at", dayBounds(zi).end)
          .order("id")),
        produsId
          ? readPages(() => supabase.from("productie_retete")
              .select("activa, productie_retete_ingrediente(productie_ingrediente(nume))")
              .eq("produs_id", produsId).order("id"))
          : Promise.resolve([]),
        comandaId
          ? readPages(() => supabase.from("productie_comenzi_ingrediente")
              .select("id, productie_ingrediente(nume)").eq("comanda_id", comandaId).order("id"))
          : Promise.resolve([]),
      ]);
      const active = (recipes as any[]).filter((r) => r.activa);
      const ingredients = [
        ...(active.length ? active : (recipes as any[])).flatMap((r) => (r.productie_retete_ingrediente || []).map((i: any) => i.productie_ingrediente?.nume)),
        ...(customs as any[]).map((c) => c.productie_ingrediente?.nume),
      ].filter(Boolean).map((n: string) => materialKey(n)).filter((k) => k.length >= 3);

      const rows: LotRow[] = [];
      for (const it of items as any[]) {
        const linie = parseTransferLine(it.stock_transfers?.notes).line;
        if (!linie || !lineKeys.includes(materialKey(linie))) continue;
        const produs = it.inventory?.products?.name || it.inventory?.name || "";
        rows.push({
          produs, linie,
          lot: it.inventory?.lot_number || "—",
          kg: transferStockQuantity(it, it.inventory?.unit),
          unit: /^(g|gr|grame|t|tone)$/i.test(it.unit || it.inventory?.unit || "") ? "kg" : (it.unit || it.inventory?.unit || "kg"),
          ora: it.stock_transfers?.created_at || it.created_at,
        });
      }
      const matches = (r: LotRow) => { const k = materialKey(r.produs); return ingredients.some((i) => k.includes(i) || i.includes(k)); };
      const matched = ingredients.length ? rows.filter(matches) : [];
      return { rows: matched.length ? matched : rows, matchedRecipe: matched.length > 0 };
    },
  });

  if (!lineKeys.length) return null;
  // Lot + produs: o singură linie cu totalul kg primit.
  const grouped = new Map<string, LotRow>();
  for (const r of data?.rows || []) {
    const k = `${r.produs}|${r.lot}`;
    const g = grouped.get(k);
    if (g) { g.kg += r.kg; if (r.ora > g.ora) g.ora = r.ora; } else grouped.set(k, { ...r });
  }
  const list = [...grouped.values()].sort((a, b) => b.ora.localeCompare(a.ora));

  return (
    <Card className="border-coral-200 shadow">
      <CardHeader className="py-3">
        <CardTitle className="flex items-center gap-2 text-base text-coral-primary">
          <Package className="h-5 w-5" /> Materie primă primită pe linie
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 text-sm">
        {isLoading ? <p className="text-muted-foreground">Se încarcă...</p>
          : list.length === 0 ? <p className="text-muted-foreground">Niciun bon de transfer pe această linie ieri sau azi.</p>
          : (
            <>
              {!data?.matchedRecipe && <p className="text-xs text-muted-foreground mb-2">Nicio materie primă din rețetă găsită; se afișează tot ce a primit linia.</p>}
              <div className="divide-y rounded-md border">
                {list.map((r) => (
                  <div key={`${r.produs}|${r.lot}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                    <span className="font-medium flex-1 min-w-[10rem]">{r.produs}</span>
                    <span>Lot: <span className="font-semibold">{r.lot}</span></span>
                    <span className="font-semibold">{r.kg.toLocaleString("ro-RO", { maximumFractionDigits: 2 })} {r.unit}</span>
                    <span className="text-xs text-muted-foreground">{r.linie} · {new Date(r.ora).toLocaleString("ro-RO", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                ))}
              </div>
            </>
          )}
      </CardContent>
    </Card>
  );
}
