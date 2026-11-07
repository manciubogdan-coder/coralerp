import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, RotateCcw, Save, Trash2, Undo2 } from "lucide-react";
import { toast } from "@/hooks/use-custom-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { argusFetch } from "@/lib/argusApi";
import { SENIOR_ROUTES } from "../../../supabase/functions/_shared/priceConfig";
import { lineRates, setPriceRules, validPriceRules, type PriceRules, type RulesMeta } from "../../../supabase/functions/_shared/priceRules";

type Line = { name: string; people: string; speed: string; hourCost: string; overheadPct: string; note: string; builtIn?: boolean };
type Draft = {
  labourOverheadPct: string; truckPallets: string; marginPct: string; eurBufferPct: string; techLossPct: string; latestCostDays: string; loadDays: string;
  lines: Line[];
  palletGroups: Array<{ label: string; keywords: string; kgPerPallet: string }>;
  tradedGoods: Array<{ label: string; keywords: string; piecesPerPallet: string; note: string }>;
  routePairs: Array<{ a: string; b: string }>;
  cityRoutes: Array<{ city: string; route: string }>;
  countyRoutes: Array<{ county: string; route: string }>;
};
type Response = RulesMeta & { defaults: PriceRules };

const s = (v: number | null | undefined, d = 4) => (v == null ? "" : String(Math.round(v * 10 ** d) / 10 ** d));
const n = (v: string) => (v.trim() === "" ? NaN : Number(v.replace(",", ".")));
const fmt = (v: number | null, d = 3) => (v == null || !Number.isFinite(v) ? "—" : v.toLocaleString("ro-RO", { minimumFractionDigits: d, maximumFractionDigits: d }));

function toDraft(r: PriceRules): Draft {
  return {
    labourOverheadPct: s(r.labourOverheadPct), truckPallets: s(r.truckPallets), marginPct: s(r.marginPct), eurBufferPct: s(r.eurBufferPct),
    techLossPct: s(r.techLossPct), latestCostDays: s(r.latestCostDays), loadDays: s(r.loadDays),
    lines: r.lines.map((l) => ({ name: l.name, people: s(l.people), speed: s(l.speed), hourCost: s(l.hourCost), overheadPct: s(l.overheadPct), note: l.note ?? "", builtIn: l.builtIn })),
    palletGroups: r.palletGroups.map((g) => ({ label: g.label, keywords: Array.isArray(g.keywords) ? g.keywords.join(", ") : String(g.keywords ?? ""), kgPerPallet: s(g.kgPerPallet) })),
    tradedGoods: r.tradedGoods.map((g) => ({ label: g.label, keywords: Array.isArray(g.keywords) ? g.keywords.join(", ") : String(g.keywords ?? ""), piecesPerPallet: s(g.piecesPerPallet), note: g.note })),
    routePairs: r.routePairs.map(([a, b]) => ({ a, b })),
    cityRoutes: r.cityRoutes.map((c) => ({ ...c })),
    countyRoutes: Object.entries(r.countyRoutes).map(([county, route]) => ({ county, route })),
  };
}
/** Hour costs are shown rounded; an unchanged rounded value keeps the exact saved value. */
function fromDraft(d: Draft, base: PriceRules) {
  return {
    labourOverheadPct: n(d.labourOverheadPct), truckPallets: n(d.truckPallets), marginPct: n(d.marginPct), eurBufferPct: n(d.eurBufferPct),
    techLossPct: n(d.techLossPct), latestCostDays: n(d.latestCostDays), loadDays: n(d.loadDays),
    lines: d.lines.map((l) => {
      const b = base.lines.find((x) => x.name === l.name), h = n(l.hourCost), o = n(l.overheadPct);
      const keep = (typed: number, exact: number | undefined) => (exact != null && Math.abs(exact - typed) < 0.0001 ? exact : typed);
      return { name: l.name, people: n(l.people), speed: l.speed.trim() === "" ? null : n(l.speed), hourCost: keep(h, b?.hourCost),
        ...(l.overheadPct.trim() === "" ? {} : { overheadPct: keep(o, b?.overheadPct) }), note: l.note };
    }),
    palletGroups: d.palletGroups.map((g) => ({ label: g.label, keywords: g.keywords, kgPerPallet: n(g.kgPerPallet) })),
    tradedGoods: d.tradedGoods.map((g) => ({ label: g.label, keywords: g.keywords, piecesPerPallet: n(g.piecesPerPallet), note: g.note })),
    routePairs: d.routePairs.map((p) => [p.a, p.b]),
    cityRoutes: d.cityRoutes,
    countyRoutes: Object.fromEntries(d.countyRoutes.filter((c) => c.county.trim() || c.route.trim()).map((c) => [c.county, c.route])),
  };
}

