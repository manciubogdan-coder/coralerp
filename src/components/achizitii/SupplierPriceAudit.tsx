import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { argusFetch } from '@/lib/argusApi';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-custom-toast';
import { ChevronDown, ChevronRight, Download, Loader2, Save, Search, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { auditLine, groupBy, parsePriceSheet, totals, type AuditLine, type InvoiceLine, type LineStatus, type PriceList, type Totals } from '@/lib/achizitii/supplierPriceAudit';

const eur = (n: number) => `${n.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const pr = (n: number | null) => n == null ? '—' : n.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
const qf = (n: number) => n.toLocaleString('ro-RO', { maximumFractionDigits: 1 });
const signed = (n: number) => <span className={cn('tabular-nums', n > 0.005 && 'text-destructive font-semibold', n < -0.005 && 'text-primary')}>{n > 0.005 ? '+' : ''}{eur(n)}</span>;
const STATUS: Record<LineStatus, { label: string; v: 'destructive' | 'outline' | 'secondary' }> = {
  ok: { label: 'Preț respectat', v: 'outline' }, peste: { label: 'Peste prețul convenit', v: 'destructive' }, sub: { label: 'Sub prețul convenit', v: 'secondary' },
  fara_pret: { label: 'Furnizor fără preț în listă', v: 'secondary' }, necunoscut: { label: 'Furnizor nelistat', v: 'secondary' },
};
const iso = (d: Date) => d.toISOString().slice(0, 10);
const firstOfPrevMonth = () => { const d = new Date(); return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1))); };

const Summary: React.FC<{ t: Totals }> = ({ t }) => (
  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
    {[
      ['Plătit (facturi Senior)', eur(t.paid), ''],
      ['Dacă furnizorii respectau prețul', eur(t.atAgreed), 'aceiași furnizori, prețul din listă'],
      ['Dacă luam totul de la cel mai ieftin', eur(t.atBest), 'fiecare ingredient de la furnizorul cu prețul cel mai mic'],
      ['Facturat peste prețul convenit', null, 'furnizorul a schimbat prețul', t.priceDiff],
      ['Cost în plus față de ideal', null, `din care ${eur(t.choiceDiff)} din alegerea furnizorului`, t.totalDiff],
    ].map(([title, val, hint, diff]) => (
      <Card key={String(title)}><CardContent className="p-3">
        <div className="text-xs text-muted-foreground">{title}</div>
        <div className="text-lg font-bold">{diff != null ? signed(Number(diff)) : val}</div>
        {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
      </CardContent></Card>))}
  </div>
);

const LinesTable: React.FC<{ lines: AuditLine[] }> = ({ lines }) => (
  <Table><TableHeader><TableRow>
    <TableHead>Data</TableHead><TableHead>Factură</TableHead><TableHead>Furnizor</TableHead><TableHead>Produs</TableHead><TableHead className="text-right">Cantitate</TableHead>
    <TableHead className="text-right">Preț facturat</TableHead><TableHead className="text-right">Preț convenit</TableHead><TableHead className="text-right">Cel mai ieftin</TableHead>
    <TableHead className="text-right">Peste convenit</TableHead><TableHead className="text-right">Din alegerea furnizorului</TableHead><TableHead className="text-right">Total în plus</TableHead><TableHead>Stare</TableHead>
  </TableRow></TableHeader><TableBody>
    {lines.map((l) => <TableRow key={l.id}>
      <TableCell className="whitespace-nowrap">{l.day.slice(8, 10)}.{l.day.slice(5, 7)}</TableCell>
      <TableCell className="whitespace-nowrap text-xs">{l.tip} {l.doc}</TableCell>
      <TableCell className="text-xs">{l.supplier ?? l.sup}</TableCell>
      <TableCell className="text-xs">{l.art}</TableCell>
      <TableCell className="text-right tabular-nums">{qf(l.q)} {l.um}</TableCell>
      <TableCell className="text-right tabular-nums">{pr(l.peur)}{l.cur !== 'EUR' && <span className="text-[10px] text-muted-foreground"> ({pr(l.pron)} lei)</span>}</TableCell>
      <TableCell className="text-right tabular-nums">{pr(l.agreed)}</TableCell>
      <TableCell className="text-right tabular-nums text-xs">{pr(l.best)} <span className="text-muted-foreground">{l.bestSupplier}</span></TableCell>
      <TableCell className="text-right">{signed(l.priceDiff)}</TableCell>
      <TableCell className="text-right">{signed(l.choiceDiff)}</TableCell>
      <TableCell className="text-right">{signed(l.totalDiff)}</TableCell>
      <TableCell><Badge variant={STATUS[l.status].v}>{STATUS[l.status].label}</Badge></TableCell>
    </TableRow>)}
  </TableBody></Table>
);

const SupplierPriceAudit: React.FC = () => {
  const { isAdmin } = useAuth();
  const [list, setList] = useState<PriceList>({ currency: 'EUR', items: [], suppliers: [] });
  const [meta, setMeta] = useState<{ by: string | null; at: string | null }>({ by: null, at: null });
  const [start, setStart] = useState(firstOfPrevMonth());
  const [end, setEnd] = useState(iso(new Date()));
  const [raw, setRaw] = useState<InvoiceLine[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    argusFetch('supplier_prices').then((r: any) => { setList(r.list); setMeta({ by: r.updated_by, at: r.updated_at }); })
      .catch((e) => toast({ title: 'Lista de prețuri nu s-a încărcat', description: (e as Error).message, variant: 'destructive' }));
  }, []);

  const run = async () => {
    setLoading(true);
    try { const r: any = await argusFetch('supplier_price_audit', {}, { start, end }); setRaw(r.lines ?? []); }
    catch (e) { toast({ title: 'Nu am putut citi facturile din Senior', description: (e as Error).message, variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  const lines = useMemo(() => (raw ?? []).map((l) => auditLine(l, list)), [raw, list]);
  const shown = onlyIssues ? lines.filter((l) => l.status === 'peste' || l.totalDiff > 0.005) : lines;
  const t = useMemo(() => totals(lines), [lines]);
  const byProduct = useMemo(() => groupBy(shown, (l) => l.art), [shown]);
  const bySupplier = useMemo(() => groupBy(shown, (l) => l.supplier ?? l.sup), [shown]);
  const suppliers = useMemo(() => [...new Set(list.items.flatMap((i) => Object.keys(i.prices)))].sort(), [list]);

  const exportXlsx = () => {
    const rows = lines.map((l) => ({ Data: l.day, Document: `${l.tip} ${l.doc}`, 'Furnizor Senior': l.sup, Furnizor: l.supplier ?? '', Produs: l.art, UM: l.um, Cantitate: l.q,
      'Preț facturat EUR': l.peur ?? 0, 'Preț convenit EUR': l.agreed ?? '', 'Cel mai ieftin EUR': l.best ?? '', 'Furnizor cel mai ieftin': l.bestSupplier ?? '',
      'Plătit EUR': l.paid, 'Peste convenit EUR': l.priceDiff, 'Din alegerea furnizorului EUR': l.choiceDiff, 'Total în plus EUR': l.totalDiff, Stare: STATUS[l.status].label }));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Facturi');
    XLSX.writeFile(wb, `Control_preturi_furnizori_${start}_${end}.xlsx`);
  };

  const importXlsx = async (f: File) => {
    const wb = XLSX.read(await f.arrayBuffer());
    const items = wb.SheetNames.filter((n) => !/detaliu|date/i.test(n)).flatMap((n) => parsePriceSheet(XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1 }) as unknown[][], n));
    if (!items.length) return toast({ title: 'Nu am găsit coloana „Produs” în fișier', variant: 'destructive' });
    setList((l) => ({ ...l, items })); setDirty(true);
    toast({ title: `${items.length} produse citite — apasă „Salvează lista”` });
  };
  const setPrice = (product: string, sup: string, v: string) => {
    setList((l) => ({ ...l, items: l.items.map((i) => { if (i.product !== product) return i; const prices = { ...i.prices }; const n = Number(v.replace(',', '.')); if (v.trim() && n > 0) prices[sup] = n; else delete prices[sup]; return { ...i, prices }; }) }));
    setDirty(true);
  };
  const save = async () => {
    try { const r: any = await argusFetch('supplier_prices_save', {}, { list }); setList(r.list); setDirty(false); setMeta({ by: 'tu', at: new Date().toISOString() }); toast({ title: 'Lista de prețuri salvată' }); }
    catch (e) { toast({ title: 'Nu s-a salvat', description: (e as Error).message, variant: 'destructive' }); }
  };
  const toggle = (k: string) => setOpen((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const Grouped: React.FC<{ groups: { key: string; lines: AuditLine[]; t: Totals }[]; prefix: string; label: string }> = ({ groups, prefix, label }) => (
    <Table><TableHeader><TableRow><TableHead>{label}</TableHead><TableHead className="text-right">Cantitate</TableHead><TableHead className="text-right">Plătit</TableHead>
      <TableHead className="text-right">Peste convenit</TableHead><TableHead className="text-right">Din alegerea furnizorului</TableHead><TableHead className="text-right">Total în plus</TableHead><TableHead className="text-right">Linii cu probleme</TableHead></TableRow></TableHeader>
      <TableBody>{groups.map((g) => { const k = prefix + g.key; const isOpen = open.has(k); return <React.Fragment key={k}>
        <TableRow className="cursor-pointer" onClick={() => toggle(k)}>
          <TableCell className="font-medium">{isOpen ? <ChevronDown className="inline h-4 w-4" /> : <ChevronRight className="inline h-4 w-4" />} {g.key}</TableCell>
          <TableCell className="text-right tabular-nums">{qf(g.t.qty)}</TableCell><TableCell className="text-right tabular-nums">{eur(g.t.paid)}</TableCell>
          <TableCell className="text-right">{signed(g.t.priceDiff)}</TableCell><TableCell className="text-right">{signed(g.t.choiceDiff)}</TableCell><TableCell className="text-right">{signed(g.t.totalDiff)}</TableCell>
          <TableCell className="text-right">{g.t.issues || '—'}</TableCell>
        </TableRow>
        {isOpen && <TableRow><TableCell colSpan={7} className="bg-muted/30 p-2">
          {prefix === 'p:' && (() => { const item = list.items.find((i) => i.product === g.key); const best = item && Object.entries(item.prices).sort((a, b) => a[1] - b[1]);
            return best?.length ? <p className="text-xs mb-2">Cum trebuia: <b>{best[0][0]}</b> la {pr(best[0][1])} €/{g.lines[0]?.um.toLowerCase()} → {eur(g.t.atBest)} în loc de {eur(g.t.paid)}. Prețuri în listă: {best.map(([s, p]) => `${s} ${pr(p)}`).join(' · ')}</p> : null; })()}
          <LinesTable lines={g.lines} />
        </TableCell></TableRow>}
      </React.Fragment>; })}</TableBody></Table>
  );

  return (
    <div className="space-y-3">
      <Card><CardContent className="p-3 flex flex-wrap items-end gap-3">
        <div><Label className="text-xs">De la</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="h-9 w-40" /></div>
        <div><Label className="text-xs">Până la</Label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="h-9 w-40" /></div>
        <Button onClick={run} disabled={loading || !start || !end}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Analizează facturile</Button>
        <div className="flex items-center gap-2"><Switch checked={onlyIssues} onCheckedChange={setOnlyIssues} id="pi" /><Label htmlFor="pi" className="text-sm">Doar ce m-a costat în plus</Label></div>
        {raw && <Button variant="outline" size="sm" onClick={exportXlsx}><Download className="h-4 w-4" /> Excel</Button>}
        <p className="text-xs text-muted-foreground basis-full">Facturile furnizorilor (FF, FFI, FFIC) din Senior pentru produsele din lista de prețuri. Prețurile în lei sunt trecute în EUR la cursul BNR al zilei facturii. „Cel mai ieftin” nu ține cont de cât poate livra fiecare furnizor.</p>
      </CardContent></Card>

      <Tabs defaultValue="produs">
        <TabsList><TabsTrigger value="produs">Pe ingredient</TabsTrigger><TabsTrigger value="furnizor">Pe furnizor</TabsTrigger><TabsTrigger value="linii">Toate facturile</TabsTrigger><TabsTrigger value="lista">Lista de prețuri</TabsTrigger></TabsList>
        {(['produs', 'furnizor', 'linii'] as const).map((v) => <TabsContent key={v} value={v} className="space-y-3">
          {!raw ? <p className="text-sm text-muted-foreground p-4">Alege perioada și apasă „Analizează facturile”.</p> : <>
            <Summary t={t} />
            <Card><CardContent className="p-0 overflow-x-auto">
              {v === 'produs' && <Grouped groups={byProduct} prefix="p:" label="Ingredient" />}
              {v === 'furnizor' && <Grouped groups={bySupplier} prefix="s:" label="Furnizor" />}
              {v === 'linii' && <LinesTable lines={shown} />}
            </CardContent></Card>
          </>}
        </TabsContent>)}
        <TabsContent value="lista">
          <Card><CardHeader className="py-3 flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-base">Prețuri convenite (EUR / unitate Senior){meta.at && <span className="text-xs font-normal text-muted-foreground ml-2">actualizat {new Date(meta.at).toLocaleDateString('ro-RO')} · {meta.by}</span>}</CardTitle>
            {isAdmin && <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild><label className="cursor-pointer"><Upload className="h-4 w-4" /> Încarcă Excel<input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importXlsx(f); e.target.value = ''; }} /></label></Button>
              <Button size="sm" onClick={save} disabled={!dirty}><Save className="h-4 w-4" /> Salvează lista</Button>
            </div>}
          </CardHeader><CardContent className="p-0 overflow-x-auto">
            <Table><TableHeader><TableRow><TableHead>Produs</TableHead>{suppliers.map((s) => <TableHead key={s} className="text-right text-xs">{s}</TableHead>)}</TableRow></TableHeader>
              <TableBody>{list.items.map((i) => { const min = Math.min(...Object.values(i.prices)); return <TableRow key={i.product}>
                <TableCell className="text-xs font-medium whitespace-nowrap">{i.product}</TableCell>
                {suppliers.map((s) => <TableCell key={s} className={cn('text-right p-1', i.prices[s] === min && 'bg-primary/10 font-semibold')}>
                  {isAdmin ? <Input className="h-7 w-20 text-right ml-auto" defaultValue={i.prices[s] ?? ''} onBlur={(e) => { if (String(i.prices[s] ?? '') !== e.target.value) setPrice(i.product, s, e.target.value); }} /> : pr(i.prices[s] ?? null)}
                </TableCell>)}
              </TableRow>; })}</TableBody></Table>
          </CardContent></Card>
          <p className="text-xs text-muted-foreground mt-2">Verde = cel mai ieftin furnizor pentru produs. Excelul trebuie să aibă o foaie pe categorie cu coloana „Produs” și câte o coloană pe furnizor.</p>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SupplierPriceAudit;
