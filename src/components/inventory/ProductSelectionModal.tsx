
import React, { useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronUp, ChevronDown, X, Search } from "lucide-react";
import { InventoryItem } from "@/types";

interface ProductSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: InventoryItem[];
  onProductSelect: (id: string) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
}

export function ProductSelectionModal({
  isOpen,
  onClose,
  inventory,
  onProductSelect,
  searchTerm,
  setSearchTerm
}: ProductSelectionModalProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listScrollAreaRef = useRef<HTMLDivElement>(null);

  // Force focus on the search input when modal opens
  useEffect(() => {
    if (isOpen) {
      // Delay focus to ensure animation is complete
      const focusTimeout = setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 300);
      
      return () => clearTimeout(focusTimeout);
    }
  }, [isOpen]);
  
  // Prevent body scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);
  
  // Enhanced scroll functions with larger increments for mobile
  const scrollListUp = () => {
    if (listScrollAreaRef.current) {
      listScrollAreaRef.current.scrollTop -= 300;
    }
  };

  const scrollListDown = () => {
    if (listScrollAreaRef.current) {
      listScrollAreaRef.current.scrollTop += 300;
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/70 z-50 flex flex-col" 
      onClick={onClose}
    >
      <div 
        className="mt-12 bg-white rounded-t-xl flex-1 p-4 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4 sticky top-0 bg-white">
          <h3 className="text-lg font-semibold">Selectare Produse</h3>
          <Button 
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-10 w-10"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="sticky top-12 bg-white z-10 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              ref={searchInputRef}
              placeholder="Caută produse..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mb-2 h-14 text-lg pl-10"
            />
            {searchTerm && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="absolute right-2 top-3"
                onClick={() => setSearchTerm('')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        
        {/* Main content area with products */}
        <div 
          ref={listScrollAreaRef}
          className="flex-1 overflow-auto"
        >
          <div className="space-y-2 pb-20">
            {inventory.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                Nu există produse disponibile
              </div>
            ) : (
              inventory.map(item => (
                <div 
                  key={item.id} 
                  className="p-4 border rounded-lg bg-gray-50 hover:bg-gray-100 active:bg-gray-200"
                  onClick={() => onProductSelect(item.id)}
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
        </div>
        
        {/* Sticky navigation buttons at the bottom */}
        <div className="sticky bottom-0 left-0 right-0 bg-white border-t p-2 flex gap-2">
          <Button 
            variant="outline"
            className="w-1/2 h-14 text-lg flex items-center justify-center"
            onClick={(e) => {
              e.stopPropagation();
              scrollListUp();
            }}
          >
            <ChevronUp className="h-6 w-6" />
            <span className="ml-2">Sus</span>
          </Button>
          <Button
            variant="outline" 
            className="w-1/2 h-14 text-lg flex items-center justify-center"
            onClick={(e) => {
              e.stopPropagation();
              scrollListDown();
            }}
          >
            <span className="mr-2">Jos</span>
            <ChevronDown className="h-6 w-6" />
          </Button>
        </div>
      </div>
    </div>
  );
}
