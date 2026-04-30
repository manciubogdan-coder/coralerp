import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PackagePlus, Search, Edit2, Trash2, Download, Printer } from 'lucide-react';
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

  // Marfa restocată = surplus din tabelul productie_restocari
  const { data: marfaRestocata, isLoading, refetch } = useQuery({
    queryKey: ['marfa-restocata'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('productie_restocari')
        .select(`
          *,
          productie_produse!inner(
            nume,
            unitate_masura
          ),
          productie_comenzi(numar_comanda)
        `)
        .eq('status', 'disponibil')
        .gt('cantitate_surplus', 0)
        .order('data_productie', { ascending: false });

      if (error) throw error;
      
      // Transform data to match MarfaRestocata interface
      return data.map(item => ({
        id: item.id,
        produs_id: item.produs_id,
        nume_produs: item.productie_produse?.nume || 'N/A',
        cantitate_surplus: item.cantitate_surplus,
        unitate_masura: item.productie_produse?.unitate_masura || 'kg',
        data_surplus: item.data_productie,
        comanda_originala: item.productie_comenzi?.numar_comanda || null,
      })) as MarfaRestocata[];
    },
  });

  // Grupare date pe produs
  const marfaGrupata = React.useMemo(() => {
    if (!marfaRestocata) return [];

    const grupate = new Map<string, MarfaRestocataGrupata>();

    marfaRestocata.forEach(item => {
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

    // Filtrare după căutare
    let filtered = Array.from(grupate.values());
    
    if (cautareProdu) {
      filtered = filtered.filter(item =>
        item.nume_produs.toLowerCase().includes(cautareProdu.toLowerCase())
      );
    }

    if (dataFiltru) {
      filtered = filtered.filter(item =>
        item.loturi.some(lot => lot.data_surplus.startsWith(dataFiltru))
      );
    }

    return filtered;
  }, [marfaRestocata, cautareProdu, dataFiltru]);

  const handleEditOpen = (produsGrupat: MarfaRestocataGrupata) => {
    const cantitatiInitiale: Record<string, string> = {};
    produsGrupat.loturi.forEach(lot => {
      cantitatiInitiale[lot.id] = lot.cantitate_surplus.toString();
    });
    
    setEditDialog({ 
      open: true, 
      produsGrupat,
      cantitatiEditate: cantitatiInitiale
    });
  };

  const handleCantitateChange = (lotId: string, value: string) => {
    setEditDialog(prev => ({
      ...prev,
      cantitatiEditate: {
        ...prev.cantitatiEditate,
        [lotId]: value
      }
    }));
  };

  const handleEditSave = async () => {
    if (!editDialog.produsGrupat) return;

    try {
      // Actualizăm fiecare lot
      const updates = editDialog.produsGrupat.loturi.map(lot => {
        const nouaCantitate = parseFloat(editDialog.cantitatiEditate[lot.id] || '0');
        
        return supabase
          .from('productie_restocari')
          .update({ cantitate_surplus: nouaCantitate })
          .eq('id', lot.id);
      });

      await Promise.all(updates);

      toast.success('Cantitățile au fost actualizate cu succes');
      setEditDialog({ open: false, produsGrupat: null, cantitatiEditate: {} });
      refetch();
    } catch (error) {
      console.error('Eroare la actualizare:', error);
      toast.error('Eroare la actualizarea cantităților');
    }
  };

  const handleDeleteLot = async (lot: MarfaRestocata) => {
    try {
      const { error } = await supabase
        .from('productie_restocari')
        .update({ 
          cantitate_surplus: 0,
          status: 'epuizat'
        })
        .eq('id', lot.id);

      if (error) throw error;

      toast.success('Lotul a fost șters cu succes');
      refetch();
    } catch (error) {
      console.error('Eroare la ștergere:', error);
      toast.error('Eroare la ștergerea lotului');
    }
  };

  const handleExportExcel = () => {
    if (!marfaGrupata || marfaGrupata.length === 0) {
      toast.error('Nu există date de exportat');
      return;
    }

    const exportData = marfaGrupata.map(item => ({
      'Produs': item.nume_produs,
      'Cantitate totală': item.cantitate_totala,
      'Unitate': item.unitate_masura,
      'Număr loturi': item.numar_loturi
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Marfă Restocată');
    
    const fileName = `marfa-restocata-${format(new Date(), 'dd-MM-yyyy')}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    toast.success('Export realizat cu succes');
  };

  const handlePrint = () => {
    window.print();
  };

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
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                disabled={!marfaGrupata || marfaGrupata.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                disabled={!marfaGrupata || marfaGrupata.length === 0}
              >
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
            </div>
          </CardTitle>
          <CardDescription>
            Surplus disponibil din producție (avans + comenzi normale), gata pentru redistribuire
          </CardDescription>
          <div className="flex items-center gap-4 mt-4 print:hidden">
            <div className="flex items-center gap-2 flex-1">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Caută produs..."
                value={cautareProdu}
                onChange={(e) => setCautareProdu(e.target.value)}
                className="flex-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="dataFiltruRestock" className="text-sm font-normal whitespace-nowrap">Filtrează după dată:</Label>
              <Input
                id="dataFiltruRestock"
                type="date"
                value={dataFiltru}
                onChange={(e) => setDataFiltru(e.target.value)}
                className="w-40"
              />
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditOpen(item)}
                        >
                          <Edit2 className="h-4 w-4 mr-2" />
                          Editează loturi
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

      <Dialog open={editDialog.open} onOpenChange={(open) => setEditDialog({ open, produsGrupat: null, cantitatiEditate: {} })}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editează loturi - {editDialog.produsGrupat?.nume_produs}</DialogTitle>
            <DialogDescription>
              Modifică cantitățile pentru fiecare lot individual
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Comandă origine</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Cantitate</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {editDialog.produsGrupat?.loturi.map((lot) => (
                    <TableRow key={lot.id}>
                      <TableCell>
                        <Badge variant="outline">
                          {lot.comanda_originala || 'Avans'}
                        </Badge>
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
                            className="w-32"
                          />
                          <span className="text-sm text-muted-foreground">
                            {lot.unitate_masura}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteLot(lot)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog({ open: false, produsGrupat: null, cantitatiEditate: {} })}>
              Anulează
            </Button>
            <Button onClick={handleEditSave}>
              Salvează toate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MarfaRestocataView;
