
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
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface TransferOperation {
  transfer_id: string;
  transfer_date: string;
  destination: string;
  notes: string | null;
  product_name: string;
  quantity: number;
  unit: string;
  crate_count: number | null;
  net_quantity: number | null;
  supplier_name: string | null;
  manufacturer_name: string | null;
  document_number: string | null;
  batch_number: string | null;
  entry_number: number | null;
  inventory_item_id: string | null;
}

export function TransferHistory() {
  const [transfers, setTransfers] = useState<TransferOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const isMobile = useIsMobile();

  const formatQuantity = (quantity: number) => {
    return quantity.toFixed(2);
  };

  useEffect(() => {
    fetchTransfers();
  }, [searchTerm]);
  
  const fetchTransfers = async () => {
    try {
      setLoading(true);
      
      const query = supabase
        .from('stock_transfer_view')
        .select('*')
        .order('transfer_date', { ascending: false });
        
      if (searchTerm) {
        query.or(`product_name.ilike.%${searchTerm}%,supplier_name.ilike.%${searchTerm}%,manufacturer_name.ilike.%${searchTerm}%,batch_number.ilike.%${searchTerm}%,document_number.ilike.%${searchTerm}%`);
      }
      
      const { data, error } = await query;
        
      if (error) throw error;
      
      setTransfers(data || []);
    } catch (error) {
      console.error("Error fetching transfers:", error);
    } finally {
      setLoading(false);
    }
  };
  
  const getVisibleColumns = () => {
    if (isMobile) {
      return {
        date: true,
        product: true,
        supplier: true,
        destination: true,
        quantity: true,
        unit: true,
        batch: true
      };
    }
    return {
      date: true,
      product: true,
      supplier: true,
      manufacturer: true,
      batch: true,
      documentNumber: true,
      entryNumber: true,
      destination: true,
      quantity: true,
      unit: true,
      netQuantity: true,
      notes: true
    };
  };

  const visibleColumns = getVisibleColumns();
  
  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Caută produs, furnizor..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 w-full"
        />
      </div>
      
      <div className="rounded-md border w-full overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {visibleColumns.date && <TableHead>Data</TableHead>}
              {visibleColumns.product && <TableHead>Produs</TableHead>}
              {visibleColumns.supplier && <TableHead>Furnizor</TableHead>}
              {visibleColumns.destination && <TableHead>Destinație</TableHead>}
              {visibleColumns.quantity && <TableHead className="text-right">Cantitate</TableHead>}
              {visibleColumns.unit && <TableHead>Unitate</TableHead>}
              {visibleColumns.batch && <TableHead>Lot</TableHead>}
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
              transfers.map((transfer) => (
                <TableRow key={`${transfer.transfer_id}-${transfer.product_name}`}>
                  {visibleColumns.date && <TableCell>{format(new Date(transfer.transfer_date), "dd.MM.yyyy")}</TableCell>}
                  {visibleColumns.product && <TableCell>{transfer.product_name}</TableCell>}
                  {visibleColumns.supplier && <TableCell>{transfer.supplier_name || "-"}</TableCell>}
                  {visibleColumns.destination && (
                    <TableCell>
                      <Badge variant={transfer.destination === "Distrugere" ? "destructive" : "default"}>
                        {transfer.destination}
                      </Badge>
                    </TableCell>
                  )}
                  {visibleColumns.quantity && <TableCell className="text-right">{formatQuantity(transfer.quantity)}</TableCell>}
                  {visibleColumns.unit && <TableCell>{transfer.unit}</TableCell>}
                  {visibleColumns.batch && <TableCell>{transfer.batch_number || "-"}</TableCell>}
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
    </div>
  );
}
