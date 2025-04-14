
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
import { Button } from "@/components/ui/button";
import { Search, ArrowLeftCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-custom-toast";

interface TransferOperation {
  transfer_id: string;
  transfer_date: string;
  destination: string;
  notes: string | null;
  product_name: string;
  quantity: number;
  net_quantity?: number | null;
  unit: string;
  crate_count: number | null;
  supplier_name: string | null;
  manufacturer_name: string | null;
  document_number: string | null;
  entry_number: number | null;
  inventory_item_id: string | null;
}

interface ReturnFormProps {
  transfer: TransferOperation;
  onComplete: () => void;
}

const ReturnForm = ({ transfer, onComplete }: ReturnFormProps) => {
  const [returnQuantity, setReturnQuantity] = useState<number>(transfer.net_quantity || transfer.quantity);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleReturn = async () => {
    const maxReturnQuantity = transfer.net_quantity || transfer.quantity;
    
    if (returnQuantity <= 0 || returnQuantity > maxReturnQuantity) {
      toast({
        variant: "destructive",
        title: "Eroare",
        description: "Cantitatea de returnat nu este validă"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // First insert back into inventory
      const { error: insertError } = await supabase
        .from('inventory')
        .insert({
          quantity: returnQuantity,
          unit: transfer.unit,
          name: transfer.product_name,
          supplier: transfer.supplier_name,
          document_number: transfer.document_number,
          entry_number: transfer.entry_number
        });

      if (insertError) throw insertError;

      // Record the return in inventory history
      const { error: historyError } = await supabase
        .from('inventory_history')
        .insert({
          action: 'add',
          name: transfer.product_name,
          quantity: returnQuantity,
          unit: transfer.unit,
          supplier: transfer.supplier_name,
          document_number: transfer.document_number,
          notes: `Retur de la ${transfer.destination}`
        });

      if (historyError) throw historyError;

      toast({
        title: "Succes",
        description: "Produsul a fost returnat în stoc"
      });
      
      onComplete();
    } catch (error: any) {
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
    <div className="flex gap-2 items-center">
      <Input
        type="number"
        value={returnQuantity}
        onChange={(e) => setReturnQuantity(Number(e.target.value))}
        min={0}
        max={transfer.net_quantity || transfer.quantity}
        step="0.01"
        className="w-32"
      />
      <span className="text-sm text-gray-500">{transfer.unit}</span>
      <Button 
        variant="outline" 
        size="sm"
        onClick={handleReturn}
        disabled={isSubmitting}
      >
        <ArrowLeftCircle className="h-4 w-4 mr-2" />
        Returnează
      </Button>
    </div>
  );
};

export function TransferHistory() {
  const [transfers, setTransfers] = useState<TransferOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDestination, setSelectedDestination] = useState<string>("");

  const formatQuantity = (quantity: number) => {
    return quantity.toFixed(2);
  };

  useEffect(() => {
    fetchTransfers();
  }, [searchTerm, selectedDestination]);
  
  const fetchTransfers = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('stock_transfer_view')
        .select('*')
        .order('transfer_date', { ascending: false });
        
      if (searchTerm) {
        query = query.or(`product_name.ilike.%${searchTerm}%,supplier_name.ilike.%${searchTerm}%,manufacturer_name.ilike.%${searchTerm}%,document_number.ilike.%${searchTerm}%`);
      }

      if (selectedDestination && selectedDestination !== "all") {
        query = query.eq('destination', selectedDestination);
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
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Caută produs, furnizor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full"
          />
        </div>
        
        <Select 
          value={selectedDestination} 
          onValueChange={setSelectedDestination}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filtrează după destinație" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toate destinațiile</SelectItem>
            <SelectItem value="Producție">Producție</SelectItem>
            <SelectItem value="Distrugere">Distrugere</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="rounded-md border w-full overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID Transfer</TableHead>
              <TableHead>Dată Transfer</TableHead>
              <TableHead>Produs</TableHead>
              <TableHead>Furnizor</TableHead>
              <TableHead>Producător</TableHead>
              <TableHead>Destinație</TableHead>
              <TableHead>Nr. Intrare</TableHead>
              <TableHead>Nr. Document</TableHead>
              <TableHead className="text-right">Cantitate Brută</TableHead>
              <TableHead className="text-right">Cantitate Netă</TableHead>
              <TableHead>Unitate</TableHead>
              <TableHead>Nr. Lăzi</TableHead>
              <TableHead>Note</TableHead>
              <TableHead>Acțiuni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={14} className="text-center py-6 text-gray-500">
                  Se încarcă datele...
                </TableCell>
              </TableRow>
            ) : transfers.length > 0 ? (
              transfers.map((transfer) => (
                <TableRow key={transfer.transfer_id}>
                  <TableCell>{transfer.transfer_id || "-"}</TableCell>
                  <TableCell>{transfer.transfer_date ? format(new Date(transfer.transfer_date), "dd.MM.yyyy") : "-"}</TableCell>
                  <TableCell>{transfer.product_name}</TableCell>
                  <TableCell>{transfer.supplier_name || "-"}</TableCell>
                  <TableCell>{transfer.manufacturer_name || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={transfer.destination === "Distrugere" ? "destructive" : "default"}>
                      {transfer.destination}
                    </Badge>
                  </TableCell>
                  <TableCell>{transfer.entry_number || "-"}</TableCell>
                  <TableCell>{transfer.document_number || "-"}</TableCell>
                  <TableCell className="text-right">{formatQuantity(transfer.quantity)}</TableCell>
                  <TableCell className="text-right">{formatQuantity(transfer.net_quantity || transfer.quantity)}</TableCell>
                  <TableCell>{transfer.unit}</TableCell>
                  <TableCell>{transfer.crate_count || "-"}</TableCell>
                  <TableCell>{transfer.notes || "-"}</TableCell>
                  <TableCell>
                    <ReturnForm 
                      transfer={transfer}
                      onComplete={fetchTransfers}
                    />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={14} className="text-center py-6 text-gray-500">
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
  );
}
