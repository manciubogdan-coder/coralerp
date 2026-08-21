import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Search, PackagePlus } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Numele produsului din comandă (folosit ca text implicit de căutare) */
  numeProdus?: string;
  /** Cantitatea rămasă de alocat */
  cantitateNecesara?: number;
  onAloca: (produsId: string, cantitate: number, numeProdus: string) => void;
}

/** Normalizează denumirea ca să potrivim "SALATA ATLANTIC 100 GR KFL" cu "SALATA ATLANTIC 100". */
const normalizeNume = (s: string) =>
  (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9ăâîșț ]/gi, ' ')
    .replace(/\b(kfl|gr|g|buc|ml|l|pg)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const CautaInRestocariDialog = ({ open, onOpenChange, numeProdus, cantitateNecesara, onAloca }: Props) => {
  const [cauta, setCauta] = useState('');
  const [selectat, setSelectat] = useState<string | null>(null);
  const [cantitate, setCantitate] = useState<number>(cantitateNecesara || 0);

  React.useEffect(() => {
    if (open) {
      setCauta('');
      setSelectat(null);
      setCantitate(cantitateNecesara || 0);
    }
  }, [open, cantitateNecesara]);

  const { data: pool, isLoading } = useQuery({
    queryKey: ['pool-cautare-restocari', open],
    enabled: open,
    staleTime: 15_000,
    queryFn: async () => {
      const rows: any[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from('productie_restocari')
          .select('id, produs_id, cantitate_surplus, data_productie')
          .eq('status', 'disponibil')
          .gt('cantitate_surplus', 0)
          .range(from, from + 999);
        if (error) throw error;
        rows.push(...(data || []));
        if (!data || data.length < 1000) break;
        from += 1000;
      }

      const ids = Array.from(new Set(rows.map((r) => r.produs_id).filter(Boolean)));
      const produse: any[] = [];
      for (let i = 0; i < ids.length; i += 50) {
        const { data } = await supabase
          .from('productie_produse')
          .select('id, nume, unitate_masura')
          .in('id', ids.slice(i, i + 50));
        produse.push(...(data || []));
      }
      const map = new Map(produse.map((p: any) => [p.id, p]));

      const grupe = new Map<string, any>();
      rows.forEach((r) => {
        const det: any = map.get(r.produs_id);
        const nume = det?.nume || 'Produs necunoscut';
        if (!grupe.has(r.produs_id)) {
          grupe.set(r.produs_id, {
            produs_id: r.produs_id,
            nume,
            unitate: det?.unitate_masura || 'buc',
            total: 0,
            loturi: 0,
          });
        }
        const g = grupe.get(r.produs_id);
        g.total += Number(r.cantitate_surplus || 0);
        g.loturi += 1;
      });

      return Array.from(grupe.values()).sort((a, b) => a.nume.localeCompare(b.nume));
    },
  });

  const lista = useMemo(() => {
    const all = pool || [];
    const q = cauta.trim().toLowerCase();
    const ref = normalizeNume(numeProdus || '');
    const scored = all.map((g: any) => {
      const n = normalizeNume(g.nume);
      const potrivireAuto =
        !!ref && (n === ref || n.startsWith(ref) || ref.startsWith(n));
      return { ...g, potrivireAuto };
    });
    const filtrat = q
      ? scored.filter((g: any) => g.nume.toLowerCase().includes(q) || normalizeNume(g.nume).includes(normalizeNume(q)))
      : scored;
    return filtrat.sort((a: any, b: any) => Number(b.potrivireAuto) - Number(a.potrivireAuto) || a.nume.localeCompare(b.nume));
  }, [pool, cauta, numeProdus]);

  const selectatDet = (pool || []).find((g: any) => g.produs_id === selectat);
  const maxim = selectatDet ? Number(selectatDet.total) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Caută în restocări</DialogTitle>
          <DialogDescription>
            Alege manual din ce produs iei marfa {numeProdus ? `pentru „${numeProdus}”` : ''}. Util când același
            produs există sub denumiri diferite.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Caută produs în restocări..."
            value={cauta}
            onChange={(e) => setCauta(e.target.value)}
            className="pl-8"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {isLoading && <p className="text-sm text-muted-foreground">Se încarcă restocările...</p>}
          {!isLoading && lista.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">Nu există marfă disponibilă în restocări.</p>
          )}
          {lista.map((g: any) => (
            <button
              key={g.produs_id}
              onClick={() => {
                setSelectat(g.produs_id);
                setCantitate(Math.min(cantitateNecesara || g.total, g.total));
              }}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                selectat === g.produs_id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium flex-1">{g.nume}</span>
                {g.potrivireAuto && <Badge variant="outline">posibil același produs</Badge>}
                <Badge className="bg-green-600">
                  {g.total} {g.unitate}
                </Badge>
                <span className="text-xs text-muted-foreground">{g.loturi} loturi</span>
              </div>
            </button>
          ))}
        </div>

        <div className="border-t pt-3 flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">Cantitate de luat</Label>
            <Input
              type="number"
              min={0}
              max={maxim || undefined}
              className="w-32"
              value={cantitate}
              onChange={(e) => setCantitate(Math.max(0, parseFloat(e.target.value) || 0))}
            />
          </div>
          <div className="text-sm text-muted-foreground flex-1">
            {selectatDet ? `Disponibil: ${maxim} ${selectatDet.unitate}` : 'Selectează un produs din listă'}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Anulează
          </Button>
          <Button
            disabled={!selectat || cantitate <= 0 || cantitate > maxim}
            onClick={() => {
              if (!selectat || !selectatDet) return;
              onAloca(selectat, cantitate, selectatDet.nume);
              onOpenChange(false);
            }}
          >
            <PackagePlus className="h-4 w-4 mr-2" />
            Ia din restocări
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CautaInRestocariDialog;
