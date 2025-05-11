
import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-custom-toast";
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

interface TransferHistoryItem {
  id: string;
  source: string;
  destination: string;
  product_name: string;
  quantity: number;
  unit: string;
  transfer_date: string;
  returned: boolean;
  returned_date: string | null;
  notes?: string;
}

export const TransferHistory = ({ onTransferReturned }: { onTransferReturned: () => void }) => {
  const [history, setHistory] = useState<TransferHistoryItem[]>([]);
  const [destinations, setDestinations] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDestination, setSelectedDestination] = useState("all");
  const [returnedFilter, setReturnedFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDestinations = async () => {
      try {
        const { data, error } = await supabase
          .from('stock_transfers')
          .select('destination')
          .order('destination');
        
        if (error) {
          throw error;
        }
        
        if (data) {
          // Extract the destination strings and remove duplicates
          const destinationStrings = data
            .map(item => item.destination as string)
            .filter((value, index, self) => self.indexOf(value) === index);
          
          setDestinations(destinationStrings);
        }
      } catch (error) {
        console.error("Error fetching destinations:", error);
      }
    };
    
    fetchDestinations();
  }, []);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from("stock_transfers")
          .select("*")
          .order("transfer_date", { ascending: false });

        if (selectedDestination !== "all") {
          query = query.eq("destination", selectedDestination);
        }

        if (returnedFilter === "returned") {
          query = query.eq("returned", true);
        } else if (returnedFilter === "not_returned") {
          query = query.eq("returned", false);
        }

        const { data, error } = await query;

        if (error) {
          throw error;
        }

        setHistory(data || []);
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Eroare la încărcarea istoricului transferurilor",
          description: error.message,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [selectedDestination, returnedFilter]);

  const filteredHistory = history.filter((item) => {
    const searchTermLower = searchTerm.toLowerCase();
    return (
      item.product_name.toLowerCase().includes(searchTermLower) ||
      item.source.toLowerCase().includes(searchTermLower) ||
      item.destination.toLowerCase().includes(searchTermLower)
    );
  });

  const handleReturnTransfer = async (transferId: string) => {
    try {
      const { error } = await supabase
        .from("stock_transfers")
        .update({ returned: true, returned_date: new Date().toISOString() })
        .eq("id", transferId);

      if (error) {
        throw error;
      }

      // Re-fetch history to update the table
      setHistory((prevHistory) =>
        prevHistory.map((item) =>
          item.id === transferId ? { ...item, returned: true } : item
        )
      );

      toast({
        title: "Transfer marcat ca returnat",
      });
      onTransferReturned();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Eroare la marcarea transferului ca returnat",
        description: error.message,
      });
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2">
        <Input
          type="text"
          placeholder="Caută după produs, sursă, destinație..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <div className="flex gap-2">
          <div>
            <Label htmlFor="destination">Destinație:</Label>
            <select
              id="destination"
              className="w-full px-3 py-2 border rounded"
              value={selectedDestination}
              onChange={(e) => setSelectedDestination(e.target.value)}
            >
              <option value="all">Toate destinațiile</option>
              {destinations.map((dest) => (
                <option key={dest} value={dest}>
                  {dest}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="returned">Status retur:</Label>
            <select
              id="returned"
              className="w-full px-3 py-2 border rounded"
              value={returnedFilter}
              onChange={(e) => setReturnedFilter(e.target.value)}
            >
              <option value="all">Toate</option>
              <option value="returned">Returnate</option>
              <option value="not_returned">Nereturate</option>
            </select>
          </div>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sursă</TableHead>
            <TableHead>Destinație</TableHead>
            <TableHead>Produs</TableHead>
            <TableHead>Cantitate</TableHead>
            <TableHead>Data Transferului</TableHead>
            <TableHead>Status Retur</TableHead>
            <TableHead>Acțiuni</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center">
                Se încarcă...
              </TableCell>
            </TableRow>
          ) : filteredHistory.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center">
                Niciun transfer găsit.
              </TableCell>
            </TableRow>
          ) : (
            filteredHistory.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.source}</TableCell>
                <TableCell>{item.destination}</TableCell>
                <TableCell>{item.product_name}</TableCell>
                <TableCell>
                  {item.quantity} {item.unit}
                </TableCell>
                <TableCell>{format(new Date(item.transfer_date), 'dd MMMM yyyy', { locale: ro })}</TableCell>
                <TableCell>
                  {item.returned
                    ? `Returnat la ${format(new Date(item.returned_date || item.transfer_date), 'dd MMMM yyyy', { locale: ro })}`
                    : "Nereturat"}
                </TableCell>
                <TableCell>
                  {!item.returned && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReturnTransfer(item.id)}
                    >
                      Marchează ca Returnat
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};
