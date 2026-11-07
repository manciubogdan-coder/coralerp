import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PriceParameters, PARAMETER_FIELDS } from "./PriceParameters";
import { CONFIG_NUMBERS, type PriceConfig, validPriceConfig } from "../../../supabase/functions/_shared/priceConfig";

export default function LivePriceFilters({ config, values, onChange, onRun, busy }: { config?: PriceConfig; values: Record<string, string>; onChange: (v: Record<string, string>) => void; onRun: () => void; busy?: boolean }) {
  const [draft, setDraft] = useState<PriceConfig>(() => {
    try { return validPriceConfig(JSON.parse(values.price_config ?? "null")) ?? config ?? {}; } catch { return config ?? {}; }
  });
  const set = (c: PriceConfig) => { setDraft(c); onChange({ ...values, price_config: JSON.stringify(c) }); };
  const fields = Object.fromEntries(PARAMETER_FIELDS.map(([k]) => [k, String((draft as any)[k] ?? (draft.rates as any)?.[k] ?? "")]));
  return <details className="mb-3 border-y py-2"><summary className="cursor-pointer text-sm font-medium">Filtre și parametri fișă preț</summary><div className="mt-3 space-y-3">
    <div className="grid grid-cols-2 gap-2"><label className="text-xs">Anul<Input type="number" min={2016} max={2099} value={draft.year ?? ""} onChange={(e) => set({ ...draft, year: Number(e.target.value) })} /></label><label className="text-xs">Luna<Input type="number" min={1} max={12} value={draft.month ?? ""} onChange={(e) => set({ ...draft, month: Number(e.target.value) })} /></label></div>
    <PriceParameters values={fields} setValue={(k, v) => {
      const next = structuredClone(draft);
      const value = Number(v.replace(",", "."));
      if ((CONFIG_NUMBERS as readonly string[]).includes(k)) { if (v === "") delete (next as any)[k]; else (next as any)[k] = value; }
      else { next.rates ??= {}; if (v === "") delete (next.rates as any)[k]; else (next.rates as any)[k] = value; }
      set(next);
    }} mode={draft.rawPriceMode ?? "annual"} setMode={(rawPriceMode) => set({ ...draft, rawPriceMode })} route={draft.route ?? "România"} setRoute={(route) => { const next = { ...draft, route }; delete next.distributionTotal; delete next.distributionPallets; delete next.distributionPerPallet; set(next); }} line={draft.labourLine ?? ""} setLine={(labourLine) => { const next = { ...draft, rates: { ...draft.rates } }; delete next.rates.labourPerPiece; delete next.rates.utilitiesPerPiece; for (const k of ["labourPeople", "labourSpeed", "labourHourCost", "labourOverheadPct"] as const) delete next[k]; if (labourLine) next.labourLine = labourLine; else delete next.labourLine; set(next); }} basis={draft.supplyBasis ?? "pallet"} setBasis={(supplyBasis) => set({ ...draft, supplyBasis })} />
    {Object.entries(draft.components ?? {}).map(([id, c]) => <div key={id} className="grid gap-2 sm:grid-cols-4">{(["price", "qty", "lossPct", "kgPerPallet"] as const).map((k) => <label key={k} className="text-xs text-muted-foreground">Componentă {id} · {({ price: "Preț", qty: "Cantitate", lossPct: "PT %", kgPerPallet: "kg/palet" })[k]}<Input inputMode="decimal" value={c[k] ?? ""} onChange={(e) => { const row = { ...c }; if (!e.target.value) delete row[k]; else row[k] = Number(e.target.value.replace(",", ".")); set({ ...draft, components: { ...draft.components, [id]: row } }); }} /></label>)}</div>)}
    <Button size="sm" onClick={onRun} disabled={busy || !validPriceConfig(draft)}>Actualizează fișa</Button>
  </div></details>;
}