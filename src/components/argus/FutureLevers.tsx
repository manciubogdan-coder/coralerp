import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Globe, Loader2, Mic } from "lucide-react";
import { argusFetch } from "@/lib/argusApi";
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
  const navigate = useNavigate();
  const [levers, setLevers] = useState<Levers>({});
  const [fee, setFee] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [scan, setScan] = useState<{ items: Array<{ lever: string; title: string; pct: number; effective: string; source: string; url: string; confirmed: boolean }>; advice: string[]; checkedAt: string } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanErr, setScanErr] = useState<string | null>(null);
  const runScan = async () => {
    setScanning(true); setScanErr(null);
    try {
      const r = await argusFetch<{ levers: Levers; items: any[]; advice: string[]; checkedAt: string }>("future_scan", {}, {});
      setScan(r); setLevers(r.levers); setFee(0); setNote(null);
      if (Object.keys(r.levers).length) onApply(leversToPct(r.levers), 0);
    } catch (e) { setScanErr((e as Error).message); } finally { setScanning(false); }
  };
  const impact = leverImpact(base.costs, levers);
  const total = impact.reduce((s, x) => s + x.lei, 0);
  const year = months > 0 ? 12 / months : 1;
  const set = (k: string, v: string) => { const x = Number(v.replace(",", ".")); if (Number.isFinite(x)) setLevers((l) => ({ ...l, [k]: x })); };
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4" />Viitor: legi, taxe și scumpiri — ce mă costă și ce fac</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <Button variant="outline" className="h-auto whitespace-normal" onClick={() => navigate('/administrativ/argus/viitor')}><Mic className="mr-2 h-4 w-4 shrink-0" />Vorbește cu Argus Viitor</Button>
        <div className="rounded border border-primary p-2 space-y-2">
          <Button size="sm" onClick={runScan} disabled={scanning}>{scanning ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Globe className="mr-1 h-4 w-4" />}{scanning ? "Argus caută legile și scumpirile… (1–2 minute)" : "Argus: caută singur ce urmează și calculează"}</Button>
          <p className="text-xs text-muted-foreground">Caută pe internet legile și scumpirile anunțate, completează procentele de mai jos și le aplică pe costurile tale reale din perioada aleasă.</p>
          {scanErr && <p className="text-xs text-destructive">{scanErr}</p>}
          {scan && <div className="space-y-1 text-xs">
            <p className="font-medium">Ce a găsit Argus ({scan.checkedAt}){!scan.items.length && " — nicio schimbare cu sursă sigură"}</p>
            {scan.items.map((i, k) => <p key={k}>• <b>{i.pct > 0 ? "+" : ""}{i.pct}%</b> {LEVER_LABEL[i.lever as keyof typeof LEVER_LABEL] ?? i.lever}: {i.title} {i.effective && `(din ${i.effective})`} — <a className="underline" href={i.url} target="_blank" rel="noreferrer">{i.source || "sursă"}</a> {i.confirmed ? "✓ lege publicată" : "· anunțat / estimare"}</p>)}
            {scan.advice.length > 0 && <><p className="font-medium pt-1">Sfaturile lui Argus</p>{scan.advice.map((a, k) => <p key={k}>• {a}</p>)}</>}
          </div>}
        </div>
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
