import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LEVER_KEYS, LEVER_LABEL, PRESETS, leverImpact, leversToPct, type Levers } from "@/lib/argus/futureLevers";
import type { CostKey, Structure } from "@/lib/argus/costStructure";

const n0 = (x: number) => Math.round(x).toLocaleString("ro-RO");

/** Future scenario: legal/macro changes → cost-line % applied to the what-if scenario below. */
export default function FutureLevers({ base, what, breakEven, months, onApply }: {
  base: Structure; what: Structure; breakEven: number | null; months: number;
  onApply: (pct: Partial<Record<CostKey, number>>, feeDelta: number) => void;
}) {
  const [levers, setLevers] = useState<Levers>({});
  const [fee, setFee] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const impact = leverImpact(base.costs, levers);
  const total = impact.reduce((s, x) => s + x.lei, 0);
  const year = months > 0 ? 12 / months : 1;
  const set = (k: string, v: string) => { const x = Number(v.replace(",", ".")); if (Number.isFinite(x)) setLevers((l) => ({ ...l, [k]: x })); };
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4" />Viitor: legi, taxe și scumpiri — ce mă costă și ce fac</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => <Button key={p.id} size="sm" variant="outline" onClick={() => { setLevers(p.levers); setFee(p.feeDelta ?? 0); setNote(p.note); }}>{p.title}</Button>)}
        </div>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {LEVER_KEYS.map((k) => <label key={k} className="flex items-center justify-between gap-2 rounded border p-2"><span className="text-xs">{LEVER_LABEL[k]}</span>
            <span className="flex items-center gap-1"><Input className="h-8 w-20 text-right" inputMode="decimal" value={String(levers[k] ?? 0)} onChange={(e) => set(k, e.target.value)} />%</span></label>)}
          <label className="flex items-center justify-between gap-2 rounded border p-2"><span className="text-xs">Taxe rețea client (puncte %)</span>
            <span className="flex items-center gap-1"><Input className="h-8 w-20 text-right" inputMode="decimal" value={String(fee)} onChange={(e) => { const x = Number(e.target.value.replace(",", ".")); if (Number.isFinite(x)) setFee(x); }} />pp</span></label>
        </div>
        {total > 0 && <div className="rounded border p-2">
          <p>Fără să schimbi prețurile, costurile cresc cu <b className="text-destructive">{n0(total)} lei</b> în perioada analizată (≈ <b className="text-destructive">{n0(total * year)} lei/an</b>).</p>
          <ul className="mt-1 list-disc pl-5 text-xs">{impact.map((x) => <li key={x.lever}>{LEVER_LABEL[x.lever]}: {n0(x.lei * year)} lei/an</li>)}</ul>
        </div>}
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={!total && !fee} onClick={() => onApply(leversToPct(levers), fee)}>Aplică în scenariul de mai jos</Button>
          <span className="text-xs text-muted-foreground">Vezi apoi cine trece pe pierdere și pragul de preț.</span>
        </div>
        {what.profit !== base.profit && <div className="rounded border border-primary p-2 text-xs space-y-1">
          <p className="font-medium">Ce ar trebui făcut</p>
          {breakEven != null && breakEven > 0 && <p>• Ca să rămâi la profitul de azi trebuie să crești prețurile în medie cu <b>{breakEven.toFixed(1)}%</b> — începe renegocierea cu clienții de pe pierdere din tabelul 2.</p>}
          {impact[0] && <p>• Cea mai mare lovitură vine din „{LEVER_LABEL[impact[0].lever]}”: acolo merită optimizat primul (viteză pe linii, camioane pline, contracte fixe).</p>}
          <p>• Procentele sunt estimări: confirmă cifrele oficiale (Monitorul Oficial, contabila) înainte de a le folosi în contracte.</p>
        </div>}
      </CardContent>
    </Card>
  );
}
