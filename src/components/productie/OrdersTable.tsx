
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProductieComanda, ProductieSesiuneLucru } from "@/hooks/productie/useProductionData";
import { Package, AlertTriangle, CheckCircle, Clock, Factory, Archive, Play, Users } from "lucide-react";
import { useOrdersPagination } from "@/hooks/productie/useOrdersPagination";
import OrdersPagination from "./OrdersPagination";

interface OrdersTableProps {
  orders: ProductieComanda[];
  onOrderSelect: (orderId: string) => void;
  totalItems: number;
  activeSessions?: ProductieSesiuneLucru[];
}

const OrdersTable: React.FC<OrdersTableProps> = ({ orders, onOrderSelect, totalItems, activeSessions = [] }) => {
  const {
    currentPage,
    pageSize,
    totalPages,
    paginatedOrders,
    handlePageChange,
    handlePageSizeChange,
    resetPagination
  } = useOrdersPagination({ orders, initialPageSize: 25 });

  // Reset pagination when orders change (e.g., after filtering)
  React.useEffect(() => {
    resetPagination();
  }, [orders.length, resetPagination]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pending</Badge>;
      case 'in_progress':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">În progres</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Finalizată</Badge>;
      case 'assigned':
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">Alocată</Badge>;
      default:
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">{status}</Badge>;
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 100) return 'text-green-600';
    if (progress >= 50) return 'text-blue-600';
    return 'text-amber-600';
  };

  return (
    <Card className="border-coral-200 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-coral-primary to-bio-primary text-white">
        <CardTitle className="flex items-center gap-2">
          <Factory className="h-5 w-5" />
          Lista Comenzilor ({totalItems})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {/* Mobile/tablet card view */}
        <div className="md:hidden divide-y">
          {paginatedOrders.map((order) => {
            const cantitateComandată = order.cantitate;
            const cantitateRealaProadusa = order.cantitate_reala_produsa || 0;
            const esteReambalare = (order as any).magazin === 'REAMBALARE' || (order as any).tip_comanda === 'REAMBALARE';
            const cantitatedinRestock = esteReambalare ? 0 : order.cantitate_din_restock || 0;
            const cantitateAcoperitaTotal = cantitateRealaProadusa + cantitatedinRestock;
            const cantitateRamasaDeProdus = Math.max(0, cantitateComandată - cantitateAcoperitaTotal);
            const procentProgres = cantitateComandată > 0 ? Math.round(cantitateAcoperitaTotal / cantitateComandată * 100) : 0;
            const activeSession = activeSessions.find(s => s.comanda_id === order.id);
            const hasActiveSession = !!activeSession;
            return (
              <div
                key={order.id}
                onClick={() => onOrderSelect(order.id)}
                className={`p-3 cursor-pointer active:bg-coral-50 transition-colors ${
                  order.status === 'completed' ? 'bg-green-50' : hasActiveSession ? 'bg-emerald-50 border-l-4 border-l-green-500' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-coral-primary text-sm">{order.numar_comanda}</div>
                    <div className="font-medium text-sm truncate">{order.productie_produse?.nume}</div>
                  </div>
                  {getStatusBadge(order.status)}
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xl font-bold ${getProgressColor(procentProgres)}`}>{cantitateAcoperitaTotal}</span>
                  <span className="text-gray-400">/</span>
                  <span className="text-base font-semibold">{cantitateComandată}</span>
                  <span className="text-xs text-gray-500">{order.productie_produse?.unitate_masura}</span>
                  <div className={`ml-auto px-2 py-1 rounded-full text-xs font-bold ${getProgressColor(procentProgres)}`}
                    style={{ backgroundColor: procentProgres >= 100 ? '#dcfce7' : procentProgres >= 50 ? '#dbeafe' : '#fef3c7' }}>
                    {procentProgres}%
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden mb-2">
                  <div className={`h-2 rounded-full ${
                    procentProgres >= 100 ? 'bg-green-500' : procentProgres >= 50 ? 'bg-blue-500' : 'bg-amber-500'
                  }`} style={{ width: `${Math.min(100, procentProgres)}%` }} />
                </div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Magazin:</span>
                    <span className="font-medium truncate">{order.magazin}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Factory className="w-3 h-3 text-coral-primary shrink-0" />
                    <span className="font-medium text-coral-primary truncate">{order.productie_linii?.nume || '-'}</span>
                  </div>
                  <div className="text-gray-500">
                    📅 Creată: <span className="font-medium text-gray-700">{order.created_at ? new Date(order.created_at).toLocaleDateString('ro-RO') : '-'}</span>
                  </div>
                  <div className={(order as any).data_productie ? 'text-coral-primary' : 'text-gray-400'}>
                    🏭 Prod: <span className="font-medium">{(order as any).data_productie ? new Date((order as any).data_productie).toLocaleDateString('ro-RO') : 'Nestabilită'}</span>
                  </div>
                  {order.punct_livrare && (
                    <div className="col-span-2 text-gray-500 truncate">📍 {order.punct_livrare}</div>
                  )}
                  {cantitateRamasaDeProdus > 0 && (
                    <div className="col-span-2 text-red-600 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Lipsește: {cantitateRamasaDeProdus} {order.productie_produse?.unitate_masura}
                    </div>
                  )}
                  {hasActiveSession && (
                    <div className="col-span-2 text-green-700 flex items-center gap-1">
                      <Play className="w-3 h-3 fill-green-600" />
                      🟢 {activeSession.nume_operator} — {new Date(activeSession.ora_start).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>
                <Button
                  size="sm"
                  className={`w-full mt-2 ${order.status === 'completed' ? "bg-green-600 hover:bg-green-700" : "bg-coral-primary hover:bg-coral-600"} text-white text-xs`}
                >
                  {order.status === 'completed' ? <><CheckCircle className="w-3 h-3 mr-1" />Vezi</> : <><Clock className="w-3 h-3 mr-1" />Accesează</>}
                </Button>
              </div>
            );
          })}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="font-semibold text-coral-primary">Număr</TableHead>
              <TableHead className="font-semibold text-coral-primary">Produs</TableHead>
              <TableHead className="font-semibold text-coral-primary">Date</TableHead>
              <TableHead className="font-semibold text-coral-primary">Progres Producție</TableHead>
              <TableHead className="font-semibold text-coral-primary">Status</TableHead>
              <TableHead className="font-semibold text-coral-primary">Magazin</TableHead>
              <TableHead className="font-semibold text-coral-primary">Zonă Livrare</TableHead>
              <TableHead className="font-semibold text-coral-primary">Linie</TableHead>
              <TableHead className="font-semibold text-coral-primary">Acțiuni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedOrders.map((order) => {
              const cantitateComandată = order.cantitate;
              const cantitateRealaProadusa = order.cantitate_reala_produsa || 0;
              const esteReambalare = (order as any).magazin === 'REAMBALARE' || (order as any).tip_comanda === 'REAMBALARE';
              const cantitatedinRestock = esteReambalare ? 0 : order.cantitate_din_restock || 0;
              const cantitateAcoperitaTotal = cantitateRealaProadusa + cantitatedinRestock;
              const cantitateRamasaDeProdus = Math.max(0, cantitateComandată - cantitateAcoperitaTotal);
              const procentProgres = cantitateComandată > 0 ? Math.round(cantitateAcoperitaTotal / cantitateComandată * 100) : 0;
              const surplusRestocari = Math.max(0, cantitateRealaProadusa - cantitateComandată);
              
              const activeSession = activeSessions.find(s => s.comanda_id === order.id);
              const hasActiveSession = !!activeSession;

              return (
                <TableRow 
                  key={order.id} 
                  className={`hover:bg-coral-50 cursor-pointer transition-colors ${order.status === 'completed' ? 'bg-green-50' : hasActiveSession ? 'bg-emerald-50 border-l-4 border-l-green-500' : ''}`}
                  onClick={() => onOrderSelect(order.id)}
                >
                  <TableCell className="font-medium text-coral-primary">
                    {order.numar_comanda}
                  </TableCell>
                  
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium">{order.productie_produse?.nume}</div>
                      <div className="text-sm text-gray-500">
                        {cantitateComandată} {order.productie_produse?.unitate_masura}
                      </div>
                      {(order as any).baxare && (
                        <div className="text-xs px-2 py-1 rounded bg-amber-50 border border-amber-200 text-amber-800 font-medium">
                          📝 {(order as any).baxare}
                        </div>
                      )}
                      {cantitateRamasaDeProdus > 0 && (
                        <div className="text-xs text-red-600 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Lipsește: {cantitateRamasaDeProdus} {order.productie_produse?.unitate_masura}
                        </div>
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="space-y-1 text-xs whitespace-nowrap">
                      <div>
                        <span className="text-gray-500">Creată:</span>{' '}
                        <span className="font-medium text-gray-800">
                          {order.created_at ? new Date(order.created_at).toLocaleDateString('ro-RO') : '-'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Producție:</span>{' '}
                        <span className={`font-medium ${(order as any).data_productie ? 'text-coral-primary' : 'text-gray-400'}`}>
                          {(order as any).data_productie
                            ? new Date((order as any).data_productie).toLocaleDateString('ro-RO')
                            : 'Nestabilită'}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="space-y-2 min-w-[200px]">
                      {/* Progres principal cu iconițe și numere mari */}
                      <div className="flex items-center gap-2">
                        <span className={`text-2xl font-bold ${getProgressColor(procentProgres)}`}>
                          {cantitateAcoperitaTotal}
                        </span>
                        <span className="text-gray-400 text-lg">/</span>
                        <span className="text-xl font-semibold text-gray-800">
                          {cantitateComandată}
                        </span>
                        <span className="text-sm text-gray-500 ml-1">
                          {order.productie_produse?.unitate_masura}
                        </span>
                        <div className={`ml-2 px-2 py-1 rounded-full text-sm font-bold ${getProgressColor(procentProgres)} bg-opacity-20`} 
                             style={{ backgroundColor: procentProgres >= 100 ? '#dcfce7' : procentProgres >= 50 ? '#dbeafe' : '#fef3c7' }}>
                          {procentProgres}%
                        </div>
                      </div>
                      
                      {/* Badge-uri pentru componente cu iconițe */}
                      <div className="flex flex-wrap gap-1">
                        {cantitatedinRestock > 0 && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-orange-100 rounded-full border border-orange-200">
                            <Package className="w-3 h-3 text-orange-600" />
                            <span className="text-orange-700 font-medium text-xs">
                              Din restocări: {cantitatedinRestock} {order.productie_produse?.unitate_masura}
                            </span>
                          </div>
                        )}
                        {cantitateRealaProadusa > 0 && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 rounded-full border border-blue-200">
                            <Factory className="w-3 h-3 text-blue-600" />
                            <span className="text-blue-700 font-medium text-xs">
                              {cantitateRealaProadusa > cantitateComandată ? `${cantitateComandată}` : `${cantitateRealaProadusa}`} {order.productie_produse?.unitate_masura} din producție
                            </span>
                          </div>
                        )}
                        {surplusRestocari > 0 && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-purple-100 rounded-full border border-purple-200">
                            <Archive className="w-3 h-3 text-purple-600" />
                            <span className="text-purple-700 font-medium text-xs">
                              {surplusRestocari} {order.productie_produse?.unitate_masura} în restocări
                            </span>
                          </div>
                        )}
                        {procentProgres === 100 && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-green-100 rounded-full border border-green-200">
                            <CheckCircle className="w-3 h-3 text-green-600" />
                            <span className="text-green-700 font-medium text-xs">Complet acoperit</span>
                          </div>
                        )}
                        {cantitateRamasaDeProdus > 0 && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-red-100 rounded-full border border-red-200">
                            <AlertTriangle className="w-3 h-3 text-red-600" />
                            <span className="text-red-700 font-medium text-xs">
                              Lipsește: {cantitateRamasaDeProdus} {order.productie_produse?.unitate_masura}
                            </span>
                          </div>
                        )}
                        {cantitateAcoperitaTotal === 0 && !hasActiveSession && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-full border border-gray-200">
                            <Clock className="w-3 h-3 text-gray-600" />
                            <span className="text-gray-700 font-medium text-xs italic">Nu s-a început producția</span>
                          </div>
                        )}
                        {hasActiveSession && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-green-100 rounded-full border border-green-300">
                            <Play className="w-3 h-3 text-green-600 fill-green-600" />
                            <span className="text-green-700 font-medium text-xs">
                              🟢 Sesiune activă — {activeSession.nume_operator} — pornită la {new Date(activeSession.ora_start).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {/* Bara de progres stilizată */}
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div 
                          className={`h-2 rounded-full transition-all duration-500 ${
                            procentProgres >= 100 ? 'bg-gradient-to-r from-green-400 to-green-500' : 
                            procentProgres >= 50 ? 'bg-gradient-to-r from-blue-400 to-blue-500' : 'bg-gradient-to-r from-amber-400 to-amber-500'
                          }`}
                          style={{ width: `${Math.min(100, procentProgres)}%` }}
                        />
                      </div>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    {getStatusBadge(order.status)}
                  </TableCell>
                  
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium flex items-center gap-2 flex-wrap">
                        {order.magazin}
                        {order.productie_clienti?.nickname && (
                          <Badge variant="outline" className="text-xs bg-amber-50 border-amber-300 text-amber-800">
                            {order.productie_clienti.nickname}
                          </Badge>
                        )}
                        {((order as any).tip_comanda === 'REAMBALARE' || order.magazin === 'REAMBALARE') && (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-100">
                            🔁 Reambalare
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">{order.punct_livrare}</div>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    {order.productie_clienti?.productie_zone_livrare && (
                      <div className="space-y-2">
                        <div 
                          className="px-2 py-1 rounded text-white text-xs font-medium text-center"
                          style={{ backgroundColor: order.productie_clienti.productie_zone_livrare.culoare }}
                        >
                          {order.productie_clienti.productie_zone_livrare.nume_zona}
                        </div>
                        <div className="text-xs text-gray-600">
                          🚛 {order.productie_clienti.productie_zone_livrare.ora_limita_plecare || 'Nu specificat'}
                        </div>
                        <div className="text-xs text-blue-600 font-medium">
                          Prioritate: {order.productie_clienti.productie_zone_livrare.prioritate}
                        </div>
                      </div>
                    )}
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <Factory className="w-4 h-4 text-coral-primary" />
                      <span className="font-medium text-coral-primary">
                        {order.productie_linii?.nume || '-'}
                      </span>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <Button 
                      size="sm" 
                      className={order.status === 'completed' ? 
                        "bg-green-600 hover:bg-green-700 text-white text-xs" : 
                        "bg-coral-primary hover:bg-coral-600 text-white text-xs"
                      }
                    >
                      {order.status === 'completed' ? (
                        <>
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Vezi
                        </>
                      ) : (
                        <>
                          <Clock className="w-3 h-3 mr-1" />
                          Accesează
                        </>
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </div>

        {/* Componenta de paginație */}
        <OrdersPagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          showPageSizeSelector={true}
        />
      </CardContent>
    </Card>
  );
};

export default OrdersTable;
