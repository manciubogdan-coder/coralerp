
import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Pagination, 
  PaginationContent, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious 
} from "@/components/ui/pagination";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface TransferHistoryProps {
  limit?: number;
  showSearch?: boolean;
}

interface TransferOperation {
  id: string;
  operation_date: string;
  product_name: string;
  quantity: number;
  unit: string;
  crate_count: number | null;
  net_quantity: number | null;
  notes: string | null;
  document_number: string | null;
  destination: string;
}

export function TransferHistory({ limit = 10, showSearch = true }: TransferHistoryProps) {
  const [transfers, setTransfers] = useState<TransferOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  
  useEffect(() => {
    fetchTransfers();
  }, [page, searchTerm]);
  
  const fetchTransfers = async () => {
    try {
      setLoading(true);
      
      // First, get data from stock_transfers
      const { data: transfersData, error: transfersError, count } = await supabase
        .from("stock_transfers")
        .select("*", { count: "exact" })
        .order("transfer_date", { ascending: false })
        .range((page - 1) * limit, page * limit - 1);
        
      if (transfersError) throw transfersError;
      
      if (count !== null) {
        setTotalPages(Math.ceil(count / limit));
      }
      
      if (!transfersData || transfersData.length === 0) {
        setTransfers([]);
        return;
      }
      
      // For each transfer, get its items
      const transfersWithDetails = await Promise.all(transfersData.map(async (transfer) => {
        const { data: itemsData, error: itemsError } = await supabase
          .from("stock_transfer_items")
          .select(`
            quantity,
            unit,
            inventory_item_id,
            inventory:inventory_item_id (name)
          `)
          .eq("transfer_id", transfer.id);
          
        if (itemsError) throw itemsError;
        
        return {
          ...transfer,
          items: itemsData || []
        };
      }));
      
      // Format the data for display
      const formattedTransfers = transfersWithDetails.flatMap(transfer => {
        // Filter items if search term is provided
        const filteredItems = !searchTerm 
          ? transfer.items 
          : transfer.items.filter(item => 
              item.inventory?.name.toLowerCase().includes(searchTerm.toLowerCase())
            );
            
        return filteredItems.map(item => ({
          id: `${transfer.id}-${item.inventory_item_id}`,
          operation_date: transfer.transfer_date,
          product_name: item.inventory?.name || "Produs necunoscut",
          quantity: item.quantity,
          unit: item.unit,
          crate_count: null, // We don't have this info in the current schema
          net_quantity: null, // We don't have this info in the current schema
          notes: transfer.notes,
          document_number: null, // We don't have this info in the current schema
          destination: transfer.destination,
        }));
      });
      
      setTransfers(formattedTransfers);
    } catch (error) {
      console.error("Error fetching transfers:", error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="space-y-4">
      {showSearch && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Caută produs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      )}
      
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data operațiune</TableHead>
              <TableHead>Produs</TableHead>
              <TableHead>Destinație</TableHead>
              <TableHead className="text-right">Cantitate</TableHead>
              <TableHead>Unitate</TableHead>
              <TableHead>Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-6 text-gray-500">
                  Se încarcă datele...
                </TableCell>
              </TableRow>
            ) : transfers.length > 0 ? (
              transfers.map(transfer => (
                <TableRow key={transfer.id}>
                  <TableCell>{format(new Date(transfer.operation_date), "dd.MM.yyyy")}</TableCell>
                  <TableCell>{transfer.product_name}</TableCell>
                  <TableCell>
                    <Badge variant={transfer.destination === "Distrugere" ? "destructive" : "default"}>
                      {transfer.destination}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{transfer.quantity}</TableCell>
                  <TableCell>{transfer.unit}</TableCell>
                  <TableCell>{transfer.notes || "-"}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-6 text-gray-500">
                  {searchTerm
                    ? "Nu s-au găsit transferuri conform criteriilor de căutare"
                    : "Nu există transferuri înregistrate"}
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
}
