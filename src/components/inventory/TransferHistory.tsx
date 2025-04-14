
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

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Caută produs, furnizor, lot..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 w-full"
        />
      </div>
      
      <div className="rounded-md border w-full overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Produs</TableHead>
              <TableHead>Furnizor</TableHead>
              <TableHead>Producător</TableHead>
              <TableHead>Nr. Lot</TableHead>
              <TableHead>Nr. Document</TableHead>
              <TableHead>Nr. Intrare</TableHead>
              <TableHead>Destinație</TableHead>
              <TableHead className="text-right">Cantitate</TableHead>
              <TableHead>Unitate</TableHead>
              <TableHead className="text-right">Cant. Netă</TableHead>
              <TableHead>Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-6 text-gray-500">
                  Se încarcă datele...
                </TableCell>
              </TableRow>
            ) : transfers.length > 0 ? (
              transfers.map((transfer) => (
                <TableRow key={`${transfer.transfer_id}-${transfer.product_name}`}>
                  <TableCell>{format(new Date(transfer.transfer_date), "dd.MM.yyyy")}</TableCell>
                  <TableCell>{transfer.product_name}</TableCell>
                  <TableCell>{transfer.supplier_name || "-"}</TableCell>
                  <TableCell>{transfer.manufacturer_name || "-"}</TableCell>
                  <TableCell>{transfer.batch_number || "-"}</TableCell>
                  <TableCell>{transfer.document_number || "-"}</TableCell>
                  <TableCell>{transfer.entry_number || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={transfer.destination === "Distrugere" ? "destructive" : "default"}>
                      {transfer.destination}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{formatQuantity(transfer.quantity)}</TableCell>
                  <TableCell>{transfer.unit}</TableCell>
                  <TableCell className="text-right">
                    {transfer.net_quantity ? formatQuantity(transfer.net_quantity) : "-"}
                  </TableCell>
                  <TableCell>{transfer.notes || "-"}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-6 text-gray-500">
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
