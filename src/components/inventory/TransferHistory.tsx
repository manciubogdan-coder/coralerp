import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import { toast } from "@/hooks/use-custom-toast";
import { Search, CornerDownLeft, CalendarIcon } from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Calendar } from "@/components/ui/calendar";
import { CrateType } from "@/types";

interface TransferHistoryProps {
  onTransferReturned?: () => void;
}

interface TransferItem {
  transfer_id: string;
  transfer_date: string;
  destination: string;
  product_name: string;
  supplier_name?: string;
  manufacturer_name?: string;
  document_number?: string;
  entry_number?: number;
  quantity: number;
  net_quantity?: number;
  unit: string;
  crate_count?: number;
  notes?: string;
  inventory_item_id: string;
  product_id?: string;
  supplier_id?: string;
  manufacturer_id?: string;
  created_at?: string;
  crate_type_id?: string;
  crate_weight?: number;
  lot_number?: string;
}

interface ReturnFormProps {
  transfer: TransferItem;
  onReturnComplete?: () => void;
}

const ReturnForm = ({ transfer, onReturnComplete }: ReturnFormProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [grossQuantity, setGrossQuantity] = useState<number>(transfer.quantity);
  const [crateCount, setCrateCount] = useState<number>(transfer.crate_count || 0);
  const [selectedCrateTypeId, setSelectedCrateTypeId] = useState<string>(transfer.crate_type_id || '');
  const [crateWeight, setCrateWeight] = useState<number>(transfer.crate_weight || 0);
  const [palletCount, setPalletCount] = useState<number>(0);
  const [palletWeight, setPalletWeight] = useState<number>(0);
  const [notes, setNotes] = useState<string>("");
  const [crateTypes, setCrateTypes] = useState<CrateType[]>([]);
  
  useEffect(() => {
    const fetchCrateTypes = async () => {
      const { data, error } = await supabase
        .from('crate_types')
        .select('*')
        .order('name');
        
      if (error) {
        console.error("Error fetching crate types:", error);
        toast({
          variant: "destructive",
          title: "Eroare",
          description: "Nu s-au putut încărca tipurile de lădițe"
        });
        return;
      }
      
      setCrateTypes(data || []);
    };
    
    fetchCrateTypes();
  }, []);
  
  useEffect(() => {
    if (selectedCrateTypeId) {
      const selectedType = crateTypes.find(type => type.id === selectedCrateTypeId);
      if (selectedType) {
        setCrateWeight(selectedType.weight);
      }
    }
  }, [selectedCrateTypeId, crateTypes]);
  
  const calculateNetQuantity = () => {
    const totalCrateWeight = crateWeight * crateCount;
    const totalPalletWeight = palletWeight;
    return Math.max(0, grossQuantity - totalCrateWeight - totalPalletWeight);
  };
  
  const netQuantity = calculateNetQuantity();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (grossQuantity <= 0) {
      toast({
        variant: "destructive",
        title: "Eroare",
        description: "Cantitatea brută trebuie să fie mai mare de 0"
      });
      return;
    }

    try {
      setIsSubmitting(true);
      
      console.log("Return form submitted with data:", {
        transferId: transfer.transfer_id,
        inventoryItemId: transfer.inventory_item_id,
        grossQuantity,
        netQuantity,
        crateCount,
        palletCount,
        palletWeight,
        notes
      });
      
      const { data: originalItem, error: fetchError } = await supabase
        .from('inventory')
        .select('*')
        .eq('id', transfer.inventory_item_id)
        .single();
      
      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      let updatedId;
      
      if (originalItem) {
        const newQuantity = originalItem.quantity + netQuantity;
        
        const { error: updateError } = await supabase
          .from('inventory')
          .update({ 
            quantity: newQuantity,
            crate_count: originalItem.crate_count + crateCount
          })
          .eq('id', transfer.inventory_item_id);
          
        if (updateError) throw updateError;
        updatedId = transfer.inventory_item_id;
        
        console.log("Updated existing inventory item:", {
          id: transfer.inventory_item_id,
          newQuantity,
          newCrateCount: originalItem.crate_count + crateCount
        });
      } else {
        const { data: similarItems, error: similarError } = await supabase
          .from('inventory')
          .select('*')
          .eq('product_id', transfer.product_id || '')
          .eq('supplier_id', transfer.supplier_id || '')
          .eq('manufacturer_id', transfer.manufacturer_id || '');
          
        if (similarError) throw similarError;
        
        if (similarItems && similarItems.length > 0) {
          const similarItem = similarItems[0];
          const newQuantity = similarItem.quantity + netQuantity;
          const newCrateCount = (similarItem.crate_count || 0) + crateCount;
          
          const { error: updateError } = await supabase
            .from('inventory')
            .update({ 
              quantity: newQuantity,
              crate_count: newCrateCount
            })
            .eq('id', similarItem.id);
            
          if (updateError) throw updateError;
          updatedId = similarItem.id;
          
          console.log("Updated similar inventory item:", {
            id: similarItem.id,
            newQuantity,
            newCrateCount
          });
        } else {
          const { data: inventoryData, error: insertError } = await supabase
            .from('inventory')
            .insert({
              name: transfer.product_name,
              product_id: transfer.product_id || null,
              supplier_id: transfer.supplier_id || null,
              supplier: transfer.supplier_name || null,
              manufacturer_id: transfer.manufacturer_id || null,
              document_number: transfer.document_number || null,
              entry_number: transfer.entry_number || null,
              quantity: netQuantity,
              unit: transfer.unit,
              crate_count: crateCount,
              crate_type_id: selectedCrateTypeId || null,
              crate_weight: crateWeight || null,
              gross_quantity: grossQuantity,
              net_quantity: netQuantity
            })
            .select()
            .single();
            
          if (insertError) throw insertError;
          updatedId = inventoryData.id;
          
          console.log("Created new inventory item:", inventoryData);
        }
      }
      
      const { error: historyError } = await supabase
        .from('inventory_history')
        .insert({
          inventory_item_id: updatedId,
          action: 'add',
          name: transfer.product_name,
          quantity: grossQuantity,
          net_quantity: netQuantity,
          unit: transfer.unit,
          operation_date: new Date().toISOString(),
          document_number: transfer.document_number,
          crate_count: crateCount,
          crate_type_id: selectedCrateTypeId || null,
          crate_weight: crateWeight || null,
          notes: `Returnat din ${transfer.destination}. ${notes}`
        });
        
      if (historyError) throw historyError;
      
      toast({
        title: "Succes",
        description: `Cantitate de ${netQuantity} ${transfer.unit} returnată în stoc.`
      });
      
      setIsOpen(false);
      if (onReturnComplete) onReturnComplete();
      
    } catch (error: any) {
      console.error("Error returning stock:", error);
      toast({
        variant: "destructive",
        title: "Eroare la returnare",
        description: error.message
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Returnează în stoc">
          <CornerDownLeft className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Returnare în stoc</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="font-medium">Produs</div>
            <div>{transfer.product_name}</div>
          </div>
          
          <div className="space-y-2">
            <label htmlFor="grossQuantity" className="font-medium">
              Cantitate brută returnată ({transfer.unit})
            </label>
            <Input
              id="grossQuantity"
              type="number"
              min="0.01"
              step="0.01"
              value={grossQuantity}
              onChange={(e) => setGrossQuantity(parseFloat(e.target.value) || 0)}
              required
            />
          </div>
          
          <div className="space-y-2">
            <label htmlFor="crateCount" className="font-medium">
              Număr lădițe returnate
            </label>
            <Input
              id="crateCount"
              type="number"
              min="0"
              value={crateCount}
              onChange={(e) => setCrateCount(parseInt(e.target.value) || 0)}
            />
          </div>
          
          {crateCount > 0 && (
            <div className="space-y-2">
              <label htmlFor="crateType" className="font-medium">
                Tip lădiță
              </label>
              <Select value={selectedCrateTypeId} onValueChange={setSelectedCrateTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Alege tipul de lădiță" />
                </SelectTrigger>
                <SelectContent>
                  {crateTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name} ({type.weight} kg)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {selectedCrateTypeId && (
                <div className="text-sm text-muted-foreground">
                  Greutate totală lădițe: {(crateWeight * crateCount).toFixed(2)} kg
                </div>
              )}
            </div>
          )}
          
          <div className="space-y-2">
            <label htmlFor="palletCount" className="font-medium">
              Număr paleți returnați
            </label>
            <Input
              id="palletCount"
              type="number"
              min="0"
              value={palletCount}
              onChange={(e) => setPalletCount(parseInt(e.target.value) || 0)}
            />
          </div>
          
          <div className="space-y-2">
            <label htmlFor="palletWeight" className="font-medium">
              Greutate totală paleți (kg)
            </label>
            <Input
              id="palletWeight"
              type="number"
              min="0"
              step="0.01"
              value={palletWeight}
              onChange={(e) => setPalletWeight(parseFloat(e.target.value) || 0)}
            />
          </div>
          
          <div className="space-y-2">
            <div className="font-medium">Cantitate netă calculată</div>
            <div className="px-4 py-2 bg-gray-100 rounded border">
              {netQuantity.toFixed(2)} {transfer.unit}
            </div>
          </div>
          
          <div className="space-y-2">
            <label htmlFor="notes" className="font-medium">
              Note (opțional)
            </label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalii despre returnare"
            />
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Anulează
            </Button>
            <Button type="submit" disabled={isSubmitting || grossQuantity <= 0}>
              {isSubmitting ? "Se procesează..." : "Returnează în stoc"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export function TransferHistory({ onTransferReturned }: TransferHistoryProps) {
  const [transfers, setTransfers] = useState<TransferItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [destinations, setDestinations] = useState<string[]>([]);
  const [selectedDestination, setSelectedDestination] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [dateRange, setDateRange] = useState<[Date | undefined, Date | undefined]>([undefined, undefined]);
  const [page, setPage] = useState(1);
  const [itemsPerPage] = useState(10);
  
  const fetchTransfers = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('stock_transfer_view')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      
      console.log("Fetched transfers:", data);
      setTransfers(data || []);
      
      // Fix the type error by type casting the unique destinations
      const uniqueDestinations = Array.from(
        new Set((data || []).map((transfer: any) => transfer.destination))
      ).filter((destination): destination is string => typeof destination === 'string');
      
      setDestinations(uniqueDestinations);
      
    } catch (error: any) {
      console.error("Error fetching transfers:", error);
      toast({
        variant: "destructive",
        title: "Eroare la încărcarea transferurilor",
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchTransfers();
  }, []);
  
  const handleTransferReturned = () => {
    fetchTransfers();
    if (onTransferReturned) {
      onTransferReturned();
    }
  };
  
  const filteredTransfers = transfers.filter((transfer) => {
    if (selectedDestination !== "all" && transfer.destination !== selectedDestination) {
      return false;
    }
    
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        (transfer.product_name && transfer.product_name.toLowerCase().includes(searchLower)) ||
        (transfer.supplier_name && transfer.supplier_name.toLowerCase().includes(searchLower)) ||
        (transfer.document_number && transfer.document_number.toLowerCase().includes(searchLower)) ||
        (transfer.notes && transfer.notes.toLowerCase().includes(searchLower))
      );
    }
    
    return true;
  });
  
  const totalPages = Math.max(1, Math.ceil(filteredTransfers.length / itemsPerPage));
  
  const indexOfLastItem = page * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredTransfers.slice(indexOfFirstItem, indexOfLastItem);
  
  const formatQuantity = (quantity: number) => {
    return quantity.toFixed(2);
  };
  
  const formatDateRange = () => {
    if (dateRange[0] && dateRange[1]) {
      return `${format(dateRange[0], 'dd.MM.yyyy')} - ${format(dateRange[1], 'dd.MM.yyyy')}`;
    } else if (dateRange[0]) {
      return `De la ${format(dateRange[0], 'dd.MM.yyyy')}`;
    } else if (dateRange[1]) {
      return `Până la ${format(dateRange[1], 'dd.MM.yyyy')}`;
    }
    return 'Selectați perioada';
  };

  return (
    <div>
      <div className="p-2 md:p-4 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Caută produs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full"
            />
          </div>
          
          <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
            <Select value={selectedDestination} onValueChange={setSelectedDestination}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Filtrează după destinație" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toate destinațiile</SelectItem>
                {destinations.map((destination) => (
                  <SelectItem key={destination} value={destination}>
                    {destination}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Tip operațiune" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toate operațiunile</SelectItem>
                <SelectItem value="add">Adăugare</SelectItem>
                <SelectItem value="remove">Eliminare</SelectItem>
                <SelectItem value="set">Setare</SelectItem>
              </SelectContent>
            </Select>
            
            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full md:w-[200px] justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formatDateRange()}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={{ from: dateRange[0], to: dateRange[1] }}
                  onSelect={(range) => {
                    setDateRange([range?.from, range?.to]);
                    if (range?.to) {
                      setTimeout(() => setIsCalendarOpen(false), 100);
                    }
                  }}
                  locale={ro}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        
        <div className="overflow-hidden rounded-lg border">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-50 sticky top-0">
                <TableRow>
                  <TableHead>Data și ora</TableHead>
                  <TableHead>Destinație</TableHead>
                  <TableHead>Nr. Document</TableHead>
                  <TableHead>Produs</TableHead>
                  <TableHead>Nr. Lot</TableHead>
                  <TableHead>Furnizor</TableHead>
                  <TableHead>Producător</TableHead>
                  <TableHead className="text-right">Cant. Brută</TableHead>
                  <TableHead className="text-right">Cant. Netă</TableHead>
                  <TableHead>UM</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="sticky right-0 bg-gray-50">Acțiuni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-6 text-gray-500">
                      Se încarcă datele...
                    </TableCell>
                  </TableRow>
                ) : currentItems.length > 0 ? (
                  currentItems.map((transfer) => (
                    <TableRow key={`${transfer.transfer_id}-${transfer.inventory_item_id}`}>
                      <TableCell>
                        {transfer.created_at 
                          ? format(new Date(transfer.created_at), 'dd.MM.yyyy HH:mm:ss')
                          : transfer.transfer_date 
                            ? format(new Date(transfer.transfer_date), 'dd.MM.yyyy')
                            : '-'}
                      </TableCell>
                      <TableCell>{transfer.destination}</TableCell>
                      <TableCell>{transfer.document_number || "-"}</TableCell>
                      <TableCell className="font-medium">{transfer.product_name}</TableCell>
                      <TableCell>{transfer.lot_number || "-"}</TableCell>
                      <TableCell>{transfer.supplier_name || "-"}</TableCell>
                      <TableCell>{transfer.manufacturer_name || "-"}</TableCell>
                      <TableCell className="text-right">{formatQuantity(transfer.quantity)}</TableCell>
                      <TableCell className="text-right">{formatQuantity(transfer.net_quantity || transfer.quantity)}</TableCell>
                      <TableCell>{transfer.unit}</TableCell>
                      <TableCell>{transfer.notes || "-"}</TableCell>
                      <TableCell className="sticky right-0 bg-white">
                        <ReturnForm 
                          transfer={transfer}
                          onReturnComplete={handleTransferReturned}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-6 text-gray-500">
                      {searchTerm || (selectedDestination && selectedDestination !== "all")
                        ? "Nu s-au găsit transferuri conform criteriilor de căutare"
                        : "Nu există transferuri înregistrate"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
        
        <Pagination className="my-4">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className={page <= 1 ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
            
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }
              
              return (
                <PaginationItem key={i}>
                  <PaginationLink 
                    isActive={pageNum === page}
                    onClick={() => setPage(pageNum)}
                  >
                    {pageNum}
                  </PaginationLink>
                </PaginationItem>
              );
            })}
            
            <PaginationItem>
              <PaginationNext 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}
