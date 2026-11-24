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
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-custom-toast';
import { ChevronDown, ChevronRight, Download, Loader2, Save, Search, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AuditColumnHead } from './AuditColumnHead';
import { SupplierPricePeriods } from './SupplierPricePeriods';
import { auditLine, groupBy, parsePriceSheet, totals, type AuditLine, type InvoiceLine, type LineStatus, type PriceList, type Totals, validatePricePeriods } from '@/lib/achizitii/supplierPriceAudit';

const eur = (n: number) => `${n.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const pr = (n: number | null) => n == null ? '—' : n.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
const qf = (n: number) => n.toLocaleString('ro-RO', { maximumFractionDigits: 1 });
const signed = (n: number | null) => n == null ? <span className="text-muted-foreground">—</span> : <span className={cn('tabular-nums', n > 0.005 && 'text-destructive font-semibold', n < -0.005 && 'text-primary')}>{n > 0.005 ? '+' : ''}{eur(n)}</span>;
const STATUS: Record<LineStatus, { label: string; v: 'destructive' | 'outline' | 'secondary' }> = {
  ok: { label: 'Preț respectat', v: 'outline' }, peste: { label: 'Peste prețul convenit', v: 'destructive' }, sub: { label: 'Sub prețul convenit', v: 'secondary' },
  fara_pret: { label: 'Fără listă valabilă / preț', v: 'secondary' }, necunoscut: { label: 'Furnizor nelistat', v: 'secondary' },
};
const iso = (d: Date) => d.toISOString().slice(0, 10);
const firstOfPrevMonth = () => { const d = new Date(); return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1))); };

const Summary: React.FC<{ t: Totals }> = ({ t }) => (
  <div className="space-y-2">
  {(t.withoutAgreed > 0 || t.withoutBest > 0) && <p className="text-sm text-destructive">Comparație incompletă: {t.withoutAgreed} rânduri fără preț valabil la furnizorul ales; {t.withoutBest} fără preț minim valabil. Aceste rânduri nu sunt incluse în comparațiile respective.</p>}
  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
    {[
      ['Valoare facturată', eur(t.paid), ''],
      ['1. Facturat PESTE lista furnizorului', null, `${t.overLines} rânduri · separat, ${t.underLines} rânduri facturate SUB listă: ${eur(t.under)}`, t.over],
      ['2. Rânduri cumpărate NU de la cel mai ieftin', String(t.notCheapest), `din ${t.lines} rânduri de factură`],
      ['3. Cât economiseam la cel mai mic preț', null, 'doar rânduri plătite peste cel mai mic preț din liste', t.savings],
      ['4. Pierdut că n-am luat de la cel mai ieftin', null, 'diferența de listă: furnizorul ales vs cel mai ieftin', t.choiceDiff],
    ].map(([title, val, hint, diff]) => (
      <Card key={String(title)}><CardContent className="p-3">
        <div className="text-xs text-muted-foreground">{title}</div>
        <div className="text-lg font-bold">{diff != null ? signed(Number(diff)) : val}</div>
        {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
      </CardContent></Card>))}
  </div></div>
);

const LinesTable: React.FC<{ lines: AuditLine[] }> = ({ lines }) => (
  <Table wrapperClassName="max-h-[60vh] overflow-auto"><TableHeader><TableRow>
    {['Data', 'Factură', 'Furnizor', 'Produs', 'Cantitate', 'Preț facturat (€/UM)', 'Preț din listă (€/UM)', 'Lista valabilă', '1. Conform listei?', 'Cel mai ieftin (€/UM)', '2. Era cel mai ieftin?', '3. Economie posibilă (€)', '4. Pierdut din alegere (€)'].map((label) => <AuditColumnHead key={label} label={label} right={label.includes('€') || label === 'Cantitate'} />)}
  </TableRow></TableHeader><TableBody>
    {lines.map((l) => <TableRow key={l.id}>
      <TableCell className="whitespace-nowrap">{l.day.slice(8, 10)}.{l.day.slice(5, 7)}</TableCell>
      <TableCell className="whitespace-nowrap text-xs">{l.tip} {l.doc}</TableCell>
      <TableCell className="text-xs">{l.supplier ?? l.sup}</TableCell>
      <TableCell className="text-xs">{l.art}</TableCell>
      <TableCell className="text-right tabular-nums">{qf(l.q)} {l.um}</TableCell>
      <TableCell className="text-right tabular-nums">{pr(l.peur)}{l.cur !== 'EUR' && <span className="text-[10px] text-muted-foreground"> ({pr(l.pron)} lei)</span>}</TableCell>
      <TableCell className="text-right tabular-nums">{pr(l.agreed)}</TableCell>
      <TableCell className="text-xs whitespace-nowrap">{l.validFrom ? `${l.validFrom.split('-').reverse().join('.')} – ${l.validTo?.split('-').reverse().join('.')}` : l.agreed != null ? 'Fără date (lista inițială)' : 'Nicio listă valabilă'}</TableCell>
      <TableCell><Badge variant={STATUS[l.status].v}>{STATUS[l.status].label}</Badge>{l.agreed != null && l.status !== 'ok' && <div className="text-[10px]">{signed(l.priceDiff)}</div>}</TableCell>
      <TableCell className="text-right tabular-nums text-xs">{pr(l.best)} <span className="text-muted-foreground">{l.bestSupplier}</span></TableCell>
      <TableCell>{l.isCheapest == null ? <span className="text-muted-foreground">—</span> : l.isCheapest ? <Badge variant="outline">Da</Badge> : <Badge variant="destructive">Nu</Badge>}</TableCell>
      <TableCell className="text-right">{signed(l.best == null || l.agreed == null ? null : l.savings)}</TableCell>
      <TableCell className="text-right">{signed(l.agreed == null || l.best == null ? null : l.choiceDiff)}</TableCell>
    </TableRow>)}
  </TableBody></Table>
);

const SupplierPriceAudit: React.FC = () => {
  const { isAdmin } = useAuth();
  const [list, setList] = useState<PriceList>({ currency: 'EUR', items: [], suppliers: [] });
  const [auditList, setAuditList] = useState<PriceList>({ currency: 'EUR', items: [], suppliers: [] });
  const [meta, setMeta] = useState<{ by: string | null; at: string | null }>({ by: null, at: null });
  const [start, setStart] = useState(firstOfPrevMonth());
  const [end, setEnd] = useState(iso(new Date()));
  const [raw, setRaw] = useState<InvoiceLine[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);
  const [listLoaded, setListLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    argusFetch('supplier_prices').then((r: any) => { setList(r.list); setListLoaded(true); setMeta({ by: r.updated_by, at: r.updated_at }); })
      .catch((e) => toast({ title: 'Lista de prețuri nu s-a încărcat', description: (e as Error).message, variant: 'destructive' }));
  }, []);

  const run = async () => {
    if (dirty) return toast({ title: 'Salvează întâi listele de prețuri', variant: 'destructive' });
    setLoading(true);
    try { const r: any = await argusFetch('supplier_price_audit', {}, { start, end }); setRaw(r.lines ?? []); setAuditList(r.list ?? list); if (r.list) setList(r.list); }
    catch (e) { toast({ title: 'Nu am putut citi facturile din Senior', description: (e as Error).message, variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  const lines = useMemo(() => (raw ?? []).map((l) => auditLine(l, auditList)), [raw, auditList]);
  const shown = onlyIssues ? lines.filter((l) => l.status === 'peste' || l.savings > 0.005) : lines;
  const t = useMemo(() => totals(lines), [lines]);
  const byProduct = useMemo(() => groupBy(shown, (l) => l.art), [shown]);
  const bySupplier = useMemo(() => groupBy(shown, (l) => l.supplier ?? l.sup), [shown]);
  const suppliers = useMemo(() => [...new Set(list.items.flatMap((i) => Object.keys(i.prices)))].sort(), [list]);

  const exportXlsx = () => {
    const rows = lines.map((l) => ({ Data: l.day, Document: `${l.tip} ${l.doc}`, 'Furnizor Senior': l.sup, Furnizor: l.supplier ?? '', Produs: l.art, UM: l.um, Cantitate: l.q,
      'Preț facturat EUR': l.peur ?? 0, 'Preț convenit EUR': l.agreed ?? '', 'Cel mai ieftin EUR': l.best ?? '', 'Furnizor cel mai ieftin': l.bestSupplier ?? '',
      'Valabil de la': l.validFrom ?? '', 'Valabil până la': l.validTo ?? '', 'Valoare facturată EUR': l.paid, 'Peste/sub listă EUR': l.agreed == null ? '' : l.priceDiff, 'Era cel mai ieftin': l.isCheapest == null ? '' : l.isCheapest ? 'Da' : 'Nu', 'Economie posibilă EUR': l.agreed == null || l.best == null ? '' : l.savings, 'Pierdut din alegere EUR': l.agreed == null || l.best == null ? '' : l.choiceDiff, Stare: STATUS[l.status].label }));
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
    setSaving(true);
    try { validatePricePeriods(list.periods ?? []); const r: any = await argusFetch('supplier_prices_save', {}, { list }); setList(r.list); setDirty(false); setMeta({ by: 'tu', at: new Date().toISOString() }); toast({ title: 'Lista de prețuri salvată' }); }
    catch (e) { toast({ title: 'Nu s-a salvat', description: (e as Error).message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };
  const toggle = (k: string) => setOpen((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const Grouped: React.FC<{ groups: { key: string; lines: AuditLine[]; t: Totals }[]; prefix: string; label: string }> = ({ groups, prefix, label }) => (
    <Table wrapperClassName="max-h-[60vh] overflow-auto"><TableHeader><TableRow>
      {[label, 'Cantitate', 'Valoare facturată (€)', '1. Peste/sub listă (€)', '2. Rânduri nu de la cel mai ieftin', '3. Economie posibilă (€)', '4. Pierdut din alegere (€)'].map((name) => <AuditColumnHead key={name} label={name} right={name !== label} />)}
    </TableRow></TableHeader>
      <TableBody>{groups.map((g) => { const k = prefix + g.key; const isOpen = open.has(k); return <React.Fragment key={k}>
        <TableRow className="cursor-pointer" onClick={() => toggle(k)}>
          <TableCell className="font-medium">{isOpen ? <ChevronDown className="inline h-4 w-4" /> : <ChevronRight className="inline h-4 w-4" />} {g.key}</TableCell>
          <TableCell className="text-right tabular-nums">{qf(g.t.qty)}</TableCell><TableCell className="text-right tabular-nums">{eur(g.t.paid)}</TableCell>
          <TableCell className="text-right">{signed(g.t.withoutAgreed === g.t.lines ? null : g.t.priceDiff)}</TableCell><TableCell className="text-right tabular-nums">{g.t.notCheapest || '—'}</TableCell><TableCell className="text-right">{signed(g.t.withoutBest === g.t.lines || g.t.withoutAgreed === g.t.lines ? null : g.t.savings)}</TableCell><TableCell className="text-right">{signed(g.t.withoutAgreed === g.t.lines || g.t.withoutBest === g.t.lines ? null : g.t.choiceDiff)}</TableCell>
        </TableRow>
        {isOpen && <TableRow><TableCell colSpan={7} className="bg-muted/30 p-2">
          {prefix === 'p:' && <p className="text-xs mb-2">La cele mai mici prețuri valabile în fiecare zi: <b>{eur(g.t.atBest)}</b>, comparativ cu {eur(g.t.paid)} facturat.{g.t.withoutBest > 0 && ` Atenție: ${g.t.withoutBest} rânduri fără comparație.`} Furnizorul recomandat poate fi diferit de la o zi la alta; îl vezi pe fiecare factură.</p>}
          <LinesTable lines={g.lines} />
        </TableCell></TableRow>}
      </React.Fragment>; })}</TableBody></Table>
  );

  return (
    <div className="space-y-3">
      <Card><CardContent className="p-3 flex flex-wrap items-end gap-3">
        <div><Label className="text-xs">De la</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="h-9 w-40" /></div>
        <div><Label className="text-xs">Până la</Label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="h-9 w-40" /></div>
        <Button onClick={run} disabled={loading || !listLoaded || !start || !end}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Analizează facturile</Button>
        <div className="flex items-center gap-2"><Switch checked={onlyIssues} onCheckedChange={setOnlyIssues} id="pi" /><Label htmlFor="pi" className="text-sm">Doar ce m-a costat în plus</Label></div>
        {raw && <Button variant="outline" size="sm" onClick={exportXlsx}><Download className="h-4 w-4" /> Excel</Button>}
        <p className="text-xs text-muted-foreground basis-full">Facturile furnizorilor (FF, FFI, FFIC) din Senior pentru produsele din lista de prețuri. Prețurile în lei sunt trecute în EUR la cursul BNR al zilei facturii. „Cel mai ieftin” nu ține cont de cât poate livra fiecare furnizor.</p>
      </CardContent></Card>

      <Tabs defaultValue="produs">
        <div className="overflow-x-auto"><TabsList className="w-max justify-start"><TabsTrigger value="produs">Pe ingredient</TabsTrigger><TabsTrigger value="furnizor">Pe furnizor</TabsTrigger><TabsTrigger value="linii">Toate facturile</TabsTrigger><TabsTrigger value="lista">Lista de prețuri</TabsTrigger></TabsList></div>
        {(['produs', 'furnizor', 'linii'] as const).map((v) => <TabsContent key={v} value={v} className="space-y-3">
          {!raw ? <p className="text-sm text-muted-foreground p-4">Alege perioada și apasă „Analizează facturile”.</p> : <>
            <Summary t={t} />
            {!auditList.periods?.length && <p className="text-sm text-muted-foreground">Prețuri din lista inițială, fără valabilitate confirmată. Comparația istorică devine verificabilă după adăugarea perioadelor reale.</p>}
            <Card><CardContent className="p-0">
              {v === 'produs' && <Grouped groups={byProduct} prefix="p:" label="Ingredient" />}
              {v === 'furnizor' && <Grouped groups={bySupplier} prefix="s:" label="Furnizor" />}
              {v === 'linii' && <LinesTable lines={shown} />}
            </CardContent></Card>
          </>}
        </TabsContent>)}
        <TabsContent value="lista">
          <Card><CardHeader className="py-3 flex-col items-start gap-3 space-y-0 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <CardTitle className="text-base">Liste de prețuri furnizori (EUR / unitate){meta.at && <span className="text-xs font-normal text-muted-foreground ml-2">actualizat {new Date(meta.at).toLocaleDateString('ro-RO')} · {meta.by}</span>}</CardTitle>
            {isAdmin && listLoaded && <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild><label className="cursor-pointer"><Upload className="h-4 w-4" /> Încarcă Excel<input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importXlsx(f); e.target.value = ''; }} /></label></Button>
              <Button size="sm" onClick={save} disabled={!dirty || saving}><Save className="h-4 w-4" /> Salvează toate listele</Button>
            </div>}
          </CardHeader><CardContent className="space-y-4">
            {listLoaded && <SupplierPricePeriods list={list} isAdmin={isAdmin} onChange={(next) => { setList(next); setDirty(true); }} />}
            {!list.periods?.length && <><h3 className="text-sm font-semibold">Lista inițială · fără date de valabilitate</h3>
            <Table wrapperClassName="max-h-[50vh] overflow-auto"><TableHeader><TableRow><AuditColumnHead label="Produs" />{suppliers.map((s) => <AuditColumnHead key={s} label={s} right />)}</TableRow></TableHeader>
              <TableBody>{list.items.map((i) => { const min = Math.min(...Object.values(i.prices)); return <TableRow key={i.product}>
                <TableCell className="text-xs font-medium whitespace-nowrap">{i.product}</TableCell>
                {suppliers.map((s) => <TableCell key={s} className={cn('text-right p-1', i.prices[s] === min && 'bg-primary/10 font-semibold')}>
                  {isAdmin && !list.periods?.length ? <Input className="h-7 w-20 text-right ml-auto" defaultValue={i.prices[s] ?? ''} onBlur={(e) => { if (String(i.prices[s] ?? '') !== e.target.value) setPrice(i.product, s, e.target.value); }} /> : pr(i.prices[s] ?? null)}
                </TableCell>)}
              </TableRow>; })}</TableBody></Table></>}
          </CardContent></Card>
          <p className="text-xs text-muted-foreground mt-2">Verde = minimum din lista inițială, fără confirmare istorică. Listele pe furnizor sunt verificate după data facturii. După „Aplică lista”, apasă „Salvează toate listele”; apoi reia analiza pentru noile prețuri.</p>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SupplierPriceAudit;
