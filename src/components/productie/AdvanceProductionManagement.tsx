import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, Factory, Package, Clock, Plus, TrendingUp, Edit, Trash2, ChefHat, Search, Zap, CheckCircle } from "lucide-react";
import { useOrders, useUpdateOrder, useDeleteOrder, useAutoDistributeToLine } from "@/hooks/productie/useProductionData";
import { useRestockings } from "@/hooks/productie/useInventoryDataProductie";
import { useOrdersPagination } from "@/hooks/productie/useOrdersPagination";
import { toast } from "sonner";
import AdvanceProductionForm from "./AdvanceProductionForm";
import OrderEditDialog from "./OrderEditDialog";
import OrderIngredientEditor from "./OrderIngredientEditor";
import OrdersPagination from "./OrdersPagination";
import SabloaneProductieAvans from "./SabloaneProductieAvans";

const AdvanceProductionManagement = () => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isIngredientDialogOpen, setIsIngredientDialogOpen] = useState(false);
  const [selectedOrderForEdit, setSelectedOrderForEdit] = useState<any>(null);
  const [selectedOrderForIngredients, setSelectedOrderForIngredients] = useState<any>(null);
  
  // Filtre și căutare
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [productionDate, setProductionDate] = useState<string>('');

  // All hooks must be called before any early returns
  const { data: orders, isLoading: ordersLoading, refetch: refetchOrders } = useOrders();
  const { data: restockings, isLoading: restockingsLoading } = useRestockings();
  const updateOrderMutation = useUpdateOrder();
  const deleteOrderMutation = useDeleteOrder();
  const autoDistributeMutation = useAutoDistributeToLine();

  // Ensure we have valid data before filtering
  const allOrders = orders || [];
  const allRestockings = restockings || [];

  // Filtrează comenzile de producție în avans
  const advanceOrders = allOrders.filter(order => {
    const isAdvance = order.magazin === 'PRODUCTIE_AVANS';
    return isAdvance;
  });

  // Aplicare filtre de căutare și status
  const filteredAdvanceOrders = advanceOrders.filter(order => {
    const matchesSearch = !searchTerm || 
      order.numar_comanda.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.productie_produse?.nume?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;

    const orderProdDate = (order as any).data_productie 
      ? String((order as any).data_productie).split('T')[0] 
      : null;
    const matchesProdDate = !productionDate || orderProdDate === productionDate;

    return matchesSearch && matchesStatus && matchesProdDate;
  });

  // Grupează pe status
  const pendingAdvanceOrders = filteredAdvanceOrders.filter(order => 
    ['pending', 'assigned'].includes(order.status)
  );
  
  const inProgressAdvanceOrders = filteredAdvanceOrders.filter(order => 
    ['in_progress', 'partial'].includes(order.status)
  );
  
  const completedAdvanceOrders = filteredAdvanceOrders.filter(order => 
    order.status === 'completed'
  );

  // Paginare pentru fiecare secțiune - toate hook-urile trebuie apelate înainte de orice return
  // Reduc dimensiunea paginii pentru a testa paginația
  const {
    currentPage: pendingPage,
    pageSize: pendingPageSize,
    totalPages: pendingTotalPages,
    totalItems: pendingTotalItems,
    paginatedOrders: paginatedPendingOrders,
    handlePageChange: handlePendingPageChange,
    handlePageSizeChange: handlePendingPageSizeChange,
    resetPagination: resetPendingPagination
  } = useOrdersPagination({ orders: pendingAdvanceOrders, initialPageSize: 5 });

  const {
    currentPage: inProgressPage,
    pageSize: inProgressPageSize,
    totalPages: inProgressTotalPages,
    totalItems: inProgressTotalItems,
    paginatedOrders: paginatedInProgressOrders,
    handlePageChange: handleInProgressPageChange,
    handlePageSizeChange: handleInProgressPageSizeChange,
    resetPagination: resetInProgressPagination
  } = useOrdersPagination({ orders: inProgressAdvanceOrders, initialPageSize: 5 });

  const {
    currentPage: completedPage,
    pageSize: completedPageSize,
    totalPages: completedTotalPages,
    totalItems: completedTotalItems,
    paginatedOrders: paginatedCompletedOrders,
    handlePageChange: handleCompletedPageChange,
    handlePageSizeChange: handleCompletedPageSizeChange,
    resetPagination: resetCompletedPagination
  } = useOrdersPagination({ orders: completedAdvanceOrders, initialPageSize: 5 });

  // Reset paginare când se schimbă filtrele
  useEffect(() => {
    resetPendingPagination();
    resetInProgressPagination();
    resetCompletedPagination();
  }, [searchTerm, statusFilter, resetPendingPagination, resetInProgressPagination, resetCompletedPagination]);

  // Restocările disponibile pentru redistribuire
  const availableRestockings = allRestockings.filter(restock => 
    restock.status === 'disponibil'
  );

  // Only after all hooks are called, we can do early returns
  const isLoading = ordersLoading || restockingsLoading;

  if (isLoading) {
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
    if (!window.confirm(`Sigur doriți să ștergeți comanda "${order.numar_comanda}" din producția în avans?`)) {
      return;
    }

    try {
      await deleteOrderMutation.mutateAsync(order.id);
      toast.success(`Comanda "${order.numar_comanda}" a fost ștearsă cu succes din producția în avans`);
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

  const handleBulkAutoDistribute = async (orders: any[]) => {
    const pendingOrders = orders.filter(order => order.status === 'pending');
    
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

  const canModifyOrder = (order: any) => {
    return order.status !== 'completed';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Producție în Avans</h2>
          <p className="text-muted-foreground">
            Gestionează producția preventivă pentru a avea stoc disponibil ({advanceOrders.length} comenzi totale)
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => handleBulkAutoDistribute(pendingAdvanceOrders)}
            disabled={autoDistributeMutation.isPending || pendingAdvanceOrders.length === 0}
            className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200"
          >
            {autoDistributeMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 mr-2" />
            )}
            Distribuire Automată Toate
          </Button>
          
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                Comandă Nouă în Avans
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>Creează Comandă de Producție în Avans</DialogTitle>
              </DialogHeader>
              <AdvanceProductionForm 
                onClose={() => setIsCreateDialogOpen(false)}
                onSuccess={handleCreateSuccess}
              />
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

      {/* Statistici */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">În Așteptare</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{pendingTotalItems}</div>
            <p className="text-xs text-muted-foreground">comenzi de alocat</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">În Producție</CardTitle>
            <Factory className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{inProgressTotalItems}</div>
            <p className="text-xs text-muted-foreground">în lucru acum</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Finalizate</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{completedTotalItems}</div>
            <p className="text-xs text-muted-foreground">terminate cu succes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stoc Disponibil</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{availableRestockings.length}</div>
            <p className="text-xs text-muted-foreground">produse pentru redistribuire</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtre și Căutare */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Caută după număr comandă sau produs..."
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
                <SelectItem value="partial">Parțial finalizate</SelectItem>
                <SelectItem value="completed">Finalizate</SelectItem>
              </SelectContent>
            </Select>
            <div className="w-full md:w-56">
              <Input
                type="date"
                value={productionDate}
                onChange={(e) => setProductionDate(e.target.value)}
                placeholder="Data producției"
                title="Data producției programate"
              />
            </div>
            {productionDate && (
              <button
                type="button"
                onClick={() => setProductionDate('')}
                className="text-xs text-muted-foreground hover:text-foreground underline self-center"
              >
                Resetează data
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="pending">
            <Clock className="h-4 w-4 mr-2" />
            În Așteptare ({pendingTotalItems})
          </TabsTrigger>
          <TabsTrigger value="in-progress">
            <Factory className="h-4 w-4 mr-2" />
            În Producție ({inProgressTotalItems})
          </TabsTrigger>
          <TabsTrigger value="completed">
            <CheckCircle className="h-4 w-4 mr-2" />
            Finalizate ({completedTotalItems})
          </TabsTrigger>
          <TabsTrigger value="available-stock">
            <Package className="h-4 w-4 mr-2" />
            Stoc Disponibil ({availableRestockings.length})
          </TabsTrigger>
          <TabsTrigger value="sabloane">
            <Zap className="h-4 w-4 mr-2" />
            Șabloane
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Comenzi în Așteptare de Alocare ({pendingTotalItems} total)</CardTitle>
                {pendingTotalItems > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkAutoDistribute(paginatedPendingOrders)}
                    disabled={autoDistributeMutation.isPending}
                    className="text-blue-600 hover:text-blue-700 hover:border-blue-300"
                  >
                    {autoDistributeMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4 mr-2" />
                    )}
                    Distribuire Automată Pagină
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {paginatedPendingOrders.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-2">
                    {pendingTotalItems === 0 ? 
                      "Nu există comenzi în așteptare. Creează o comandă nouă de producție în avans." :
                      "Nu s-au găsit comenzi cu filtrele aplicate."
                    }
                  </p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nr. Comandă</TableHead>
                        <TableHead>Produs</TableHead>
                        <TableHead>Cantitate</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Linie Alocată</TableHead>
                        <TableHead>Data Creării</TableHead>
                        <TableHead>Data Producție</TableHead>
                        <TableHead className="text-right">Acțiuni</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedPendingOrders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">
                            {order.numar_comanda}
                          </TableCell>
                          <TableCell>
                            {order.productie_produse?.nume || 'Produs necunoscut'}
                          </TableCell>
                          <TableCell>
                            {order.cantitate} {order.productie_produse?.unitate_masura}
                          </TableCell>
                          <TableCell>
                            <Badge variant={order.status === 'pending' ? 'secondary' : 'default'}>
                              {order.status === 'pending' ? 'În așteptare' : 
                               order.status === 'assigned' ? 'Alocată' : order.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {order.productie_linii?.nume || 'Nealocat'}
                          </TableCell>
                          <TableCell>
                            {new Date(order.created_at).toLocaleDateString('ro-RO')}
                          </TableCell>
                          <TableCell>
                            {(order as any).data_productie
                              ? new Date((order as any).data_productie).toLocaleDateString('ro-RO')
                              : <span className="text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAutoDistribute(order)}
                                disabled={autoDistributeMutation.isPending}
                                title="Distribuire automată pe linie"
                                className="text-blue-600 hover:text-blue-700 hover:border-blue-300"
                              >
                                {autoDistributeMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Zap className="h-4 w-4" />
                                )}
                              </Button>
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
                                {deleteOrderMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <OrdersPagination
                    currentPage={pendingPage}
                    totalPages={pendingTotalPages}
                    pageSize={pendingPageSize}
                    totalItems={pendingTotalItems}
                    onPageChange={handlePendingPageChange}
                    onPageSizeChange={handlePendingPageSizeChange}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="in-progress">
          <Card>
            <CardHeader>
              <CardTitle>Comenzi în Producție / Parțial Finalizate ({inProgressTotalItems} total)</CardTitle>
            </CardHeader>
            <CardContent>
              {paginatedInProgressOrders.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-2">
                    {inProgressTotalItems === 0 ? 
                      "Nu există comenzi în producție momentan." :
                      "Nu s-au găsit comenzi cu filtrele aplicate."
                    }
                  </p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nr. Comandă</TableHead>
                        <TableHead>Produs</TableHead>
                        <TableHead>Cantitate</TableHead>
                        <TableHead>Linie</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data Actualizării</TableHead>
                        <TableHead className="text-right">Acțiuni</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedInProgressOrders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">
                            {order.numar_comanda}
                          </TableCell>
                          <TableCell>
                            {order.productie_produse?.nume || 'Produs necunoscut'}
                          </TableCell>
                          <TableCell>
                            {order.cantitate_reala_produsa || 0} / {order.cantitate} {order.productie_produse?.unitate_masura}
                          </TableCell>
                          <TableCell>
                            {order.productie_linii?.nume || 'Necunoscut'}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={order.status === 'partial' ? 'destructive' : 'default'} 
                              className={order.status === 'partial' ? 'bg-yellow-600' : 'bg-blue-600'}
                            >
                              {order.status === 'in_progress' ? 'În progres' : 
                               order.status === 'partial' ? 'Parțial finalizată' : order.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(order.updated_at).toLocaleDateString('ro-RO')}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              {canModifyOrder(order) && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleAutoDistribute(order)}
                                    disabled={autoDistributeMutation.isPending}
                                    title="Distribuire automată pe linie"
                                    className="text-blue-600 hover:text-blue-700 hover:border-blue-300"
                                  >
                                    {autoDistributeMutation.isPending ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Zap className="h-4 w-4" />
                                    )}
                                  </Button>
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
                                </>
                              )}
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteOrder(order)}
                                disabled={deleteOrderMutation.isPending}
                                title="Șterge comanda"
                              >
                                {deleteOrderMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <OrdersPagination
                    currentPage={inProgressPage}
                    totalPages={inProgressTotalPages}
                    pageSize={inProgressPageSize}
                    totalItems={inProgressTotalItems}
                    onPageChange={handleInProgressPageChange}
                    onPageSizeChange={handleInProgressPageSizeChange}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed">
          <Card>
            <CardHeader>
              <CardTitle>Comenzi Finalizate ({completedTotalItems} total)</CardTitle>
            </CardHeader>
            <CardContent>
              {paginatedCompletedOrders.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-2">
                    {completedTotalItems === 0 ? 
                      "Nu există comenzi finalizate momentan." :
                      "Nu s-au găsit comenzi cu filtrele aplicate."
                    }
                  </p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nr. Comandă</TableHead>
                        <TableHead>Produs</TableHead>
                        <TableHead>Cantitate Produsă</TableHead>
                        <TableHead>Linie</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data Finalizării</TableHead>
                        <TableHead className="text-right">Acțiuni</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedCompletedOrders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">
                            {order.numar_comanda}
                          </TableCell>
                          <TableCell>
                            {order.productie_produse?.nume || 'Produs necunoscut'}
                          </TableCell>
                          <TableCell>
                            <span className="text-green-600 font-medium">
                              {order.cantitate_reala_produsa || order.cantitate} {order.productie_produse?.unitate_masura}
                            </span>
                          </TableCell>
                          <TableCell>
                            {order.productie_linii?.nume || 'Necunoscut'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="default" className="bg-green-600 text-white">
                              Finalizată
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(order.updated_at).toLocaleDateString('ro-RO')}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditIngredients(order)}
                                title="Vizualizează ingredientele"
                                className="text-purple-600 hover:text-purple-700 hover:border-purple-300"
                              >
                                <ChefHat className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteOrder(order)}
                                disabled={deleteOrderMutation.isPending}
                                title="Șterge comanda"
                              >
                                {deleteOrderMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <OrdersPagination
                    currentPage={completedPage}
                    totalPages={completedTotalPages}
                    pageSize={completedPageSize}
                    totalItems={completedTotalItems}
                    onPageChange={handleCompletedPageChange}
                    onPageSizeChange={handleCompletedPageSizeChange}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="available-stock">
          <Card>
            <CardHeader>
              <CardTitle>Stoc Disponibil pentru Redistribuire</CardTitle>
            </CardHeader>
            <CardContent>
              {availableRestockings.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nu există stoc disponibil pentru redistribuire.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produs</TableHead>
                      <TableHead>Cantitate Disponibilă</TableHead>
                      <TableHead>Data Producției</TableHead>
                      <TableHead>Comandă Originală</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {availableRestockings.map((restock) => (
                      <TableRow key={restock.id}>
                        <TableCell className="font-medium">
                          {restock.productie_produse?.nume || 'Produs necunoscut'}
                        </TableCell>
                        <TableCell>
                          <span className="font-medium text-green-600">
                            {restock.cantitate_surplus} {restock.productie_produse?.unitate_masura}
                          </span>
                        </TableCell>
                        <TableCell>
                          {new Date(restock.data_productie).toLocaleDateString('ro-RO')}
                        </TableCell>
                        <TableCell>
                          {restock.productie_comenzi?.numar_comanda || 'Avans'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sabloane">
          <Card>
            <CardContent className="pt-6">
              <SabloaneProductieAvans onGenerated={refetchOrders} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdvanceProductionManagement;
