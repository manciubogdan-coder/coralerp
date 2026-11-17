import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileSpreadsheet, Truck } from 'lucide-react';
import { toast } from '@/hooks/use-custom-toast';
import { palletKgFor } from '@/lib/forecastGroups';
import { exportPurchaseOrders } from '@/lib/purchaseOrderExport';

export interface TruckOrderLine { key: string; productId: string; name: string; kg: number }

const fmt = (n: number, d = 1) => n.toLocaleString('ro-RO', { maximumFractionDigits: d });
const chunks = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

/** Supplier orders for one truck: each product gets its usual supplier (editable), one order line per product,
 *  all with the truck's arrival day as delivery date, and one Excel with a sheet per supplier. */
const TruckOrderDialog: React.FC<{
  open: boolean; onOpenChange: (v: boolean) => void; day: string; dayLabel: string; lines: TruckOrderLine[]; onCreated: () => void;
}> = ({ open, onOpenChange, day, dayLabel, lines, onCreated }) => {
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [supplierOf, setSupplierOf] = useState<Record<string, string>>({});
  const [qty, setQty] = useState<Record<string, string>>({});
  const [codes, setCodes] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQty(Object.fromEntries(lines.map((l) => [l.key, String(Math.round(l.kg))])));
    setLoading(true);
    (async () => {
      try {
        const { data: sup } = await supabase.from('suppliers').select('id, name').order('name');
        setSuppliers((sup as any) || []);
        const ids = [...new Set(lines.map((l) => l.productId))];
        const products: any[] = []; const lastOrders: any[] = [];
        for (const part of chunks(ids, 50)) {
          let res: any = await supabase.from('products').select('id, cod_produs, default_supplier_id').in('id', part);
          if (res.error) res = await supabase.from('products').select('id, cod_produs').in('id', part);
          products.push(...(res.data || []));
          for (let from = 0; from < 5000; from += 1000) {
            const { data: page } = await supabase.from('product_orders').select('product_id, supplier_id, order_date')
              .in('product_id', part).not('supplier_id', 'is', null).order('order_date', { ascending: false }).range(from, from + 999);
            lastOrders.push(...(page || []));
            if (!page || page.length < 1000) break;
          }
        }
        const last = new Map<string, string>();
        lastOrders.forEach((o) => { if (o.product_id && o.supplier_id && !last.has(o.product_id)) last.set(o.product_id, o.supplier_id); });
        const byId = new Map(products.map((p) => [p.id, p]));
        setCodes(Object.fromEntries(lines.map((l) => [l.key, byId.get(l.productId)?.cod_produs || null])));
        setSupplierOf(Object.fromEntries(lines.map((l) => [l.key, last.get(l.productId) || byId.get(l.productId)?.default_supplier_id || ''])));
      } finally { setLoading(false); }
    })();
  }, [open, lines]);

  const name = (id: string) => suppliers.find((s) => s.id === id)?.name || '';
  const groups = useMemo(() => {
    const m = new Map<string, { kg: number; pallets: number; count: number }>();
    lines.forEach((l) => {
      const q = Number(qty[l.key]) || 0; if (q <= 0) return;
      const s = supplierOf[l.key] || '';
      const g = m.get(s) ?? { kg: 0, pallets: 0, count: 0 };
      g.kg += q; g.pallets += q / (palletKgFor(l.name) || Infinity); g.count += 1; m.set(s, g);
    });
    return [...m.entries()];
  }, [lines, qty, supplierOf]);
  const missing = lines.some((l) => (Number(qty[l.key]) || 0) > 0 && !supplierOf[l.key]);
  const total = groups.reduce((s, [, g]) => s + g.pallets, 0);

  const generate = async () => {
    const active = lines.filter((l) => (Number(qty[l.key]) || 0) > 0);
    if (!active.length) { toast({ title: 'Nu există cantități de comandat', variant: 'destructive' }); return; }
    if (missing) { toast({ title: 'Alege furnizorul la fiecare produs', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const rows = active.map((l) => ({
        product_id: l.productId, supplier_id: supplierOf[l.key], quantity_ordered: Number(qty[l.key]),
        order_date: new Date().toISOString(), expected_delivery_date: day, status: 'ordered',
        notes: `Generat din camionul de ${dayLabel}`,
      }));
      const { error } = await supabase.from('product_orders').insert(rows as any);
      if (error) throw error;
      const delivery = new Date(`${day}T12:00:00`);
      const bySupplier = new Map<string, typeof active>();
      active.forEach((l) => bySupplier.set(supplierOf[l.key], [...(bySupplier.get(supplierOf[l.key]) || []), l]));
      exportPurchaseOrders([...bySupplier.entries()].map(([sid, ls]) => ({
        supplier_name: name(sid), order_date: new Date(),
        items: ls.map((l) => ({ product_code: codes[l.key] || null, product_name: l.name, quantity: Number(qty[l.key]), unit: 'kg', expected_delivery_date: delivery })),
      })), `Comenzi_camion_${day.replace(/-/g, '')}.xlsx`);
      toast({ title: 'Comenzile au fost salvate', description: `${rows.length} produse la ${bySupplier.size} furnizori, livrare ${dayLabel}` });
      onCreated();
      onOpenChange(false);
    } catch (e) {
      console.error('[TruckOrderDialog]', e);
      toast({ title: 'Eroare la salvarea comenzilor', description: (e as any)?.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2"><Truck className="h-5 w-5 text-primary" /> Comandă pentru camionul de {dayLabel}</DialogTitle>
          <DialogDescription>Fiecare produs are furnizorul de la ultima comandă; îl poți schimba. Se salvează câte o comandă pe produs, cu livrare pe {dayLabel}, și primești un Excel cu o foaie pe fiecare furnizor.</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {loading && <p className="text-sm text-muted-foreground">Caut furnizorii obișnuiți…</p>}
          <div className="border rounded-md divide-y">
            {lines.map((l) => {
              const q = Number(qty[l.key]) || 0; const per = palletKgFor(l.name);
              return (
                <div key={l.key} className="flex flex-wrap items-center gap-2 p-2 text-sm">
                  <span className="flex-1 min-w-[140px] font-medium">{l.name}</span>
                  <select className="h-9 rounded-md border bg-background px-2 text-sm max-w-[220px]" value={supplierOf[l.key] || ''}
                    onChange={(e) => setSupplierOf((p) => ({ ...p, [l.key]: e.target.value }))} aria-label={`Furnizor ${l.name}`}>
                    <option value="">Alege furnizorul…</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <Input type="number" min={0} className="w-24 text-right" value={qty[l.key] ?? ''} aria-label={`Kg ${l.name}`}
                    onChange={(e) => setQty((p) => ({ ...p, [l.key]: e.target.value }))} />
                  <span className="w-20 text-right tabular-nums text-muted-foreground">{per ? `${fmt(q / per)} pal` : 'fără normă'}</span>
                </div>);
            })}
          </div>
          {groups.length > 0 && (
            <div className="rounded-md border p-3 text-sm space-y-1">
              <div className="font-medium">Pe furnizori</div>
              {groups.map(([sid, g]) => (
                <div key={sid || 'none'} className="flex gap-2"><span className="flex-1">{sid ? name(sid) : <span className="text-destructive">fără furnizor</span>}</span>
                  <span className="tabular-nums">{g.count} produse · {fmt(g.kg, 0)} kg · {fmt(g.pallets)} pal</span></div>))}
            </div>)}
        </div>
        <DialogFooter className="p-6 pt-3 border-t">
          <div className="text-sm font-medium mr-auto">Total camion de comandat: {fmt(total)} paleți</div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Anulează</Button>
          <Button onClick={generate} disabled={saving || loading || missing}>
            <FileSpreadsheet className="h-4 w-4 mr-2" /> Generează comenzile ({groups.filter(([s]) => s).length} furnizori)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
export default TruckOrderDialog;
