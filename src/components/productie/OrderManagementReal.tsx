import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Search, Zap, Edit, Trash2, ChefHat, Archive, ChevronDown, ChevronRight } from "lucide-react";
import { useOrders, useUpdateOrder, useDeleteOrder, useAutoDistributeToLine } from "@/hooks/productie/useProductionData";
import { toast } from "sonner";
import OrderFormNew from "./OrderFormNew";
import { ErrorBoundary } from "./ErrorBoundary";
import OrderEditDialog from "./OrderEditDialog";
import OrderIngredientEditor from "./OrderIngredientEditor";
import { useOrdersPagination } from "@/hooks/productie/useOrdersPagination";
import OrdersPagination from "./OrdersPagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SabloaneComenziClient from "./SabloaneComenziClient";

const OrderManagementReal = () => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isIngredientDialogOpen, setIsIngredientDialogOpen] = useState(false);
  const [selectedOrderForEdit, setSelectedOrderForEdit] = useState<any>(null);
  const [selectedOrderForIngredients, setSelectedOrderForIngredients] = useState<any>(null);
  
  // Filtre și căutare
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [storeFilter, setStoreFilter] = useState<string>('all');
  const [minQuantity, setMinQuantity] = useState<string>('');
  const [productFilter, setProductFilter] = useState<string>('all');
  const [lineFilter, setLineFilter] = useState<string>('all');
  const todayLocal = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const [selectedDate, setSelectedDate] = useState<string>(todayLocal);
  const [productionDate, setProductionDate] = useState<string>(todayLocal);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const { data: orders, isLoading: ordersLoading, refetch: refetchOrders } = useOrders();
  const updateOrderMutation = useUpdateOrder();
  const deleteOrderMutation = useDeleteOrder();
  const autoDistributeMutation = useAutoDistributeToLine();

  // Filtrare comenzi - EXCLUDE comenzile de producție în avans
  const filteredOrders = orders ? orders.filter(order => {
    // EXCLUDE comenzile de producție în avans
    if (order.magazin === 'PRODUCTIE_AVANS') {
      return false;
    }

    const matchesSearch = !searchTerm || 
      order.numar_comanda.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.productie_produse?.nume?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    const matchesStore = storeFilter === 'all' || order.magazin === storeFilter;
    const matchesProduct = productFilter === 'all' || order.productie_produse?.nume?.toLowerCase().includes(productFilter.toLowerCase());
    const matchesLine = lineFilter === 'all' || (lineFilter === 'unassigned' ? !order.productie_linii?.nume : order.productie_linii?.nume?.toLowerCase().includes(lineFilter.toLowerCase()));
    const matchesQuantity = !minQuantity || order.cantitate >= parseInt(minQuantity);
    
    const matchesDate = !selectedDate ||
      new Date(order.created_at).toISOString().split('T')[0] === selectedDate;

    const orderProdDate = (order as any).data_productie
      ? String((order as any).data_productie).split('T')[0]
      : null;
    const matchesProdDate = !productionDate || orderProdDate === productionDate;

    return matchesSearch && matchesStatus && matchesStore && matchesProduct && 
           matchesLine && matchesQuantity && matchesDate && matchesProdDate;
  }) : [];

  // Grupare comenzi după numar_comanda + magazin (un document Senior = un grup)
  const groupedOrders = (() => {
    const map = new Map<string, any[]>();
    filteredOrders.forEach((o: any) => {
      const key = `${o.numar_comanda}||${o.magazin}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(o);
    });
    const arr = Array.from(map.entries()).map(([key, ord]) => ({
      key,
      numar_comanda: ord[0].numar_comanda,
      magazin: ord[0].magazin,
      punct_livrare: ord[0].punct_livrare,
      productie_clienti: ord[0].productie_clienti,
      created_at: ord[0].created_at,
      data_productie: (ord[0] as any).data_productie,
      orders: ord,
    }));
    arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return arr;
  })();

  // Paginăm pe grupuri (nu pe linii) - fiecare document rămâne intact pe o pagină
  const {
    currentPage,
    pageSize,
    totalPages,
    paginatedOrders: paginatedGroups,
    handlePageChange,
    handlePageSizeChange,
    resetPagination
  } = useOrdersPagination({ orders: groupedOrders as any, initialPageSize: 25 });

  // Reset pagination when filtered orders change
  useEffect(() => {
    resetPagination();
  }, [filteredOrders.length, resetPagination]);


  // Obține lista unică de magazine din comenzi (exclude PRODUCTIE_AVANS)
  const uniqueStores = orders ? 
    Array.from(new Set(orders.filter(order => order.magazin !== 'PRODUCTIE_AVANS').map(order => order.magazin)))
      .sort()
      .map(store => ({ value: store, label: store }))
    : [];

  // Obține lista unică de produse
  const uniqueProducts = orders ? 
    Array.from(new Set(orders.map(order => order.productie_produse?.nume).filter(Boolean)))
      .sort()
      .map(product => ({ value: product, label: product }))
    : [];

  // Obține lista unică de linii
  const uniqueLines = orders ? 
    Array.from(new Set(orders.map(order => order.productie_linii?.nume).filter(Boolean)))
      .sort()
      .map(line => ({ value: line, label: line }))
    : [];

  if (ordersLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const handleCreateSuccess = () => {
    setIsCreateDialogOpen(false);
    refetchOrders();
  };

  const handleEditOrder = (order: any) => {
    setSelectedOrderForEdit(order);
    setIsEditDialogOpen(true);
  };

  const handleEditSuccess = () => {
    setIsEditDialogOpen(false);
    setSelectedOrderForEdit(null);
    refetchOrders();
  };

  const handleEditIngredients = (order: any) => {
    setSelectedOrderForIngredients(order);
    setIsIngredientDialogOpen(true);
  };

  const handleIngredientsSuccess = () => {
    setIsIngredientDialogOpen(false);
    setSelectedOrderForIngredients(null);
  };

  const handleDeleteOrder = async (order: any) => {
    if (!window.confirm(`Sigur doriți să ștergeți comanda "${order.numar_comanda}"?`)) {
      return;
    }

    try {
      await deleteOrderMutation.mutateAsync(order.id);
      toast.success(`Comanda "${order.numar_comanda}" a fost ștearsă cu succes`);
      refetchOrders();
    } catch (error: any) {
      toast.error(`Nu s-a putut șterge comanda: ${error.message || 'Eroare necunoscută'}`);
    }
  };

  const handleAutoDistribute = async (order: any) => {
    try {
      await autoDistributeMutation.mutateAsync(order.id);
      toast.success(`Comanda "${order.numar_comanda}" a fost distribuită automat pe linie`);
      refetchOrders();
    } catch (error: any) {
      toast.error(`Nu s-a putut distribui automat: ${error.message || 'Eroare necunoscută'}`);
    }
  };

  const handleBulkAutoDistribute = async () => {
    const pendingOrders = filteredOrders.filter(order => order.status === 'pending');
    
    if (pendingOrders.length === 0) {
      toast.info("Nu există comenzi în așteptare pentru distribuire automată");
      return;
    }

    try {
      for (const order of pendingOrders) {
        await autoDistributeMutation.mutateAsync(order.id);
      }
      toast.success(`${pendingOrders.length} comenzi au fost distribuite automat pe linii`);
      refetchOrders();
    } catch (error: any) {
      toast.error(`Eroare la distribuirea automată: ${error.message || 'Eroare necunoscută'}`);
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setStoreFilter('all');
    setMinQuantity('');
    setProductFilter('all');
    setLineFilter('all');
    setSelectedDate('');
    setProductionDate('');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="bg-orange-100 text-orange-800">Pending</Badge>;
      case 'assigned':
        return <Badge variant="default" className="bg-blue-100 text-blue-800">Alocată</Badge>;
      case 'in_progress':
        return <Badge variant="default" className="bg-blue-600 text-white">În progres</Badge>;
      case 'partial':
        return <Badge variant="destructive" className="bg-yellow-600 text-white">Parțial</Badge>;
      case 'completed':
        return <Badge variant="default" className="bg-green-600 text-white">Finalizată</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="comenzi" className="space-y-4">
        <TabsList>
          <TabsTrigger value="comenzi">Comenzi</TabsTrigger>
          <TabsTrigger value="sabloane">Șabloane Client</TabsTrigger>
        </TabsList>
        <TabsContent value="sabloane">
          <SabloaneComenziClient onGenerated={refetchOrders} />
        </TabsContent>
        <TabsContent value="comenzi" className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Management Comenzi</h2>
          <p className="text-muted-foreground">
            Gestionează comenzile de producție - {filteredOrders.length} comenzi disponibile (exclusiv producția în avans)
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleBulkAutoDistribute}
            disabled={autoDistributeMutation.isPending}
            className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200"
          >
            {autoDistributeMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 mr-2" />
            )}
            Distribuire Automată
          </Button>
          
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-green-600 hover:bg-green-700">
                <Plus className="h-4 w-4 mr-2" />
                Comandă Nouă
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl w-[calc(100vw-1rem)] max-h-[95vh] overflow-y-auto p-4 sm:p-6">
              <DialogHeader>
                <DialogTitle>Creează Comandă Nouă</DialogTitle>
              </DialogHeader>
              <ErrorBoundary>
                <OrderFormNew 
                  onClose={() => setIsCreateDialogOpen(false)}
                  onSuccess={handleCreateSuccess}
                />
              </ErrorBoundary>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Dialog pentru editare comandă */}
      {isEditDialogOpen && selectedOrderForEdit && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <OrderEditDialog
            order={selectedOrderForEdit}
            onClose={() => setIsEditDialogOpen(false)}
            onSuccess={handleEditSuccess}
          />
        </Dialog>
      )}

      {/* Dialog pentru editare ingrediente */}
      {isIngredientDialogOpen && selectedOrderForIngredients && (
        <Dialog open={isIngredientDialogOpen} onOpenChange={setIsIngredientDialogOpen}>
          <DialogContent className="max-w-5xl">
            <OrderIngredientEditor
              comandaId={selectedOrderForIngredients.id}
              produsNume={selectedOrderForIngredients.productie_produse?.nume || 'Produs necunoscut'}
              onClose={handleIngredientsSuccess}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Secțiune de căutare și filtrare */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Căutare și Filtrare Comenzi
            </CardTitle>
            <Button variant="outline" onClick={resetFilters} size="sm">
              Resetează filtrele
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Nr. comandă / produs</label>
              <Input
                placeholder="ex: 103304"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Produs</label>
              <Select value={productFilter} onValueChange={setProductFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Toate produsele" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toate produsele</SelectItem>
                  {uniqueProducts.map((product) => (
                    <SelectItem key={product.value} value={product.value}>
                      {product.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Cantitate minimă</label>
              <Input
                type="number"
                placeholder="ex: 100"
                value={minQuantity}
                onChange={(e) => setMinQuantity(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Magazin</label>
              <Select value={storeFilter} onValueChange={setStoreFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Caută după magazin..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toate magazinele</SelectItem>
                  {uniqueStores.map((store) => (
                    <SelectItem key={store.value} value={store.value}>
                      {store.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Linie</label>
              <Select value={lineFilter} onValueChange={setLineFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Toate liniile" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toate liniile</SelectItem>
                  <SelectItem value="unassigned">Neatribuite</SelectItem>
                  {uniqueLines.map((line) => (
                    <SelectItem key={line.value} value={line.value}>
                      {line.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Data creării</label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Data producției programate</label>
              <Input
                type="date"
                value={productionDate}
                onChange={(e) => setProductionDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista comenzilor cu paginația */}
      <Card>
        <CardHeader>
          <CardTitle>Lista Comenzilor ({groupedOrders.length} documente · {filteredOrders.length} articole)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Nu s-au găsit comenzi cu filtrele aplicate.</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="w-8"></TableHead>
                    <TableHead className="font-semibold">Număr</TableHead>
                    <TableHead className="font-semibold">Produs</TableHead>
                    <TableHead className="font-semibold">Progres Producție</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Magazin</TableHead>
                    <TableHead className="font-semibold">Zona Livrare</TableHead>
                    <TableHead className="font-semibold">Linie</TableHead>
                    <TableHead className="font-semibold">Data Creării</TableHead>
                    <TableHead className="font-semibold">Data Producție</TableHead>
                    <TableHead className="font-semibold">Acțiuni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedGroups.map((group: any) => {
                    const isExpanded = expandedGroups.has(group.key);
                    const totalCantitate = group.orders.reduce((s: number, o: any) => s + (o.cantitate || 0), 0);
                    const totalProdus = group.orders.reduce((s: number, o: any) => s + ((o.cantitate_reala_produsa || 0) + (o.cantitate_din_restock || 0)), 0);
                    const progressGrup = totalCantitate > 0 ? Math.round(totalProdus / totalCantitate * 100) : 0;
                    const statusuri = new Set(group.orders.map((o: any) => o.status));
                    const statusGrup = statusuri.size === 1 ? (Array.from(statusuri)[0] as string)
                      : statusuri.has('pending') ? 'pending'
                      : statusuri.has('in_progress') ? 'in_progress'
                      : 'partial';

                    const groupHeader = (
                      <TableRow
                        key={`grp-${group.key}`}
                        className="bg-blue-50 hover:bg-blue-100 cursor-pointer border-t-2 border-blue-200"
                        onClick={() => toggleGroup(group.key)}
                      >
                        <TableCell>
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </TableCell>
                        <TableCell className="font-bold text-blue-900">{group.numar_comanda}</TableCell>
                        <TableCell className="text-sm text-gray-700">
                          <span className="font-medium">{group.orders.length} articole</span>
                          <span className="text-gray-500"> · {totalCantitate} buc</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${progressGrup >= 100 ? 'bg-green-500' : progressGrup >= 50 ? 'bg-blue-500' : 'bg-amber-500'}`}
                                style={{ width: `${Math.min(100, progressGrup)}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium">{progressGrup}%</span>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(statusGrup)}</TableCell>
                        <TableCell>
                          <div className="font-medium flex items-center gap-2 flex-wrap">
                            {group.magazin}
                            {group.productie_clienti?.nickname && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-amber-50 border border-amber-300 text-amber-800 font-semibold">
                                {group.productie_clienti.nickname}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">{group.punct_livrare}</div>
                        </TableCell>
                        <TableCell>
                          {group.productie_clienti?.productie_zone_livrare && (
                            <div
                              className="px-2 py-1 rounded text-white text-xs font-medium text-center"
                              style={{ backgroundColor: group.productie_clienti.productie_zone_livrare.culoare }}
                            >
                              {group.productie_clienti.productie_zone_livrare.nume_zona}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {(() => {
                            const linii = Array.from(new Set(group.orders.map((o: any) => o.productie_linii?.nume).filter(Boolean)));
                            return linii.length > 0
                              ? <span className="text-gray-700">{linii.join(', ')}</span>
                              : <span className="text-gray-500">—</span>;
                          })()}
                        </TableCell>
                        <TableCell className="text-xs">
                          {new Date(group.created_at).toLocaleDateString('ro-RO')}
                        </TableCell>
                        <TableCell className="text-xs">
                          {group.data_productie ? new Date(group.data_productie).toLocaleDateString('ro-RO') : '-'}
                        </TableCell>
                        <TableCell className="text-xs text-gray-500 italic">
                          {isExpanded ? 'ascunde' : 'deschide'}
                        </TableCell>
                      </TableRow>
                    );

                    if (!isExpanded) return groupHeader;

                    const detailRows = group.orders.map((order: any) => {
                    const cantitateComandată = order.cantitate;
                    const cantitateRealaProadusa = order.cantitate_reala_produsa || 0;
                    const cantitatedinRestock = order.cantitate_din_restock || 0;
                    const cantitateAcoperitaTotal = cantitateRealaProadusa + cantitatedinRestock;
                    const cantitateRamasaDeProdus = Math.max(0, cantitateComandată - cantitateAcoperitaTotal);
                    const procentProgres = cantitateComandată > 0 ? Math.round(cantitateAcoperitaTotal / cantitateComandată * 100) : 0;
                    const surplusRestocari = Math.max(0, cantitateRealaProadusa - cantitateComandată);

                    return (
                      <TableRow key={order.id} className="hover:bg-gray-50">
                        <TableCell></TableCell>
                        <TableCell className="font-medium text-xs text-gray-500">
                          #{order.id?.toString().slice(0, 6)}
                        </TableCell>
                        
                        
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{order.productie_produse?.nume}</div>
                            <div className="text-sm text-gray-500">
                              {cantitateComandată} {order.productie_produse?.unitate_masura}
                            </div>
                            {cantitateRamasaDeProdus > 0 && (
                              <div className="text-xs text-red-600">
                                ⚠️ Mai trebuie: {cantitateRamasaDeProdus} {order.productie_produse?.unitate_masura}
                              </div>
                            )}
                            {cantitateRamasaDeProdus === 0 && order.status !== 'completed' && (
                              <div className="text-xs text-red-600">
                                Nu s-a început producția
                              </div>
                            )}
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="space-y-2">
                            {/* Progres total */}
                            <div className="flex items-center gap-2">
                              <span className={`text-lg font-bold ${procentProgres >= 100 ? 'text-green-600' : procentProgres >= 50 ? 'text-blue-600' : 'text-amber-600'}`}>
                                {cantitateAcoperitaTotal}
                              </span>
                              <span className="text-gray-400">/</span>
                              <span className="text-lg font-semibold text-gray-800">
                                {cantitateComandată}
                              </span>
                              <span className="text-sm text-gray-500">
                                {order.productie_produse?.unitate_masura}
                              </span>
                            </div>
                            
                            {/* Detalii separate - Restocări și Producție */}
                            <div className="space-y-1">
                              {cantitatedinRestock > 0 && (
                                <div className="flex items-center gap-2 text-xs">
                                  <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                                  <span className="text-orange-700 font-medium">
                                    {cantitatedinRestock} din restocări
                                  </span>
                                </div>
                              )}
                              {cantitateRealaProadusa > 0 && (
                                <div className="flex items-center gap-2 text-xs">
                                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                                  <span className="text-blue-700 font-medium">
                                    {cantitateRealaProadusa > cantitateComandată ? cantitateComandată : cantitateRealaProadusa} din producție
                                  </span>
                                </div>
                              )}
                              {surplusRestocari > 0 && (
                                <div className="flex items-center gap-2 text-xs">
                                  <Archive className="w-3 h-3 text-purple-600" />
                                  <span className="text-purple-700 font-medium">
                                    {surplusRestocari} în restocări
                                  </span>
                                </div>
                              )}
                              {cantitateAcoperitaTotal === 0 && (
                                <div className="text-xs text-gray-500 italic">
                                  Fără progres înregistrat
                                </div>
                              )}
                            </div>
                            
                            {/* Bara de progres */}
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full transition-all duration-300 ${
                                  procentProgres >= 100 ? 'bg-green-500' : 
                                  procentProgres >= 50 ? 'bg-blue-500' : 'bg-amber-500'
                                }`}
                                style={{ width: `${Math.min(100, procentProgres)}%` }}
                              />
                            </div>
                            <div className={`text-sm font-medium ${procentProgres >= 100 ? 'text-green-600' : procentProgres >= 50 ? 'text-blue-600' : 'text-amber-600'}`}>
                              {procentProgres}%
                            </div>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          {getStatusBadge(order.status)}
                        </TableCell>
                        
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{order.magazin}</div>
                            <div className="text-sm text-gray-500">{order.punct_livrare}</div>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          {order.productie_clienti?.productie_zone_livrare && (
                            <div className="space-y-1">
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
                          <div className="text-sm font-medium">
                            {order.productie_linii?.nume || '-'}
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          {new Date(order.created_at).toLocaleDateString('ro-RO')}
                        </TableCell>
                        <TableCell>
                          {(order as any).data_productie
                            ? new Date((order as any).data_productie).toLocaleDateString('ro-RO')
                            : <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        
                        <TableCell>
                          <div className="flex gap-1">
                            {order.status === 'pending' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAutoDistribute(order)}
                                disabled={autoDistributeMutation.isPending}
                                title="Distribuire automată pe linie"
                                className="text-blue-600 hover:text-blue-700 hover:border-blue-300"
                              >
                                <Zap className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditIngredients(order)}
                              title="Editează ingredientele"
                              className="text-purple-600 hover:text-purple-700 hover:border-purple-300"
                            >
                              <ChefHat className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditOrder(order)}
                              title="Editează comanda"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteOrder(order)}
                              disabled={deleteOrderMutation.isPending}
                              title="Șterge comanda"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                    });

                    return (
                      <React.Fragment key={group.key}>
                        {groupHeader}
                        {detailRows}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Componenta de paginație */}
              <OrdersPagination
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={groupedOrders.length}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
                showPageSizeSelector={true}
              />
            </>
          )}
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OrderManagementReal;
