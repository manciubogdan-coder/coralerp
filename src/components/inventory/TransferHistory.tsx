import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import { toast } from "@/hooks/use-custom-toast";
import { Search, CalendarIcon, FileDown } from "lucide-react";
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
import { exportToExcel } from "@/lib/excelExport";
import { TransferReturnForm } from "./TransferReturnForm";

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
      
      const uniqueDestinations = Array.from(
        new Set((data || []).map((transfer) => transfer.destination))
      );
      
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
  
  const handleExportExcel = () => {
    let transfersToExport = filteredTransfers;
    
    // Apply date range filter for export
    if (dateRange[0] || dateRange[1]) {
      transfersToExport = transfersToExport.filter((transfer) => {
        const transferDate = transfer.created_at 
          ? new Date(transfer.created_at) 
          : new Date(transfer.transfer_date);
        
        if (dateRange[0] && transferDate < dateRange[0]) return false;
        if (dateRange[1]) {
          const endDate = new Date(dateRange[1]);
          endDate.setDate(endDate.getDate() + 1); // Include the end date
          if (transferDate >= endDate) return false;
        }
        return true;
      });
    }
    
    const dataForExport = transfersToExport.map(transfer => ({
      "Data și ora": transfer.created_at 
        ? format(new Date(transfer.created_at), 'dd.MM.yyyy HH:mm:ss')
        : transfer.transfer_date 
          ? format(new Date(transfer.transfer_date), 'dd.MM.yyyy')
          : '-',
      "Destinație": transfer.destination,
      "Nr. Document": transfer.document_number || "-",
      "Produs": transfer.product_name,
      "Nr. Lot": transfer.lot_number || "-",
      "Furnizor": transfer.supplier_name || "-",
      "Producător": transfer.manufacturer_name || "-",
      "Cantitate Brută": formatQuantity(transfer.quantity),
      "Cantitate Netă": formatQuantity(transfer.net_quantity || transfer.quantity),
      "Unitate Măsură": transfer.unit,
      "Note": transfer.notes || "-"
    }));
    
    const filename = `istoric_transferuri_${dateRange[0] ? format(dateRange[0], 'dd-MM-yyyy') : 'toate'}_${dateRange[1] ? format(dateRange[1], 'dd-MM-yyyy') : 'prezent'}.xlsx`;
    
    exportToExcel(dataForExport, filename);
    
    toast({
      title: "Export realizat cu succes",
      description: `Fișierul ${filename} a fost generat și descărcat.`
    });
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
            
            <Button
              variant="outline"
              onClick={handleExportExcel}
              disabled={loading || filteredTransfers.length === 0}
              className="w-full md:w-auto"
            >
              <FileDown className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
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
                    <TableCell colSpan={12} className="text-center py-6 text-gray-500">
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
                        <TransferReturnForm 
                          transfer={transfer}
                          onReturnComplete={handleTransferReturned}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-6 text-gray-500">
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
