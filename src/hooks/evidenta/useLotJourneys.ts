import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { supabaseCloud } from "@/integrations/supabase/cloudClient";
import { businessDay, dayBounds, isProductionDestination, materialQuantity, readPages, transferStockQuantity } from "@/lib/forecastReconciliation";
import { parseTransferLine } from "@/lib/transferLine";
import { supplierQualityCreditQuantity, supplierQualityLossBase } from "@/lib/receptionQuality";
import {
  lotMaterialKey, overrideKey,
  type DayOverride, type JourneyReception, type JourneySession, type JourneyTransfer, type RecipeMap,
} from "@/lib/evidenta/lotJourney";

export const LOT_OVERRIDE_TYPE = "lot-materii-prime";
const BATCH = 50;

const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

async function inBatches<T>(ids: (string | number)[], run: (slice: any[]) => Promise<T[]>): Promise<T[]> {
  const out: T[] = [];
  const unique = [...new Set(ids)];
  for (let i = 0; i < unique.length; i += BATCH) out.push(...(await run(unique.slice(i, i + BATCH))));
  return out;
}

const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);

/** Evidența pe lot: recepțiile MP din interval, cu tot ce s-a întâmplat cu fiecare lot în producție. */
export const useLotJourneys = (startDay: string, endDay: string) =>
  useQuery({
    queryKey: ["evidenta-lot-journeys", startDay, endDay],
    enabled: !!startDay && !!endDay && startDay <= endDay,
    staleTime: 60_000,
    queryFn: () => loadLotJourneyInputs(startDay, endDay),
  });

