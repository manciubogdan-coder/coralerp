// Fix the select method argument issue
import React, { useState, useEffect } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { InventoryHistoryItem } from "@/types";

const InventoryHistory = () => {
  const [inventoryHistoryItems, setInventoryHistoryItems] = useState<InventoryHistoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAction, setSelectedAction] = useState("all");
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [itemsPerPage] = useState(10);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const { toast } = useToast();

  const fetchInventoryHistoryItems = async (page = 0) => {
    setLoading(true);
    
    try {
      let query = supabase
        .from("inventory_history")
        .select("*", { count: 'exact' });

      query = query.order("operation_date", { ascending: false });

      if (searchTerm) {
        query = query.ilike('name', `%${searchTerm}%`);
      }

      if (selectedAction !== 'all') {
        query = query.eq('action', selectedAction);
      }

      if (date) {
        const formattedDate = format(date, 'yyyy-MM-dd');
        query = query.gte('operation_date', `${formattedDate} 00:00:00`).lte('operation_date', `${formattedDate} 23:59:59`);
      }

      const { data, error, count } = await query
        .range(page * itemsPerPage, (page + 1) * itemsPerPage - 1);

      if (error) {
        throw error;
      }

      setInventoryHistoryItems(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error("Error fetching inventory history:", error);
      toast({
        title: "Error",
        description: "Could not fetch inventory history.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventoryHistoryItems();
  }, [searchTerm, selectedAction, page, date]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setPage(0); // Reset to the first page when searching
  };

  const handleActionChange = (action: string) => {
    setSelectedAction(action);
    setPage(0); // Reset to the first page when filtering
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedAction("all");
    setDate(undefined);
    setPage(0);
  };

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-semibold mb-4">Inventory History</h2>

      <div className="flex flex-wrap gap-4 mb-4">
        <Input
          type="text"
          placeholder="Search by product name..."
          value={searchTerm}
          onChange={handleSearchChange}
          className="max-w-xs"
        />

        <Select value={selectedAction} onValueChange={handleActionChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="add">Add</SelectItem>
            <SelectItem value="remove">Remove</SelectItem>
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-[200px] justify-start text-left font-normal",
                !date && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? format(date, "PPP") : <span>Pick a date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center" side="bottom">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              disabled={(date) =>
                date > new Date() || date < new Date("2023-01-01")
              }
              initialFocus
            />
          </PopoverContent>
        </Popover>

        <Button onClick={clearFilters} variant="ghost">Clear Filters</Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Action</TableHead>
              <TableHead>Product Name</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Operation Date</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center">Loading...</TableCell>
              </TableRow>
            ) : inventoryHistoryItems.length > 0 ? (
              inventoryHistoryItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.action}</TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>{new Date(item.operation_date).toLocaleDateString()}</TableCell>
                  <TableCell>{item.details}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center">No history found.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-between items-center mt-4">
        <span>Total items: {totalCount}</span>
        <div className="flex gap-2">
          <Button
            onClick={() => handlePageChange(page - 1)}
            disabled={page === 0}
            variant="outline"
          >
            Previous
          </Button>
          <Button
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= Math.ceil(totalCount / itemsPerPage) - 1}
            variant="outline"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
};

export default InventoryHistory;
