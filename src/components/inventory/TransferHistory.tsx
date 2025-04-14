
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
}

export function TransferHistory() {
  const [transfers, setTransfers] = useState<TransferOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

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
        query.ilike('product_name', `%${searchTerm}%`);
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
          placeholder="Caută produs..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>
      
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
              transfers.map((transfer) => (
                <TableRow key={`${transfer.transfer_id}-${transfer.product_name}`}>
                  <TableCell>{format(new Date(transfer.transfer_date), "dd.MM.yyyy")}</TableCell>
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
    </div>
  );
}
