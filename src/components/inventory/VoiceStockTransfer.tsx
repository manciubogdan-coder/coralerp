
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusCircle, Mic, MicOff, Trash, Send } from "lucide-react";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import VoiceInputButton from "@/components/VoiceInputButton";
import VoiceTranscript from "@/components/VoiceTranscript";
import { toast } from "@/hooks/use-custom-toast";
import { supabase } from "@/integrations/supabase/client";
import { parseUserResponse } from "@/lib/speechService";
import { InventoryItem, Product } from "@/types";

interface VoiceStockTransferProps {
  onTransferComplete: () => void;
  products: Product[];
}

export const VoiceStockTransfer = ({ onTransferComplete, products }: VoiceStockTransferProps) => {
  const [open, setOpen] = useState(false);
  const { isRecording, transcript, finalTranscript, toggleRecording, processCommand } = useVoiceInput();
  const [transferData, setTransferData] = useState<{
    destination: string;
    notes: string;
    items: {
      productId: string;
      productName: string;
      quantity: number;
      unit: string;
      lotNumber?: string;
    }[];
  }>({
    destination: '',
    notes: '',
    items: []
  });

  // Procesează transcriptul final când devine disponibil
  useEffect(() => {
    if (!finalTranscript || !open) return;
    
    const processFinalTranscript = () => {
      const lowercaseText = finalTranscript.toLowerCase();
      
      // Identifică tipul comenzii
      if (lowercaseText.includes('destinație') || lowercaseText.includes('destinatia') || lowercaseText.includes('pentru')) {
        // Comandă pentru setarea destinației
        const destinationMatch = lowercaseText.match(/(?:destinație|destinatia|pentru)\s+([a-zăîâșțĂÎÂȘȚ\s]+)/i);
        if (destinationMatch && destinationMatch[1]) {
          setTransferData(prev => ({
            ...prev,
            destination: destinationMatch[1].trim()
          }));
          toast({
            title: "Destinație setată",
            description: `Destinație: ${destinationMatch[1].trim()}`
          });
        }
      } 
      else if (lowercaseText.includes('adaugă') || lowercaseText.includes('adauga')) {
        // Comandă pentru adăugarea unui produs
        const productMatch = lowercaseText.match(/adaug[ăa]\s+([0-9,.]+)\s*(kg|litri|litru|l|buc)\s+(?:de\s+)?([a-zăîâșțĂÎÂȘȚ\s]+)/i);
        
        if (productMatch) {
          const quantity = parseFloat(productMatch[1].replace(',', '.'));
          const unit = productMatch[2];
          const productName = productMatch[3].trim();
          
          // Caută produsul în lista de produse
          const foundProduct = products.find(p => 
            p.name.toLowerCase().includes(productName.toLowerCase())
          );
          
          if (foundProduct) {
            const newItem = {
              productId: foundProduct.id,
              productName: foundProduct.name,
              quantity,
              unit: unit === 'litri' || unit === 'litru' ? 'l' : unit
            };
            
            setTransferData(prev => ({
              ...prev,
              items: [...prev.items, newItem]
            }));
            
            toast({
              title: "Produs adăugat",
              description: `${quantity} ${unit} de ${foundProduct.name}`,
              variant: "default"
            });
          } else {
            toast({
              title: "Produs negăsit",
              description: `Nu am găsit produsul "${productName}" în baza de date`,
              variant: "warning"
            });
          }
        } else {
          toast({
            title: "Format incorect",
            description: "Folosiți formatul: 'adaugă [cantitate] [unitate] de [produs]'",
            variant: "warning"
          });
        }
      }
      else if (lowercaseText.includes('notă') || lowercaseText.includes('nota') || lowercaseText.includes('observații')) {
        // Comandă pentru adăugarea unei note
        const noteMatch = lowercaseText.match(/(?:notă|nota|observații)\s+(.+)/i);
        if (noteMatch && noteMatch[1]) {
          setTransferData(prev => ({
            ...prev,
            notes: noteMatch[1].trim()
          }));
          toast({
            title: "Notă adăugată",
            description: `Notă: ${noteMatch[1].trim()}`,
            variant: "default"
          });
        }
      }
      else if (lowercaseText.includes('șterge') || lowercaseText.includes('sterge') || lowercaseText.includes('elimină') || lowercaseText.includes('elimina')) {
        // Comandă pentru ștergerea unui produs
        const deleteMatch = lowercaseText.match(/(?:șterge|sterge|elimină|elimina)\s+([a-zăîâșțĂÎÂȘȚ\s]+)/i);
        if (deleteMatch && deleteMatch[1]) {
          const productToDelete = deleteMatch[1].trim();
          
          const itemIndex = transferData.items.findIndex(item => 
            item.productName.toLowerCase().includes(productToDelete.toLowerCase())
          );
          
          if (itemIndex !== -1) {
            const updatedItems = [...transferData.items];
            updatedItems.splice(itemIndex, 1);
            
            setTransferData(prev => ({
              ...prev,
              items: updatedItems
            }));
            
            toast({
              title: "Produs eliminat",
              description: `Am eliminat ${productToDelete} din lista de transfer`,
              variant: "default"
            });
          } else {
            toast({
              title: "Produs negăsit",
              description: `Nu am găsit produsul "${productToDelete}" în lista curentă`,
              variant: "warning"
            });
          }
        }
      }
      else if (lowercaseText.includes('finalizează') || lowercaseText.includes('finalizeaza') || lowercaseText.includes('trimite') || lowercaseText.includes('salvează')) {
        // Comandă pentru finalizarea și trimiterea transferului
        handleTransferSubmit();
      }
      else {
        toast({
          title: "Comandă necunoscută",
          description: "Încercați: 'destinație [locatie]', 'adaugă [cantitate] [unitate] de [produs]', 'notă [text]', 'șterge [produs]' sau 'finalizează'",
          variant: "warning"
        });
      }
    };
    
    processFinalTranscript();
  }, [finalTranscript, open, products, transferData.items]);

  const handleTransferSubmit = async () => {
    if (!transferData.destination) {
      toast({
        title: "Destinație lipsă",
        description: "Vă rugăm să specificați o destinație pentru transfer",
        variant: "warning"
      });
      return;
    }

    if (transferData.items.length === 0) {
      toast({
        title: "Produse lipsă",
        description: "Vă rugăm să adăugați cel puțin un produs pentru transfer",
        variant: "warning"
      });
      return;
    }

    try {
      // Creează transferul în baza de date
      const { data: transferData_, error: transferError } = await supabase
        .from('stock_transfers')
        .insert({
          destination: transferData.destination,
          notes: transferData.notes || null
        })
        .select('id')
        .single();

      if (transferError) throw transferError;

      // Adaugă produsele la transfer
      for (const item of transferData.items) {
        // Obține produsul din inventar
        const { data: inventoryItems, error: inventoryError } = await supabase
          .from('inventory')
          .select('id, quantity, unit')
          .eq('product_id', item.productId)
          .gt('quantity', 0)
          .order('created_at', { ascending: false })
          .limit(1);

        if (inventoryError) throw inventoryError;
        
        if (!inventoryItems || inventoryItems.length === 0) {
          toast({
            title: "Eroare",
            description: `Produsul ${item.productName} nu mai are stoc disponibil`,
            variant: "destructive"
          });
          continue;
        }

        const inventoryItem = inventoryItems[0];

        // Adaugă elementul la transfer
        const { error: insertError } = await supabase
          .from('stock_transfer_items')
          .insert({
            transfer_id: transferData_.id,
            inventory_item_id: inventoryItem.id,
            quantity: item.quantity,
            unit: item.unit
          });

        if (insertError) throw insertError;

        // Actualizează cantitatea în stoc - Fixed type error by using rpc as a direct function call
        const { error: updateError } = await supabase
          .rpc('decrement_quantity', {
            item_id: inventoryItem.id,
            decrement_by: item.quantity,
            exit_document: transferData.destination
          });

        if (updateError) throw updateError;
      }

      toast({
        title: "Transfer finalizat",
        description: "Transferul a fost înregistrat cu succes",
        variant: "default"
      });

      // Resetează formularul și închide dialogul
      setTransferData({
        destination: '',
        notes: '',
        items: []
      });
      setOpen(false);
      onTransferComplete();
    } catch (error) {
      console.error("Eroare la procesarea transferului:", error);
      toast({
        title: "Eroare",
        description: "A apărut o eroare la procesarea transferului",
        variant: "destructive"
      });
    }
  };

  const removeItem = (index: number) => {
    const updatedItems = [...transferData.items];
    updatedItems.splice(index, 1);
    setTransferData(prev => ({ ...prev, items: updatedItems }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <PlusCircle className="h-4 w-4 mr-2" /> Transfer Vocal
        </Button>
      </DialogTrigger>

      <DialogContent className="md:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Transfer stoc - comandă vocală</span>
            <VoiceInputButton 
              isRecording={isRecording} 
              toggleRecording={toggleRecording} 
              className="ml-2" 
            />
          </DialogTitle>
        </DialogHeader>

        <VoiceTranscript transcript={transcript} isRecording={isRecording} />

        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor="destination">Destinație</Label>
            <Input 
              id="destination" 
              value={transferData.destination} 
              onChange={e => setTransferData(prev => ({ ...prev, destination: e.target.value }))} 
              placeholder="Spune: 'destinație [locația]'"
            />
          </div>

          <div>
            <Label htmlFor="notes">Observații</Label>
            <Input 
              id="notes" 
              value={transferData.notes} 
              onChange={e => setTransferData(prev => ({ ...prev, notes: e.target.value }))} 
              placeholder="Spune: 'notă [textul observației]'"
            />
          </div>

          <div>
            <Label>Produse</Label>
            <div className="mt-2 border rounded-md divide-y">
              {transferData.items.length > 0 ? (
                transferData.items.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-2 hover:bg-gray-50">
                    <div>
                      <span className="font-medium">{item.productName}</span>
                      <span className="ml-2 text-sm text-gray-600">
                        {item.quantity} {item.unit}
                      </span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeItem(index)}>
                      <Trash className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))
              ) : (
                <p className="p-4 text-center text-gray-500 text-sm italic">
                  Nu există produse adăugate. <br />
                  Spune: "adaugă [cantitate] [unitate] de [produs]"
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Anulează</Button>
            <Button 
              variant="default" 
              onClick={handleTransferSubmit}
              disabled={transferData.destination.trim() === '' || transferData.items.length === 0}
              className="flex items-center"
            >
              <Send className="h-4 w-4 mr-2" /> Finalizează transfer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
