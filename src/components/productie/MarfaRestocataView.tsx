import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { PackagePlus, Search, Edit2, Trash2, Download, Printer, History, Trash, RefreshCw, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type MotivScoatere = 'aruncat' | 'reambalare' | 'altul';

const MOTIV_LABEL: Record<MotivScoatere, string> = {
  aruncat: 'Aruncat',
  reambalare: 'Trimis la reambalare',
  altul: 'Altul',
};

const MOTIV_BADGE: Record<MotivScoatere, string> = {
  aruncat: 'bg-red-100 text-red-700 border-red-300',
  reambalare: 'bg-amber-100 text-amber-700 border-amber-300',
  altul: 'bg-slate-100 text-slate-700 border-slate-300',
};

interface MarfaRestocata {
  id: string;
  produs_id: string;
  nume_produs: string;
  cantitate_surplus: number;
  unitate_masura: string;
  data_surplus: string;
  comanda_originala?: string;
}

interface MarfaRestocataGrupata {
  produs_id: string;
  nume_produs: string;
  cantitate_totala: number;
  unitate_masura: string;
  numar_loturi: number;
  loturi: MarfaRestocata[];
}

interface LotScos {
  id: string;
  nume_produs: string;
  unitate_masura: string;
  cantitate_initiala: number;
  motiv_scoatere: MotivScoatere | null;
  observatii_scoatere: string | null;
  scos_la: string | null;
  comanda_originala?: string | null;
  data_productie: string;
}

const MarfaRestocataView = () => {
  const [dataFiltru, setDataFiltru] = useState<string>('');
  const [cautareProdu, setCautareProdu] = useState<string>('');
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    produsGrupat: MarfaRestocataGrupata | null;
    cantitatiEditate: Record<string, string>;
  }>({
    open: false,
    produsGrupat: null,
    cantitatiEditate: {},
  });

  const [scoatereDialog, setScoatereDialog] = useState<{
    open: boolean;
    lot: MarfaRestocata | null;
    motiv: MotivScoatere;
    observatii: string;
  }>({
    open: false,
    lot: null,
    motiv: 'aruncat',
    observatii: '',
  });

  const [istoricOpen, setIstoricOpen] = useState(false);

  // Marfă restocată = surplus disponibil
  const { data: marfaRestocata, isLoading, refetch } = useQuery({
    queryKey: ['marfa-restocata'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('productie_restocari')
        .select(`
          *,
          productie_produse!inner(nume, unitate_masura),
          productie_comenzi(numar_comanda)
        `)
        .eq('status', 'disponibil')
        .gt('cantitate_surplus', 0)
        .order('data_productie', { ascending: false });

      if (error) throw error;

      return (data || []).map((item: any) => ({
        id: item.id,
        produs_id: item.produs_id,
        nume_produs: item.productie_produse?.nume || 'N/A',
        cantitate_surplus: Number(item.cantitate_surplus || 0),
        unitate_masura: item.productie_produse?.unitate_masura || 'kg',
        data_surplus: item.data_productie,
        comanda_originala: item.productie_comenzi?.numar_comanda || null,
      })) as MarfaRestocata[];
    },
  });

  // Istoric loturi scoase (status != disponibil + motiv setat)
  const {
    data: istoric,
    isLoading: isLoadingIstoric,
    refetch: refetchIstoric,
  } = useQuery({
    queryKey: ['marfa-restocata-istoric'],
    enabled: istoricOpen,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('productie_restocari')
        .select(`
          id, data_productie, scos_la, motiv_scoatere, observatii_scoatere,
          cantitate_surplus,
          productie_produse(nume, unitate_masura),
          productie_comenzi(numar_comanda)
        `)
        .not('motiv_scoatere', 'is', null)
        .order('scos_la', { ascending: false })
        .limit(500);

      if (error) throw error;

      return (data || []).map((item: any) => ({
        id: item.id,
        nume_produs: item.productie_produse?.nume || 'N/A',
        unitate_masura: item.productie_produse?.unitate_masura || 'kg',
        cantitate_initiala: Number(item.cantitate_surplus || 0),
        motiv_scoatere: item.motiv_scoatere,
        observatii_scoatere: item.observatii_scoatere,
        scos_la: item.scos_la,
        comanda_originala: item.productie_comenzi?.numar_comanda || null,
        data_productie: item.data_productie,
      })) as LotScos[];
    },
  });

  const marfaGrupata = React.useMemo(() => {
    if (!marfaRestocata) return [];
    const grupate = new Map<string, MarfaRestocataGrupata>();

    marfaRestocata.forEach((item) => {
      const key = `${item.produs_id}-${item.nume_produs}`;
      if (grupate.has(key)) {
        const grup = grupate.get(key)!;
        grup.cantitate_totala += item.cantitate_surplus;
        grup.numar_loturi += 1;
        grup.loturi.push(item);
      } else {
        grupate.set(key, {
          produs_id: item.produs_id,
          nume_produs: item.nume_produs,
          cantitate_totala: item.cantitate_surplus,
          unitate_masura: item.unitate_masura,
          numar_loturi: 1,
          loturi: [item],
        });
      }
    });

    let filtered = Array.from(grupate.values());
    if (cautareProdu) {
      filtered = filtered.filter((item) =>
        item.nume_produs.toLowerCase().includes(cautareProdu.toLowerCase())
      );
    }
    if (dataFiltru) {
      filtered = filtered.filter((item) =>
        item.loturi.some((lot) => lot.data_surplus.startsWith(dataFiltru))
      );
    }
    return filtered;
  }, [marfaRestocata, cautareProdu, dataFiltru]);

  const handleEditOpen = (produsGrupat: MarfaRestocataGrupata) => {
    const cantitatiInitiale: Record<string, string> = {};
    produsGrupat.loturi.forEach((lot) => {
      cantitatiInitiale[lot.id] = lot.cantitate_surplus.toString();
    });
    setEditDialog({ open: true, produsGrupat, cantitatiEditate: cantitatiInitiale });
  };

  const handleCantitateChange = (lotId: string, value: string) => {
    setEditDialog((prev) => ({
      ...prev,
      cantitatiEditate: { ...prev.cantitatiEditate, [lotId]: value },
    }));
  };

  const handleEditSave = async () => {
    if (!editDialog.produsGrupat) return;
    try {
      const updates = editDialog.produsGrupat.loturi.map((lot) => {
        const nouaCantitate = parseFloat(editDialog.cantitatiEditate[lot.id] || '0');
        return (supabase as any)
          .from('productie_restocari')
          .update({ cantitate_surplus: nouaCantitate })
          .eq('id', lot.id);
      });
      await Promise.all(updates);
      toast.success('Cantitățile au fost actualizate');
      setEditDialog({ open: false, produsGrupat: null, cantitatiEditate: {} });
      refetch();
    } catch (error) {
      console.error('Eroare la actualizare:', error);
      toast.error('Eroare la actualizarea cantităților');
    }
  };

  const openScoatere = (lot: MarfaRestocata, motiv: MotivScoatere) => {
    setScoatereDialog({ open: true, lot, motiv, observatii: '' });
  };

  const confirmScoatere = async () => {
    if (!scoatereDialog.lot) return;
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id || null;

      const { error } = await (supabase as any)
        .from('productie_restocari')
        .update({
          status: 'scos',
          cantitate_surplus: 0,
          motiv_scoatere: scoatereDialog.motiv,
          observatii_scoatere: scoatereDialog.observatii?.trim() || null,
          scos_la: new Date().toISOString(),
          scos_de: userId,
        })
        .eq('id', scoatereDialog.lot.id);

      if (error) throw error;

      toast.success(`Lot marcat ca "${MOTIV_LABEL[scoatereDialog.motiv]}". Nu se mai consumă materie primă.`);
      setScoatereDialog({ open: false, lot: null, motiv: 'aruncat', observatii: '' });

      // Închide și dialogul de editare dacă lotul scos era ultimul
      const grup = editDialog.produsGrupat;
      if (grup) {
        const ramase = grup.loturi.filter((l) => l.id !== scoatereDialog.lot!.id);
        if (ramase.length === 0) {
          setEditDialog({ open: false, produsGrupat: null, cantitatiEditate: {} });
        }
      }
      refetch();
    } catch (error: any) {
      console.error('Eroare la scoatere:', error);
      toast.error(`Eroare: ${error.message || 'necunoscută'}`);
    }
  };

  const handleExportExcel = () => {
    if (!marfaGrupata || marfaGrupata.length === 0) {
      toast.error('Nu există date de exportat');
      return;
    }
    const exportData = marfaGrupata.map((item) => ({
      Produs: item.nume_produs,
      'Cantitate totală': item.cantitate_totala,
      Unitate: item.unitate_masura,
      'Număr loturi': item.numar_loturi,
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Marfă Restocată');
    XLSX.writeFile(wb, `marfa-restocata-${format(new Date(), 'dd-MM-yyyy')}.xlsx`);
    toast.success('Export realizat');
  };

  const handlePrint = () => window.print();

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <PackagePlus className="h-5 w-5 mr-2" />
              Marfă Restocată (Surplus disponibil)
            </div>
            <div className="flex items-center gap-2 print:hidden">
              <Button variant="outline" size="sm" onClick={() => { setIstoricOpen(true); refetchIstoric(); }}>
                <History className="h-4 w-4 mr-2" />
                Vezi istoric
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={!marfaGrupata || marfaGrupata.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Export Excel
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint} disabled={!marfaGrupata || marfaGrupata.length === 0}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
            </div>
          </CardTitle>
          <CardDescription>
            Surplus disponibil din producție. Loturile aruncate sau trimise la reambalare nu se mai calculează la consum materie primă.
          </CardDescription>
          <div className="flex items-center gap-4 mt-4 print:hidden">
            <div className="flex items-center gap-2 flex-1">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input placeholder="Caută produs..." value={cautareProdu} onChange={(e) => setCautareProdu(e.target.value)} className="flex-1" />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="dataFiltruRestock" className="text-sm font-normal whitespace-nowrap">Filtrează după dată:</Label>
              <Input id="dataFiltruRestock" type="date" value={dataFiltru} onChange={(e) => setDataFiltru(e.target.value)} className="w-40" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && <p>Se încarcă...</p>}

          {!isLoading && (!marfaRestocata || marfaRestocata.length === 0) && (
            <div className="text-center py-8 text-muted-foreground">
              <PackagePlus className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nu există marfă restocată {(dataFiltru || cautareProdu) && 'pentru filtrele selectate'}</p>
            </div>
          )}

          {!isLoading && marfaGrupata && marfaGrupata.length > 0 && (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produs</TableHead>
                    <TableHead>Cantitate totală</TableHead>
                    <TableHead>Loturi</TableHead>
                    <TableHead className="text-right print:hidden">Acțiuni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {marfaGrupata.map((item) => (
                    <TableRow key={`${item.produs_id}-${item.nume_produs}`}>
                      <TableCell className="font-medium">{item.nume_produs}</TableCell>
                      <TableCell className="font-bold text-blue-600">
                        {item.cantitate_totala.toFixed(2)} {item.unitate_masura}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {item.numar_loturi} {item.numar_loturi === 1 ? 'lot' : 'loturi'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right print:hidden">
                        <Button variant="ghost" size="sm" onClick={() => handleEditOpen(item)}>
                          <Edit2 className="h-4 w-4 mr-2" />
                          Editează / Scoate loturi
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog editare + scoatere loturi */}
      <Dialog
        open={editDialog.open}
        onOpenChange={(open) => setEditDialog({ open, produsGrupat: null, cantitatiEditate: {} })}
      >
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Loturi - {editDialog.produsGrupat?.nume_produs}</DialogTitle>
            <DialogDescription>
              Modifică cantitățile sau scoate loturi (Aruncat / Reambalare / Altul). Loturile scoase nu mai consumă materie primă.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Comandă</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Cantitate</TableHead>
                    <TableHead className="text-right">Scoate din stoc</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {editDialog.produsGrupat?.loturi.map((lot) => (
                    <TableRow key={lot.id}>
                      <TableCell>
                        <Badge variant="outline">{lot.comanda_originala || 'Avans'}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(lot.data_surplus), 'dd MMM yyyy', { locale: ro })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            step="0.01"
                            value={editDialog.cantitatiEditate[lot.id] || '0'}
                            onChange={(e) => handleCantitateChange(lot.id, e.target.value)}
                            className="w-28"
                          />
                          <span className="text-sm text-muted-foreground">{lot.unitate_masura}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-red-700 border-red-300 hover:bg-red-50"
                            onClick={() => openScoatere(lot, 'aruncat')}
                          >
                            <Trash className="h-3.5 w-3.5 mr-1" />
                            Aruncat
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-amber-700 border-amber-300 hover:bg-amber-50"
                            onClick={() => openScoatere(lot, 'reambalare')}
                          >
                            <RefreshCw className="h-3.5 w-3.5 mr-1" />
                            Reambalare
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={() => openScoatere(lot, 'altul')}
                          >
                            <AlertCircle className="h-3.5 w-3.5 mr-1" />
                            Altul
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog({ open: false, produsGrupat: null, cantitatiEditate: {} })}>
              Închide
            </Button>
            <Button onClick={handleEditSave}>Salvează cantitățile</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog confirmare scoatere */}
      <Dialog
        open={scoatereDialog.open}
        onOpenChange={(open) => !open && setScoatereDialog({ open: false, lot: null, motiv: 'aruncat', observatii: '' })}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{MOTIV_LABEL[scoatereDialog.motiv]}</DialogTitle>
            <DialogDescription>
              Lotul de <strong>{scoatereDialog.lot?.cantitate_surplus.toFixed(2)} {scoatereDialog.lot?.unitate_masura}</strong>{' '}
              <strong>{scoatereDialog.lot?.nume_produs}</strong> va fi scos din stoc și nu se va mai calcula la consumul de materie primă.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="obs-scoatere">Observații (opțional)</Label>
            <Textarea
              id="obs-scoatere"
              placeholder="Ex: ambalaj defect, expirat, contaminat..."
              value={scoatereDialog.observatii}
              onChange={(e) => setScoatereDialog((prev) => ({ ...prev, observatii: e.target.value }))}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScoatereDialog({ open: false, lot: null, motiv: 'aruncat', observatii: '' })}>
              Anulează
            </Button>
            <Button onClick={confirmScoatere}>Confirmă scoaterea</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog istoric */}
      <Dialog open={istoricOpen} onOpenChange={setIstoricOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Istoric loturi scoase</DialogTitle>
            <DialogDescription>Loturile aruncate, trimise la reambalare sau scoase din alt motiv.</DialogDescription>
          </DialogHeader>
          {isLoadingIstoric && <p>Se încarcă...</p>}
          {!isLoadingIstoric && istoric && istoric.length === 0 && (
            <p className="text-muted-foreground text-center py-8">Nu există loturi scoase.</p>
          )}
          {!isLoadingIstoric && istoric && istoric.length > 0 && (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data scoatere</TableHead>
                    <TableHead>Produs</TableHead>
                    <TableHead>Comandă</TableHead>
                    <TableHead>Motiv</TableHead>
                    <TableHead>Observații</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {istoric.map((lot) => (
                    <TableRow key={lot.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {lot.scos_la ? format(new Date(lot.scos_la), 'dd MMM yyyy HH:mm', { locale: ro }) : '-'}
                      </TableCell>
                      <TableCell className="font-medium">{lot.nume_produs}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{lot.comanda_originala || 'Avans'}</Badge>
                      </TableCell>
                      <TableCell>
                        {lot.motiv_scoatere && (
                          <Badge className={MOTIV_BADGE[lot.motiv_scoatere]} variant="outline">
                            {MOTIV_LABEL[lot.motiv_scoatere]}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-md">
                        {lot.observatii_scoatere || <span className="italic">—</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIstoricOpen(false)}>Închide</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MarfaRestocataView;
