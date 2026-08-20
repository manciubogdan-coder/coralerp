import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronDown, ChevronRight, Save, Scale, Search, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { fetchPoolTotals, setAlocareComanda } from '@/lib/productie/stockPool';

interface ComandaRow {
  id: string;
  numar_comanda: string;
  magazin: string;
  punct_livrare: string;
  produs_id: string;
  cantitate: number;
  cantitate_din_restock: number;
}

const EXCLUDED_MAGAZINE = [
  'Producție în avans',
  'Productie in avans',
  'AVANS',
  'PRODUCTIE_AVANS',
  'PRODUCȚIE_AVANS',
];

const RedistribuireProductie = () => {
  const queryClient = useQueryClient();
  const todayKey = new Date().toLocaleDateString('en-CA');
  const [data, setData] = useState(todayKey);
  const [cauta, setCauta] = useState('');
  const [expandat, setExpandat] = useState<string | null>(null);
  const [valori, setValori] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  const { data: payload, isLoading } = useQuery({
    queryKey: ['pool-redistribuire', data],
    staleTime: 30_000,
    queryFn: async () => {
      const startIso = new Date(`${data}T00:00:00`).toISOString();
      const endIso = new Date(`${data}T23:59:59`).toISOString();

      let query = supabase
        .from('productie_comenzi')
        .select('id, numar_comanda, magazin, punct_livrare, produs_id, cantitate, cantitate_din_restock, data_productie, created_at, status')
        .gt('cantitate', 0)
        .in('status', ['pending', 'assigned', 'in_progress', 'partial', 'completed'])
        .or(`data_productie.eq.${data},and(data_productie.is.null,created_at.gte.${startIso},created_at.lte.${endIso})`);

      EXCLUDED_MAGAZINE.forEach((m) => {
        query = query.neq('magazin', m);
      });

      const { data: comenzi, error } = await query;
      if (error) throw error;

      const produsIds = Array.from(new Set((comenzi || []).map((c: any) => c.produs_id).filter(Boolean)));
      const [{ data: produse }, pool] = await Promise.all([
        supabase.from('productie_produse').select('id, nume, unitate_masura').in('id', produsIds.length ? produsIds : ['-']),
        fetchPoolTotals(produsIds as string[]),
      ]);

      const produseMap = new Map((produse || []).map((p: any) => [p.id, p]));
      return { comenzi: (comenzi || []) as ComandaRow[], produseMap, pool };
    },
  });

  const grupuri = useMemo(() => {
    if (!payload) return [] as any[];
    const map = new Map<string, any>();
    payload.comenzi.forEach((c) => {
      if (!c.produs_id) return;
      const det: any = payload.produseMap.get(c.produs_id);
      const nume = det?.nume || 'Produs';
      if (!map.has(c.produs_id)) {
        map.set(c.produs_id, {
          produs_id: c.produs_id,
          nume,
          unitate: det?.unitate_masura || 'buc',
          pool: Number(payload.pool.get(c.produs_id) || 0),
          comenzi: [] as ComandaRow[],
        });
      }
      map.get(c.produs_id).comenzi.push(c);
    });
    const lista = Array.from(map.values()).map((g: any) => ({
      ...g,
      total_comandat: g.comenzi.reduce((a: number, c: ComandaRow) => a + Number(c.cantitate || 0), 0),
      total_alocat: g.comenzi.reduce((a: number, c: ComandaRow) => a + Number(c.cantitate_din_restock || 0), 0),
    }));
    const q = cauta.trim().toLowerCase();
    return lista
      .filter((g) => !q || g.nume.toLowerCase().includes(q))
      .sort((a, b) => a.nume.localeCompare(b.nume));
  }, [payload, cauta]);

  const getVal = (c: ComandaRow) =>
    valori[c.id] !== undefined ? valori[c.id] : Number(c.cantitate_din_restock || 0);

  const disponibilGrup = (g: any) => {
    const modificat = g.comenzi.reduce(
      (acc: number, c: ComandaRow) => acc + (getVal(c) - Number(c.cantitate_din_restock || 0)),
      0
    );
    return g.pool - modificat;
  };

  const repartizeazaProportional = (g: any) => {
    const disponibilTotal = g.pool + g.total_alocat;
    const totalComandat = g.total_comandat || 1;
    const next: Record<string, number> = {};
    let ramas = disponibilTotal;
    g.comenzi.forEach((c: ComandaRow, idx: number) => {
      const cota =
        idx === g.comenzi.length - 1
          ? Math.min(ramas, Number(c.cantitate || 0))
          : Math.min(
              ramas,
              Math.round((Number(c.cantitate || 0) / totalComandat) * disponibilTotal)
            );
      next[c.id] = Math.max(0, cota);
      ramas -= next[c.id];
    });
    setValori((prev) => ({ ...prev, ...next }));
  };

  const salveaza = async (g: any) => {
    if (disponibilGrup(g) < -1e-6) {
      toast.error('Ai repartizat mai mult decât există în restocări.');
      return;
    }
    setSaving(true);
    try {
      for (const c of g.comenzi as ComandaRow[]) {
        const tinta = getVal(c);
        if (Math.abs(tinta - Number(c.cantitate_din_restock || 0)) < 1e-9) continue;
        await setAlocareComanda(c, tinta);
      }
      toast.success('Repartizare salvată');
      setValori({});
      await queryClient.invalidateQueries({ queryKey: ['pool-redistribuire'] });
      queryClient.invalidateQueries({ queryKey: ['comenzi-disponibile-picking'] });
      queryClient.invalidateQueries({ queryKey: ['marfa-restocata'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    } catch (e: any) {
      toast.error(`Eroare la salvare: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scale className="h-5 w-5" />
          Redistribuire producție pe magazine
        </CardTitle>
        <CardDescription>
          Tot ce s-a produs intră în restocări. Aici repartizezi cantitatea reală pe magazine, indiferent de
          cum au venit comenzile.
        </CardDescription>
        <div className="flex flex-wrap items-center gap-2 pt-3">
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} className="w-40 h-9" />
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Caută produs..."
              value={cauta}
              onChange={(e) => setCauta(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-muted-foreground">Se încarcă...</p>}
        {!isLoading && grupuri.length === 0 && (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nu există comenzi pentru data selectată.
          </p>
        )}

        <div className="space-y-3">
          {grupuri.map((g) => {
            const deschis = expandat === g.produs_id;
            const disponibil = disponibilGrup(g);
            return (
              <div key={g.produs_id} className="border rounded-lg">
                <button
                  className="w-full flex flex-wrap items-center gap-2 p-3 text-left hover:bg-muted/50"
                  onClick={() => setExpandat(deschis ? null : g.produs_id)}
                >
                  {deschis ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <span className="font-medium flex-1">{g.nume}</span>
                  <Badge variant="outline">Comandat: {g.total_comandat} {g.unitate}</Badge>
                  <Badge className="bg-blue-600">Alocat: {g.total_alocat} {g.unitate}</Badge>
                  <Badge className={disponibil >= 0 ? 'bg-green-600' : 'bg-red-600'}>
                    În restocări: {disponibil} {g.unitate}
                  </Badge>
                </button>

                {deschis && (
                  <div className="border-t p-3 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => repartizeazaProportional(g)}>
                        <Wand2 className="h-4 w-4 mr-2" />
                        Repartizează proporțional
                      </Button>
                      <Button size="sm" onClick={() => salveaza(g)} disabled={saving}>
                        <Save className="h-4 w-4 mr-2" />
                        Salvează repartizarea
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {g.comenzi.map((c: ComandaRow) => (
                        <div
                          key={c.id}
                          className="flex flex-wrap items-center gap-3 p-2 rounded border bg-muted/30"
                        >
                          <div className="flex-1 min-w-[180px]">
                            <p className="font-medium text-sm">{c.magazin}</p>
                            <p className="text-xs text-muted-foreground">
                              {c.punct_livrare} • {c.numar_comanda}
                            </p>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Comandat: <span className="font-medium text-foreground">{c.cantitate}</span> {g.unitate}
                          </div>
                          <div className="flex items-center gap-2">
                            <Label className="text-xs">Alocat</Label>
                            <Input
                              type="number"
                              min={0}
                              className="w-24 h-9"
                              value={getVal(c)}
                              onChange={(e) =>
                                setValori((prev) => ({
                                  ...prev,
                                  [c.id]: Math.max(0, parseFloat(e.target.value) || 0),
                                }))
                              }
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default RedistribuireProductie;
