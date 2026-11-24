import { useState } from 'react';
import * as XLSX from 'xlsx';
import { Plus, Save, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-custom-toast';
import { validatePricePeriods, parsePriceSheet, type PriceList, type SupplierPricePeriod } from '@/lib/achizitii/supplierPriceAudit';
import { AuditColumnHead } from './AuditColumnHead';

export function SupplierPricePeriods({ list, isAdmin, onChange }: { list: PriceList; isAdmin: boolean; onChange: (list: PriceList) => void }) {
  const [draft, setDraft] = useState<SupplierPricePeriod | null>(null);
  const [supplierFilter, setSupplierFilter] = useState('');
  const names = [...new Set([...list.suppliers.map((s) => s.name), ...(list.periods ?? []).map((p) => p.supplier)])].sort();
  const periods = (list.periods ?? []).filter((p) => !supplierFilter || p.supplier.toLowerCase().includes(supplierFilter.toLowerCase())).sort((a, b) => a.supplier.localeCompare(b.supplier) || b.validFrom.localeCompare(a.validFrom));
  const startNew = (p?: SupplierPricePeriod) => setDraft({ id: crypto.randomUUID(), supplier: p?.supplier ?? '', validFrom: '', validTo: '', items: p?.items.map((i) => ({ ...i })) ?? [] });
  const apply = () => {
    if (!draft || !isAdmin) return;
    const next = [...(list.periods ?? []).filter((p) => p.id !== draft.id), { ...draft, supplier: draft.supplier.trim() }];
    try { validatePricePeriods(next); onChange({ ...list, periods: next }); setDraft(null); }
    catch (e) { toast({ title: 'Lista nu poate fi adăugată', description: (e as Error).message, variant: 'destructive' }); }
  };
  const importFile = async (file: File) => {
    if (!draft?.supplier.trim()) return toast({ title: 'Completează întâi furnizorul', variant: 'destructive' });
    try {
      const wb = XLSX.read(await file.arrayBuffer());
      const parsed = wb.SheetNames.flatMap((sheet) => parsePriceSheet(XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1 }) as unknown[][], sheet));
      const items = parsed.flatMap((i) => {
        const entry = Object.entries(i.prices).find(([key]) => key.trim().toLowerCase() === draft.supplier.trim().toLowerCase() || /^(preț|pret|price)(\s|$)/i.test(key));
        return entry ? [{ product: i.product, category: i.category, price: entry[1] }] : [];
      });
      if (!items.length) throw new Error(`Nu am găsit prețuri pentru ${draft.supplier}. Excelul trebuie să aibă coloana Produs și o coloană cu numele furnizorului sau Preț.`);
      setDraft({ ...draft, items });
    } catch (e) { toast({ title: 'Nu s-a încărcat lista', description: (e as Error).message, variant: 'destructive' }); }
  };

  return <section className="space-y-3 border-t pt-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Liste pe furnizor · valabilitate</h3>
      {isAdmin && <Button variant="outline" size="sm" onClick={() => startNew()}><Plus className="h-4 w-4" /> Listă nouă</Button>}
    </div>
    <Input aria-label="Caută furnizor în liste" placeholder="Caută furnizor" value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)} className="max-w-xs" />
    {!list.periods?.length && <p className="text-sm text-muted-foreground">Lista inițială nu are date de valabilitate. Adaugă perioadele reale; nu atribuim automat prețurile de azi facturilor vechi.</p>}
    {draft && <div className="space-y-3 rounded-md border p-3">
      <fieldset disabled={!isAdmin} className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-48"><Label htmlFor="period-supplier">Furnizor</Label><Input id="period-supplier" list="price-supplier-names" value={draft.supplier} onChange={(e) => setDraft({ ...draft, supplier: e.target.value })} /><datalist id="price-supplier-names">{names.map((s) => <option key={s} value={s} />)}</datalist></div>
        <div><Label htmlFor="period-from">Valabil de la</Label><Input id="period-from" type="date" value={draft.validFrom} onChange={(e) => setDraft({ ...draft, validFrom: e.target.value })} /></div>
        <div><Label htmlFor="period-to">Valabil până la (inclusiv)</Label><Input id="period-to" type="date" value={draft.validTo} onChange={(e) => setDraft({ ...draft, validTo: e.target.value })} /></div>
        <Button variant="outline" size="sm" asChild><label><Upload className="h-4 w-4" /> Încarcă Excel furnizor<input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = ''; }} /></label></Button>
        <Button variant="outline" size="sm" onClick={() => setDraft({ ...draft, items: list.items.flatMap((i) => i.prices[draft.supplier] != null ? [{ product: i.product, category: i.category, price: i.prices[draft.supplier] }] : []) })}>Preia prețurile inițiale</Button>
      </div>
      <Table wrapperClassName="max-h-[45vh] overflow-auto"><TableHeader><TableRow><AuditColumnHead label="Produs" /><AuditColumnHead label="Preț din listă (€/UM)" right /></TableRow></TableHeader><TableBody>
        {draft.items.map((i, index) => <TableRow key={index}><TableCell><Input aria-label={`Produs ${index + 1}`} value={i.product} onChange={(e) => setDraft({ ...draft, items: draft.items.map((r, j) => j === index ? { ...r, product: e.target.value } : r) })} /></TableCell><TableCell><Input type="number" step="0.001" min="0" aria-label={`Preț ${i.product || index + 1}`} value={i.price || ''} onChange={(e) => setDraft({ ...draft, items: draft.items.map((r, j) => j === index ? { ...r, price: Number(e.target.value) } : r) })} /></TableCell></TableRow>)}
      </TableBody></Table>
      </fieldset>
      <div className="flex flex-wrap gap-2">{isAdmin && <><Button variant="outline" size="sm" onClick={() => setDraft({ ...draft, items: [...draft.items, { product: '', category: '', price: 0 }] })}><Plus className="h-4 w-4" /> Ingredient</Button><Button size="sm" onClick={apply}><Save className="h-4 w-4" /> Aplică lista</Button></>}<Button variant="ghost" size="sm" onClick={() => setDraft(null)}><X className="h-4 w-4" /> {isAdmin ? 'Renunță' : 'Închide'}</Button></div>
    </div>}
    <div className="divide-y">{periods.map((p) => <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3"><div><b>{p.supplier}</b><p className="text-sm text-muted-foreground">{p.validFrom.split('-').reverse().join('.')} – {p.validTo.split('-').reverse().join('.')} · {p.items.length} ingrediente</p></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setDraft({ ...p, items: p.items.map((i) => ({ ...i })) })}>{isAdmin ? 'Deschide / editează' : 'Vezi prețurile'}</Button>{isAdmin && <Button variant="outline" size="sm" onClick={() => startNew(p)}><Plus className="h-4 w-4" /> Perioadă nouă</Button>}</div></div>)}</div>
  </section>;
}