const cell = "h-8 px-2 text-sm";
function Num({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return <label className="block space-y-1"><Label className="text-xs text-muted-foreground">{label}</Label><Input aria-label={label} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />{hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}</label>;
}
function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return <Card><CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle>{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</CardHeader><CardContent className="space-y-3">{children}</CardContent></Card>;
}
function AddButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <Button type="button" size="sm" variant="outline" onClick={onClick}><Plus className="mr-1 h-4 w-4" />{children}</Button>;
}
function Remove({ label, onClick }: { label: string; onClick: () => void }) {
  return <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label={label} onClick={onClick}><Trash2 className="h-4 w-4" /></Button>;
}

export default function PriceRulesEditor({ onSaved }: { onSaved: (r: PriceRules) => void }) {
  const [meta, setMeta] = useState<Response | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const apply = (r: Response) => { setMeta(r); setDraft(toDraft(r.rules)); setPriceRules(r.rules); };
  useEffect(() => {
    argusFetch<Response>("price_rules").then(apply).catch((e) => setError((e as Error).message));
  }, []);

  const raw = useMemo(() => (draft && meta ? fromDraft(draft, meta.rules) : null), [draft, meta]);
  const check = useMemo(() => (raw ? validPriceRules(raw) : null), [raw]);
  const dirty = !!draft && !!meta && JSON.stringify(draft) !== JSON.stringify(toDraft(meta.rules));

  if (error && !meta) return <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>;
  if (!draft || !meta) return <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Se încarcă regulile…</p>;

  const set = (f: (d: Draft) => Draft) => setDraft((d) => (d ? f(d) : d));
  const setTop = (k: keyof Draft) => (v: string) => set((d) => ({ ...d, [k]: v }));
  function editRow<K extends "lines" | "palletGroups" | "tradedGoods" | "routePairs" | "cityRoutes" | "countyRoutes">(k: K, i: number, patch: Partial<Draft[K][number]>) {
    set((d) => ({ ...d, [k]: (d[k] as Array<Draft[K][number]>).map((r, j) => (j === i ? { ...r, ...patch } : r)) }));
  }
  function removeRow(k: "lines" | "palletGroups" | "tradedGoods" | "routePairs" | "cityRoutes" | "countyRoutes", i: number) {
    set((d) => ({ ...d, [k]: (d[k] as unknown[]).filter((_, j) => j !== i) }));
  }
  const overhead = n(draft.labourOverheadPct);

  const save = async () => {
    if (!raw || !check || "error" in check) return;
    setSaving(true); setError(null);
    try {
      const r = await argusFetch<Response>("price_rules_save", {}, { rules: raw });
      apply(r); onSaved(r.rules);
      toast({ title: "Reguli salvate", description: "Se aplică la următorul calcul. Apasă „Calculează” în lista de prețuri." });
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <datalist id="price-rule-routes">{SENIOR_ROUTES.map((r) => <option key={r} value={r} />)}</datalist>
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 py-4">
          <div className="mr-auto text-sm">
            <p className="font-medium">Reguli de calcul preț</p>
            <p className="text-xs text-muted-foreground">{meta.saved ? `Ultima modificare: ${new Date(meta.updatedAt!).toLocaleString("ro-RO")}${meta.updatedBy ? ` · ${meta.updatedBy}` : ""}` : "Valorile inițiale discutate (încă nemodificate)"}. Se aplică automat la fiecare calcul; în fișa unui produs le poți schimba doar pentru acel calcul.</p>
          </div>
          <Button variant="ghost" size="sm" disabled={!dirty || saving} onClick={() => setDraft(toDraft(meta.rules))}><Undo2 className="mr-1 h-4 w-4" />Anulează modificările</Button>
          <Button variant="outline" size="sm" disabled={saving} onClick={() => setDraft(toDraft(meta.defaults))}><RotateCcw className="mr-1 h-4 w-4" />Valorile inițiale</Button>
          <Button size="sm" disabled={!dirty || saving || !check || "error" in check} onClick={save}>{saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}Salvează regulile</Button>
        </CardContent>
        {(check && "error" in check && dirty) || error ? <p className="mx-6 mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">{error ?? (check as { error: string }).error}</p> : null}
      </Card>

      <Section title="Cum se construiește prețul" hint="Ordinea calculului pe bax; fiecare rând al fișei arată cifrele folosite.">
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li><b>Materie primă</b>: cantitate din rețeta Senior ÷ (1 − PT%) × preț NIR (medie anuală sau ultima săptămână). PT din Coral ERP.</li>
          <li><b>Transport aprovizionare</b>: paleți MP pe bax × (cost mediu pe camion din ultimele {draft.latestCostDays || "?"} zile ÷ paleți pe camion din ultimele {draft.loadDays || "?"} zile). Paleți = kg comandate ÷ kg/palet pe grupă; camioane = paleții unei zile ÷ {draft.truckPallets || "?"}.</li>
          <li><b>Ambalaje și etichete</b>: cantitate × ultimul preț NIR × (1 + PT ambalaj %).</li>
          <li><b>Manoperă directă</b>: oameni × cost orar pe om ÷ viteza liniei (buc/oră). <b>Regie fabrică</b> = manopera directă × regia % a liniei (implicit {draft.labourOverheadPct || "?"}%). Marfa revândută ca atare are doar regie.</li>
          <li><b>Cost producție</b> = suma de mai sus + pierdere suplimentară {draft.techLossPct || "0"}%.</li>
          <li><b>Preț poartă fabrică</b> = cost ÷ (1 − marjă brută); marja implicită {draft.marginPct || "?"}%.</li>
          <li><b>Distribuție</b>: bucăți ÷ bucăți/palet × tarif cursă (cost curse ÷ paleți livrați punctelor cursei; perechile de curse se calculează împreună).</li>
          <li><b>Preț client</b> = livrat ÷ (1 − taxe client %); în EUR la cursul BNR + {draft.eurBufferPct || "0"}% siguranță.</li>
        </ol>
      </Section>

      <Section title="Manoperă — oameni și viteză pe linie" hint="Tariful pe bucată se calculează din oameni, viteză și cost orar. Liniile inițiale nu se pot șterge, fiindcă sunt propuse automat după rețetă.">
        <div className="max-w-xs"><Num label="Regie % pentru liniile fără regie proprie" value={draft.labourOverheadPct} onChange={setTop("labourOverheadPct")} hint="Liniile din CSV au regia lor (~41%), ca tarifele rotunjite să rămână exacte" /></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px] text-sm">
            <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1">Linie</th><th>Oameni</th><th>Viteză (buc/oră)</th><th>Cost orar / om (lei)</th><th>Regie %</th><th className="text-right">Directă lei/buc</th><th className="text-right">Regie lei/buc</th><th className="text-right">Total lei/buc</th><th>Notă</th><th /></tr></thead>
            <tbody>
              {draft.lines.map((l, i) => {
                const r = lineRates({ name: l.name, people: n(l.people), speed: l.speed.trim() ? n(l.speed) : null, hourCost: n(l.hourCost), ...(l.overheadPct.trim() ? { overheadPct: n(l.overheadPct) } : {}) }, Number.isFinite(overhead) ? overhead : 0);
                return <tr key={i} className="border-t">
                  <td className="py-1 pr-2">{l.builtIn ? <span className="font-medium">{l.name}</span> : <Input aria-label="Nume linie" className={cell} value={l.name} onChange={(e) => editRow("lines", i, { name: e.target.value })} />}</td>
                  <td className="pr-2"><Input aria-label={`Oameni ${l.name}`} className={`${cell} w-20`} inputMode="decimal" value={l.people} onChange={(e) => editRow("lines", i, { people: e.target.value })} /></td>
                  <td className="pr-2"><Input aria-label={`Viteză ${l.name}`} className={`${cell} w-24`} inputMode="decimal" placeholder="din Producție" value={l.speed} onChange={(e) => editRow("lines", i, { speed: e.target.value })} /></td>
                  <td className="pr-2"><Input aria-label={`Cost orar ${l.name}`} className={`${cell} w-24`} inputMode="decimal" value={l.hourCost} onChange={(e) => editRow("lines", i, { hourCost: e.target.value })} /></td>
                  <td className="pr-2"><Input aria-label={`Regie % ${l.name}`} className={`${cell} w-20`} inputMode="decimal" placeholder={draft.labourOverheadPct} value={l.overheadPct} onChange={(e) => editRow("lines", i, { overheadPct: e.target.value })} /></td>
                  <td className="text-right tabular-nums">{fmt(r.direct, 4)}</td><td className="text-right tabular-nums">{fmt(r.overhead, 4)}</td><td className="text-right font-medium tabular-nums">{r.total == null ? "după viteza mixului" : fmt(r.total, 4)}</td>
                  <td className="pl-2"><Input aria-label={`Notă ${l.name}`} className={cell} value={l.note} onChange={(e) => editRow("lines", i, { note: e.target.value })} /></td>
                  <td>{!l.builtIn && <Remove label={`Șterge ${l.name}`} onClick={() => removeRow("lines", i)} />}</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
        <AddButton onClick={() => set((d) => ({ ...d, lines: [...d.lines, { name: "Linie nouă", people: "", speed: "", hourCost: d.lines[0]?.hourCost ?? "", overheadPct: "", note: "" }] }))}>Adaugă linie</AddButton>
      </Section>

      <Section title="Paleți materii prime (kg pe palet)" hint="O materie primă intră în prima grupă care conține unul dintre cuvinte în denumire (fără diacritice). Folosit la aprovizionare: kg comandate ÷ kg/palet.">
        {draft.palletGroups.map((g, i) => <div key={i} className="grid gap-2 sm:grid-cols-[180px_1fr_120px_40px] items-end">
          <Input aria-label="Grupă" className={cell} value={g.label} onChange={(e) => editRow("palletGroups", i, { label: e.target.value })} />
          <Input aria-label={`Cuvinte ${g.label}`} className={cell} value={g.keywords} placeholder="cuvinte despărțite prin virgulă" onChange={(e) => editRow("palletGroups", i, { keywords: e.target.value })} />
          <Input aria-label={`kg/palet ${g.label}`} className={cell} inputMode="decimal" value={g.kgPerPallet} onChange={(e) => editRow("palletGroups", i, { kgPerPallet: e.target.value })} />
          <Remove label={`Șterge ${g.label}`} onClick={() => removeRow("palletGroups", i)} />
        </div>)}
        <AddButton onClick={() => set((d) => ({ ...d, palletGroups: [...d.palletGroups, { label: "Grupă nouă", keywords: "", kgPerPallet: "" }] }))}>Adaugă grupă</AddButton>
      </Section>

      <Section title="Marfă revândută ca atare" hint="Semifabricate cumpărate gata ambalate: fără manoperă directă, doar regie; paleți = bucăți ÷ buc/palet. Toate cuvintele trebuie să apară întregi în denumire.">
        {draft.tradedGoods.map((g, i) => <div key={i} className="grid gap-2 sm:grid-cols-[180px_1fr_120px_1fr_40px] items-end">
          <Input aria-label="Marfă" className={cell} value={g.label} onChange={(e) => editRow("tradedGoods", i, { label: e.target.value })} />
          <Input aria-label={`Cuvinte ${g.label}`} className={cell} value={g.keywords} placeholder="ex. spanac, bio" onChange={(e) => editRow("tradedGoods", i, { keywords: e.target.value })} />
          <Input aria-label={`buc/palet ${g.label}`} className={cell} inputMode="decimal" value={g.piecesPerPallet} onChange={(e) => editRow("tradedGoods", i, { piecesPerPallet: e.target.value })} />
          <Input aria-label={`Notă ${g.label}`} className={cell} value={g.note} onChange={(e) => editRow("tradedGoods", i, { note: e.target.value })} />
          <Remove label={`Șterge ${g.label}`} onClick={() => removeRow("tradedGoods", i)} />
        </div>)}
        <AddButton onClick={() => set((d) => ({ ...d, tradedGoods: [...d.tradedGoods, { label: "Marfă nouă", keywords: "", piecesPerPallet: "", note: "" }] }))}>Adaugă marfă</AddButton>
      </Section>

      <Section title="Transport aprovizionare și ultimele prețuri">
        <div className="grid gap-3 sm:grid-cols-3">
          <Num label="Paleți pe camion plin" value={draft.truckPallets} onChange={setTop("truckPallets")} hint="Paleții unei zile de livrare (toți furnizorii) ÷ această capacitate" />
          <Num label="Zile pentru ultimele prețuri" value={draft.latestCostDays} onChange={setTop("latestCostDays")} hint="Cost pe camion / cursă din facturile acestor zile" />
          <Num label="Zile pentru încărcarea medie" value={draft.loadDays} onChange={setTop("loadDays")} hint="Paleți pe camion / cursă din aceste zile" />
        </div>
      </Section>

      <Section title="Distribuție — curse" hint="Cursa unui magazin: alegerea ta din lista de prețuri, apoi orașul din numele magazinului, apoi județul.">
        <p className="text-xs font-medium">Curse cu aceeași mașină (cost și paleți calculați împreună)</p>
        {draft.routePairs.map((p, i) => <div key={i} className="flex items-center gap-2">
          <Input aria-label="Cursa scurtă" list="price-rule-routes" className={`${cell} w-48`} value={p.a} onChange={(e) => editRow("routePairs", i, { a: e.target.value.toUpperCase() })} /><span className="text-sm">+</span>
          <Input aria-label="Cursa lungă" list="price-rule-routes" className={`${cell} w-48`} value={p.b} onChange={(e) => editRow("routePairs", i, { b: e.target.value.toUpperCase() })} />
          <Remove label="Șterge perechea" onClick={() => removeRow("routePairs", i)} />
        </div>)}
        <AddButton onClick={() => set((d) => ({ ...d, routePairs: [...d.routePairs, { a: "", b: "" }] }))}>Adaugă pereche</AddButton>
        <div className="grid gap-6 pt-2 lg:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-medium">Oraș în numele magazinului → cursă (primul găsit câștigă)</p>
            {draft.cityRoutes.map((c, i) => <div key={i} className="flex items-center gap-2">
              <Input aria-label="Oraș" className={`${cell} w-40`} value={c.city} onChange={(e) => editRow("cityRoutes", i, { city: e.target.value.toUpperCase() })} /><span className="text-sm">→</span>
              <Input aria-label={`Cursă pentru ${c.city}`} list="price-rule-routes" className={`${cell} w-44`} value={c.route} onChange={(e) => editRow("cityRoutes", i, { route: e.target.value.toUpperCase() })} />
              <Remove label={`Șterge ${c.city}`} onClick={() => removeRow("cityRoutes", i)} />
            </div>)}
            <AddButton onClick={() => set((d) => ({ ...d, cityRoutes: [...d.cityRoutes, { city: "", route: "" }] }))}>Adaugă oraș</AddButton>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium">Județ → cursă</p>
            {draft.countyRoutes.map((c, i) => <div key={i} className="flex items-center gap-2">
              <Input aria-label="Județ" className={`${cell} w-40`} value={c.county} onChange={(e) => editRow("countyRoutes", i, { county: e.target.value.toUpperCase() })} /><span className="text-sm">→</span>
              <Input aria-label={`Cursă pentru ${c.county}`} list="price-rule-routes" className={`${cell} w-44`} value={c.route} onChange={(e) => editRow("countyRoutes", i, { route: e.target.value.toUpperCase() })} />
              <Remove label={`Șterge ${c.county}`} onClick={() => removeRow("countyRoutes", i)} />
            </div>)}
            <AddButton onClick={() => set((d) => ({ ...d, countyRoutes: [...d.countyRoutes, { county: "", route: "" }] }))}>Adaugă județ</AddButton>
          </div>
        </div>
      </Section>

      <Section title="Marjă, pierdere și curs">
        <div className="grid gap-3 sm:grid-cols-3">
          <Num label="Marjă brută implicită %" value={draft.marginPct} onChange={setTop("marginPct")} hint="Din prețul de vânzare: cost ÷ (1 − marjă)" />
          <Num label="Pierdere suplimentară %" value={draft.techLossPct} onChange={setTop("techLossPct")} hint="Peste PT-ul din rețete" />
          <Num label="Siguranță curs EUR %" value={draft.eurBufferPct} onChange={setTop("eurBufferPct")} hint="Adăugat la cursul BNR" />
        </div>
      </Section>
    </div>
  );
}
