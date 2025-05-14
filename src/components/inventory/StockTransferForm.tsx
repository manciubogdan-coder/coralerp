import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-custom-toast";
import { supabase } from "@/integrations/supabase/client";
import { InventoryItem } from "@/types";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage 
} from "@/components/ui/form";
import { FileText, ChevronUp, ChevronDown } from "lucide-react";
import { useForm } from "react-hook-form";
import { useIsMobile } from "@/hooks/use-mobile";
import { ScrollArea } from "@/components/ui/scroll-area";

interface StockTransferFormProps {
  onTransferComplete?: () => void;
}

interface TransferItem {
  id: string;
  productName: string;
  quantity: number;
  unit: string;
  maxQuantity: number; // Cantitatea netă maximă disponibilă
  maxGrossQuantity: number; // Cantitatea brută maximă estimată
  crateCount?: number;
  crateTypeId?: string;
  crateWeight?: number;
  pallets?: number;
  palletWeight?: number;
  grossQuantity: number;
  netQuantity: number;
  originalCrateCount?: number;
  lot_number?: string;
  // Informații adiționale pentru reintroducere
  supplier?: string;
  supplier_id?: string;
  manufacturer?: string;
  manufacturer_id?: string;
  document_number?: string;
  entry_number?: number;
}

interface TransferFormValues {
  transferDate: string;
  destination: string;
  notes: string;
}

