import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, Loader2, Plus, Repeat, Settings2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { supabaseCloud } from "@/integrations/supabase/cloudClient";
import { argusFetch } from "@/lib/argusApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DEFAULT_SUBSTITUTIONS, settingsFromRow, validSubstitutions,
  type MaterialChange, type PriceLine, type SubstitutionRule, type SubstitutionSettings,
} from "@/lib/productie/recipeSubstitution";

const kg = (n: number, d = 1) => n.toLocaleString("ro-RO", { minimumFractionDigits: d, maximumFractionDigits: d });
const lei = (n: number) => n.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const SETTINGS_KEY = ["retetar-inlocuiri"];

export function useSubstitutionSettings() {
  return useQuery({
    queryKey: SETTINGS_KEY,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<SubstitutionSettings> => {
      const { data, error } = await supabaseCloud.from("productie_retetar_inlocuiri").select("rules, max_increase_pct").eq("id", true).maybeSingle();
      if (error) throw error;
      return settingsFromRow(data as any);
    },
  });
}

/** Purchase price per kg of every raw material, from Senior NIR entries (by the raw-material code). */
export function useRawMaterialPrices() {
  return useQuery({
    queryKey: ["retetar-mp-preturi"],
    staleTime: 30 * 60_000,
    retry: false,
    queryFn: async (): Promise<{ prices: PriceLine[]; basis: string }> => {
      const { data, error } = await supabase.from("products").select("name, cod_produs").not("cod_produs", "is", null).order("name").range(0, 999);
      if (error) throw error;
      const byCode = new Map<string, string[]>();
      (data || []).forEach((p: any) => { const c = String(p.cod_produs).trim(); if (c) byCode.set(c, [...(byCode.get(c) || []), String(p.name)]); });
      if (!byCode.size) return { prices: [], basis: "" };
      const r = await argusFetch<{ prices: { code: string; pricePerKg: number; basis: string }[] }>("retetar_mp_prices", {}, { codes: [...byCode.keys()] });
      const prices = r.prices.flatMap(p => (byCode.get(p.code) || []).map(name => ({ name, pricePerKg: p.pricePerKg })));
      return { prices, basis: [...new Set(r.prices.map(p => p.basis))].join(", ") };
    },
  });
}

function changeText(c: MaterialChange) {
  const parts: string[] = [];
  c.replaced.forEach(r => parts.push(`${r.nume} ${kg(r.netKg)} kg`));
  c.supplemented.forEach(s => parts.push(`mai mult ${s.nume} ${kg(s.netKg)} kg${s.pricePerKg != null ? ` (${lei(s.pricePerKg)} lei/kg)` : ""}`));
  return parts.join(" · ");
}

