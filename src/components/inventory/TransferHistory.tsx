import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import { toast } from "@/hooks/use-custom-toast";
import { Search, CalendarIcon, FileDown, QrCode } from "lucide-react";
import { TransferQRDialog } from "./TransferQRDialog";
import type { TransferLabelData } from "./TransferQRLabel";
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
import { useInventoryType } from "@/context/inventory-type";

interface TransferHistoryProps {
  onTransferReturned?: () => void;
}

interface TransferItem {
  transfer_id: string;
  transfer_date: string;
  destination: string;
  product_name: string;
  product_code?: string;
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
  const { inventoryType } = useInventoryType();
  const [transfers, setTransfers] = useState<TransferItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [destinations, setDestinations] = useState<string[]>([]);
  const [selectedDestination, setSelectedDestination] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const initialToday = (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })();
  const [dateRange, setDateRange] = useState<[Date | undefined, Date | undefined]>([initialToday, initialToday]);
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrLabels, setQrLabels] = useState<TransferLabelData[]>([]);

  const openQrFor = (transfer: TransferItem) => {
    setQrLabels([{
      inventory_item_id: transfer.inventory_item_id,
      product_name: transfer.product_name,
      lot_number: transfer.lot_number,
      quantity: transfer.quantity,
      unit: transfer.unit,
      destination: transfer.destination,
      transfer_date: transfer.transfer_date || transfer.created_at,
      supplier: transfer.supplier_name,
      manufacturer: transfer.manufacturer_name,
      document_number: transfer.document_number,
    }]);
    setQrOpen(true);
  };
  
  const fetchTransfers = async () => {
    try {
      setLoading(true);
      
      // Use the correct tables to build a query instead of views
      const transferItemsTable = inventoryType === 'ambalaje'
        ? 'ambalaje_stock_transfer_items'
        : inventoryType === 'etichete'
          ? 'etichete_stock_transfer_items'
          : 'stock_transfer_items';

      // Server-side date filter (on item created_at) to keep the query fast
      const startDate = dateRange[0] ? new Date(dateRange[0]) : null;
      if (startDate) startDate.setHours(0, 0, 0, 0);
      const endDate = dateRange[1] ? new Date(dateRange[1]) : null;
      if (endDate) endDate.setHours(23, 59, 59, 999);
      
      // Paginate to bypass Supabase 1000-row limit
      const pageSize = 1000;
      let allData: any[] = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        let query: any = supabase
          .from(transferItemsTable)
          .select(`
            *,
            stock_transfers:transfer_id (
              transfer_date,
              destination,
              notes,
              created_at
            ),
            inventory:inventory_item_id (
              name,
              lot_number,
              document_number,
              entry_number,
              suppliers:supplier_id (name),
              manufacturers:manufacturer_id (name),
              products:product_id (name, cod_produs)
            )
          `)
          .order('created_at', { ascending: false })
          .range(offset, offset + pageSize - 1);

        if (startDate) query = query.gte('created_at', startDate.toISOString());
        if (endDate) query = query.lte('created_at', endDate.toISOString());

        const { data, error } = await query;

        if (error) throw error;

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          offset += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      const data = allData;
      console.log(`Fetched ${inventoryType} transfers total:`, data.length);
      
      // Transform the data to match the expected format
      const transformedData = (data || []).map(item => ({
        transfer_id: item.transfer_id,
        transfer_date: item.stock_transfers?.transfer_date || '',
        destination: item.stock_transfers?.destination || '',
        product_name: item.inventory?.products?.name || item.inventory?.name || '',
        product_code: item.inventory?.products?.cod_produs || '',
        supplier_name: item.inventory?.suppliers?.name || '',
        manufacturer_name: item.inventory?.manufacturers?.name || '',
        document_number: item.inventory?.document_number || '',
        entry_number: item.inventory?.entry_number || 0,
        quantity: item.quantity,
        unit: item.unit,
        notes: item.stock_transfers?.notes || '',
        inventory_item_id: item.inventory_item_id,
        created_at: item.stock_transfers?.created_at || item.created_at,
        lot_number: item.inventory?.lot_number || ''
      }));
      
      setTransfers(transformedData);
      
      const uniqueDestinations = Array.from(
        new Set(transformedData.map((transfer) => transfer.destination))
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventoryType, dateRange[0]?.getTime(), dateRange[1]?.getTime()]);
  
  const handleTransferReturned = () => {
    fetchTransfers();
    if (onTransferReturned) {
      onTransferReturned();
    }
  };
  
  const handleExportExcel = () => {
    const transfersToExport = filteredTransfers;

    
    const dataForExport = transfersToExport.map(transfer => ({
      "Data și ora": transfer.created_at 
        ? format(new Date(transfer.created_at), 'dd.MM.yyyy HH:mm:ss')
        : transfer.transfer_date 
          ? format(new Date(transfer.transfer_date), 'dd.MM.yyyy')
          : '-',
      "Destinație": transfer.destination,
      "Nr. Document": transfer.document_number || "-",
      "Produs": transfer.product_name,
      "Cod Produs": transfer.product_code || "-",
      "Nr. Lot": transfer.lot_number || "-",
      "Furnizor": transfer.supplier_name || "-",
      "Producător": transfer.manufacturer_name || "-",
      "Cantitate": formatQuantity(transfer.quantity),
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

    // Date range filter
    if (dateRange[0] || dateRange[1]) {
      const transferDate = transfer.created_at
        ? new Date(transfer.created_at)
        : transfer.transfer_date
          ? new Date(transfer.transfer_date)
          : null;
      if (!transferDate) return false;
      if (dateRange[0]) {
        const start = new Date(dateRange[0]);
        start.setHours(0, 0, 0, 0);
        if (transferDate < start) return false;
      }
      if (dateRange[1]) {
        const end = new Date(dateRange[1]);
        end.setHours(23, 59, 59, 999);
        if (transferDate > end) return false;
      }
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

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedDestination, dateRange, itemsPerPage]);
  
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
                <DateRangePanel
                  initial={{ from: dateRange[0], to: dateRange[1] }}
                  onApply={(from, to) => { setDateRange([from, to]); setIsCalendarOpen(false); }}
                  onCancel={() => setIsCalendarOpen(false)}
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
        
        {/* Mobile/tablet card view */}
        <div className="md:hidden space-y-2">
          {loading ? (
            <div className="text-center py-6 text-gray-500">Se încarcă datele...</div>
          ) : currentItems.length > 0 ? (
            currentItems.map((transfer) => (
              <div
                key={`${transfer.transfer_id}-${transfer.inventory_item_id}`}
                className="border rounded-lg p-3 bg-card shadow-sm space-y-2 text-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium text-base">{transfer.product_name}</div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="outline" onClick={() => openQrFor(transfer)} title="Printează QR">
                      <QrCode className="h-4 w-4" />
                    </Button>
                    <TransferReturnForm transfer={transfer} onReturnComplete={handleTransferReturned} />
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {transfer.created_at
                    ? format(new Date(transfer.created_at), 'dd.MM.yyyy HH:mm')
                    : transfer.transfer_date
                      ? format(new Date(transfer.transfer_date), 'dd.MM.yyyy')
                      : '-'}
                </div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 border-t pt-2 text-xs">
                  <div><span className="text-muted-foreground">Destinație:</span> {transfer.destination}</div>
                  <div><span className="text-muted-foreground">Cantitate:</span> <span className="font-semibold">{formatQuantity(transfer.quantity)} {transfer.unit}</span></div>
                  {transfer.document_number && <div><span className="text-muted-foreground">Doc:</span> {transfer.document_number}</div>}
                  {transfer.lot_number && <div><span className="text-muted-foreground">Lot:</span> {transfer.lot_number}</div>}
                  {transfer.product_code && <div><span className="text-muted-foreground">Cod:</span> {transfer.product_code}</div>}
                  {transfer.supplier_name && <div className="col-span-2"><span className="text-muted-foreground">Furnizor:</span> {transfer.supplier_name}</div>}
                  {transfer.manufacturer_name && <div className="col-span-2"><span className="text-muted-foreground">Producător:</span> {transfer.manufacturer_name}</div>}
                  {transfer.notes && <div className="col-span-2"><span className="text-muted-foreground">Note:</span> {transfer.notes}</div>}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-6 text-gray-500">
              {searchTerm || (selectedDestination && selectedDestination !== "all")
                ? "Nu s-au găsit transferuri conform criteriilor de căutare"
                : "Nu există transferuri înregistrate"}
            </div>
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-hidden rounded-lg border">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-50 sticky top-0">
                <TableRow>
                  <TableHead>Data și ora</TableHead>
                  <TableHead>Destinație</TableHead>
                  <TableHead>Nr. Document</TableHead>
                  <TableHead>Produs</TableHead>
                  <TableHead>Cod Produs</TableHead>
                  <TableHead>Nr. Lot</TableHead>
                  <TableHead>Furnizor</TableHead>
                  <TableHead>Producător</TableHead>
                  <TableHead className="text-right">Cantitate</TableHead>
                  <TableHead>UM</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="sticky right-0 bg-gray-50">Acțiuni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center py-6 text-gray-500">
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
                      <TableCell>{transfer.product_code || "-"}</TableCell>
                      <TableCell>{transfer.lot_number || "-"}</TableCell>
                      <TableCell>{transfer.supplier_name || "-"}</TableCell>
                      <TableCell>{transfer.manufacturer_name || "-"}</TableCell>
                      <TableCell className="text-right">{formatQuantity(transfer.quantity)}</TableCell>
                      <TableCell>{transfer.unit}</TableCell>
                      <TableCell>{transfer.notes || "-"}</TableCell>
                      <TableCell className="sticky right-0 bg-white">
                        <div className="flex items-center gap-1 justify-end">
                          <Button size="sm" variant="outline" onClick={() => openQrFor(transfer)} title="Printează QR">
                            <QrCode className="h-4 w-4" />
                          </Button>
                          <TransferReturnForm 
                            transfer={transfer}
                            onReturnComplete={handleTransferReturned}
                          />
                        </div>
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
        
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 my-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Pe pagină:</span>
            <Select value={String(itemsPerPage)} onValueChange={(v) => setItemsPerPage(Number(v))}>
              <SelectTrigger className="w-[90px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="250">250</SelectItem>
                <SelectItem value="500">500</SelectItem>
              </SelectContent>
            </Select>
            <span className="ml-2">
              {filteredTransfers.length} rezultate • pagina {page} / {totalPages}
            </span>
          </div>

          <Pagination className="m-0 w-auto mx-0 justify-end">
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
      <TransferQRDialog open={qrOpen} onOpenChange={setQrOpen} labels={qrLabels} />
    </div>
  );
}

function DateRangePanel({
  initial,
  onApply,
  onCancel,
}: {
  initial: { from?: Date; to?: Date };
  onApply: (from: Date | undefined, to: Date | undefined) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<{ from?: Date; to?: Date }>({ from: initial.from, to: initial.to });
  const todayMid = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
  const presets = [
    { label: "Azi", get: () => { const d = todayMid(); return { from: d, to: d }; } },
    { label: "Ieri", get: () => { const d = todayMid(); d.setDate(d.getDate()-1); return { from: d, to: d }; } },
    { label: "Ultimele 7 zile", get: () => { const t = todayMid(); const f = new Date(t); f.setDate(f.getDate()-6); return { from: f, to: t }; } },
    { label: "Ultimele 30 zile", get: () => { const t = todayMid(); const f = new Date(t); f.setDate(f.getDate()-29); return { from: f, to: t }; } },
    { label: "Luna curentă", get: () => { const t = todayMid(); return { from: new Date(t.getFullYear(), t.getMonth(), 1), to: t }; } },
    { label: "Luna trecută", get: () => { const t = todayMid(); return { from: new Date(t.getFullYear(), t.getMonth()-1, 1), to: new Date(t.getFullYear(), t.getMonth(), 0) }; } },
  ];

  const fmt = (d?: Date) => d ? format(d, "dd.MM.yyyy") : "—";
  const isDesktop = typeof window !== "undefined" && window.innerWidth >= 768;

  return (
    <div className="flex flex-col max-h-[85vh] w-[95vw] sm:w-auto">
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col sm:flex-row">
          <div className="flex sm:flex-col gap-1 p-2 border-b sm:border-b-0 sm:border-r flex-wrap sm:min-w-[160px]">
            {presets.map(p => (
              <Button key={p.label} variant="ghost" size="sm" className="justify-start text-xs h-8"
                onClick={() => { const r = p.get(); setDraft(r); onApply(r.from, r.to); }}>
                {p.label}
              </Button>
            ))}
          </div>
          <Calendar
            mode="range"
            selected={draft as any}
            onSelect={(range: any) => setDraft({ from: range?.from, to: range?.to })}
            numberOfMonths={isDesktop ? 2 : 1}
            locale={ro}
            initialFocus
            className="pointer-events-auto"
          />
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 p-3 border-t bg-background sticky bottom-0">
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{fmt(draft.from)}</span>
          <span className="mx-1">→</span>
          <span className="font-medium text-foreground">{fmt(draft.to ?? draft.from)}</span>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>Anulează</Button>
          <Button size="sm" disabled={!draft.from}
            onClick={() => onApply(draft.from, draft.to ?? draft.from)}>
            Aplică
          </Button>
        </div>
      </div>
    </div>
  );
}


