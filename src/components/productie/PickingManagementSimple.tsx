import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Package, ShoppingCart, CheckCircle, ArrowLeft, AlertCircle, ClipboardCheck, PackagePlus } from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import {
  useComenziDisponibile,
  usePickingSesiuni,
  useCreatePickingSesiune,
  usePickingProduse,
  useUpdatePickingProdus,
  useFinalizareSesiune,
  type ComenziDisponibile
} from '@/hooks/productie/usePickingSimple';
import { useAuth } from '@/contexts/productie/AuthContext';
import MarfaRestocataView from './MarfaRestocataView';

const PickingManagementSimple = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'disponibile' | 'finalizate' | 'restocata'>('disponibile');
  const [step, setStep] = useState<'comenzi' | 'produse' | 'sesiuni'>('comenzi');
  const [selectedComanda, setSelectedComanda] = useState<ComenziDisponibile | null>(null);
  const [sesiuneActivaId, setSesiuneActivaId] = useState<string | null>(null);
  const [sesiuneFinalizataSelectata, setSesiuneFinalizataSelectata] = useState<string | null>(null);
  const [operatorNume, setOperatorNume] = useState(user?.email?.split('@')[0] || '');
  const [dataFiltru, setDataFiltru] = useState<string>('');
  const todayKey = new Date().toLocaleDateString('en-CA');
  const [dataDisponibile, setDataDisponibile] = useState<string>(todayKey);
  const [modDisponibile, setModDisponibile] = useState<'zi' | 'restante' | 'toate'>('zi');

  const { data: comenziDisponibile, isLoading: loadingComenzi } = useComenziDisponibile();
  const { data: sesiuniActive } = usePickingSesiuni('in_lucru');
  const { data: sesiuniFinalizate } = usePickingSesiuni('finalizata');
  const { data: produse } = usePickingProduse(sesiuneActivaId || undefined);
  const { data: produseFinalizate } = usePickingProduse(sesiuneFinalizataSelectata || undefined);
  const createSesiune = useCreatePickingSesiune();
  const updateProdus = useUpdatePickingProdus();
  const finalizareSesiune = useFinalizareSesiune();

  const restante = (comenziDisponibile || []).filter(c => c.data && c.data < todayKey);
  const comenziAfisate = (comenziDisponibile || []).filter(c => {
    if (modDisponibile === 'toate') return true;
    if (modDisponibile === 'restante') return c.data && c.data < todayKey;
    return c.data === dataDisponibile;
  });

  // Filtrare sesiuni finalizate după dată
  const sesiuniFiltrate = dataFiltru
    ? sesiuniFinalizate?.filter(s => s.data_sesiune === dataFiltru)
    : sesiuniFinalizate;

  const handleSelectMagazin = (comanda: ComenziDisponibile) => {
    setSelectedComanda(comanda);
    
    // Creez sesiunea de picking
    createSesiune.mutate({
      magazin: comanda.magazin,
      punct_livrare: comanda.punct_livrare,
      operator_nume: operatorNume || 'operator',
      produse: comanda.produse.map(p => ({
        sesiune_lucru_id: p.sesiune_lucru_id,
        produs_id: p.produs_id,
        nume_produs: p.nume_produs,
        cantitate_comandata: p.cantitate_produsa,
        unitate_masura: p.unitate_masura
      }))
    }, {
      onSuccess: (sesiune) => {
        setSesiuneActivaId(sesiune.id);
        setStep('produse');
      }
    });
  };

  const handleMarcareProdus = (produsId: string, cantitateNumarata: number, cantLipsa: number, obs?: string) => {
    const newStatus = cantLipsa > 0 ? 'lipsa_partiala' : 'numarat';
    updateProdus.mutate({
      id: produsId,
      cantitate_numarata: cantitateNumarata,
      cantitate_lipsa: cantLipsa,
      status: newStatus,
      observatii: obs
    });
  };

  const handleFinalizare = () => {
    if (!sesiuneActivaId) return;
    
    finalizareSesiune.mutate(sesiuneActivaId, {
      onSuccess: () => {
        setStep('comenzi');
        setSelectedComanda(null);
        setSesiuneActivaId(null);
      }
    });
  };

  const handleBackToComenzi = () => {
    setStep('comenzi');
    setSelectedComanda(null);
    setSesiuneActivaId(null);
  };

  // Pagina 1: Lista comenzi - cu tabs pentru disponibile/finalizate
  if (step === 'comenzi') {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Informații Operator</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
              <Label htmlFor="operator">Nume Operator:</Label>
              <Input
                id="operator"
                value={operatorNume}
                onChange={(e) => setOperatorNume(e.target.value)}
                placeholder="Introduceți numele"
                className="max-w-xs"
              />
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'disponibile' | 'finalizate' | 'restocata')}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="disponibile" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Disponibile
            </TabsTrigger>
            <TabsTrigger value="finalizate" className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" />
              Finalizate
            </TabsTrigger>
            <TabsTrigger value="restocata" className="flex items-center gap-2">
              <PackagePlus className="h-4 w-4" />
              Marfă Restocată
            </TabsTrigger>
          </TabsList>

          {/* Tab: Comenzi Disponibile */}
          <TabsContent value="disponibile" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Package className="h-5 w-5 mr-2" />
                  Comenzi Disponibile Pentru Picking
                </CardTitle>
                <CardDescription>
                  Selectați un magazin pentru a începe procesul de picking
                </CardDescription>
                <div className="flex flex-wrap items-center gap-2 pt-3">
                  <Button
                    size="sm"
                    variant={modDisponibile === 'zi' && dataDisponibile === todayKey ? 'default' : 'outline'}
                    onClick={() => { setModDisponibile('zi'); setDataDisponibile(todayKey); }}
                  >
                    Azi
                  </Button>
                  <Input
                    type="date"
                    value={dataDisponibile}
                    onChange={(e) => { setDataDisponibile(e.target.value); setModDisponibile('zi'); }}
                    className="w-40 h-9"
                  />
                  <Button
                    size="sm"
                    variant={modDisponibile === 'restante' ? 'default' : 'outline'}
                    onClick={() => setModDisponibile('restante')}
                  >
                    Restanțe ({restante.length})
                  </Button>
                  <Button
                    size="sm"
                    variant={modDisponibile === 'toate' ? 'default' : 'outline'}
                    onClick={() => setModDisponibile('toate')}
                  >
                    Toate
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingComenzi && <p>Se încarcă...</p>}

                {!loadingComenzi && restante.length > 0 && modDisponibile !== 'restante' && (
                  <button
                    onClick={() => setModDisponibile('restante')}
                    className="w-full text-left mb-4 p-3 rounded-lg border border-orange-300 bg-orange-50 dark:bg-orange-950/30 hover:border-orange-500 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-orange-600" />
                      <span className="font-medium">
                        Ai {restante.length} comen{restante.length === 1 ? 'dă' : 'zi'} din zilele trecute care nu au fost pregătite. Click pentru a le vedea →
                      </span>
                    </div>
                  </button>
                )}

                {!loadingComenzi && comenziAfisate.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nu există comenzi disponibile pentru picking{modDisponibile === 'zi' ? ' în data selectată' : ''}</p>
                  </div>
                )}

                <div className="grid gap-4">
                  {comenziAfisate.map((comanda, idx) => (
                    <Card key={idx} className="border-2 hover:border-primary transition-colors">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-bold text-lg">{comanda.magazin}</h3>
                            <p className="text-sm text-muted-foreground">{comanda.punct_livrare}</p>
                            <div className="flex flex-wrap gap-2 mt-2">
                              <Badge variant="secondary">{comanda.total_produse} produse</Badge>
                              {comanda.data && (
                                <Badge variant={comanda.data < todayKey ? 'destructive' : 'outline'}>
                                  {format(new Date(comanda.data), 'dd MMM yyyy', { locale: ro })}
                                  {comanda.data < todayKey ? ' • restanță' : ''}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Button
                            onClick={() => handleSelectMagazin(comanda)}
                            disabled={!operatorNume}
                          >
                            <ShoppingCart className="h-4 w-4 mr-2" />
                            Începe Picking
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>

            {sesiuniActive && sesiuniActive.length > 0 && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Sesiuni Active de Picking</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {sesiuniActive.map(sesiune => (
                      <div key={sesiune.id} className="flex items-center justify-between p-3 border rounded">
                        <div>
                          <p className="font-medium">{sesiune.magazin} - {sesiune.punct_livrare}</p>
                          <p className="text-sm text-muted-foreground">Operator: {sesiune.operator_nume}</p>
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSesiuneActivaId(sesiune.id);
                            setStep('produse');
                          }}
                        >
                          Continuă
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tab: Comenzi Finalizate */}
          <TabsContent value="finalizate" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center">
                    <ClipboardCheck className="h-5 w-5 mr-2" />
                    Comenzi Finalizate
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="dataFiltru" className="text-sm font-normal">Filtrează după dată:</Label>
                    <Input
                      id="dataFiltru"
                      type="date"
                      value={dataFiltru}
                      onChange={(e) => setDataFiltru(e.target.value)}
                      className="w-40"
                    />
                    {dataFiltru && (
                      <Button variant="ghost" size="sm" onClick={() => setDataFiltru('')}>
                        Resetează
                      </Button>
                    )}
                  </div>
                </CardTitle>
                <CardDescription>
                  Comenzile pentru care picking-ul a fost finalizat - click pentru detalii
                </CardDescription>
              </CardHeader>
              <CardContent>
                {sesiuneFinalizataSelectata && produseFinalizate ? (
                  <div className="space-y-4">
                    <Button variant="outline" onClick={() => setSesiuneFinalizataSelectata(null)}>
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Înapoi la listă
                    </Button>
                    
                    <Card>
                      <CardHeader>
                        <CardTitle>Detalii Produse</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                           {produseFinalizate.map(produs => (
                            <Card key={produs.id} className="border">
                              <CardContent className="pt-4">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <h4 className="font-bold">{produs.nume_produs}</h4>
                                    <div className="grid grid-cols-3 gap-4 mt-2 text-sm">
                                      <div>
                                        <span className="text-muted-foreground">Comandat:</span>
                                        <p className="font-medium">{produs.cantitate_comandata} {produs.unitate_masura}</p>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Numărat:</span>
                                        <p className="font-medium text-green-600">{produs.cantitate_numarata} {produs.unitate_masura}</p>
                                      </div>
                                      {produs.cantitate_lipsa > 0 && (
                                        <div>
                                          <span className="text-muted-foreground">Lipsă:</span>
                                          <p className="font-medium text-red-600">{produs.cantitate_lipsa} {produs.unitate_masura}</p>
                                        </div>
                                      )}
                                    </div>
                                    {produs.observatii && (
                                      <div className="mt-2 p-2 bg-muted rounded text-sm">
                                        <span className="font-medium">Observații: </span>
                                        {produs.observatii}
                                      </div>
                                    )}
                                  </div>
                                  <Badge className={produs.status === 'numarat' ? 'bg-green-600' : 'bg-orange-600'}>
                                    {produs.status === 'numarat' ? '✓ Numărat' : 'Lipsă Parțială'}
                                  </Badge>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <>
                    {!sesiuniFiltrate || sesiuniFiltrate.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <ClipboardCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>{dataFiltru ? 'Nu există comenzi finalizate pentru data selectată' : 'Nu există comenzi finalizate încă'}</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {sesiuniFiltrate.map(sesiune => (
                          <Card 
                            key={sesiune.id} 
                            className="border-green-200 bg-green-50/50 dark:bg-green-950/20 cursor-pointer hover:border-green-400 transition-colors"
                            onClick={() => setSesiuneFinalizataSelectata(sesiune.id)}
                          >
                            <CardContent className="pt-6">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <CheckCircle className="h-5 w-5 text-green-600" />
                                    <h3 className="font-bold text-lg">{sesiune.magazin}</h3>
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1">{sesiune.punct_livrare}</p>
                                  <div className="flex gap-2 mt-2">
                                    <Badge className="bg-green-600">Finalizată</Badge>
                                    <Badge variant="outline">Operator: {sesiune.operator_nume}</Badge>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm text-muted-foreground">
                                    {format(new Date(sesiune.data_sesiune), 'dd MMMM yyyy', { locale: ro })}
                                  </p>
                                  <Button variant="ghost" size="sm" className="mt-2">
                                    Vezi Detalii →
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Marfă Restocată */}
          <TabsContent value="restocata" className="mt-6">
            <MarfaRestocataView />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // Pagina 2: Lista produse pentru numărare
  if (step === 'produse' && sesiuneActivaId) {
    const lista = produse || [];
    const inProductie = lista.filter(p => p.gata_productie === false);
    const gataDeNumarat = lista.filter(p => p.gata_productie !== false);
    const facute = gataDeNumarat.filter(p => p.status !== 'asteptare');
    const ramase = gataDeNumarat.filter(p => p.status === 'asteptare');
    const toateProduseleNumarate = gataDeNumarat.length > 0 && ramase.length === 0;


    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center">
                  <ShoppingCart className="h-5 w-5 mr-2" />
                  Picking: {selectedComanda?.magazin}
                </CardTitle>
                <CardDescription>{selectedComanda?.punct_livrare}</CardDescription>
              </div>
              <Button variant="outline" onClick={handleBackToComenzi}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Înapoi
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 p-3 rounded-lg border bg-muted/40">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge className="bg-green-600">Pregătite: {facute.length}</Badge>
                <Badge variant={ramase.length > 0 ? 'destructive' : 'outline'}>Rămase: {ramase.length}</Badge>
                {inProductie.length > 0 && (
                  <Badge className="bg-amber-500">Încă în producție: {inProductie.length}</Badge>
                )}
                <span className="text-muted-foreground">din {lista.length} produse</span>
              </div>
              {ramase.length > 0 && (
                <p className="text-sm text-muted-foreground mt-2">
                  Nepregătite: {ramase.map(p => p.nume_produs).join(', ')}
                </p>
              )}
              {inProductie.length > 0 && (
                <p className="text-sm text-amber-700 dark:text-amber-500 mt-2">
                  Nu se pot număra (încă în producție): {inProductie.map(p => p.nume_produs).join(', ')}
                </p>
              )}
            </div>
            <div className="space-y-4">
              {[...gataDeNumarat, ...inProductie].map(produs => (
                <ProdusPickingCard
                  key={produs.id}
                  produs={produs}
                  onMarcheaza={handleMarcareProdus}
                />
              ))}
            </div>


            <div className={`mt-6 p-4 rounded-lg border ${toateProduseleNumarate ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' : 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800'}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center">
                  {toateProduseleNumarate ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                      <span className="font-medium">Toate produsele au fost procesate</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-5 w-5 text-orange-600 mr-2" />
                      <span className="font-medium">Mai ai {ramase.length} produse nepregătite</span>
                    </>
                  )}
                </div>
                <Button
                  onClick={() => {
                    if (!toateProduseleNumarate && !window.confirm(`Mai sunt ${ramase.length} produse nepregătite. Finalizezi comanda oricum?`)) return;
                    handleFinalizare();
                  }}
                  variant={toateProduseleNumarate ? 'default' : 'outline'}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Finalizează Comanda
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
};

// Componenta pentru fiecare produs
const ProdusPickingCard = ({
  produs,
  onMarcheaza
}: {
  produs: any;
  onMarcheaza: (id: string, numarata: number, lipsa: number, obs?: string) => void;
}) => {
  const inProductie = produs.gata_productie === false;
  const [cantitateNumarata, setCantitateNumarata] = useState(produs.cantitate_numarata || 0);
  const [cantLipsa, setCantLipsa] = useState(produs.cantitate_lipsa || 0);
  const [observatii, setObservatii] = useState(produs.observatii || '');
  const [editing, setEditing] = useState(produs.status === 'asteptare' && !inProductie);

  const handleSave = () => {
    onMarcheaza(produs.id, cantitateNumarata, cantLipsa, observatii);
    setEditing(false);
  };

  const getStatusBadge = () => {
    if (inProductie) return <Badge className="bg-amber-500">În producție</Badge>;
    switch (produs.status) {
      case 'numarat':
        return <Badge className="bg-green-500">✓ Numarat</Badge>;
      case 'lipsa_partiala':
        return <Badge variant="destructive">Lipsă Parțială</Badge>;
      default:
        return <Badge className="bg-blue-600">Gata de numărat</Badge>;
    }
  };

  return (
    <Card className={inProductie ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 opacity-90' : (produs.status !== 'asteptare' ? 'border-green-200 bg-green-50/50 dark:bg-green-950/20' : '')}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h4 className="font-bold text-lg">{produs.nume_produs}</h4>
            <div className="space-y-1 mt-2">
              {produs.cantitate_totala_comanda && produs.cantitate_totala_comanda > produs.cantitate_comandata && (
                <>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">Total comandat:</span> {produs.cantitate_totala_comanda} {produs.unitate_masura}
                  </p>
                  {produs.cantitate_din_restock > 0 && (
                    <p className="text-sm text-orange-600">
                      <span className="font-medium">Din restocări:</span> {produs.cantitate_din_restock} {produs.unitate_masura}
                    </p>
                  )}
                  <p className="text-sm text-blue-600">
                    <span className="font-medium">De produs:</span> {produs.cantitate_comandata} {produs.unitate_masura}
                  </p>
                </>
              )}
              {(!produs.cantitate_totala_comanda || produs.cantitate_totala_comanda === produs.cantitate_comandata) && (
                <p className="text-sm text-muted-foreground">
                  Comandat: {produs.cantitate_comandata} {produs.unitate_masura}
                </p>
              )}
              {produs.cantitate_realizata !== undefined && (
                <p className={`text-sm ${inProductie ? 'text-amber-700 dark:text-amber-500' : 'text-green-700 dark:text-green-500'}`}>
                  <span className="font-medium">Realizat în producție:</span> {produs.cantitate_realizata} / {produs.cantitate_totala_comanda ?? produs.cantitate_comandata} {produs.unitate_masura}
                </p>
              )}
            </div>
          </div>
          {getStatusBadge()}
        </div>

        {inProductie ? (
          <div className="flex items-center gap-2 p-3 rounded-lg border border-amber-300 bg-amber-100/50 dark:bg-amber-950/40 text-sm">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <span>Produsul nu este finalizat pe linia de producție — nu poate fi numărat încă.</span>
          </div>
        ) : editing ? (

          <div className="space-y-4">
            {/* Indicator clar pentru cantitatea de numărat */}
            <div className="p-4 bg-primary/10 border-2 border-primary rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Trebuie să numeri:</p>
                  <p className="text-3xl font-bold text-primary">
                    {produs.cantitate_comandata} {produs.unitate_masura}
                  </p>
                </div>
                <Package className="h-12 w-12 text-primary opacity-20" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Cantitate Numărată</Label>
                <Input
                  type="number"
                  value={cantitateNumarata}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setCantitateNumarata(val);
                    setCantLipsa(Math.max(0, produs.cantitate_comandata - val));
                  }}
                  min="0"
                  max={produs.cantitate_comandata}
                />
              </div>
              <div>
                <Label>Cantitate Lipsă</Label>
                <Input
                  type="number"
                  value={cantLipsa}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setCantLipsa(val);
                    setCantitateNumarata(Math.max(0, produs.cantitate_comandata - val));
                  }}
                  min="0"
                  max={produs.cantitate_comandata}
                />
              </div>
            </div>

            {cantLipsa > 0 && (
              <div>
                <Label>Observații (opțional)</Label>
                <Textarea
                  value={observatii}
                  onChange={(e) => setObservatii(e.target.value)}
                  placeholder="Motivul lipsei..."
                />
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={handleSave} className="flex-1">
                <CheckCircle className="h-4 w-4 mr-2" />
                Marchează ca Numărat
              </Button>
              {produs.status !== 'asteptare' && (
                <Button variant="outline" onClick={() => setEditing(false)}>
                  Anulează
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Numărat:</span>
                <span className="ml-2 font-medium">{produs.cantitate_numarata} {produs.unitate_masura}</span>
              </div>
              {produs.cantitate_lipsa > 0 && (
                <div>
                  <span className="text-muted-foreground">Lipsă:</span>
                  <span className="ml-2 font-medium text-red-600">{produs.cantitate_lipsa} {produs.unitate_masura}</span>
                </div>
              )}
            </div>
            {produs.observatii && (
              <div className="text-sm">
                <span className="text-muted-foreground">Observații:</span>
                <p className="mt-1">{produs.observatii}</p>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Modifică
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PickingManagementSimple;
