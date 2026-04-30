import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProducts, useProductionLines, useOrders, useWorkSessions } from "@/hooks/useProductionData";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { Loader2, Package, Factory, ShoppingCart, Users, AlertTriangle, TrendingUp } from "lucide-react";
import CapacityMonitor from "./CapacityMonitor";
import { useOrdersPagination } from "@/hooks/useOrdersPagination";
import OrdersPagination from "./OrdersPagination";

const ProductionDashboardReal = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Auto-refresh pentru dashboard la fiecare 20 secunde
  useAutoRefresh({ 
    interval: 20000, 
    enabled: true,
    queryKeys: [
      ['orders'],
      ['production-orders'],
      ['work-sessions'],
      ['products'],
      ['lines']
    ]
  });

  // Listen for quantity corrections - SIMPLIFIED
  useEffect(() => {
    const handleQuantityCorrection = () => {
      console.log('🎯 === QUANTITY CORRECTION IN DASHBOARD ===');
      setRefreshKey(prev => prev + 1);
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'quantity-correction-trigger') {
        console.log('🔔 === STORAGE EVENT IN DASHBOARD ===');
        setRefreshKey(prev => prev + 1);
      }
    };

    window.addEventListener('quantity-corrected', handleQuantityCorrection);
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('quantity-corrected', handleQuantityCorrection);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const { data: products, isLoading: productsLoading } = useProducts();
  const { data: lines, isLoading: linesLoading } = useProductionLines();
  const { data: orders, isLoading: ordersLoading } = useOrders();
  const { data: workSessions, isLoading: sessionsLoading } = useWorkSessions();

  // Log pentru debugging
  console.log('🔍 === DASHBOARD ORDERS ===', {
    total: orders?.length || 0,
    refreshKey,
    sample: orders?.slice(0, 1)?.map(o => ({
      id: o.id,
      numar: o.numar_comanda,
      cantitate_reala: o.cantitate_reala_produsa,
      cantitate_din_restock: o.cantitate_din_restock
    }))
  });

  if (productsLoading || linesLoading || ordersLoading || sessionsLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Calculez statisticile corecte
  const totalLines = lines?.length || 0;
  const activeLines = lines?.filter(line => line.status === 'activa')?.length || 0;
  
  const totalProducts = products?.length || 0;
  
  const totalOrders = orders?.length || 0;
  const completedOrders = orders?.filter(order => order.status === 'completed')?.length || 0;
  const progressPercentage = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;
  
  const activeSessions = workSessions?.filter(session => session.status === 'activa')?.length || 0;

  const getOrderProgress = (orderId: string) => {
    const orderSessions = workSessions?.filter(session => 
      session.comanda_id === orderId && session.status === 'finalizata'
    ) || [];
    
    return orderSessions.reduce((sum, session) => 
      sum + (session.cantitate_produsa || 0), 0
    );
  };

  return (
    <div className="space-y-6" key={`dashboard-${refreshKey}`}>
      <div>
        <h2 className="text-2xl font-bold">Dashboard Producție</h2>
        <p className="text-muted-foreground">
          Monitorizează starea producției în timp real
          <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
            🔄 Auto-refresh activ (20s)
          </span>
        </p>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Prezentare Generală</TabsTrigger>
          <TabsTrigger value="capacity">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Monitor Capacitate
          </TabsTrigger>
          <TabsTrigger value="lines">Harta Liniilor</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Statistici principale */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Comenzi</CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalOrders}</div>
                <p className="text-xs text-muted-foreground">
                  {orders?.filter(order => order.status === 'pending').length || 0} nepreluate
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Progres Producție</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{progressPercentage}%</div>
                <p className="text-xs text-muted-foreground">
                  {completedOrders}/{totalOrders} finalizate
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Linii Active</CardTitle>
                <Factory className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activeLines}/{totalLines}</div>
                <p className="text-xs text-muted-foreground">
                  {totalLines - activeLines} inactive
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Sesiuni Active</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activeSessions}</div>
                <p className="text-xs text-muted-foreground">
                  în derulare acum
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="capacity">
          <CapacityMonitor />
        </TabsContent>

        <TabsContent value="lines" className="space-y-6">
          <ProductionLinesMap lines={lines} orders={orders} workSessions={workSessions} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Componenta separată pentru Harta Liniilor cu paginare
