import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowLeft, Factory, Users, Clock, Play, CheckCircle, Square, AlertCircle, Timer, AlertTriangle, TrendingUp, Package, CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useProductionLines, useOrders, useCreateWorkSession, useWorkSessions, useFinishWorkSession, ProductieLinie, ProductieComanda, ProductieSesiuneLucru } from "@/hooks/productie/useProductionData";
import { useOrdersPagination } from "@/hooks/productie/useOrdersPagination";
import OrdersPagination from "./OrdersPagination";
import OrdersTable from "./OrdersTable";
import GroupedOrdersView from "./GroupedOrdersView";
import { useGrupareAmbalare } from "@/hooks/productie/useGrupareAmbalare";
import DateProductiePicker, { todayISO } from "./DateProductiePicker";
import TrasabilitateCard from "./TrasabilitateCard";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface OperatorInterfaceProps {
  selectedLine: string;
  onLineSelect: (lineId: string) => void;
}

const OperatorInterface: React.FC<OperatorInterfaceProps> = ({
  selectedLine,
  onLineSelect
}) => {
  const [view, setView] = useState<'lines' | 'orders' | 'session'>('lines');
  const [currentLineId, setCurrentLineId] = useState<string>("");
  const [currentOrderId, setCurrentOrderId] = useState<string>("");
  const [operatorNames, setOperatorNames] = useState<string[]>([""]);
  const [producedQuantity, setProducedQuantity] = useState<number>(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [forceRefreshKey, setForceRefreshKey] = useState(0);
  const [selectedDay, setSelectedDay] = useState<string>(todayISO());
  const [ordersViewMode, setOrdersViewMode] = useState<'individual' | 'grouped'>('individual');

  const {
    data: lines,
    isLoading: linesLoading
  } = useProductionLines();

  const {
    data: orders,
    isLoading: ordersLoading
  } = useOrders();

  const createSessionMutation = useCreateWorkSession();
  const finishSessionMutation = useFinishWorkSession();

  const {
    data: workSessions,
    isLoading: sessionsLoading
  } = useWorkSessions();

  const { data: groupMap } = useGrupareAmbalare();

  const activeSessions = workSessions?.filter(session => session.status === 'activa') || [];

  // Ordinea fixă pentru produsele de aromate (conform fișei de lucru)
  const AROMATE_ORDER = ['menta', 'rozmarin', 'cimbru', 'coriandru', 'chivas', 'salvie', 'tarhon', 'oregrano', 'busuioc'];
  const currentLineObj = lines?.find(l => l.id === currentLineId);
  const isAromateLine = (currentLineObj?.nume || '').toLowerCase().includes('arom');

  const getAromateIndex = (numeProdus: string | undefined) => {
    if (!numeProdus) return 999;
    const lower = numeProdus.toLowerCase();
    const idx = AROMATE_ORDER.findIndex(a => lower.includes(a));
    return idx === -1 ? 999 : idx;
  };

  const normalizeProductionDate = (value?: string | null) => {
    if (!value) return null;
    return String(value).slice(0, 10);
  };

  const matchesSelectedDay = (order: any) => {
    const dp = normalizeProductionDate((order as any).data_productie);
    if (dp) return dp === selectedDay;
    return selectedDay === todayISO();
  };

  // Helper: o comandă este "finalizată/acoperită" pentru sortare
  const isOrderDone = (o: any) => {
    if (o.status === 'completed') return true;
    const esteReambalare = o.magazin === 'REAMBALARE' || o.tip_comanda === 'REAMBALARE';
    const acoperit = (o.cantitate_reala_produsa || 0) + (esteReambalare ? 0 : (o.cantitate_din_restock || 0));
    return o.cantitate > 0 && acoperit >= o.cantitate;
  };

  // Prepare orders for pagination - only for the selected line when viewing orders
  const lineOrders = view === 'orders' && currentLineId ? orders?.filter(order => {
    if (order.linie_id !== currentLineId) return false;
    // Filtrare pe ziua selectată (data_productie); comenzile fără data_productie apar doar la "azi"
    if (!matchesSelectedDay(order)) return false;
    return true;
  }).sort((a, b) => {
    // Comenzile finalizate/acoperite merg la coadă întotdeauna
    const doneA = isOrderDone(a);
    const doneB = isOrderDone(b);
    if (doneA !== doneB) return doneA ? 1 : -1;

    // Pentru liniile de aromate: sortare fixă după lista standard (Menta, Rozmarin, ...)
    if (isAromateLine) {
      const idxA = getAromateIndex(a.productie_produse?.nume);
      const idxB = getAromateIndex(b.productie_produse?.nume);
      if (idxA !== idxB) return idxA - idxB;
      const prA = a.productie_clienti?.productie_zone_livrare?.prioritate || 999;
      const prB = b.productie_clienti?.productie_zone_livrare?.prioritate || 999;
      return prA - prB;
    }

    // Calculăm progresul pentru fiecare comandă pentru sortare
    const getOrderProgress = (order: any) => {
      const cantitateComandată = order.cantitate;
      const cantitateRealaProadusa = order.cantitate_reala_produsa || 0;
      const esteReambalare = (order as any).magazin === 'REAMBALARE' || (order as any).tip_comanda === 'REAMBALARE';
      const cantitatedinRestock = esteReambalare ? 0 : order.cantitate_din_restock || 0;
      const cantitateAcoperitaTotal = cantitateRealaProadusa + cantitatedinRestock;
      return cantitateComandată > 0 ? Math.round(cantitateAcoperitaTotal / cantitateComandată * 100) : 0;
    };

    const progressA = getOrderProgress(a);
    const progressB = getOrderProgress(b);

    // Sortare specială pentru comenzile parțiale (progres între 1% și 99%)
    const isPartialA = progressA > 0 && progressA < 100;
    const isPartialB = progressB > 0 && progressB < 100;

    // Comenzile parțiale au prioritate maximă
    if (isPartialA && !isPartialB) return -1;
    if (!isPartialA && isPartialB) return 1;

    // Dacă ambele sunt parțiale, sortează după progres descrescător (cele mai avansate primul)
    if (isPartialA && isPartialB) {
      return progressB - progressA;
    }

    // Pentru restul comenzilor, sortez după status
    const statusPriorityA = a.status === 'in_progress' ? 0 : a.status === 'pending' ? 1 : a.status === 'assigned' ? 2 : 3;
    const statusPriorityB = b.status === 'in_progress' ? 0 : b.status === 'pending' ? 1 : b.status === 'assigned' ? 2 : 3;
    if (statusPriorityA !== statusPriorityB) return statusPriorityA - statusPriorityB;

    // Pentru comenzile cu același status, sortează după prioritatea zonei de livrare
    const prioritateA = a.productie_clienti?.productie_zone_livrare?.prioritate || 999;
    const prioritateB = b.productie_clienti?.productie_zone_livrare?.prioritate || 999;
    if (prioritateA !== prioritateB) {
      return prioritateA - prioritateB; // Prioritatea mai mică = mai importantă
    }

    // Dacă prioritatea este aceeași, sortează după ora limită de plecare
    const oraA = a.productie_clienti?.productie_zone_livrare?.ora_limita_plecare || '23:59:59';
    const oraB = b.productie_clienti?.productie_zone_livrare?.ora_limita_plecare || '23:59:59';
    if (oraA !== oraB) {
      return oraA.localeCompare(oraB); // Comenzile cu ora de plecare mai devreme primul
    }
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  }) || [] : [];

  // Always call the pagination hook, but use empty array when not needed
  const {
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    paginatedOrders,
    handlePageChange,
    handlePageSizeChange
  } = useOrdersPagination({
    orders: lineOrders,
    initialPageSize: 10
  });

  const handleLineSelect = (lineId: string) => {
    setCurrentLineId(lineId);
    setView('orders');
    onLineSelect(lineId);
  };

  const handleOrderSelect = (orderId: string) => {
    setCurrentOrderId(orderId);
    setView('session');
  };

  const handleStartSession = async () => {
    const validOperators = operatorNames.filter(n => n.trim() !== '');
    if (validOperators.length === 0 || !currentOrderId || !currentLineId) {
      toast({
        title: "Eroare",
        description: "Te rog completează cel puțin un nume de operator.",
        variant: "destructive"
      });
      return;
    }

    try {
      await createSessionMutation.mutateAsync({
        comanda_id: currentOrderId,
        linie_id: currentLineId,
        nume_operator: validOperators.join(', '),
        numar_angajati: validOperators.length
      });

      const order = orders?.find(o => o.id === currentOrderId);
      toast({
        title: "Sesiune pornită",
        description: `Sesiunea a fost pornită pentru comanda ${order?.numar_comanda}.`
      });

      setProducedQuantity(0);
    } catch (error) {
      toast({
        title: "Eroare",
        description: "Nu s-a putut porni sesiunea.",
        variant: "destructive"
      });
    }
  };

  const handleFinishSession = async (sessionId: string, cantitate: number) => {
    const session = activeSessions.find(s => s.id === sessionId);
    if (!session) return;

    const order = orders?.find(o => o.id === session.comanda_id);
    const cantitateComandă = order?.cantitate || 0;
    const cantRealaPrev = order?.cantitate_reala_produsa || 0;
    const esteReambalare = (order as any)?.magazin === 'REAMBALARE' || (order as any)?.tip_comanda === 'REAMBALARE';
    const cantRestockPrev = esteReambalare ? 0 : order?.cantitate_din_restock || 0;
    const acoperitPrev = cantRealaPrev + cantRestockPrev;
    // Cât mai e nevoie de produs în această sesiune ca să acoperim comanda
    const ramasDeAcoperit = Math.max(0, cantitateComandă - acoperitPrev);
    // Restocările disponibile vor acoperi automat restul. Aici doar deducem dacă a finalizat sau nu.
    // Considerăm finalizată dacă această sesiune + acoperirea anterioară ≥ cantitatea cerută.
    const status: 'finalizata' | 'partial' = (acoperitPrev + cantitate) >= cantitateComandă ? 'finalizata' : 'partial';

    if (cantitate <= 0) {
      const ok = window.confirm('Ai introdus 0 bucăți produse. Ești sigur că vrei să finalizezi sesiunea fără producție?');
      if (!ok) return;
    }

    try {
      await finishSessionMutation.mutateAsync({
        id: sessionId,
        cantitate_produsa: cantitate,
        status,
        comanda_id: session.comanda_id
      });

      toast({
        title: status === 'finalizata' ? "✅ Sesiune finalizată complet" : "⚠️ Sesiune finalizată parțial",
        description: `${cantitate} buc produse în această sesiune. ${status === 'partial' ? `Mai rămân de produs ~${Math.max(0, ramasDeAcoperit - cantitate)} buc.` : 'Comanda este acoperită integral.'}`
      });

      setOperatorNames([""]);
      setProducedQuantity(0);
    } catch (error) {
      toast({
        title: "Eroare",
        description: "Nu s-a putut finaliza sesiunea.",
        variant: "destructive"
      });
    }
  };

  // MULTIPLE REFRESH LISTENERS pentru a prinde toate eventurile
  useEffect(() => {
    const handleQuantityCorrection = (event: CustomEvent) => {
      console.log('🎯 === EVENIMENT CORECȚIE PRIMIT ÎN OPERATOR ===', event.detail);
      setRefreshKey(prev => prev + 1);
      setForceRefreshKey(prev => prev + 1);
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'last-quantity-correction') {
        console.log('🔔 === STORAGE EVENT ÎN OPERATOR ===', event.newValue);
        setRefreshKey(prev => prev + 1);
        setForceRefreshKey(prev => prev + 1);
      }
    };

    window.addEventListener('quantity-corrected', handleQuantityCorrection as EventListener);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('quantity-corrected', handleQuantityCorrection as EventListener);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // === Grouped session handlers ===
  const handleStartGroupSession = async (orderIds: string[], operatorList: string[]) => {
    const validOperators = operatorList.map(n => n.trim()).filter(Boolean);
    if (validOperators.length === 0 || !currentLineId) {
      toast({ title: "Eroare", description: "Completează cel puțin un operator.", variant: "destructive" });
      return;
    }
    const idSet = new Set(orderIds);
    const groupOrders = lineOrders.filter((o: any) => idSet.has(o.id) && !isOrderDone(o));
    let created = 0;
    for (const o of groupOrders) {
      if (activeSessions.some(s => s.comanda_id === o.id && s.linie_id === currentLineId)) continue;
      try {
        await createSessionMutation.mutateAsync({
          comanda_id: o.id,
          linie_id: currentLineId,
          nume_operator: validOperators.join(', '),
          numar_angajati: validOperators.length,
        });
        created++;
      } catch (err) {
        console.error('Eroare pornire sesiune grup pentru comanda', o.numar_comanda, err);
      }
    }
    toast({
      title: "Sesiuni pornite",
      description: `S-au pornit ${created} sesiuni pentru grup.`,
    });
  };

  const handleFinishGroupSession = async (orderIds: string[], totalQty: number) => {
    if (totalQty < 0 || !currentLineId) return;
    const idSet = new Set(orderIds);
    const groupOrders = lineOrders.filter((o: any) => idSet.has(o.id));
    // Ordinea existentă (după prioritate zonă) e deja aplicată în lineOrders
    const withSession = groupOrders
      .map((o: any) => ({ order: o, session: activeSessions.find(s => s.comanda_id === o.id && s.linie_id === currentLineId) }))
      .filter(x => !!x.session);

    if (withSession.length === 0) {
      toast({ title: "Nicio sesiune activă", description: "Grupul nu are sesiuni active de finalizat.", variant: "destructive" });
      return;
    }

    if (totalQty === 0) {
      const ok = window.confirm('Ai introdus 0 bucăți produse pentru tot grupul. Continui?');
      if (!ok) return;
    }

    let remaining = totalQty;
    for (let i = 0; i < withSession.length; i++) {
      const { order, session } = withSession[i] as any;
      const esteReamb = order.magazin === 'REAMBALARE' || order.tip_comanda === 'REAMBALARE';
      const acoperitPrev = (order.cantitate_reala_produsa || 0) + (esteReamb ? 0 : order.cantitate_din_restock || 0);
      const nevoie = Math.max(0, (order.cantitate || 0) - acoperitPrev);
      let assign = Math.min(nevoie, remaining);
      // Ultima sesiune primește surplusul rămas
      if (i === withSession.length - 1) assign = remaining;
      remaining = Math.max(0, remaining - assign);
      const status: 'finalizata' | 'partial' = (acoperitPrev + assign) >= (order.cantitate || 0) ? 'finalizata' : 'partial';
      try {
        await finishSessionMutation.mutateAsync({
          id: session.id,
          cantitate_produsa: assign,
          status,
          comanda_id: order.id,
        });
      } catch (err) {
        console.error('Eroare finalizare sesiune grup pentru comanda', order.numar_comanda, err);
      }
    }
    toast({
      title: "Grup finalizat",
      description: `Distribuit ${totalQty} buc pe ${withSession.length} comenzi.`,
    });
  };



  if (linesLoading || ordersLoading || sessionsLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-coral-primary" />
      </div>
    );
  }

  // VIEW: Session Management (când e selectată o comandă)
  if (view === 'session' && currentOrderId) {
    const currentOrder = orders?.find(o => o.id === currentOrderId);
    const activeSession = activeSessions.find(session => session.comanda_id === currentOrderId && session.linie_id === currentLineId);
    const cantitateComandată = currentOrder?.cantitate || 0;
    const cantitateRealaProadusa = currentOrder?.cantitate_reala_produsa || 0;
    const esteReambalare = (currentOrder as any)?.magazin === 'REAMBALARE' || (currentOrder as any)?.tip_comanda === 'REAMBALARE';
    const cantitatedinRestock = esteReambalare ? 0 : currentOrder?.cantitate_din_restock || 0;

    // Calculăm progresul mai precis
    const cantitateAcoperitaTotal = cantitateRealaProadusa + cantitatedinRestock;
    const cantitateRamasaDeProdus = Math.max(0, cantitateComandată - cantitateAcoperitaTotal);
    const procentProgres = cantitateComandată > 0 ? Math.round(cantitateAcoperitaTotal / cantitateComandată * 100) : 0;

    return (
      <div className="space-y-6 pb-24" key={`session-${refreshKey}-${forceRefreshKey}`}>
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => setView('orders')}
            className="border-coral-primary text-coral-primary hover:bg-coral-50"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Înapoi la comenzi
          </Button>
          <h2 className="text-2xl font-bold text-coral-primary">
            Gestionare Sesiune - {currentOrder?.numar_comanda}
          </h2>
        </div>

        {/* Card cu progresul complet al comenzii */}
        {currentOrder && (
          <Card className="border-coral-200 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-coral-primary to-bio-primary text-white">
              <CardTitle className="text-xl">Progres Comandă</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Produs:</span>
                    <p className="font-medium text-coral-primary text-lg">{currentOrder.productie_produse?.nume}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Magazin:</span>
                    <p className="font-medium text-coral-primary">{currentOrder.magazin}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Punct Livrare:</span>
                    <p className="font-medium text-coral-primary">{currentOrder.punct_livrare}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Unitate:</span>
                    <p className="font-medium text-coral-primary">{currentOrder.productie_produse?.unitate_masura}</p>
                  </div>
                </div>

                {/* Zonă de livrare și prioritate */}
                {currentOrder.productie_clienti?.productie_zone_livrare && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center gap-3 mb-2">
                      <div
                        className="px-3 py-1 rounded text-white font-medium text-sm"
                        style={{
                          backgroundColor: currentOrder.productie_clienti.productie_zone_livrare.culoare
                        }}
                      >
                        {currentOrder.productie_clienti.productie_zone_livrare.nume_zona}
                      </div>
                      <div className="text-sm text-gray-600">
                        🚛 Plecare: {currentOrder.productie_clienti.productie_zone_livrare.ora_limita_plecare || 'Nu specificat'}
                      </div>
                      <div className="text-sm text-blue-600 font-medium">
                        Prioritate: {currentOrder.productie_clienti.productie_zone_livrare.prioritate}
                      </div>
                    </div>
                  </div>
                )}

                {/* Progres cantitate - detaliat */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold text-green-600">{cantitateAcoperitaTotal}</span>
                      <span className="text-gray-500 text-xl">/</span>
                      <span className="text-2xl font-bold text-coral-primary">{cantitateComandată}</span>
                      <span className="text-lg text-gray-500">{currentOrder.productie_produse?.unitate_masura}</span>
                    </div>
                    <div className="text-right">
                      <div className={`text-3xl font-bold ${procentProgres >= 100 ? 'text-green-600' : procentProgres >= 50 ? 'text-blue-600' : 'text-amber-600'}`}>
                        {procentProgres}%
                      </div>
                      <div className="text-sm text-gray-500">complet</div>
                    </div>
                  </div>

                  {/* Breakdown detaliat */}
                  {(cantitateRealaProadusa > 0 || cantitatedinRestock > 0) && (
                    <div className="text-xs space-y-1 bg-gray-50 p-2 rounded">
                      {cantitateRealaProadusa > 0 && (
                        <div className="flex justify-between">
                          <span className="text-green-700">🏭 Produs efectiv:</span>
                          <span className="font-medium text-green-700">{cantitateRealaProadusa} {currentOrder.productie_produse?.unitate_masura}</span>
                        </div>
                      )}
                      {cantitatedinRestock > 0 && (
                        <div className="flex justify-between">
                          <span className="text-blue-700">📦 Din restocări:</span>
                          <span className="font-medium text-blue-700">{cantitatedinRestock} {currentOrder.productie_produse?.unitate_masura}</span>
                        </div>
                      )}
                      {cantitateRamasaDeProdus > 0 && (
                        <div className="flex justify-between border-t pt-1">
                          <span className="text-red-700 font-medium">⚠️ Mai trebuie produs:</span>
                          <span className="font-bold text-red-700">{cantitateRamasaDeProdus} {currentOrder.productie_produse?.unitate_masura}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Progress bar */}
                  <div className="w-full bg-gray-200 rounded-full h-4">
                    <div
                      className={`h-4 rounded-full transition-all duration-300 ${
                        procentProgres >= 100 ? 'bg-green-500' : procentProgres >= 50 ? 'bg-blue-500' : 'bg-amber-500'
                      }`}
                      style={{
                        width: `${Math.min(100, procentProgres)}%`
                      }}
                    ></div>
                  </div>

                  {/* Status badges */}
                  <div className="flex gap-2 flex-wrap">
                    {cantitateRamasaDeProdus > 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-600" />
                        <div>
                          <div className="font-bold text-amber-700">Mai rămâne:</div>
                          <div className="text-xl font-bold text-amber-800">
                            {cantitateRamasaDeProdus} {currentOrder.productie_produse?.unitate_masura}
                          </div>
                        </div>
                      </div>
                    )}
                    {cantitatedinRestock > 0 && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                        <Package className="w-5 h-5 text-green-600" />
                        <div>
                          <div className="font-bold text-green-700">Din stoc:</div>
                          <div className="text-xl font-bold text-green-800">
                            {cantitatedinRestock} {currentOrder.productie_produse?.unitate_masura}
                          </div>
                        </div>
                      </div>
                    )}
                    {procentProgres >= 100 && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <div className="font-bold text-green-700 text-lg">Cantitate exactă ✓</div>
                      </div>
                    )}
                    {cantitateAcoperitaTotal === 0 && (
                      <Badge variant="outline" className="text-xs bg-gray-50 text-gray-600 border-gray-200">
                        Nu s-a început producția
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Card cu Date și Observații */}
        {currentOrder && (
          <Card className="border-coral-200 shadow">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-600 block">📅 Data creării:</span>
                  <p className="font-medium text-gray-800">
                    {currentOrder.created_at
                      ? new Date(currentOrder.created_at).toLocaleString('ro-RO', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })
                      : '-'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-600 block">🏭 Data producției:</span>
                  <p className={`font-medium ${(currentOrder as any).data_productie ? 'text-coral-primary' : 'text-gray-400'}`}>
                    {(currentOrder as any).data_productie
                      ? new Date((currentOrder as any).data_productie).toLocaleDateString('ro-RO')
                      : 'Nestabilită'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-600 block">📝 Observații:</span>
                  <p className="font-medium text-gray-800 whitespace-pre-wrap break-words">
                    {(currentOrder as any).baxare || <span className="text-gray-400 italic">Fără observații</span>}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Trasabilitate (opțional) */}
        {currentOrderId && (
          <TrasabilitateCard
            comandaId={currentOrderId}
            sesiuneId={activeSessions.find(s => s.comanda_id === currentOrderId && s.linie_id === currentLineId)?.id || null}
          />
        )}

        {activeSession ? (
          <Card className="border-2 border-green-500 shadow-lg ring-2 ring-green-300">
            <CardHeader className="bg-gradient-to-r from-green-600 to-green-500 text-white">
              <CardTitle className="flex items-center gap-2">
                <Play className="h-5 w-5" />
                🟢 Sesiune Activă - În Desfășurare
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 bg-green-50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <span className="text-gray-600 text-sm">Operatori:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {activeSession.nume_operator.split(',').map((name, i) => (
                      <Badge key={i} className="bg-green-600 text-white text-sm">
                        {name.trim()}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600 text-sm">Pornită la:</span>
                  <p className="font-bold text-green-700 text-lg">
                    <Clock className="inline w-4 h-4 mr-1" />
                    {new Date(activeSession.ora_start).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <span className="text-xs text-gray-500">
                    {new Date(activeSession.ora_start).toLocaleDateString('ro-RO')}
                  </span>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="produced" className="text-coral-primary font-medium">
                    Cantitate Produsă în această sesiune
                  </Label>
                  <Input
                    id="produced"
                    type="number"
                    min="0"
                    value={producedQuantity.toString()}
                    onChange={(e) => setProducedQuantity(parseInt(e.target.value))}
                    placeholder="Introduceți cantitatea produsă"
                    className="border-coral-200 focus:border-coral-primary focus:ring-coral-primary"
                  />
                </div>
                
                <Button
                  onClick={() => handleFinishSession(activeSession.id, producedQuantity)}
                  disabled={finishSessionMutation.isPending}
                  className="w-full bg-coral-primary hover:bg-coral-600 text-white h-12 text-base"
                >
                  <CheckCircle className="h-5 w-5 mr-2" />
                  Finalizare Sesiune
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Sistemul detectează automat dacă comanda e completă sau parțială pe baza cantităților introduse.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-coral-200 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-coral-primary to-bio-primary text-white">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Pornire Sesiune Nouă
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4 mb-6">
                <div>
                  <Label className="text-coral-primary font-medium mb-2 block">Operatori</Label>
                  {operatorNames.map((name, index) => (
                    <div key={index} className="flex items-center gap-2 mb-2">
                      <Input
                        value={name}
                        onChange={(e) => {
                          const updated = [...operatorNames];
                          updated[index] = e.target.value;
                          setOperatorNames(updated);
                        }}
                        className="border-coral-200 focus:border-coral-primary focus:ring-coral-primary"
                        placeholder={`Numele operatorului ${index + 1}`}
                      />
                      {operatorNames.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setOperatorNames(operatorNames.filter((_, i) => i !== index))}
                          className="text-red-500 hover:text-red-700 px-2"
                        >
                          ✕
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOperatorNames([...operatorNames, ""])}
                    className="mt-1 border-coral-200 text-coral-primary hover:bg-coral-50"
                  >
                    + Adaugă operator
                  </Button>
                </div>
              </div>
              
              <Button
                onClick={handleStartSession}
                disabled={createSessionMutation.isPending || operatorNames.every(n => n.trim() === '')}
                className="w-full bg-coral-primary hover:bg-coral-600 text-white"
              >
                <Play className="h-4 w-4 mr-2" />
                Pornire Sesiune
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // VIEW: Orders for selected line - NOW USING TABLE FORMAT
  if (view === 'orders' && currentLineId) {
    const currentLine = lines?.find(l => l.id === currentLineId);
    const cap = currentLine?.capacitate_ora || 0;

    // Total bucăți rămase pe linie (pentru toate comenzile filtrate)
    const totalBucRamase = lineOrders.reduce((sum, o: any) => {
      const esteReambalare = o.magazin === 'REAMBALARE' || o.tip_comanda === 'REAMBALARE';
      const acoperit = (o.cantitate_reala_produsa || 0) + (esteReambalare ? 0 : (o.cantitate_din_restock || 0));
      return sum + Math.max(0, (o.cantitate || 0) - acoperit);
    }, 0);
    const totalOreEstimate = cap > 0 ? totalBucRamase / cap : 0;
    const formatDur = (hours: number) => {
      if (!isFinite(hours) || hours <= 0) return '-';
      const totalMin = Math.max(1, Math.round(hours * 60));
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      if (h === 0) return `${m} min`;
      if (m === 0) return `${h}h`;
      return `${h}h ${m}min`;
    };

    return (
      <div className="space-y-6" key={`orders-${refreshKey}-${forceRefreshKey}`}>
        <div className="flex items-center gap-4 flex-wrap">
          <Button
            variant="outline"
            onClick={() => setView('lines')}
            className="border-coral-primary text-coral-primary hover:bg-coral-50"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Înapoi la linii
          </Button>
          <h2 className="text-2xl font-bold text-coral-primary">
            Comenzi pentru {currentLine?.nume} - {totalItems} comenzi (ordinea livrării)
          </h2>
        </div>

        {/* Sumar linie: bucăți rămase + timp estimat */}
        <Card className="border-coral-200">
          <CardContent className="pt-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-coral-primary" />
              <span className="text-sm text-gray-600">Total de produs:</span>
              <span className="font-bold text-coral-primary text-lg">{totalBucRamase} buc</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              <span className="text-sm text-gray-600">Timp estimat:</span>
              <span className="font-bold text-blue-700 text-lg">
                {cap > 0 ? `~${formatDur(totalOreEstimate)}` : 'Fără capacitate'}
              </span>
            </div>
            {cap > 0 && (
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <span className="text-sm text-gray-600">Productivitate:</span>
                <span className="font-medium text-green-700">{cap} buc/h</span>
              </div>
            )}
          </CardContent>
        </Card>



        <Card className="border-coral-200">
          <CardContent className="pt-4 flex items-center gap-2 flex-wrap">
            <CalendarDays className="h-5 w-5 text-coral-primary" />
            <DateProductiePicker value={selectedDay} onChange={setSelectedDay} label="" />
            <span className="text-xs text-muted-foreground ml-2">
              Comenzile fără dată țintă apar la „Azi".
            </span>
          </CardContent>
        </Card>

        {/* Toggle vizualizare */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Vizualizare:</span>
          <ToggleGroup
            type="single"
            value={ordersViewMode}
            onValueChange={(v) => v && setOrdersViewMode(v as 'individual' | 'grouped')}
            className="border rounded-md"
          >
            <ToggleGroupItem value="individual" className="px-3">Individual</ToggleGroupItem>
            <ToggleGroupItem value="grouped" className="px-3">Grupat pe produs</ToggleGroupItem>
          </ToggleGroup>
        </div>

        {totalItems > 0 ? (
          ordersViewMode === 'grouped' ? (
            <GroupedOrdersView
              orders={lineOrders}
              activeSessions={activeSessions}
              lineCapacity={cap}
              groupMap={groupMap}
              onOrderSelect={handleOrderSelect}
              onStartGroup={handleStartGroupSession}
              onFinishGroup={handleFinishGroupSession}
            />
          ) : (
            <>
              <OrdersTable
                orders={paginatedOrders}
                onOrderSelect={handleOrderSelect}
                totalItems={totalItems}
                activeSessions={activeSessions}
                lineCapacity={cap}
              />

              {/* Paginarea pentru comenzi */}
              <OrdersPagination
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={totalItems}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
              />
            </>
          )
        ) : (
          <Card className="border-coral-200 shadow-md">
            <CardContent className="p-8 text-center">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500">Nu există comenzi pentru această linie</p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }


  // VIEW: Lines Overview (default)
  return (
    <div className="space-y-8" key={`lines-${refreshKey}-${forceRefreshKey}`}>
      <div className="text-center">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-coral-primary to-bio-primary bg-clip-text text-zinc-950">
          Interfața Operatorului
        </h2>
        <p className="text-coral-primary mt-2">Selectează o linie de producție pentru a continua</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {lines?.map((line: ProductieLinie) => {
          const activeSession = activeSessions.find(session => session.linie_id === line.id);
          // Calculez comenzile pentru fiecare linie individual
          // De lucrat = comenzi care nu sunt completed ȘI nu sunt complet acoperite (din producție + restock)
          const relevantOrders = orders?.filter(order => {
            if (order.linie_id !== line.id) return false;
            if (!matchesSelectedDay(order)) return false;
            if (order.status === 'completed') return false;
            const esteReambalare = (order as any).magazin === 'REAMBALARE' || (order as any).tip_comanda === 'REAMBALARE';
            const acoperit = (order.cantitate_reala_produsa || 0) + (esteReambalare ? 0 : (order.cantitate_din_restock || 0));
            const cerut = order.cantitate || 0;
            if (cerut > 0 && acoperit >= cerut) return false;
            return true;
          }) || [];
          const lineOrdersCount = relevantOrders.length;
          const totalBucRamase = relevantOrders.reduce((sum, o: any) => {
            const esteReambalare = o.magazin === 'REAMBALARE' || o.tip_comanda === 'REAMBALARE';
            const acoperit = (o.cantitate_reala_produsa || 0) + (esteReambalare ? 0 : (o.cantitate_din_restock || 0));
            return sum + Math.max(0, (o.cantitate || 0) - acoperit);
          }, 0);
          const cap = (line as any).capacitate_ora || 0;
          const oreEst = cap > 0 ? totalBucRamase / cap : 0;
          const formatDur = (hours: number) => {
            if (!isFinite(hours) || hours <= 0) return '-';
            const totalMin = Math.max(1, Math.round(hours * 60));
            const h = Math.floor(totalMin / 60);
            const m = totalMin % 60;
            if (h === 0) return `${m} min`;
            if (m === 0) return `${h}h`;
            return `${h}h ${m}min`;
          };

          return (
            <Card
              key={line.id}
              className={`border-coral-200 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer ${
                activeSession ? 'border-coral-400 bg-gradient-to-br from-coral-50 to-bio-50' : 'hover:border-coral-300'
              }`}
              onClick={() => handleLineSelect(line.id)}
            >
              <CardHeader className={`pb-3 ${
                activeSession ? 'bg-gradient-to-r from-coral-primary to-bio-primary text-white' : 'bg-gradient-to-r from-gray-50 to-coral-50 text-coral-primary'
              }`}>
                <CardTitle className="text-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Factory className="h-5 w-5 bg-transparent" />
                    <span className="font-semibold text-zinc-950">
                      {line.nume || 'Linie fără nume'}
                    </span>
                  </div>
                  {activeSession && (
                    <div className="flex items-center text-coral-100">
                      <Timer className="h-4 w-4 mr-1 animate-pulse" />
                      Activă
                    </div>
                  )}
                </CardTitle>
              </CardHeader>
              
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Status:</span>
                      <p className={`font-medium ${activeSession ? 'text-coral-600' : 'text-green-600'}`}>
                        {activeSession ? 'În producție' : 'Disponibilă'}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600">De lucrat:</span>
                      <p className={`font-bold text-lg ${lineOrdersCount > 0 ? 'text-coral-primary' : 'text-gray-400'}`}>
                        {lineOrdersCount > 0 ? `${lineOrdersCount} comenzi` : 'Nicio comandă'}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600 flex items-center gap-1">
                        <Package className="h-3 w-3" /> Bucăți:
                      </span>
                      <p className={`font-bold text-lg ${totalBucRamase > 0 ? 'text-coral-primary' : 'text-gray-400'}`}>
                        {totalBucRamase > 0 ? `${totalBucRamase} buc` : '—'}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Timp estimat:
                      </span>
                      <p className={`font-bold text-lg ${oreEst > 0 ? 'text-blue-700' : 'text-gray-400'}`}>
                        {cap > 0 ? (oreEst > 0 ? `~${formatDur(oreEst)}` : '—') : 'Fără cap.'}
                      </p>
                    </div>
                  </div>
                  {cap > 0 && (
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" /> Productivitate: {cap} buc/h
                    </div>
                  )}
                  
                  <Button className="w-full bg-coral-primary hover:bg-coral-600 text-white">
                    Accesează Linia
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default OperatorInterface;