export function StockTransferForm({ onTransferComplete }: StockTransferFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<TransferItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isManualSelectionMode, setIsManualSelectionMode] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const listScrollAreaRef = useRef<HTMLDivElement>(null);
  const searchResultsRef = useRef<HTMLDivElement>(null);
  
  const form = useForm<TransferFormValues>({
    defaultValues: {
      transferDate: new Date().toISOString().split('T')[0],
      destination: "Producție",
      notes: ""
    }
  });

  useEffect(() => {
    if (isOpen) {
      fetchInventory();
    }
  }, [isOpen]);
  
  // Improved mobile focus management
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current && isMobile) {
      // Delay to ensure the dropdown is fully open and keyboard appears
      const focusTimer = setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          // Force the keyboard to stay open by triggering a click
          searchInputRef.current.click();
        }
      }, 300);
      
      return () => clearTimeout(focusTimer);
    }
  }, [isSearchOpen, isMobile]);
  
  // Enhanced touch interaction handling
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      // Only prevent default for search-related elements
      if (isSearchOpen && searchContainerRef.current?.contains(e.target as Node)) {
        // Allow scrolling but prevent other touch behaviors that might dismiss keyboard
        if (!(e.target as HTMLElement).classList.contains('scroll-button')) {
          e.stopPropagation();
        }
      }
    };
    
    // Mobile-specific listeners to prevent keyboard dismissal
    const handleFocusOut = (e: FocusEvent) => {
      if (isSearchOpen && searchInputRef.current && isMobile && isManualSelectionMode) {
        // If focus is moving out of the search input but we're in manual selection mode
        // prevent the default action and keep focus
        e.preventDefault();
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 100);
      }
    };
    
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    if (searchInputRef.current) {
      searchInputRef.current.addEventListener('focusout', handleFocusOut);
    }
    
    // Prevent zoom/scale on mobile
    const metaViewport = document.createElement('meta');
    metaViewport.name = 'viewport';
    metaViewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
    document.head.appendChild(metaViewport);
    
    // Add a global touchmove handler to prevent scrolling the background when search is open
    const handleTouchMove = (e: TouchEvent) => {
      if (isSearchOpen && !searchContainerRef.current?.contains(e.target as Node) && 
          !searchResultsRef.current?.contains(e.target as Node)) {
        e.preventDefault();
      }
    };
    
    if (isSearchOpen && isMobile) {
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
    }
    
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      if (searchInputRef.current) {
        searchInputRef.current.removeEventListener('focusout', handleFocusOut);
      }
      
      // Clean up meta tag
      document.querySelectorAll('meta[name="viewport"]').forEach(meta => {
        if (meta.getAttribute('content')?.includes('maximum-scale=1.0')) {
          meta.remove();
        }
      });
    };
  }, [isSearchOpen, isMobile, isManualSelectionMode]);
  
  const fetchInventory = async () => {
    try {
      const { data, error } = await supabase
        .from("inventory")
        .select(`
          *,
          suppliers:supplier_id (name),
          products:product_id (name),
          manufacturers:manufacturer_id (name)
        `)
        .gt("quantity", 0)
        .order("name");

      if (error) {
        throw error;
      }

      setInventory(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Eroare la încărcarea stocului",
        description: error.message,
      });
    }
  };

  const handleAddItem = (itemId: string) => {
    const selectedItem = inventory.find(item => item.id === itemId);
    if (!selectedItem) return;

    const productName = selectedItem.products?.name || selectedItem.name;
    
    // Estimăm o cantitate brută maximă permisă ca fiind de 50% mai mare decât cea netă
    const maxGrossEstimate = selectedItem.quantity * 1.5;
    
    setSelectedItems([...selectedItems, {
      id: selectedItem.id,
      productName,
      quantity: selectedItem.quantity,
      unit: selectedItem.unit,
      maxQuantity: selectedItem.quantity,
      maxGrossQuantity: maxGrossEstimate,
      crateCount: selectedItem.crate_count || 0,
      originalCrateCount: selectedItem.crate_count || 0,
      crateTypeId: selectedItem.crate_type_id || undefined,
      crateWeight: selectedItem.crate_weight || 0,
      pallets: 0,
      palletWeight: 0,
      grossQuantity: selectedItem.gross_quantity || selectedItem.quantity,
      netQuantity: selectedItem.net_quantity || selectedItem.quantity,
      supplier: selectedItem.supplier || selectedItem.suppliers?.name,
      supplier_id: selectedItem.supplier_id,
      manufacturer: selectedItem.manufacturer || selectedItem.manufacturers?.name,
      manufacturer_id: selectedItem.manufacturer_id,
      document_number: selectedItem.document_number,
      entry_number: selectedItem.entry_number,
      lot_number: selectedItem.lot_number
    }]);
    
    // Close the search mode after selection on mobile
    if (isMobile) {
      setIsSearchOpen(false);
      setIsManualSelectionMode(false);
    }
  };

  // Direct product selection without using dropdown's built-in selection
  const handleManualItemSelection = (itemId: string) => {
    handleAddItem(itemId);
    
    // Ensure the dropdown and keyboard stay closed after selection
    setIsSearchOpen(false);
    setIsManualSelectionMode(false);
    
    if (searchInputRef.current) {
      searchInputRef.current.blur();
    }
  };

  const calculateNetQuantity = (item: TransferItem) => {
    // Calculate deductions from crates
    const totalCrateWeight = (item.crateWeight || 0) * (item.crateCount || 0);
    
    // Calculate deductions from pallets
    const totalPalletWeight = item.palletWeight || 0;
    
    // Calculate net quantity by subtracting total weights from gross quantity
    return Math.max(0, item.grossQuantity - totalCrateWeight - totalPalletWeight);
  };

  const handleGrossQuantityChange = (index: number, value: number) => {
    const updatedItems = [...selectedItems];
    const item = updatedItems[index];
    
    // Permite orice cantitate brută, fără limite superioare
    const newGrossQuantity = Math.max(0, value);
    
    updatedItems[index] = {
      ...item,
      grossQuantity: newGrossQuantity,
    };
    
    // Recalculate net quantity
    updatedItems[index].netQuantity = calculateNetQuantity(updatedItems[index]);
    
    setSelectedItems(updatedItems);
  };

  const handleCrateCountChange = (index: number, value: number) => {
    const updatedItems = [...selectedItems];
    const item = updatedItems[index];
    const newCrateCount = Math.max(0, value);
    
    updatedItems[index] = {
      ...item,
      crateCount: newCrateCount
    };
    
    // Recalculate net quantity
    updatedItems[index].netQuantity = calculateNetQuantity(updatedItems[index]);
    
    setSelectedItems(updatedItems);
  };

  const handlePalletsChange = (index: number, value: number) => {
    const updatedItems = [...selectedItems];
    updatedItems[index] = {
      ...updatedItems[index],
      pallets: Math.max(0, value)
    };
    setSelectedItems(updatedItems);
  };
  
  const handlePalletWeightChange = (index: number, value: number) => {
    const updatedItems = [...selectedItems];
    const item = updatedItems[index];
    const newPalletWeight = Math.max(0, value);
    
    updatedItems[index] = {
      ...item,
      palletWeight: newPalletWeight
    };
    
    // Recalculate net quantity
    updatedItems[index].netQuantity = calculateNetQuantity(updatedItems[index]);
    
    setSelectedItems(updatedItems);
  };

  const handleRemoveItem = (index: number) => {
    const updatedItems = [...selectedItems];
    updatedItems.splice(index, 1);
    setSelectedItems(updatedItems);
  };

  const onSubmit = async (formData: TransferFormValues) => {
    if (selectedItems.length === 0) {
      toast({
        variant: "destructive",
        title: "Eroare",
        description: "Adăugați cel puțin un produs pentru transfer."
      });
      return;
    }

    // Verificăm dacă cantitatea netă depășește cantitatea maximă disponibilă
    const invalidItem = selectedItems.find(item => item.netQuantity > item.maxQuantity);
    if (invalidItem) {
      toast({
        variant: "destructive",
        title: "Cantitate netă depășită",
        description: `Pentru ${invalidItem.productName} cantitatea netă (${invalidItem.netQuantity.toFixed(2)} ${invalidItem.unit}) depășește stocul disponibil (${invalidItem.maxQuantity.toFixed(2)} ${invalidItem.unit}).`
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // First create a transfer document
      const { data: transferData, error: transferError } = await supabase
        .from('stock_transfers')
        .insert({
          transfer_date: formData.transferDate,
          destination: formData.destination,
          notes: formData.notes
        })
        .select()
        .single();
      
      if (transferError) throw transferError;
      
      if (!transferData) {
        throw new Error("Nu s-a putut crea bonul de transfer.");
      }
      
      // Process each item in the transfer
      for (const item of selectedItems) {
        // Add item to stock_transfer_items
        const { error: transferItemError } = await supabase
          .from('stock_transfer_items')
          .insert({
            transfer_id: transferData.id,
            inventory_item_id: item.id,
            quantity: item.grossQuantity,
            net_quantity: item.netQuantity,
            unit: item.unit
          });
          
        if (transferItemError) throw transferItemError;

        // Record the transfer in inventory_history
        const { error: historyError } = await supabase
          .from("inventory_history")
          .insert({
            inventory_item_id: item.id,
            action: "remove",
            name: item.productName,
            quantity: item.netQuantity,
            unit: item.unit,
            operation_date: new Date().toISOString(),
            supplier: item.supplier,
            supplier_id: item.supplier_id,
            manufacturer_id: item.manufacturer_id,
            document_number: item.document_number,
            crate_count: item.crateCount,
            crate_type_id: item.crateTypeId,
            crate_weight: item.crateWeight,
            notes: `Transfer către ${formData.destination}`
          });
          
        if (historyError) throw historyError;

        // Update inventory quantity
        const { data: inventoryItem, error: getError } = await supabase
          .from('inventory')
          .select('quantity')
          .eq('id', item.id)
          .single();
        
        if (getError) throw getError;
        
        const currentQuantity = inventoryItem?.quantity || 0;
        const newQuantity = Math.max(0, currentQuantity - item.netQuantity);
        
        const { error: updateError } = await supabase
          .from('inventory')
          .update({ quantity: newQuantity })
          .eq('id', item.id);
           
        if (updateError) throw updateError;
      }

      toast({
        title: "Succes",
        description: `Bon de transfer creat cu succes.`
      });

      setSelectedItems([]);
      setIsOpen(false);
      if (onTransferComplete) onTransferComplete();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Eroare la procesarea transferului",
        description: error.message
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSearchFocus = () => {
    setIsSearchFocused(true);
    
    if (isMobile) {
      // Enable manual selection mode when searching on mobile
      setIsManualSelectionMode(true);
      
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          searchInputRef.current.click();
        }
      }, 100);
    }
  };

  const availableItems = inventory.filter(
    item => !selectedItems.some(selected => selected.id === item.id)
  );

  const filteredItems = availableItems.filter(item => {
    const productName = item.products?.name || item.name || '';
    const supplierName = item.supplier || item.suppliers?.name || '';
    const manufacturerName = item.manufacturer || item.manufacturers?.name || '';
    const searchLower = searchTerm.toLowerCase();

    return productName.toLowerCase().includes(searchLower) ||
           supplierName.toLowerCase().includes(searchLower) ||
           manufacturerName.toLowerCase().includes(searchLower);
  });

  // Enhanced scroll functions with larger increments for mobile
  const scrollListUp = () => {
    if (listScrollAreaRef.current) {
      listScrollAreaRef.current.scrollTop -= 300; // Larger scroll amount for better UX
    } else {
      const selectContent = document.querySelector(".select-content-scroll");
      if (selectContent) {
        selectContent.scrollTop -= 300;
      }
    }
  };

  const scrollListDown = () => {
    if (listScrollAreaRef.current) {
      listScrollAreaRef.current.scrollTop += 300; // Larger scroll amount for better UX
    } else {
      const selectContent = document.querySelector(".select-content-scroll");
      if (selectContent) {
        selectContent.scrollTop += 300;
      }
    }
  };

  // Check if net quantity is valid
  const isNetQuantityValid = (item: TransferItem) => {
    return item.netQuantity <= item.maxQuantity;
  };
  
  // Custom product selection list instead of using the Select component's built-in options
  const renderProductSearchResults = () => {
    if (!isSearchOpen || !isManualSelectionMode) return null;
    
    return (
      <div 
        className="fixed inset-0 bg-black/40 z-50 flex flex-col"
        onClick={() => {
          setIsSearchOpen(false);
          setIsManualSelectionMode(false);
        }}
      >
        <div 
          className="mt-20 bg-white rounded-t-xl flex-1 p-4 overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
          ref={searchResultsRef}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Selectare Produse</h3>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-gray-500"
              onClick={() => {
                setIsSearchOpen(false);
                setIsManualSelectionMode(false);
              }}
            >
              Închide
            </Button>
          </div>
          
          <div
            ref={searchContainerRef}
            className="sticky top-0 bg-white z-10 border-b pb-4"
          >
            <Input
              ref={searchInputRef}
              placeholder="Caută produse..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mb-2 h-14 text-lg"
              preventMobileKeyboardDismiss={true}
              onFocus={handleSearchFocus}
              autoFocus={isMobile}
              onClick={(e) => {
                e.stopPropagation();
                searchInputRef.current?.focus();
              }}
            />
          </div>
          
          <ScrollArea className="flex-1 mt-4 pb-20" ref={listScrollAreaRef}>
            <div className="space-y-2">
              {filteredItems.length === 0 ? (
                <div className="p-3 text-center text-gray-500">
                  Nu există produse disponibile
                </div>
              ) : (
                filteredItems.map(item => (
                  <div 
                    key={item.id} 
                    className="p-4 border rounded-lg bg-gray-50 hover:bg-gray-100 active:bg-gray-200"
                    onClick={() => handleManualItemSelection(item.id)}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-lg">
                        {item.products?.name || item.name}
                      </span>
                      <span className="text-base text-gray-500">
                        Cantitate: {item.quantity} {item.unit} | Lot: {item.lot_number || 'N/A'}
                      </span>
                      <span className="text-sm text-gray-500">
                        {item.supplier || item.suppliers?.name ? 
                          `Furnizor: ${item.supplier || item.suppliers?.name}` : ''}
                        {item.manufacturer || item.manufacturers?.name ? 
                          ` | Producător: ${item.manufacturer || item.manufacturers?.name}` : ''}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
          
          {/* Fixed scroll controls at the bottom */}
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-2 flex gap-2">
            <Button 
              variant="outline"
              className="w-1/2 h-16 text-xl flex items-center justify-center"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                scrollListUp();
              }}
            >
              <ChevronUp className="h-8 w-8" />
              <span className="ml-2">Sus</span>
            </Button>
            <Button
              variant="outline" 
              className="w-1/2 h-16 text-xl flex items-center justify-center"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                scrollListDown();
              }}
            >
              <span className="mr-2">Jos</span>
              <ChevronDown className="h-8 w-8" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size={isMobile ? "default" : "sm"}>
          <FileText className="h-4 w-4 mr-2" />
          Bon de Transfer
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Creare Bon de Transfer Gestiune</DialogTitle>
          <DialogDescription>
            Transferați produse din stocul depozit către producție sau alte departamente.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="transferDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data transferului</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="destination"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Destinație</FormLabel>
                    <FormControl>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selectați destinația" />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          <SelectItem value="Producție" className="py-3 text-base">Producție</SelectItem>
                          <SelectItem value="Distrugere" className="py-3 text-base">Distrugere</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Note</FormLabel>
                  <FormControl>
                    <Input placeholder="Notițe opționale despre transfer" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="border rounded-md p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-md font-medium">Produse de transferat</h3>
                
                {/* Mobile-optimized product selection */}
                {isMobile ? (
                  <Button 
                    variant="outline"
                    className="w-full h-12 text-base"
                    onClick={() => {
                      setIsSearchOpen(true);
                      setIsManualSelectionMode(true);
                    }}
                  >
                    Adaugă produse
                  </Button>
                ) : (
                  <Select 
                    onValueChange={handleAddItem}
                    open={isSearchOpen}
                    onOpenChange={(open) => {
                      setIsSearchOpen(open);
                      if (open) {
                        setSearchTerm("");
                        setIsSearchFocused(true);
                        setTimeout(() => {
                          if (searchInputRef.current) {
                            searchInputRef.current.focus();
                          }
                        }, 300);
                      } else {
                        setIsSearchFocused(false);
                      }
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-[400px]">
                      <SelectValue placeholder="Adăugați un produs" />
                    </SelectTrigger>
                    <SelectContent className="bg-white select-content-scroll">
                      <div 
                        className="px-3 py-2 sticky top-0 bg-white z-10 border-b"
                        ref={searchContainerRef}
                      >
                        <Input
                          ref={searchInputRef}
                          placeholder="Caută produse..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="mb-2"
                          onFocus={handleSearchFocus}
                        />
                      </div>
                      
                      <div ref={listScrollAreaRef}>
                        <ScrollArea className="max-h-[40vh]">
                          {filteredItems.length === 0 ? (
                            <div className="p-3 text-center text-gray-500">
                              Nu există produse disponibile
                            </div>
                          ) : (
                            filteredItems.map(item => (
                              <SelectItem 
                                key={item.id} 
                                value={item.id} 
                                className="py-3"
                              >
                                <div className="flex flex-col">
                                  <span className="font-medium">
                                    {item.products?.name || item.name}
                                  </span>
                                  <span className="text-sm text-gray-500">
                                    Cantitate: {item.quantity} {item.unit} | Lot: {item.lot_number || 'N/A'}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {item.supplier || item.suppliers?.name ? 
                                      `Furnizor: ${item.supplier || item.suppliers?.name}` : ''}
                                    {item.manufacturer || item.manufacturers?.name ? 
                                      ` | Producător: ${item.manufacturer || item.manufacturers?.name}` : ''}
                                  </span>
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </ScrollArea>
                      </div>
                    </SelectContent>
                  </Select>
                )}
              </div>

              {selectedItems.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>Niciun produs selectat</p>
                  <p className="text-sm mt-2">Folosiți meniul pentru a adăuga produse pentru transfer</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[300px] overflow-y-auto">
                  {selectedItems.map((item, index) => (
                    <div key={index} className="flex flex-col gap-3 p-3 border rounded-md bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-500">
                            Lot: {item.lot_number || '-'}
                          </p>
                          <p className="text-xs text-gray-500">
                            Furnizor: {item.supplier || '-'}
                          </p>
                          <p className="text-xs text-gray-500">
                            Document: {item.document_number || '-'} | Intrare nr.: {item.entry_number || '-'}
                          </p>
                        </div>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className={`${isMobile ? 'h-10 w-10' : 'h-8 w-8'} p-0`}
                          onClick={() => handleRemoveItem(index)}
                        >
                          &times;
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        <div>
                          <label className="text-sm">Cantitate brută {item.unit}</label>
                          <Input
                            type="number"
                            value={item.grossQuantity}
                            onChange={(e) => handleGrossQuantityChange(index, parseFloat(e.target.value) || 0)}
                            min={0}
                            step="0.01"
                            variant={!isNetQuantityValid(item) ? "warning" : "default"}
                            className={isMobile ? 'h-12' : ''}
                          />
                        </div>
                        
                        {item.crateTypeId && (
                          <div>
                            <label className="text-sm">Număr lădițe</label>
                            <Input
                              type="number"
                              value={item.crateCount}
                              onChange={(e) => handleCrateCountChange(index, parseInt(e.target.value) || 0)}
                              min={0}
                              className={isMobile ? 'h-12' : ''}
                            />
                          </div>
                        )}
                        
                        <div>
                          <label className="text-sm">Număr paleți</label>
                          <Input
                            type="number"
                            value={item.pallets}
                            onChange={(e) => handlePalletsChange(index, parseInt(e.target.value) || 0)}
                            min={0}
                            className={isMobile ? 'h-12' : ''}
                          />
                        </div>
                        
                        <div>
                          <label className="text-sm">Greutate paleți (kg)</label>
                          <Input
                            type="number"
                            value={item.palletWeight}
                            onChange={(e) => handlePalletWeightChange(index, parseFloat(e.target.value) || 0)}
                            min={0}
                            step="0.01"
                            className={isMobile ? 'h-12' : ''}
                          />
                        </div>
                        
                        <div>
                          <label className="text-sm font-medium">Cantitate netă (se va extrage)</label>
                          <Input
                            type="number"
                            value={item.netQuantity.toFixed(2)}
                            readOnly
                            className={`bg-gray-100 font-medium ${isMobile ? 'h-12' : ''}`}
                            variant={!isNetQuantityValid(item) ? "warning" : "default"}
                          />
                          {!isNetQuantityValid(item) && (
                            <p className="text-xs text-amber-600 mt-1">
                              Atenție: Cantitatea netă depășește stocul disponibil de {item.maxQuantity.toFixed(2)} {item.unit}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Anulează
              </Button>
              <Button 
                type="submit" 
                disabled={selectedItems.length === 0 || isSubmitting}
                className={isMobile ? 'h-14 text-base' : ''}
              >
                {isSubmitting ? "Se procesează..." : "Creare bon de transfer"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
      
      {/* Render the mobile product selection UI */}
      {renderProductSearchResults()}
    </Dialog>
  );
}