const ProductionLinesMap = ({ lines, orders, workSessions }: any) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Harta Liniilor de Producție</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {lines?.map((line: any) => {
            const lineOrders = orders?.filter((order: any) => order.linie_id === line.id) || [];
            
            // Paginare pentru comenzile pe linie
            const {
              currentPage,
              pageSize,
              totalPages,
              totalItems,
              paginatedOrders,
              handlePageChange,
              handlePageSizeChange
            } = useOrdersPagination({ orders: lineOrders, initialPageSize: 5 });

            // Sortez comenzile după prioritatea zonei de livrare
            const sortedLineOrders = paginatedOrders.sort((a: any, b: any) => {
              const statusOrder = { 'pending': 0, 'assigned': 1, 'in_progress': 2, 'completed': 3 };
              const statusA = statusOrder[a.status as keyof typeof statusOrder] ?? 4;
              const statusB = statusOrder[b.status as keyof typeof statusOrder] ?? 4;
              
              if (statusA !== statusB) {
                return statusA - statusB;
              }
              
              const prioritateA = a.productie_clienti?.productie_zone_livrare?.prioritate || 999;
              const prioritateB = b.productie_clienti?.productie_zone_livrare?.prioritate || 999;
              
              if (prioritateA !== prioritateB) {
                return prioritateA - prioritateB;
              }
              
              const oraA = a.productie_clienti?.productie_zone_livrare?.ora_limita_plecare || '23:59:59';
              const oraB = b.productie_clienti?.productie_zone_livrare?.ora_limita_plecare || '23:59:59';
              
              if (oraA !== oraB) {
                return oraA.localeCompare(oraB);
              }
              
              return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            });

            const activeOrder = sortedLineOrders.find((order: any) => 
              workSessions?.some((session: any) => 
                session.comanda_id === order.id && 
                session.linie_id === line.id && 
                session.status === 'activa'
              )
            );

            const completedOrdersCount = lineOrders.filter((order: any) => order.status === 'completed').length;
            const lineProgressPercent = lineOrders.length > 0 ? 
              Math.round((completedOrdersCount / lineOrders.length) * 100) : 0;

            return (
              <Card key={line.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{line.nume}</CardTitle>
                    <Badge 
                      className={
                        line.status === 'activa' ? 'bg-green-500 text-white' :
                        line.status === 'inactiva' ? 'bg-red-500 text-white' :
                        'bg-yellow-500 text-white'
                      }
                    >
                      {line.status === 'activa' ? 'Activă' :
                       line.status === 'inactiva' ? 'Inactivă' :
                       'Mentenanță'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span>Capacitate:</span>
                      <span className="font-medium">{line.capacitate_ora} buc/oră</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total comenzi:</span>
                      <span className="font-medium">{totalItems}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Progres linie:</span>
                      <span className="font-medium">{lineProgressPercent}%</span>
                    </div>
                  </div>

                  {/* Lista comenzilor cu progres detaliat și paginare */}
                  {totalItems > 0 ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b pb-1">
                        <h4 className="text-sm font-semibold text-gray-700">Comenzi (ordinea de livrare):</h4>
                        {totalItems > pageSize && (
                          <span className="text-xs text-gray-500">
                            {currentPage * pageSize - pageSize + 1}-{Math.min(currentPage * pageSize, totalItems)} din {totalItems}
                          </span>
                        )}
                      </div>
                      
                      {sortedLineOrders.map((order: any) => {
                        const cantitateNecesara = order.cantitate;
                        const cantitateProadusa = order.cantitate_reala_produsa || 0;
                        const cantitatedinRestock = order.cantitate_din_restock || 0;
                        
                        const cantitateRamasaDeProdus = Math.max(0, cantitateNecesara - cantitateProadusa - cantitatedinRestock);
                        const cantitateSuprlus = Math.max(0, cantitateProadusa - (cantitateNecesara - cantitatedinRestock));
                        
                        const cantitateAcoperita = cantitateProadusa + cantitatedinRestock;
                        const procentProgres = cantitateNecesara > 0 ? Math.round((cantitateAcoperita / cantitateNecesara) * 100) : 0;
                        
                        const isActive = activeOrder?.id === order.id;

                        return (
                          <div 
                            key={order.id} 
                            className={`p-3 rounded-lg border ${
                              isActive ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
                            }`}
                          >
                            <div className="space-y-2">
                              {/* Header cu numele comenzii și status */}
                              <div className="flex justify-between items-center">
                                <div className="font-medium text-sm">
                                  {order.numar_comanda}
                                  {isActive && (
                                    <Badge variant="secondary" className="ml-2 text-xs">
                                      În lucru
                                    </Badge>
                                  )}
                                </div>
                                <Badge 
                                  variant={
                                    order.status === 'completed' ? 'default' : 
                                    order.status === 'in_progress' ? 'secondary' : 
                                    'outline'
                                  }
                                  className="text-xs"
                                >
                                  {order.status === 'completed' ? 'Finalizată' : 
                                   order.status === 'in_progress' ? 'În progres' : 
                                   order.status === 'assigned' ? 'Alocată' : 'Pending'}
                                </Badge>
                              </div>
                              
                              {order.productie_clienti?.productie_zone_livrare && (
                                <div className="text-xs space-y-1">
                                  <div 
                                    className="inline-block px-2 py-1 rounded text-white font-medium"
                                    style={{ backgroundColor: order.productie_clienti.productie_zone_livrare.culoare }}
                                  >
                                    {order.productie_clienti.productie_zone_livrare.nume_zona}
                                  </div>
                                  <div className="text-gray-600">
                                    🚛 Plecare: {order.productie_clienti.productie_zone_livrare.ora_limita_plecare || 'Nu specificat'} | 
                                    Prioritate: {order.productie_clienti.productie_zone_livrare.prioritate}
                                  </div>
                                </div>
                              )}
                              
                              <div className="text-xs text-gray-600">
                                {order.productie_produse?.nume} • {order.magazin}
                              </div>

                              <div className="space-y-2">
                                <div className="text-xs text-gray-600 space-y-1">
                                  <div className="flex justify-between">
                                    <span>🎯 Comandă:</span>
                                    <span className="font-semibold">{cantitateNecesara} {order.productie_produse?.unitate_masura}</span>
                                  </div>
                                  {cantitateProadusa > 0 && (
                                    <div className="flex justify-between">
                                      <span>🏭 Produs:</span>
                                      <span className="font-semibold text-green-600">{cantitateProadusa} {order.productie_produse?.unitate_masura}</span>
                                    </div>
                                  )}
                                  {cantitatedinRestock > 0 && (
                                    <div className="flex justify-between">
                                      <span>📦 Din restock:</span>
                                      <span className="font-semibold text-blue-600">{cantitatedinRestock} {order.productie_produse?.unitate_masura}</span>
                                    </div>
                                  )}
                                  {cantitateRamasaDeProdus > 0 && (
                                    <div className="flex justify-between">
                                      <span>⏳ Rămas de produs:</span>
                                      <span className="font-bold text-orange-600">{cantitateRamasaDeProdus} {order.productie_produse?.unitate_masura}</span>
                                    </div>
                                  )}
                                </div>

                                <div className="flex items-center justify-between text-sm">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-green-600">{cantitateAcoperita}</span>
                                    <span className="text-gray-500">/</span>
                                    <span className="font-semibold">{cantitateNecesara}</span>
                                    <span className="text-xs text-gray-500">{order.productie_produse?.unitate_masura}</span>
                                  </div>
                                  <div className={`font-bold text-sm ${
                                    procentProgres >= 100 ? 'text-green-600' : 
                                    procentProgres >= 50 ? 'text-blue-600' : 'text-amber-600'
                                  }`}>
                                    {procentProgres}%
                                  </div>
                                </div>

                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div 
                                    className={`h-2 rounded-full transition-all duration-300 ${
                                      procentProgres >= 100 ? 'bg-green-500' : 
                                      procentProgres >= 50 ? 'bg-blue-500' : 'bg-amber-500'
                                    }`}
                                    style={{ width: `${Math.min(100, procentProgres)}%` }}
                                  ></div>
                                </div>

                                <div className="flex gap-1 flex-wrap">
                                  {cantitateRamasaDeProdus > 0 && (
                                    <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                                      <AlertTriangle className="w-3 h-3 mr-1" />
                                      Rămas: {cantitateRamasaDeProdus}
                                    </Badge>
                                  )}
                                  {cantitateSuprlus > 0 && (
                                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                      <TrendingUp className="w-3 h-3 mr-1" />
                                      Surplus: +{cantitateSuprlus}
                                    </Badge>
                                  )}
                                  {cantitatedinRestock > 0 && (
                                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                      📦 Restock: {cantitatedinRestock}
                                    </Badge>
                                  )}
                                  {cantitateAcoperita === cantitateNecesara && cantitateAcoperita > 0 && (
                                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                      ✓ Complet
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Paginare simplă pentru fiecare linie */}
                      {totalPages > 1 && (
                        <div className="flex justify-center pt-2">
                          <div className="flex gap-1">
                            <button
                              onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                              disabled={currentPage === 1}
                              className="px-2 py-1 text-xs border rounded disabled:opacity-50"
                            >
                              ‹
                            </button>
                            <span className="px-2 py-1 text-xs">
                              {currentPage}/{totalPages}
                            </span>
                            <button
                              onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                              disabled={currentPage === totalPages}
                              className="px-2 py-1 text-xs border rounded disabled:opacity-50"
                            >
                              ›
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground text-center py-4 bg-gray-50 rounded-lg">
                      Nu există comenzi alocate
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default ProductionDashboardReal;
