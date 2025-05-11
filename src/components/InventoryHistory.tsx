
import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import { CalendarIcon } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { useToast } from "@/components/ui/use-toast"
import { InventoryItem } from '@/types';

interface InventoryHistoryProps {
  inventoryHistory: InventoryItem[];
}

const InventoryHistory = ({ inventoryHistory }: InventoryHistoryProps) => {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  const formatDate = (date: Date | undefined) => {
    if (!date) return '';
    return format(date, 'yyyy-MM-dd');
  };

  // Helper function to convert various date formats to a proper Date object
  const convertToDate = (dateValue: string | { seconds: number; nanoseconds: number; } | Date | undefined): Date | undefined => {
    if (!dateValue) return undefined;
    
    if (dateValue instanceof Date) {
      return dateValue;
    }
    
    if (typeof dateValue === 'string') {
      return new Date(dateValue);
    }
    
    if (typeof dateValue === 'object' && 'seconds' in dateValue) {
      // Convert Firestore timestamp to Date
      return new Date(dateValue.seconds * 1000);
    }
    
    return undefined;
  };

  const filteredHistory = inventoryHistory.filter(item => {
    const itemDate = item.created_at ? convertToDate(item.created_at) : undefined;
    const formattedItemDate = itemDate ? formatDate(itemDate) : '';
    const searchText = searchTerm.toLowerCase();
    const productName = item.name?.toLowerCase() || '';

    const dateMatch = !date || formattedItemDate === formatDate(date);
    const searchMatch = productName.includes(searchText);

    return dateMatch && searchMatch;
  });

  return (
    <div>
      <div className="flex items-center justify-between py-4">
        <div className="flex items-center space-x-2">
          <Input
            type="text"
            placeholder="Caută după nume produs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "justify-start text-left font-normal",
                  !date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? formatDate(date) : <span>Alege o dată</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                disabled={(date) =>
                  date > new Date()
                }
                initialFocus
              />
            </PopoverContent>
          </Popover>
          {date && (
            <Button variant="ghost" size="sm" onClick={() => setDate(undefined)}>
              Șterge data
            </Button>
          )}
        </div>
        <Button onClick={() => {
          toast({
            title: "Nu am implementat",
            description: "Îmi pare rău, încă nu am implementat asta."
          })
        }}>Filtre avansate</Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableCaption>Istoricul stocului de produse.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Data</TableHead>
              <TableHead>Produs</TableHead>
              <TableHead>Cantitate</TableHead>
              <TableHead>Unitate</TableHead>
              <TableHead>Furnizor</TableHead>
              <TableHead>Lot</TableHead>
              <TableHead>Document</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredHistory.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">
                  {formatDate(convertToDate(item.created_at))}
                </TableCell>
                <TableCell>{item.name}</TableCell>
                <TableCell>{item.quantity}</TableCell>
                <TableCell>{item.unit}</TableCell>
                <TableCell>{item.supplier}</TableCell>
                <TableCell>{item.lot_number}</TableCell>
                <TableCell>{item.document_number}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default InventoryHistory;
