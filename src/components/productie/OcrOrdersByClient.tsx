 import { useState } from "react";
 import { format } from "date-fns";
 import { ro } from "date-fns/locale";
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
 import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
 import { Badge } from "@/components/ui/badge";
 import { Calendar } from "@/components/ui/calendar";
 import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
 import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
 import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
 import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
 import { useToast } from "@/hooks/use-toast";
 import { supabase } from "@/integrations/supabase/client";
 import { useClients, useProducts } from "@/hooks/productie/useProductionData";
 import { Loader2, Calendar as CalendarIcon, Users, Printer, Download, Edit2, Trash2, Save, X, ChevronRight, Plus } from "lucide-react";
 import * as XLSX from 'xlsx';
 import { cn } from "@/lib/utils";
 import { useQuery, useQueryClient } from "@tanstack/react-query";
 
 interface OcrOrder {
   id: string;
   client_id: string | null;
   client_nume: string | null;
   produs_id: string | null;
   produs_nume: string;
   cantitate: number;
   data_comanda: string;
   fisier_sursa: string | null;
   created_at: string;
   client?: { id: string; nume_magazin: string; punct_livrare: string } | null;
   produs?: { id: string; nume: string } | null;
 }
 
 export default function OcrOrdersByClient() {
   const [filterDate, setFilterDate] = useState<Date>(new Date());
   const [filterClientId, setFilterClientId] = useState<string>("all");
  const [editingOrder, setEditingOrder] = useState<OcrOrder | null>(null);
  const [editQuantity, setEditQuantity] = useState<number>(0);
  const [editProductId, setEditProductId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [openClients, setOpenClients] = useState<Set<string>>(new Set());
  const [deletingClientId, setDeletingClientId] = useState<string | null>(null);
  const [addingForClient, setAddingForClient] = useState<{ client_id: string | null; client_name: string } | null>(null);
  const [addProductId, setAddProductId] = useState<string>("");
  const [addQuantity, setAddQuantity] = useState<number>(1);
  const [isAdding, setIsAdding] = useState(false);
   
   const { toast } = useToast();
   const queryClient = useQueryClient();
   const { data: clients } = useClients();
   const { data: products } = useProducts();
 
   // Fetch orders by client
   const { data: orders, isLoading } = useQuery({
     queryKey: ['ocr-orders-by-client', format(filterDate, 'yyyy-MM-dd'), filterClientId],
     queryFn: async () => {
       let query = supabase
         .from('productie_ocr_comenzi')
         .select(`
           *,
           client:productie_clienti(id, nume_magazin, punct_livrare),
           produs:productie_produse(id, nume)
         `)
         .eq('data_comanda', format(filterDate, 'yyyy-MM-dd'))
         .order('client_nume')
         .order('produs_nume');
       
       if (filterClientId !== 'all') {
         query = query.eq('client_id', filterClientId);
       }
       
       const { data, error } = await query;
       if (error) throw error;
       return data as OcrOrder[];
     },
   });
 
   // Group orders by client
   const ordersByClient = orders?.reduce((acc, order) => {
     const clientKey = order.client_id || 'unknown';
     const clientName = order.client?.nume_magazin || order.client_nume || 'Client necunoscut';
     
     if (!acc[clientKey]) {
       acc[clientKey] = {
         client_id: order.client_id,
         client_name: clientName,
         punct_livrare: order.client?.punct_livrare || '',
         orders: [],
       };
     }
     acc[clientKey].orders.push(order);
     return acc;
   }, {} as Record<string, { client_id: string | null; client_name: string; punct_livrare: string; orders: OcrOrder[] }>) || {};
 
   const clientGroups = Object.values(ordersByClient).sort((a, b) => 
     a.client_name.localeCompare(b.client_name)
   );
 
   // Toggle client expansion
   const toggleClient = (clientId: string) => {
     setOpenClients(prev => {
       const newSet = new Set(prev);
       if (newSet.has(clientId)) {
         newSet.delete(clientId);
       } else {
         newSet.add(clientId);
       }
       return newSet;
     });
   };
 
   // Edit order
   const handleEdit = (order: OcrOrder) => {
     setEditingOrder(order);
     setEditQuantity(order.cantitate);
     setEditProductId(order.produs_id || '');
   };
 
   const handleSaveEdit = async () => {
     if (!editingOrder) return;
     
     setIsSaving(true);
     try {
       const selectedProduct = products?.find(p => p.id === editProductId);
       
       const { error } = await supabase
         .from('productie_ocr_comenzi')
         .update({
           cantitate: editQuantity,
           produs_id: editProductId || null,
           produs_nume: selectedProduct?.nume || editingOrder.produs_nume,
         })
         .eq('id', editingOrder.id);
 
       if (error) throw error;
 
       toast({ title: "Comandă actualizată cu succes" });
       queryClient.invalidateQueries({ queryKey: ['ocr-orders-by-client'] });
       queryClient.invalidateQueries({ queryKey: ['ocr-daily-orders'] });
        // Invalidate all queries related to OCR orders for materials calculation
        queryClient.invalidateQueries({ queryKey: ['ocr-orders-for-materials'] });
       setEditingOrder(null);
     } catch (error) {
       console.error('Error updating order:', error);
       toast({ 
         title: "Eroare la actualizare", 
         description: error instanceof Error ? error.message : 'Eroare necunoscută',
         variant: "destructive" 
       });
     } finally {
       setIsSaving(false);
     }
   };
 
   // Delete order
   const handleDelete = async (orderId: string) => {
     try {
       const { error } = await supabase
         .from('productie_ocr_comenzi')
         .delete()
         .eq('id', orderId);
 
       if (error) throw error;
 
       toast({ title: "Comandă ștearsă cu succes" });
       queryClient.invalidateQueries({ queryKey: ['ocr-orders-by-client'] });
       queryClient.invalidateQueries({ queryKey: ['ocr-daily-orders'] });
        // Invalidate all queries related to OCR orders for materials calculation
        queryClient.invalidateQueries({ queryKey: ['ocr-orders-for-materials'] });
     } catch (error) {
       console.error('Error deleting order:', error);
       toast({ 
         title: "Eroare la ștergere", 
         description: error instanceof Error ? error.message : 'Eroare necunoscută',
         variant: "destructive" 
       });
     }
   };
 
  // Delete all orders for a client
  const handleDeleteClientOrders = async (clientId: string, orders: OcrOrder[]) => {
    setDeletingClientId(clientId);
    try {
      const orderIds = orders.map(o => o.id);
      const { error } = await supabase
        .from('productie_ocr_comenzi')
        .delete()
        .in('id', orderIds);

      if (error) throw error;

      toast({ title: `${orders.length} comenzi șterse cu succes` });
      queryClient.invalidateQueries({ queryKey: ['ocr-orders-by-client'] });
      queryClient.invalidateQueries({ queryKey: ['ocr-daily-orders'] });
      queryClient.invalidateQueries({ queryKey: ['ocr-orders-for-materials'] });
    } catch (error) {
      console.error('Error deleting client orders:', error);
      toast({ 
        title: "Eroare la ștergere", 
        description: error instanceof Error ? error.message : 'Eroare necunoscută',
        variant: "destructive" 
      });
    } finally {
      setDeletingClientId(null);
    }
  };

  // Add product to client order
  const handleAddProduct = async () => {
    if (!addingForClient || !addProductId) return;
    
    setIsAdding(true);
    try {
      const selectedProduct = products?.find(p => p.id === addProductId);
      if (!selectedProduct) throw new Error('Produsul nu a fost găsit');

      const clientData = clients?.find(c => c.id === addingForClient.client_id);

      const { error } = await supabase
        .from('productie_ocr_comenzi')
        .insert({
          client_id: addingForClient.client_id,
          client_nume: clientData?.nume_magazin || addingForClient.client_name,
          produs_id: addProductId,
          produs_nume: selectedProduct.nume,
          cantitate: addQuantity,
          data_comanda: format(filterDate, 'yyyy-MM-dd'),
          fisier_sursa: 'manual',
        });

      if (error) throw error;

      toast({ title: `${selectedProduct.nume} adăugat cu succes` });
      queryClient.invalidateQueries({ queryKey: ['ocr-orders-by-client'] });
      queryClient.invalidateQueries({ queryKey: ['ocr-daily-orders'] });
      queryClient.invalidateQueries({ queryKey: ['ocr-orders-for-materials'] });
      setAddingForClient(null);
      setAddProductId("");
      setAddQuantity(1);
    } catch (error) {
      console.error('Error adding product:', error);
      toast({ 
        title: "Eroare la adăugare", 
        description: error instanceof Error ? error.message : 'Eroare necunoscută',
        variant: "destructive" 
      });
    } finally {
      setIsAdding(false);
    }
  };

  // Export Excel
   const exportExcel = () => {
     if (!orders || orders.length === 0) return;
     
     const exportData = orders.map(order => ({
       'Client': order.client?.nume_magazin || order.client_nume || 'Necunoscut',
       'Punct Livrare': order.client?.punct_livrare || '',
       'Produs': order.produs?.nume || order.produs_nume,
       'Cantitate': order.cantitate,
       'Sursă Fișier': order.fisier_sursa || '',
     }));
 
     const ws = XLSX.utils.json_to_sheet(exportData);
     const wb = XLSX.utils.book_new();
     XLSX.utils.book_append_sheet(wb, ws, 'Comenzi pe Client');
     XLSX.writeFile(wb, `comenzi-clienti-${format(filterDate, 'yyyy-MM-dd')}.xlsx`);
   };
 
   // Print
   const handlePrint = () => {
     const printWindow = window.open('', '_blank');
     if (!printWindow) return;
     
     const html = `
       <!DOCTYPE html>
       <html>
       <head>
         <title>Comenzi pe Client - ${format(filterDate, 'dd.MM.yyyy')}</title>
         <style>
           body { font-family: Arial, sans-serif; padding: 20px; }
           h1 { font-size: 18px; margin-bottom: 20px; }
           h2 { font-size: 14px; margin-top: 20px; margin-bottom: 10px; background: #f5f5f5; padding: 8px; }
           table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
           th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
           th { background-color: #f5f5f5; font-weight: bold; }
           .text-right { text-align: right; }
           .subtotal { font-weight: bold; background: #f9f9f9; }
         </style>
       </head>
       <body>
         <h1>Comenzi pe Client - ${format(filterDate, 'dd.MM.yyyy')}</h1>
         ${clientGroups.map(group => `
           <h2>${group.client_name}${group.punct_livrare ? ` - ${group.punct_livrare}` : ''}</h2>
           <table>
             <thead>
               <tr>
                 <th>Produs</th>
                 <th class="text-right">Cantitate</th>
               </tr>
             </thead>
             <tbody>
               ${group.orders.map(order => `
                 <tr>
                   <td>${order.produs?.nume || order.produs_nume}</td>
                   <td class="text-right">${order.cantitate}</td>
                 </tr>
               `).join('')}
               <tr class="subtotal">
                 <td>Total ${group.client_name}</td>
                 <td class="text-right">${group.orders.reduce((sum, o) => sum + o.cantitate, 0)}</td>
               </tr>
             </tbody>
           </table>
         `).join('')}
         <script>window.print(); window.close();</script>
       </body>
       </html>
     `;
     printWindow.document.write(html);
     printWindow.document.close();
   };
 
   return (
     <Card>
       <CardHeader>
         <div className="flex justify-between items-center">
           <div>
             <CardTitle className="flex items-center gap-2">
               <Users className="h-6 w-6" />
               Comenzi pe Client
             </CardTitle>
             <CardDescription>
               Vizualizează, editează și șterge comenzile grupate pe clienți.
             </CardDescription>
           </div>
           <div className="flex items-center gap-2">
             <Button
               variant="outline"
               size="sm"
               onClick={handlePrint}
               disabled={!orders || orders.length === 0}
             >
               <Printer className="h-4 w-4 mr-2" />
               Print
             </Button>
             <Button
               variant="outline"
               size="sm"
               onClick={exportExcel}
               disabled={!orders || orders.length === 0}
             >
               <Download className="h-4 w-4 mr-2" />
               Export Excel
             </Button>
             <Select value={filterClientId} onValueChange={setFilterClientId}>
               <SelectTrigger className="w-[200px]">
                 <SelectValue placeholder="Toți clienții" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="all">Toți clienții</SelectItem>
                 {clients?.map(client => (
                   <SelectItem key={client.id} value={client.id}>
                     {client.nume_magazin}
                   </SelectItem>
                 ))}
               </SelectContent>
             </Select>
             <Popover>
               <PopoverTrigger asChild>
                 <Button
                   variant="outline"
                   className={cn("w-[240px] justify-start text-left font-normal")}
                 >
                   <CalendarIcon className="mr-2 h-4 w-4" />
                   {format(filterDate, "PPP", { locale: ro })}
                 </Button>
               </PopoverTrigger>
               <PopoverContent className="w-auto p-0" align="end">
                 <Calendar
                   mode="single"
                   selected={filterDate}
                   onSelect={(date) => date && setFilterDate(date)}
                   initialFocus
                   className="pointer-events-auto"
                 />
               </PopoverContent>
             </Popover>
           </div>
         </div>
       </CardHeader>
       <CardContent>
         {isLoading ? (
           <div className="flex justify-center py-8">
             <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
           </div>
         ) : clientGroups.length === 0 ? (
           <div className="text-center py-8 text-muted-foreground">
             <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
             <p>Nu există comenzi pentru {format(filterDate, 'dd.MM.yyyy')}</p>
           </div>
         ) : (
           <div className="space-y-6">
             {clientGroups.map((group) => (
               <Collapsible 
                 key={group.client_id || 'unknown'} 
                 open={openClients.has(group.client_id || 'unknown')}
                 onOpenChange={() => toggleClient(group.client_id || 'unknown')}
               >
                 <CollapsibleTrigger asChild>
                   <div className="border rounded-lg px-4 py-3 flex justify-between items-center cursor-pointer hover:bg-muted/50 transition-colors">
                     <div className="flex items-center gap-3">
                       <ChevronRight className={cn(
                         "h-5 w-5 transition-transform",
                         openClients.has(group.client_id || 'unknown') && "rotate-90"
                       )} />
                       <div>
                         <h3 className="font-semibold">{group.client_name}</h3>
                         {group.punct_livrare && (
                           <p className="text-sm text-muted-foreground">{group.punct_livrare}</p>
                         )}
                       </div>
                     </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-primary">
                          {group.orders.length} produse | Total: {group.orders.reduce((sum, o) => sum + o.cantitate, 0)}
                        </Badge>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAddingForClient({ client_id: group.client_id, client_name: group.client_name });
                          }}
                        >
                          <Plus className="h-4 w-4 text-primary" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => e.stopPropagation()}
                              disabled={deletingClientId === (group.client_id || 'unknown')}
                            >
                              {deletingClientId === (group.client_id || 'unknown') ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4 text-destructive" />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Șterge toate comenzile</AlertDialogTitle>
                              <AlertDialogDescription>
                                Ești sigur că vrei să ștergi toate cele {group.orders.length} comenzi pentru <strong>{group.client_name}</strong>? Acțiunea nu poate fi anulată.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Anulează</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleDeleteClientOrders(group.client_id || 'unknown', group.orders)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Șterge tot
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                   </div>
                 </CollapsibleTrigger>
                 <CollapsibleContent>
                   <div className="border border-t-0 rounded-b-lg overflow-hidden">
                     <Table>
                       <TableHeader>
                         <TableRow>
                           <TableHead>Produs</TableHead>
                           <TableHead className="text-right w-32">Cantitate</TableHead>
                           <TableHead className="text-right w-32">Acțiuni</TableHead>
                         </TableRow>
                       </TableHeader>
                       <TableBody>
                         {group.orders.map((order) => (
                           <TableRow key={order.id}>
                             <TableCell className="font-medium">
                               {order.produs?.nume || order.produs_nume}
                             </TableCell>
                             <TableCell className="text-right">
                               <Badge variant="outline">{order.cantitate}</Badge>
                             </TableCell>
                             <TableCell className="text-right">
                               <div className="flex justify-end gap-1">
                                 <Button
                                   variant="ghost"
                                   size="icon"
                                   onClick={(e) => {
                                     e.stopPropagation();
                                     handleEdit(order);
                                   }}
                                 >
                                   <Edit2 className="h-4 w-4" />
                                 </Button>
                                 <AlertDialog>
                                   <AlertDialogTrigger asChild>
                                     <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                                       <Trash2 className="h-4 w-4 text-destructive" />
                                     </Button>
                                   </AlertDialogTrigger>
                                   <AlertDialogContent>
                                     <AlertDialogHeader>
                                       <AlertDialogTitle>Șterge comandă</AlertDialogTitle>
                                       <AlertDialogDescription>
                                         Ești sigur că vrei să ștergi această comandă? Acțiunea nu poate fi anulată.
                                       </AlertDialogDescription>
                                     </AlertDialogHeader>
                                     <AlertDialogFooter>
                                       <AlertDialogCancel>Anulează</AlertDialogCancel>
                                       <AlertDialogAction onClick={() => handleDelete(order.id)}>
                                         Șterge
                                       </AlertDialogAction>
                                     </AlertDialogFooter>
                                   </AlertDialogContent>
                                 </AlertDialog>
                               </div>
                             </TableCell>
                           </TableRow>
                         ))}
                       </TableBody>
                     </Table>
                   </div>
                 </CollapsibleContent>
               </Collapsible>
             ))}
             
             <div className="mt-4 pt-4 border-t text-sm text-muted-foreground">
               Total: <strong>{clientGroups.length}</strong> clienți, 
               <strong className="ml-1">{orders?.length || 0}</strong> comenzi
             </div>
           </div>
         )}
       </CardContent>
 
       {/* Edit Dialog */}
       <Dialog open={!!editingOrder} onOpenChange={(open) => !open && setEditingOrder(null)}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle>Editează Comandă</DialogTitle>
             <DialogDescription>
               Modifică detaliile comenzii pentru {editingOrder?.client?.nume_magazin || editingOrder?.client_nume}
             </DialogDescription>
           </DialogHeader>
           <div className="space-y-4 py-4">
             <div className="space-y-2">
               <label className="text-sm font-medium">Produs</label>
               <Select value={editProductId} onValueChange={setEditProductId}>
                 <SelectTrigger>
                   <SelectValue placeholder="Selectează produs" />
                 </SelectTrigger>
                 <SelectContent>
                   {products?.map(p => (
                     <SelectItem key={p.id} value={p.id}>
                       {p.nume}
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>
             <div className="space-y-2">
               <label className="text-sm font-medium">Cantitate</label>
               <Input
                 type="number"
                 min="1"
                 value={editQuantity}
                 onChange={(e) => setEditQuantity(parseInt(e.target.value) || 1)}
               />
             </div>
           </div>
           <DialogFooter>
             <Button variant="outline" onClick={() => setEditingOrder(null)}>
               <X className="h-4 w-4 mr-2" />
               Anulează
             </Button>
             <Button onClick={handleSaveEdit} disabled={isSaving}>
               {isSaving ? (
                 <Loader2 className="h-4 w-4 mr-2 animate-spin" />
               ) : (
                 <Save className="h-4 w-4 mr-2" />
               )}
               Salvează
             </Button>
           </DialogFooter>
         </DialogContent>
        </Dialog>

        {/* Add Product Dialog */}
        <Dialog open={!!addingForClient} onOpenChange={(open) => { if (!open) { setAddingForClient(null); setAddProductId(""); setAddQuantity(1); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adaugă Produs</DialogTitle>
              <DialogDescription>
                Adaugă un produs nou la comanda pentru {addingForClient?.client_name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Produs</label>
                <Select value={addProductId} onValueChange={setAddProductId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selectează produs" />
                  </SelectTrigger>
                  <SelectContent>
                    {products?.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nume}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Cantitate</label>
                <Input
                  type="number"
                  min="1"
                  value={addQuantity}
                  onChange={(e) => setAddQuantity(parseInt(e.target.value) || 1)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setAddingForClient(null); setAddProductId(""); setAddQuantity(1); }}>
                <X className="h-4 w-4 mr-2" />
                Anulează
              </Button>
              <Button onClick={handleAddProduct} disabled={isAdding || !addProductId}>
                {isAdding ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Adaugă
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Card>
   );
 }