export function SubstitutionPanel({ changes, costDelta, unpriced, applied, setApplied, prices, ingredients }: {
  changes: MaterialChange[]; costDelta: number; unpriced: string[];
  applied: boolean; setApplied: (v: boolean) => void;
  prices: ReturnType<typeof useRawMaterialPrices>; ingredients: string[];
}) {
  const [editing, setEditing] = useState(false);
  const uncovered = changes.filter(c => c.uncoveredNetKg > 0);
  return (
    <Card className={changes.length ? "border-crm-warning border-2" : undefined}>
      <CardContent className="pt-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Repeat className="h-5 w-5 text-crm-warning" />
          <h3 className="font-bold">Înlocuiri în rețete</h3>
          <span className="text-sm text-muted-foreground">
            {changes.length ? `${changes.length} ${changes.length === 1 ? "materie primă înlocuită" : "materii prime înlocuite"}` : "Nu e nevoie de înlocuiri"}
          </span>
          <label className="ml-auto flex items-center gap-2 text-sm font-medium cursor-pointer">
            <Switch checked={applied} onCheckedChange={setApplied} aria-label="Aplică înlocuirile în foi" />
            {applied ? "Aplicate în foi, print și Excel" : "Neaplicate — foile arată rețeta originală"}
          </label>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Settings2 className="h-4 w-4 mr-1" />Reguli de înlocuire</Button>
        </div>
        {changes.length > 0 && (
          <ul className="space-y-1 text-sm">
            {changes.map(c => (
              <li key={c.nume} className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-semibold">{c.nume}</span>
                <span className="text-muted-foreground">{c.reason === "always" ? `mereu înlocuit în salatele mixte (${kg(c.netKg)} kg net)` : `lipsesc ${kg(c.netKg)} kg net`}</span>
                <ArrowRight className="h-3.5 w-3.5 self-center text-muted-foreground" />
                <span>{changeText(c) || "nimic disponibil"}</span>
                {c.uncoveredNetKg > 0 && <span className="font-semibold text-destructive">tot lipsesc {kg(c.uncoveredNetKg)} kg — rămân în rețetă</span>}
              </li>
            ))}
          </ul>
        )}
        {changes.length > 0 && (
          <p className="text-sm">
            Cost materie primă față de rețeta originală:{" "}
            <span className={`font-bold ${costDelta > 0 ? "text-destructive" : "text-primary"}`}>{costDelta > 0 ? "+" : ""}{lei(costDelta)} lei</span>
            {unpriced.length > 0 && <span className="text-xs text-muted-foreground"> (fără preț pentru: {unpriced.join(", ")})</span>}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Întâi se folosește înlocuitorul din regulă, doar din stocul de care nu au nevoie celelalte comenzi ale zilei. Ce nu ajunge se completează din celelalte ingrediente ale aceleiași rețete, întâi cele mai ieftine, fiecare cel mult cu procentul din reguli. Ingredientele schimbate sunt marcate cu galben în foi.
          {prices.isLoading && " Se încarcă prețurile din Senior…"}
          {prices.data?.basis && ` Prețuri: ${prices.data.basis} din Senior.`}
        </p>
        {prices.error && <p className="text-xs text-crm-warning font-medium">Prețurile din Senior nu sunt disponibile ({(prices.error as Error).message}); ingredientele se completează în ordine alfabetică, nu după preț.</p>}
        {uncovered.length > 0 && <p className="text-xs text-destructive">Ce nu se poate acoperi apare în continuare ca lipsă mai sus, cu magazinele afectate.</p>}
        {editing && <SubstitutionRulesDialog ingredients={ingredients} onClose={() => setEditing(false)} />}
      </CardContent>
    </Card>
  );
}

const NONE = "";

function IngredientSelect({ value, onChange, options, placeholder, label }: { value: string; onChange: (v: string) => void; options: string[]; placeholder: string; label: string }) {
  const list = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <select aria-label={label} value={value} onChange={e => onChange(e.target.value)}
      className="h-9 w-44 rounded-md border border-input bg-background px-2 text-sm">
      <option value={NONE}>{placeholder}</option>
      {list.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function SubstitutionRulesDialog({ ingredients, onClose }: { ingredients: string[]; onClose: () => void }) {
  const cache = useQueryClient();
  const saved = useSubstitutionSettings();
  const [draft, setDraft] = useState<SubstitutionSettings | null>(null);
  useEffect(() => { if (saved.data && !draft) setDraft(saved.data); }, [saved.data, draft]);
  const save = useMutation({
    mutationFn: (s: SubstitutionSettings) => argusFetch<SubstitutionSettings>("retetar_substitutions_save", {}, validSubstitutions(s)),
    onSuccess: async () => { await cache.invalidateQueries({ queryKey: SETTINGS_KEY }); toast.success("Regulile de înlocuire au fost salvate."); onClose(); },
    onError: (e: Error) => toast.error(`Nu s-a salvat: ${e.message}`),
  });
  const set = (i: number, patch: Partial<SubstitutionRule>) => setDraft(d => d && ({ ...d, rules: d.rules.map((r, k) => k === i ? { ...r, ...patch } : r) }));
  const setTo = (i: number, slot: number, v: string) => setDraft(d => {
    if (!d) return d;
    const to = [...d.rules[i].to]; to[slot] = v;
    return { ...d, rules: d.rules.map((r, k) => k === i ? { ...r, to: to.filter(Boolean) } : r) };
  });

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader><DialogTitle>Reguli de înlocuire a materiei prime</DialogTitle></DialogHeader>
        {!draft ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Se încarcă…</div> : (
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            <p className="text-sm text-muted-foreground">Alege cu ce înlocuiești un ingredient când nu ajunge. Fără înlocuitor, se pune mai mult din celelalte ingrediente ale rețetei, întâi cele mai ieftine. „Mereu în salatele mixte” înseamnă că ingredientul se înlocuiește chiar dacă e pe stoc (de exemplu Iceberg, pus doar în teorie).</p>
            {draft.rules.map((r, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 rounded-md border p-2">
                <IngredientSelect label="Ingredient care lipsește" value={r.from} onChange={v => set(i, { from: v })} options={ingredients} placeholder="Ce lipsește" />
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <IngredientSelect label="Primul înlocuitor" value={r.to[0] ?? ""} onChange={v => setTo(i, 0, v)} options={ingredients} placeholder="Fără înlocuitor" />
                {r.to.length > 0 && <IngredientSelect label="Al doilea înlocuitor" value={r.to[1] ?? ""} onChange={v => setTo(i, 1, v)} options={ingredients} placeholder="(al doilea, opțional)" />}
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <Checkbox checked={r.always} disabled={!r.to.length} onCheckedChange={v => set(i, { always: v === true })} />
                  Mereu în salatele mixte
                </label>
                <Button size="icon" variant="ghost" className="ml-auto" aria-label={`Șterge regula ${r.from}`} onClick={() => setDraft(d => d && ({ ...d, rules: d.rules.filter((_, k) => k !== i) }))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => setDraft(d => d && ({ ...d, rules: [...d.rules, { from: "", to: [], always: false }] }))}><Plus className="h-4 w-4 mr-1" />Adaugă regulă</Button>
            <label className="flex items-center gap-2 text-sm">
              Un ingredient poate crește cel mult cu
              <Input type="number" min={0} max={300} className="w-20 h-9" value={draft.maxIncreasePct} onChange={e => setDraft(d => d && ({ ...d, maxIncreasePct: Number(e.target.value) }))} />
              % față de rețetă
            </label>
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => setDraft(DEFAULT_SUBSTITUTIONS)}>Revino la regulile inițiale</Button>
          <Button variant="outline" onClick={onClose}>Renunță</Button>
          <Button disabled={!draft || save.isPending} onClick={() => draft && save.mutate(draft)}>{save.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Salvează</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