export async function loadLotJourneyInputs(startDay: string, endDay: string) {
  {
    {
      // 1) NIR-urile din interval
      const recRows = await readPages(() => (supabase as any).from("reception_records")
        .select("id, entry_number, receipt_date, name, original_quantity, net_quantity, consider_quantity, gross_quantity, unit, lot_number, supplier_name, manufacturer_id, product_id")
        .gte("receipt_date", dayBounds(startDay).start).lte("receipt_date", dayBounds(endDay).end)
        .order("id"));

      // 2) Rândurile de stoc create de fiecare NIR (același număr de intrare)
      const entries = recRows.map((r: any) => r.entry_number).filter((x: any) => x != null);
      const invRows = await inBatches(entries, async (slice) => readPages(() => (supabase as any).from("inventory")
        .select("id, entry_number, lot_number, quantity, unit").in("entry_number", slice).order("id")));
      const invByEntry = new Map<string, any[]>();
      for (const i of invRows as any[]) {
        const k = `${i.entry_number}|${(i.lot_number || "").trim()}`;
        (invByEntry.get(k) || invByEntry.set(k, []).get(k)!).push(i);
      }
      const invIds = (invRows as any[]).map((i) => i.id);

      // 3) Producători, calitate la recepție, toleranțe
      const manIds = recRows.map((r: any) => r.manufacturer_id).filter(Boolean);
      const productIds = recRows.map((r: any) => r.product_id).filter(Boolean);
      const [mans, quality, tols] = await Promise.all([
        inBatches(manIds, async (s) => ((await (supabase as any).from("manufacturers").select("id, name").in("id", s)).data || [])),
        inBatches(invIds, async (s) => ((await (supabase as any).from("reception_report_data")
          .select("inventory_id, pierdere_calitativa_procent, cantitate_receptionata, cantitate_document, declared_quantity").in("inventory_id", s)).data || [])),
        inBatches(productIds, async (s) => ((await (supabase as any).from("product_reception_tolerances")
          .select("product_id, tolerance_under_percent, tolerance_over_kg").eq("inventory_type", "materii-prime").in("product_id", s)).data || [])),
      ]);
      const manName = new Map((mans as any[]).map((m) => [m.id, m.name]));
      const qualityByInv = new Map((quality as any[]).map((q) => [q.inventory_id, q]));
      const tolBy = new Map((tols as any[]).map((t) => [t.product_id, { under: Number(t.tolerance_under_percent ?? 3), over: Number(t.tolerance_over_kg ?? 100) }]));

      const receptions: JourneyReception[] = recRows.map((r: any) => {
        const inv = invByEntry.get(`${r.entry_number}|${(r.lot_number || "").trim()}`) || [];
        let pct: number | null = null;
        let credit: number | null = null;
        for (const i of inv) {
          const q = qualityByInv.get(i.id);
          const p = num(q?.pierdere_calitativa_procent);
          if (p == null) continue;
          pct = pct ?? p;
          const rec = Number(q.cantitate_receptionata || 0);
          const doc = num(q.cantitate_document);
          const declared = num(q.declared_quantity);
          const effective = declared != null && declared >= 0 && doc != null && doc > 0 && rec > doc ? doc + declared : rec;
          const base = supplierQualityLossBase(doc, rec, tolBy.get(r.product_id) || { under: 3, over: 100 }, effective);
          credit = (credit || 0) + supplierQualityCreditQuantity(base, p);
        }
        return {
          id: r.id,
          entryNumber: r.entry_number ?? null,
          receiptDay: businessDay(r.receipt_date),
          product: r.name || "",
          lot: (r.lot_number || "").trim(),
          supplier: r.supplier_name || null,
          producer: manName.get(r.manufacturer_id) || null,
          // Stocul intră cu cantitatea cântărită la NIR (original/brut); „net” scade tare estimate și nu e stocul real.
          nirKg: materialQuantity(r.original_quantity ?? r.gross_quantity ?? r.net_quantity, r.unit),
          remainingKg: inv.length ? inv.reduce((a, i) => a + materialQuantity(i.quantity, i.unit), 0) : null,
          qualityPct: pct,
          creditKg: credit,
          inventoryIds: inv.map((i) => i.id),
        };
      });

      // 4) Toate transferurile în producție din perioadă (pentru partea fiecărui lot)
      const today = businessDay(new Date().toISOString());
      const lastDay = addDays(endDay, 30) < today ? addDays(endDay, 30) : today;
      const materials = new Set(receptions.map((r) => lotMaterialKey(r.product)));
      const items = await readPages(() => (supabase as any).from("stock_transfer_items")
        .select("id, inventory_item_id, quantity, net_quantity, unit, created_at, stock_transfers:transfer_id!inner(transfer_date, notes, destination), inventory:inventory_item_id(name, unit)")
        .ilike("stock_transfers.destination", "%produc%")
        .gte("created_at", dayBounds(startDay).start).lte("created_at", dayBounds(lastDay).end)
        .order("id"));
      const transfers: JourneyTransfer[] = [];
      for (const it of items as any[]) {
        if (!isProductionDestination(it.stock_transfers?.destination)) continue;
        const material = lotMaterialKey(it.inventory?.name);
        if (!materials.has(material)) continue;
        transfers.push({
          inventoryId: it.inventory_item_id,
          material,
          day: it.stock_transfers?.transfer_date || businessDay(it.created_at),
          kg: transferStockQuantity(it, it.inventory?.unit),
          line: parseTransferLine(it.stock_transfers?.notes).line?.replace(/\s*\[[^\]]*\]/g, "").trim() || null,
        });
      }

      // 5) Sesiunile de producție și rețetele produselor
      const sessRows = await readPages(() => (supabase as any).from("productie_sesiuni_lucru")
        .select("id, ora_start, ora_sfarsit, cantitate_produsa, productie_comenzi:comanda_id(produs_id, productie_produse(nume))")
        .gte("ora_start", dayBounds(startDay).start).lte("ora_start", dayBounds(lastDay).end)
        .order("id"));
      const prodIds = (sessRows as any[]).map((s) => s.productie_comenzi?.produs_id).filter(Boolean);
      const recipeRows = await inBatches(prodIds, async (s) => readPages(() => (supabase as any).from("productie_retete")
        .select("id, produs_id, activa, productie_retete_ingrediente(cantitate_necesara, unitate_masura, productie_ingrediente(nume))")
        .in("produs_id", s).order("id")));
      const recipes: RecipeMap = new Map();
      const byProduct = new Map<string, any[]>();
      for (const r of recipeRows as any[]) (byProduct.get(r.produs_id) || byProduct.set(r.produs_id, []).get(r.produs_id)!).push(r);
      for (const [pid, list] of byProduct) {
        const chosen = list.find((r) => r.activa) || list[0];
        const lines = (chosen?.productie_retete_ingrediente || []).map((i: any) => {
          const u = (i.unitate_masura || "gr").toLowerCase();
          const q = Number(i.cantitate_necesara || 0);
          return { material: lotMaterialKey(i.productie_ingrediente?.nume), grams: u === "kg" ? q * 1000 : q };
        }).filter((l: any) => l.material && l.grams > 0);
        recipes.set(pid, lines);
      }
      const sessions: JourneySession[] = (sessRows as any[])
        .filter((s) => (recipes.get(s.productie_comenzi?.produs_id) || []).some((l) => materials.has(l.material)))
        .map((s) => ({
          id: s.id,
          day: businessDay(s.ora_start),
          productId: s.productie_comenzi?.produs_id || null,
          productName: s.productie_comenzi?.productie_produse?.nume || "Produs",
          pieces: Number(s.cantitate_produsa || 0),
          start: s.ora_start || null,
          end: s.ora_sfarsit || null,
        }));

      // 6) Rebutul sesiunilor (Cloud) și corecturile manuale ale Andradei
      const [rebutRows, ovRows] = await Promise.all([
        inBatches(sessions.map((s) => s.id), async (s) => readPages(() => supabaseCloud.from("productie_sesiuni_rebut")
          .select("id, sesiune_id, cantitate").in("sesiune_id", s).order("id"))),
        inBatches(receptions.map((r) => r.id), async (s) => readPages(() => supabaseCloud.from("evidenta_andrada_rows")
          .select("id, reception_id, data_productie, rebut, kg_final, nr_pers, ora_start, ora_stop, observatii, schimb")
          .eq("inventory_type", LOT_OVERRIDE_TYPE).in("reception_id", s).order("id"))),
      ]);
      const rebutBySession = new Map<string, number>();
      for (const r of rebutRows as any[]) rebutBySession.set(r.sesiune_id, (rebutBySession.get(r.sesiune_id) || 0) + Number(r.cantitate || 0));
      const overrides = new Map<string, DayOverride>();
      for (const o of ovRows as any[]) {
        if (!o.reception_id || !o.data_productie) continue;
        overrides.set(overrideKey(o.reception_id, o.data_productie), {
          id: o.id, rebut: num(o.rebut), kgFinal: num(o.kg_final), nrPers: num(o.nr_pers),
          oraStart: o.ora_start || null, oraStop: o.ora_stop || null, observatii: o.observatii || null, schimb: o.schimb || null,
        });
      }

      return { receptions, transfers, sessions, recipes, rebutBySession, overrides };
    }
  }
}

/** Salvează (sau curăță) corectura manuală pentru un lot într-o zi de producție. */
export async function saveLotOverride(params: {
  receptionId: string; day: string; lot: string; produs: string; existingId?: string;
  patch: Record<string, string | number | null>;
}) {
  const { receptionId, day, lot, produs, existingId, patch } = params;
  if (existingId) {
    const { error } = await supabaseCloud.from("evidenta_andrada_rows").update(patch).eq("id", existingId);
    if (error) throw error;
    return existingId;
  }
  const { data, error } = await supabaseCloud.from("evidenta_andrada_rows").insert({
    inventory_type: LOT_OVERRIDE_TYPE, reception_id: receptionId, data: day, data_productie: day, lot, produs, ...patch,
  }).select("id").single();
  if (error) throw error;
  return (data as any).id as string;
}
