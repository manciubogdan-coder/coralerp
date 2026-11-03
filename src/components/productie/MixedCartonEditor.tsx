import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { NumberInput } from '@/components/ui/number-input';
import { useMixedCartons } from '@/hooks/productie/useMixedCartons';
import { argusHeaders, ARGUS_URL } from '@/lib/argusApi';
import { edgeFetchJson } from '@/lib/edgeFetch';
import { validateCarton, expandCarton } from '../../../supabase/functions/_shared/mixedCartons';
type Product = { id: string; nume: string; unitate_masura?: string };
export default function MixedCartonEditor({ product, products, recipeIds, editRecipe }: { product: Product; products: Product[]; recipeIds: Set<string>; editRecipe: (product: Product) => void }) {
  const { data = [], isPending, isError } = useMixedCartons();
  const cache = useQueryClient();
  const [enabled, setEnabled] = useState(false);
  const [parts, setParts] = useState<{ produs_id: string; units: number }[]>([]);
  const [aliases, setAliases] = useState('');
  const [busy, setBusy] = useState(false);
  const [example, setExample] = useState(1);
  const existing = data.find(r => r.produs_id === product.id);
  useEffect(() => { setEnabled(existing?.enabled ?? false); setParts(existing?.components ?? []); setAliases(existing?.aliases.join('\n') ?? ''); }, [existing, product.id]);
  const components = parts.map(p => ({ ...p, nume: products.find(x => x.id === p.produs_id)?.nume ?? '' }));
  let preview: ReturnType<typeof expandCarton> = [];
  try { preview = expandCarton({ produs_id: product.id, denumire: product.nume, aliases: [], components, enabled }, example); } catch { /* incomplete draft */ }
  const save = async () => {
    try {
      validateCarton({ produs_id: product.id, denumire: product.nume, aliases: aliases.split('\n').map(x => x.trim()).filter(Boolean), components, enabled }, data);
      setBusy(true);
      await edgeFetchJson(ARGUS_URL.replace(/\/argus$/, '/mixed-cartons'), { method: 'POST', headers: await argusHeaders(), body: { produs_id: product.id, aliases: aliases.split('\n').map(x => x.trim()).filter(Boolean), components: parts, enabled } });
      await cache.invalidateQueries({ queryKey: ['mixed-cartons'] });
      toast.success('Compoziția baxului a fost salvată. Comenzile deja desfăcute își păstrează compoziția.');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Nu am putut salva baxul.'); } finally { setBusy(false); }
  };
  return <section className="space-y-4">
    <div className="flex items-center justify-between gap-3"><h3 className="text-lg font-semibold">Compoziție bax mixt</h3><div className="flex items-center gap-2"><Label htmlFor="mixed-enabled">Import în baxuri</Label><Switch id="mixed-enabled" checked={enabled} onCheckedChange={setEnabled} disabled={busy || isPending || isError} /></div></div>
    {isPending ? <p>Se încarcă…</p> : isError ? <p className="text-destructive">Compoziția nu s-a putut încărca.</p> : <>
      {parts.map((p, i) => <div key={i} className="grid grid-cols-[minmax(0,1fr)_90px_36px] items-end gap-2">
        <div><Label htmlFor={`part-${i}`}>Produs finit</Label><select id={`part-${i}`} className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={p.produs_id} onChange={e => setParts(parts.map((x, j) => j === i ? { ...x, produs_id: e.target.value } : x))}><option value="">Alege produsul și gramajul</option>{products.filter(x => x.id !== product.id && !data.some(r => r.enabled && r.produs_id === x.id)).map(x => <option key={x.id} value={x.id}>{x.nume}</option>)}</select>
          {p.produs_id && <Button variant="link" size="sm" className={recipeIds.has(p.produs_id) ? 'text-primary' : 'text-destructive'} onClick={() => { const found = products.find(x => x.id === p.produs_id); if (found) editRecipe(found); }}>{recipeIds.has(p.produs_id) ? 'Editează rețeta / bucată' : 'Lipsește rețeta — configurează'}</Button>}</div>
        <div><Label>Buc / bax</Label><NumberInput value={p.units} integer minValue={1} onValueChange={n => setParts(parts.map((x, j) => j === i ? { ...x, units: n } : x))} /></div>
        <Button variant="ghost" size="icon" title="Elimină componenta" onClick={() => setParts(parts.filter((_, j) => j !== i))}><Trash2 /></Button>
      </div>)}
      <Button variant="outline" onClick={() => setParts([...parts, { produs_id: '', units: 1 }])}><Plus />Adaugă produs component</Button>
      <div className="space-y-1"><Label htmlFor="carton-aliases">Alte denumiri exacte din fișiere (una pe rând)</Label><textarea id="carton-aliases" className="min-h-20 w-full rounded-md border bg-background p-2 text-sm" value={aliases} onChange={e => setAliases(e.target.value)} /></div>
      <div className="flex flex-wrap items-center gap-2 border-y py-3"><Label>Baxuri</Label><NumberInput className="w-24" integer minValue={0} value={example} onValueChange={setExample} /><span className="text-sm">{preview.length ? preview.map(c => `${c.quantity} buc ${c.nume}`).join(' + ') : 'Compoziție incompletă'}</span></div>
      {enabled && parts.some(p => !recipeIds.has(p.produs_id)) && <p className="text-sm text-destructive">Consum incomplet: configurează rețeta fiecărui produs component înainte de producție.</p>}
      <div className="flex justify-end"><Button onClick={save} disabled={busy || (!enabled && !existing)}><Save />Salvează compoziția</Button></div>
    </>}
  </section>;
}