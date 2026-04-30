import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft, Play, Pause, Square, Loader2, AlertTriangle, Package, Search } from "lucide-react";
import { useOrders, useUpdateOrder, useProductionLines, useCreateWorkSession, useWorkSessions, useFinishWorkSession } from "@/hooks/productie/useProductionData";
import { useAutoRefresh } from "@/hooks/productie/useAutoRefresh";
import { useOrdersPagination } from "@/hooks/productie/useOrdersPagination";
import { useLinesPagination } from "@/hooks/productie/useLinesPagination";
import OrdersPagination from "./OrdersPagination";

const LineDistribution = () => {
  // Auto-refresh pentru comenzi la fiecare 10 secunde
  useAutoRefresh({ 
    interval: 10000, 
    enabled: true,
    queryKeys: [
      ['orders'],
      ['work-sessions']
    ]
  });

  const [selectedLine, setSelectedLine] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isStartSessionDialogOpen, setIsStartSessionDialogOpen] = useState(false);
  const [selectedOrderForSession, setSelectedOrderForSession] = useState<any>(null);
  const [operatorName, setOperatorName] = useState('');
  const [employeeCount, setEmployeeCount] = useState(1);
  const [isFinishDialogOpen, setIsFinishDialogOpen] = useState(false);
  const [selectedSessionForFinish, setSelectedSessionForFinish] = useState<any>(null);
  const [producedQuantity, setProducedQuantity] = useState(0);
  const [sessionStatus, setSessionStatus] = useState<'finalizata' | 'partial'>('finalizata');

  const { data: orders, refetch: refetchOrders } = useOrders();
  const { data: lines } = useProductionLines();
  const { data: workSessions, refetch: refetchSessions } = useWorkSessions();
  const updateOrderMutation = useUpdateOrder();
  const createSessionMutation = useCreateWorkSession();
  const finishSessionMutation = useFinishWorkSession();

  // Paginare pentru liniile de producție
  const {
    currentPage: linesCurrentPage,
    pageSize: linesPageSize,
    totalPages: linesTotalPages,
    totalItems: linesTotalItems,
    paginatedLines,
    handlePageChange: handleLinesPageChange,
    handlePageSizeChange: handleLinesPageSizeChange,
  } = useLinesPagination({ lines: lines || [], initialPageSize: 5 });

  // Filtrare comenzi pentru linia selectată
  const ordersForSelectedLine = orders?.filter(order => 
    selectedLine && order.linie_id === selectedLine
  ) || [];

  // Aplicare filtre de căutare și status
  const filteredOrders = ordersForSelectedLine.filter(order => {
    const matchesSearch = !searchTerm || 
      order.numar_comanda.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.productie_produse?.nume?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.magazin.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Paginare pentru comenzile filtrate
  const {
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    paginatedOrders,
    handlePageChange,
    handlePageSizeChange,
    resetPagination
  } = useOrdersPagination({ orders: filteredOrders, initialPageSize: 15 });

  // Reset paginare când se schimbă filtrele
  useEffect(() => {
    resetPagination();
  }, [searchTerm, statusFilter, selectedLine, resetPagination]);

  // Sesiuni active pentru linia selectată
  const activeSessionsForLine = workSessions?.filter(session => 
    selectedLine && session.linie_id === selectedLine && session.status === 'activa'
  ) || [];

  const handleStartSession = async () => {
    if (!selectedOrderForSession || !operatorName.trim()) {
      toast.error("Completează toate câmpurile obligatorii");
      return;
    }

    try {
      await createSessionMutation.mutateAsync({
        comanda_id: selectedOrderForSession.id,
        linie_id: selectedLine,
        nume_operator: operatorName.trim(),
        numar_angajati: employeeCount
      });

      // Update order status to in_progress
      await updateOrderMutation.mutateAsync({
        id: selectedOrderForSession.id,
        updates: { status: 'in_progress' }
      });

      toast.success("Sesiunea de lucru a fost începută!");
      setIsStartSessionDialogOpen(false);
      setSelectedOrderForSession(null);
      setOperatorName('');
      setEmployeeCount(1);
      
      // Refresh data immediately
      await refetchSessions();
      await refetchOrders();
    } catch (error) {
      console.error('Eroare la începerea sesiunii:', error);
      toast.error("Nu s-a putut începe sesiunea de lucru");
    }
  };

  const handleFinishSession = async () => {
    if (!selectedSessionForFinish || producedQuantity <= 0) {
      toast.error("Cantitatea produsă trebuie să fie mai mare decât 0");
      return;
    }

    try {
      await finishSessionMutation.mutateAsync({
        id: selectedSessionForFinish.id,
        cantitate_produsa: producedQuantity,
        status: sessionStatus,
        comanda_id: selectedSessionForFinish.comanda_id
      });

      toast.success("Sesiunea de lucru a fost finalizată!");
      setIsFinishDialogOpen(false);
      setSelectedSessionForFinish(null);
      setProducedQuantity(0);
      setSessionStatus('finalizata');
      
      // Refresh data immediately
      await refetchSessions();
      await refetchOrders();
    } catch (error) {
      console.error('Eroare la finalizarea sesiunii:', error);
      toast.error("Nu s-a putut finaliza sesiunea de lucru");
    }
  };

  if (!selectedLine) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold">Distribuție pe Linii</h2>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Selectează o Linie de Producție ({linesTotalItems} linii)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {paginatedLines.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nu există linii de producție disponibile.
                </p>
              ) : (
                <div className="grid gap-4">
                  {paginatedLines.map((line) => (
                    <Card key={line.id} className="cursor-pointer hover:bg-gray-50 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold text-lg">{line.nume}</h3>
                            <p className="text-sm text-muted-foreground">
                              Capacitate: {line.capacitate_ora} bucăți/oră
                            </p>
                            <Badge 
                              variant={line.status === 'activa' ? 'default' : 'secondary'}
                              className="mt-2"
                            >
                              {line.status === 'activa' ? 'Activă' : 'Inactivă'}
                            </Badge>
                          </div>
                          <Button 
                            onClick={() => setSelectedLine(line.id)}
                            disabled={line.status !== 'activa'}
                          >
                            Selectează
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Paginarea pentru linii - afișată întotdeauna când sunt linii */}
              {linesTotalItems > 0 && (
                <div className="border-t pt-4">
                  <OrdersPagination
                    currentPage={linesCurrentPage}
                    totalPages={linesTotalPages}
                    pageSize={linesPageSize}
                    totalItems={linesTotalItems}
                    onPageChange={handleLinesPageChange}
                    onPageSizeChange={handleLinesPageSizeChange}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedLineData = lines?.find(line => line.id === selectedLine);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => setSelectedLine('')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Înapoi la Linii
        </Button>
        <h2 className="text-2xl font-bold">
          Comenzi pentru {selectedLineData?.nume} - {totalItems} comenzi {activeSessionsForLine.length > 0 && `(${activeSessionsForLine.length} sesiuni active)`}
        </h2>
      </div>

      {/* Sesiuni Active */}
      {activeSessionsForLine.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5 text-green-600" />
              Sesiuni de Lucru Active ({activeSessionsForLine.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activeSessionsForLine.map((session) => {
                const order = orders?.find(o => o.id === session.comanda_id);
                return (
                  <div key={session.id} className="flex items-center justify-between p-4 border rounded-lg bg-green-50">
                    <div className="flex-1">
                      <div className="font-medium">
                        Sesiune: {session.nume_operator} ({session.numar_angajati} angajați)
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Comandă: {order?.numar_comanda} - {order?.productie_produse?.nume}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Început la: {new Date(session.ora_start).toLocaleString('ro-RO')}
                      </div>
                    </div>
                    <Button
                      onClick={() => {
                        setSelectedSessionForFinish(session);
                        setProducedQuantity(order?.cantitate || 0);
                        setIsFinishDialogOpen(true);
                      }}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      <Square className="h-4 w-4 mr-2" />
                      Finalizează
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtre și Căutare */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Caută după număr comandă, produs sau magazin..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toate statusurile</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="assigned">Alocate</SelectItem>
                <SelectItem value="in_progress">În progres</SelectItem>
                <SelectItem value="completed">Finalizate</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lista Comenzilor cu Paginare */}
      <Card>
        <CardHeader>
          <CardTitle>Lista Comenzilor ({totalItems} total)</CardTitle>
        </CardHeader>
        <CardContent>
          {paginatedOrders.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {totalItems === 0 ? "Nu există comenzi alocate pe această linie." : "Nu s-au găsit comenzi cu filtrele aplicate."}
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Număr</TableHead>
                    <TableHead>Produs</TableHead>
                    <TableHead className="min-w-[350px]">Progres Producție</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Magazin</TableHead>
                    <TableHead>Data Creării</TableHead>
                    <TableHead className="text-right">Acțiuni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedOrders.map((order) => {
                    const cantitateComandată = order.cantitate;
                    const cantitateReală = order.cantitate_reala_produsa || 0;
                    const cantitateDinRestock = order.cantitate_din_restock || 0;
                    
                    const cantitateAcoperitaTotal = cantitateReală + cantitateDinRestock;
                    const cantitateRamasaDeProdus = Math.max(0, cantitateComandată - cantitateAcoperitaTotal);
                    const procentProgres = cantitateComandată > 0 ? Math.round((cantitateAcoperitaTotal / cantitateComandată) * 100) : 0;
                    
                    const uniqueKey = `${order.id}-${cantitateReală}-${cantitateDinRestock}-${order.updated_at}`;
                    
                    // Check if there's an active session for this order
                    const hasActiveSession = activeSessionsForLine.some(session => session.comanda_id === order.id);
                    
                    return (
                      <TableRow key={uniqueKey}>
                        <TableCell className="font-medium">{order.numar_comanda}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{order.productie_produse?.nume}</div>
                            <div className="text-sm text-muted-foreground">
                              {order.productie_produse?.unitate_masura}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <span className="text-lg font-bold text-blue-600">{cantitateAcoperitaTotal}</span>
                                  <span className="text-muted-foreground">/</span>
                                  <span className="text-lg font-semibold text-gray-800">{cantitateComandată}</span>
                                  <span className="text-sm text-muted-foreground">{order.productie_produse?.unitate_masura}</span>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Acoperit / Comandat
                                </div>
                              </div>
                              <div className="text-right">
                                <div className={`text-lg font-bold ${
                                  procentProgres >= 100 ? 'text-green-600' : 
                                  procentProgres >= 50 ? 'text-blue-600' : 
                                  'text-amber-600'
                                }`}>
                                  {procentProgres}%
                                </div>
                                <div className="text-xs text-muted-foreground">complet</div>
                              </div>
                            </div>

                            {(cantitateReală > 0 || cantitateDinRestock > 0 || hasActiveSession) && (
                              <div className="text-xs space-y-1 bg-gray-50 p-2 rounded">
                                {hasActiveSession && (
                                  <div className="flex justify-between">
                                    <span className="text-green-700 font-medium">🔄 În producție acum:</span>
                                    <span className="font-medium text-green-700">ACTIV</span>
                                  </div>
                                )}
                                {cantitateReală > 0 && (
                                  <div className="flex justify-between">
                                    <span className="text-green-700">🏭 Produs efectiv:</span>
                                    <span className="font-medium text-green-700">{cantitateReală} {order.productie_produse?.unitate_masura}</span>
                                  </div>
                                )}
                                {cantitateDinRestock > 0 && (
                                  <div className="flex justify-between">
                                    <span className="text-blue-700">📦 Din restocări:</span>
                                    <span className="font-medium text-blue-700">{cantitateDinRestock} {order.productie_produse?.unitate_masura}</span>
                                  </div>
                                )}
                                {cantitateRamasaDeProdus > 0 && (
                                  <div className="flex justify-between border-t pt-1">
                                    <span className="text-red-700 font-medium">⚠️ Mai trebuie produs:</span>
                                    <span className="font-bold text-red-700">{cantitateRamasaDeProdus} {order.productie_produse?.unitate_masura}</span>
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="w-full bg-gray-200 rounded-full h-3">
                              <div 
                                className={`h-3 rounded-full transition-all duration-300 ${
                                  procentProgres >= 100 ? 'bg-green-500' : 
                                  procentProgres >= 50 ? 'bg-blue-500' : 'bg-amber-500'
                                }`}
                                style={{ width: `${Math.min(100, procentProgres)}%` }}
                              ></div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {hasActiveSession && (
                                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                  🔄 În producție
                                </Badge>
                              )}
                              {cantitateRamasaDeProdus > 0 && (
                                <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  Lipsește: {cantitateRamasaDeProdus} {order.productie_produse?.unitate_masura}
                                </Badge>
                              )}
                              {cantitateDinRestock > 0 && (
                                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                  <Package className="w-3 h-3 mr-1" />
                                  Din stoc: {cantitateDinRestock} {order.productie_produse?.unitate_masura}
                                </Badge>
                              )}
                              {procentProgres >= 100 && (
                                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                  ✓ Complet acoperit
                                </Badge>
                              )}
                              {cantitateAcoperitaTotal === 0 && !hasActiveSession && (
                                <Badge variant="outline" className="text-xs bg-gray-50 text-gray-600 border-gray-200">
                                  Nu s-a început producția
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={
                              order.status === 'completed' ? 'default' : 
                              order.status === 'in_progress' ? 'secondary' : 
                              'outline'
                            }
                          >
                            {order.status === 'completed' ? 'Finalizată' : 
                             order.status === 'in_progress' ? 'În progres' : 
                             order.status === 'assigned' ? 'Alocată' : 'Pending'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{order.magazin}</div>
                            <div className="text-sm text-muted-foreground">{order.punct_livrare}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {new Date(order.created_at).toLocaleDateString('ro-RO')}
                        </TableCell>
                        <TableCell className="text-right">
                          {!hasActiveSession && order.status !== 'completed' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedOrderForSession(order);
                                setIsStartSessionDialogOpen(true);
                              }}
                              disabled={createSessionMutation.isPending}
                            >
                              {createSessionMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <Play className="h-4 w-4 mr-2" />
                                  Start
                                </>
                              )}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Paginația pentru comenzi */}
              <div className="mt-6 border-t pt-4">
                <OrdersPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  totalItems={totalItems}
                  onPageChange={handlePageChange}
                  onPageSizeChange={handlePageSizeChange}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog pentru începerea sesiunii */}
      <Dialog open={isStartSessionDialogOpen} onOpenChange={setIsStartSessionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Începe Sesiunea de Lucru</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Comandă</label>
              <p className="text-sm text-muted-foreground">
                {selectedOrderForSession?.numar_comanda} - {selectedOrderForSession?.productie_produse?.nume}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">Nume Operator *</label>
              <input
                type="text"
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-md"
                placeholder="Introdu numele operatorului"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Numărul de Angajați</label>
              <input
                type="number"
                min="1"
                value={employeeCount}
                onChange={(e) => setEmployeeCount(parseInt(e.target.value) || 1)}
                className="w-full mt-1 px-3 py-2 border rounded-md"
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleStartSession}
                disabled={createSessionMutation.isPending || !operatorName.trim()}
                className="flex-1"
              >
                {createSessionMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Începe Sesiunea
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsStartSessionDialogOpen(false);
                  setSelectedOrderForSession(null);
                  setOperatorName('');
                  setEmployeeCount(1);
                }}
              >
                Anulează
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isFinishDialogOpen} onOpenChange={setIsFinishDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finalizează Sesiunea de Lucru</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Operator</label>
              <p className="text-sm text-muted-foreground">
                {selectedSessionForFinish?.nume_operator}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">Cantitatea Produsă *</label>
              <input
                type="number"
                min="1"
                value={producedQuantity}
                onChange={(e) => setProducedQuantity(parseInt(e.target.value) || 0)}
                className="w-full mt-1 px-3 py-2 border rounded-md"
                placeholder="Introdu cantitatea produsă"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Status Sesiune</label>
              <Select value={sessionStatus} onValueChange={(value: 'finalizata' | 'partial') => setSessionStatus(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="finalizata">Finalizată Complet</SelectItem>
                  <SelectItem value="partial">Finalizată Parțial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleFinishSession}
                disabled={finishSessionMutation.isPending || producedQuantity <= 0}
                className="flex-1"
              >
                {finishSessionMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Square className="h-4 w-4 mr-2" />
                )}
                Finalizează
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsFinishDialogOpen(false);
                  setSelectedSessionForFinish(null);
                  setProducedQuantity(0);
                  setSessionStatus('finalizata');
                }}
              >
                Anulează
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LineDistribution;
