import React, { useState, useEffect } from "react";
import { 
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Pagination, PaginationContent, PaginationItem, 
  PaginationLink, PaginationNext, PaginationPrevious 
} from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import { Search, Calendar as CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { InventoryHistoryItem } from "@/types";
import { supabase } from "@/integrations/supabase/client";

interface InventoryHistoryProps {
  productName?: string;
  initialDateRange?: [Date | undefined, Date | undefined];
}

const InventoryHistory = ({ productName, initialDateRange }: InventoryHistoryProps) => {
  const [history, setHistory] = useState<InventoryHistoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState(productName || "");
  const [dateRange, setDateRange] = useState<[Date | undefined, Date | undefined]>(
    initialDateRange || [undefined, undefined]
  );
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 10;
  
  useEffect(() => {
    fetchHistory();
  }, [searchTerm, dateRange, actionFilter, page]);

  const fetchHistory = async () => {
    try {
      let query = supabase
        .from('inventory_history')
        .select('*', { count: 'exact' })
        .order('operation_date', { ascending: false });
      
      if (searchTerm) {
        query = query.ilike('name', `%${searchTerm}%`);
      }
      
      if (dateRange[0]) {
        query = query.gte('operation_date', dateRange[0].toISOString());
      }
      
      if (dateRange[1]) {
        const endDate = new Date(dateRange[1]);
        endDate.setDate(endDate.getDate() + 1);
        query = query.lt('operation_date', endDate.toISOString());
      }
      
      if (actionFilter && actionFilter !== "all") {
        query = query.eq('action', actionFilter);
      }
      
      query = query.range((page - 1) * limit, page * limit - 1);
      
      const { data, error, count } = await query;
      
      if (error) throw error;

      if (count !== null) {
        setTotalPages(Math.ceil(count / limit));
      }
      
      const historyItems: InventoryHistoryItem[] = data.map(item => ({
        id: item.id,
        inventory_item_id: item.inventory_item_id,
        action: item.action as 'add' | 'remove' | 'set',
        name: item.name,
        quantity: Number(item.quantity),
        unit: item.unit,
        previous_quantity: item.previous_quantity ? Number(item.previous_quantity) : undefined,
        supplier: item.supplier || undefined,
        batch_number: item.batch_number || undefined,
        pallets: item.pallets || undefined,
        operation_date: new Date(item.operation_date),
        exit_timestamp: item.exit_timestamp ? new Date(item.exit_timestamp) : undefined,
        notes: item.notes || undefined
      }));
      
      setHistory(historyItems);
    } catch (error) {
      console.error("Error fetching inventory history:", error);
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'add': return 'bg-green-500';
      case 'remove': return 'bg-red-500';
      case 'set': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };
  
  const getActionTranslation = (action: string) => {
    switch (action) {
      case 'add': return 'Adăugare';
      case 'remove': return 'Eliminare';
      case 'set': return 'Setare';
      default: return action;
    }
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
      <div className="p-4 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Caută produs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-full md:w-[180px]">
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
                className="w-full md:w-auto justify-start text-left font-normal"
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
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
      
      <div className="overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dată operațiune</TableHead>
              <TableHead>Acțiune</TableHead>
              <TableHead>Produs</TableHead>
              <TableHead className="text-right">Cantitate</TableHead>
              <TableHead>Unitate</TableHead>
              <TableHead className="text-right">Cantitate anterioară</TableHead>
              <TableHead>Furnizor</TableHead>
              <TableHead>Lot</TableHead>
              <TableHead className="text-right">Paleți</TableHead>
              <TableHead>Ora ieșire</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.length > 0 ? (
              history.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="whitespace-nowrap">
                    {format(item.operation_date, 'dd.MM.yyyy HH:mm')}
                  </TableCell>
                  <TableCell>
                    <Badge className={getActionColor(item.action)}>
                      {getActionTranslation(item.action)}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell>{item.unit}</TableCell>
                  <TableCell className="text-right">
                    {item.previous_quantity !== undefined 
                      ? item.previous_quantity 
                      : '-'}
                  </TableCell>
                  <TableCell>{item.supplier || '-'}</TableCell>
                  <TableCell>{item.batch_number || '-'}</TableCell>
                  <TableCell className="text-right">{item.pallets || '-'}</TableCell>
                  <TableCell>
                    {item.action === 'remove' && item.exit_timestamp
                      ? format(item.exit_timestamp, 'dd.MM.yyyy HH:mm:ss')
                      : '-'}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-6 text-gray-500">
                  {searchTerm || dateRange[0] || dateRange[1] || actionFilter !== "all"
                    ? "Nu s-au găsit operațiuni conform criteriilor de căutare"
                    : "Nu există operațiuni de stoc înregistrate"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      
      {totalPages > 1 && (
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
      )}
    </div>
  );
};

export default InventoryHistory;
