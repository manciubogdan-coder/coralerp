import React, { useState, useEffect, useRef } from 'react';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Mic, MicOff, MessageSquare } from "lucide-react";
import { speakText } from "@/lib/speechService";
import { toast } from "@/hooks/use-custom-toast";
import { useInventoryData } from "@/hooks/use-inventory-data";
import { supabase } from "@/integrations/supabase/client";

interface ConversationalVoiceAssistantProps {
  onOperationComplete: () => void;
}

interface ConversationMessage {
  role: 'assistant' | 'user';
  message: string;
  timestamp: Date;
}

export const ConversationalVoiceAssistant = ({ onOperationComplete }: ConversationalVoiceAssistantProps) => {
  const [open, setOpen] = useState(false);
  const { 
    isRecording, 
    transcript, 
    finalTranscript, 
    toggleRecording,
    startConversation,
    processConversationStep,
    endConversation,
    conversationMode,
    currentStep,
    collectedData
  } = useVoiceInput();
  
  const { suppliers, products, manufacturers, crateTypes, fetchInventory } = useInventoryData();
  
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [inactivityTimer, setInactivityTimer] = useState<NodeJS.Timeout | null>(null);
  const conversationEndedRef = useRef(false);
  const [assistantInitiative, setAssistantInitiative] = useState(false);
  
  // Adaugă un mesaj în conversație
  const addMessage = (role: 'assistant' | 'user', message: string) => {
    setConversation(prev => [...prev, {
      role,
      message,
      timestamp: new Date()
    }]);
  };
  
  // Funcția pentru a face asistentul să vorbească
  const assistantSays = (message: string) => {
    addMessage('assistant', message);
    speakText(message);
  };
  
  // Resetează timerul de inactivitate
  const resetInactivityTimer = () => {
    if (inactivityTimer) {
      clearTimeout(inactivityTimer);
    }
    
    const timer = setTimeout(() => {
      if (open && conversationMode !== 'idle' && !conversationEndedRef.current) {
        assistantSays("Se pare că nu mai există activitate. Mai pot să te ajut cu ceva?");
        setAssistantInitiative(true);
      }
    }, 30000); // 30 secunde
    
    setInactivityTimer(timer);
  };
  
  // Începe conversația când dialogul se deschide
  useEffect(() => {
    if (open && conversationMode === 'idle') {
      setConversation([]);
      conversationEndedRef.current = false;
      setAssistantInitiative(true);
      setTimeout(() => {
        const greeting = "Salut! Eu sunt asistentul tău pentru gestionarea stocului. Cu ce te pot ajuta astăzi? Poți să-mi spui dacă vrei să faci o recepție de marfă, un transfer de stoc sau să introduci marfă din producție.";
        assistantSays(greeting);
        startConversation('greeting');
        resetInactivityTimer();
      }, 500);
    }
    
    return () => {
      if (inactivityTimer) {
        clearTimeout(inactivityTimer);
      }
    };
  }, [open, conversationMode, startConversation]);
  
  // Procesează transcriptul când devine disponibil
  useEffect(() => {
    if (!finalTranscript || conversationMode === 'idle' || !open) return;
    
    console.log(`Procesez transcriptul pentru pasul ${currentStep}:`, finalTranscript);
    addMessage('user', finalTranscript);
    setAssistantInitiative(true);
    resetInactivityTimer();
    
    const processTranscript = async () => {
      switch (currentStep) {
        case 'greeting':
          // Determinăm operațiunea
          const operation = determineOperation(finalTranscript);
          if (operation === 'unknown') {
            assistantSays("Nu am înțeles ce operațiune dorești să faci. Te rog să-mi spui din nou dacă vrei să faci o recepție de marfă, un transfer de stoc sau să introduci marfă din producție.");
            processConversationStep('', 'greeting');
          } else {
            processConversationStep('', 'askProduct', { operation });
            
            if (operation === 'reception') {
              assistantSays("Bun, vom face o recepție de marfă. Ce produs dorești să recepționezi?");
            } else if (operation === 'transfer') {
              assistantSays("Perfect, vom face un transfer de stoc. Ce produs dorești să transferi?");
            } else if (operation === 'production') {
              assistantSays("Ok, vom introduce marfă din producție. Ce produs dorești să introduci?");
            }
          }
          break;
          
        case 'askOperation':
          const operationDirect = determineOperation(finalTranscript);
          if (operationDirect === 'unknown') {
            assistantSays("Nu am înțeles ce operațiune dorești să faci. Te rog să-mi spui din nou dacă vrei să faci o recepție de marfă, un transfer de stoc sau să introduci marfă din producție.");
            processConversationStep('', 'askOperation');
          } else {
            processConversationStep('', 'askProduct', { operation: operationDirect });
            
            if (operationDirect === 'reception') {
              assistantSays("Bun, vom face o recepție de marfă. Ce produs dorești să recepționezi?");
            } else if (operationDirect === 'transfer') {
              assistantSays("Perfect, vom face un transfer de stoc. Ce produs dorești să transferi?");
            } else if (operationDirect === 'production') {
              assistantSays("Ok, vom introduce marfă din producție. Ce produs dorești să introduci?");
            }
          }
          break;
        
        case 'askProduct': {
          const productName = finalTranscript.toLowerCase();
          const foundProduct = products.find(p => 
            p.name.toLowerCase().includes(productName) || 
            productName.includes(p.name.toLowerCase())
          );
          
          if (foundProduct) {
            processConversationStep('', 'askQuantity', { 
              productId: foundProduct.id,
              productName: foundProduct.name,
              unit: foundProduct.default_unit
            });
            assistantSays(`Am găsit produsul ${foundProduct.name}. Ce cantitate dorești să ${collectedData.operation === 'reception' ? 'recepționezi' : collectedData.operation === 'transfer' ? 'transferi' : 'introduci'}?`);
          } else {
            const closestMatch = findClosestMatch(productName, products.map(p => p.name));
            if (closestMatch) {
              assistantSays(`Nu am găsit exact produsul menționat. Te referi la ${closestMatch}? Răspunde cu da sau nu.`);
              processConversationStep('', 'confirmProduct', { suggestedProduct: closestMatch });
            } else {
              assistantSays("Nu am găsit acest produs în baza de date. Te rog să încerci din nou sau să spui un alt produs.");
              processConversationStep('', 'askProduct');
            }
          }
          break;
        }
        
        case 'confirmProduct': {
          const confirmation = finalTranscript.toLowerCase();
          if (confirmation.includes('da') || confirmation.includes('correct') || confirmation.includes('exact')) {
            const foundProduct = products.find(p => p.name === collectedData.suggestedProduct);
            if (foundProduct) {
              processConversationStep('', 'askQuantity', { 
                productId: foundProduct.id,
                productName: foundProduct.name,
                unit: foundProduct.default_unit,
                suggestedProduct: undefined
              });
              assistantSays(`Perfect! Ce cantitate de ${foundProduct.name} dorești să ${collectedData.operation === 'reception' ? 'recepționezi' : collectedData.operation === 'transfer' ? 'transferi' : 'introduci'}?`);
            }
          } else {
            assistantSays("Te rog să-mi spui din nou ce produs dorești să gestionezi.");
            processConversationStep('', 'askProduct', { suggestedProduct: undefined });
          }
          break;
        }
        
        case 'askQuantity': {
          const quantity = extractNumber(finalTranscript);
          if (quantity > 0) {
            processConversationStep('', 'askUnit', { quantity });
            assistantSays(`Am înregistrat cantitatea de ${quantity}. În ce unitate de măsură? De exemplu: ${collectedData.unit || 'kg, litri sau bucăți'}.`);
          } else {
            assistantSays("Te rog să specifici o cantitate validă, de exemplu: 5 kg sau 10 bucăți.");
            processConversationStep('', 'askQuantity');
          }
          break;
        }
        
        case 'askUnit': {
          const unit = extractUnit(finalTranscript);
          if (unit) {
            processConversationStep('', collectedData.operation === 'reception' ? 'askSupplier' : 'askDestination', { unit });
            
            if (collectedData.operation === 'reception') {
              assistantSays(`Am înregistrat unitatea de măsură ${unit}. De la ce furnizor primești produsul?`);
            } else if (collectedData.operation === 'transfer') {
              assistantSays(`Am înregistrat unitatea de măsură ${unit}. Către ce destinație transferi produsul?`);
            } else {
              assistantSays(`Am înregistrat unitatea de măsură ${unit}. Care este lotul de producție?`);
            }
          } else {
            assistantSays(`Te rog să specifici o unitate de măsură validă, de exemplu: ${collectedData.unit || 'kg, litri sau bucăți'}.`);
            processConversationStep('', 'askUnit');
          }
          break;
        }
        
        case 'askSupplier': {
          const supplierName = finalTranscript.toLowerCase();
          const foundSupplier = suppliers.find(s => 
            s.name.toLowerCase().includes(supplierName) || 
            supplierName.includes(s.name.toLowerCase())
          );
          
          if (foundSupplier) {
            processConversationStep('', 'askManufacturer', { 
              supplierId: foundSupplier.id,
              supplierName: foundSupplier.name 
            });
            assistantSays(`Am înregistrat furnizorul ${foundSupplier.name}. Cine este producătorul?`);
          } else {
            const closestMatch = findClosestMatch(supplierName, suppliers.map(s => s.name));
            if (closestMatch) {
              assistantSays(`Nu am găsit exact acest furnizor. Te referi la ${closestMatch}? Răspunde cu da sau nu.`);
              processConversationStep('', 'confirmSupplier', { suggestedSupplier: closestMatch });
            } else {
              assistantSays("Nu am găsit acest furnizor în baza de date. Te rog să încerci din nou sau să specifici un alt furnizor.");
              processConversationStep('', 'askSupplier');
            }
          }
          break;
        }
        
        case 'confirmSupplier': {
          const confirmation = finalTranscript.toLowerCase();
          if (confirmation.includes('da') || confirmation.includes('correct') || confirmation.includes('exact')) {
            const foundSupplier = suppliers.find(s => s.name === collectedData.suggestedSupplier);
            if (foundSupplier) {
              processConversationStep('', 'askManufacturer', { 
                supplierId: foundSupplier.id,
                supplierName: foundSupplier.name,
                suggestedSupplier: undefined
              });
              assistantSays(`Perfect! Cine este producătorul pentru produsul ${collectedData.productName}?`);
            }
          } else {
            assistantSays("Te rog să-mi spui din nou numele furnizorului.");
            processConversationStep('', 'askSupplier', { suggestedSupplier: undefined });
          }
          break;
        }
        
        case 'askManufacturer': {
          const manufacturerName = finalTranscript.toLowerCase();
          const foundManufacturer = manufacturers.find(m => 
            m.name.toLowerCase().includes(manufacturerName) || 
            manufacturerName.includes(m.name.toLowerCase())
          );
          
          if (foundManufacturer) {
            processConversationStep('', 'askLot', { 
              manufacturerId: foundManufacturer.id,
              manufacturerName: foundManufacturer.name 
            });
            assistantSays(`Am înregistrat producătorul ${foundManufacturer.name}. Care este numărul de lot?`);
          } else {
            const closestMatch = findClosestMatch(manufacturerName, manufacturers.map(m => m.name));
            if (closestMatch) {
              assistantSays(`Nu am găsit exact acest producător. Te referi la ${closestMatch}? Răspunde cu da sau nu.`);
              processConversationStep('', 'confirmManufacturer', { suggestedManufacturer: closestMatch });
            } else {
              assistantSays("Nu am găsit acest producător în baza de date. Te rog să încerci din nou sau să specifici un alt producător.");
              processConversationStep('', 'askManufacturer');
            }
          }
          break;
        }
        
        case 'confirmManufacturer': {
          const confirmation = finalTranscript.toLowerCase();
          if (confirmation.includes('da') || confirmation.includes('correct') || confirmation.includes('exact')) {
            const foundManufacturer = manufacturers.find(m => m.name === collectedData.suggestedManufacturer);
            if (foundManufacturer) {
              processConversationStep('', 'askLot', { 
                manufacturerId: foundManufacturer.id,
                manufacturerName: foundManufacturer.name,
                suggestedManufacturer: undefined
              });
              assistantSays(`Perfect! Care este numărul de lot pentru produsul ${collectedData.productName}?`);
            }
          } else {
            assistantSays("Te rog să-mi spui din nou numele producătorului.");
            processConversationStep('', 'askManufacturer', { suggestedManufacturer: undefined });
          }
          break;
        }
        
        case 'askLot': {
          const lotNumber = finalTranscript.replace(/[^a-zA-Z0-9]/g, '');
          processConversationStep('', 'askDocumentNumber', { lotNumber });
          assistantSays(`Am înregistrat numărul de lot ${lotNumber}. Care este numărul documentului (factură, aviz)?`);
          break;
        }
        
        case 'askDocumentNumber': {
          const docNumber = finalTranscript.replace(/[^a-zA-Z0-9]/g, '');
          processConversationStep('', 'askCrateInfo', { documentNumber: docNumber });
          assistantSays(`Am înregistrat numărul documentului ${docNumber}. Produsul este ambalat în lădițe? Răspunde cu da sau nu.`);
          break;
        }
        
        case 'askCrateInfo': {
          const answer = finalTranscript.toLowerCase();
          if (answer.includes('da') || answer.includes('sunt') || answer.includes('este')) {
            processConversationStep('', 'askCrateType', { hasCrates: true });
            assistantSays("Ce tip de lădiță folosești?");
          } else {
            processConversationStep('', 'confirmOperation', { hasCrates: false });
            const details = summarizeOperation();
            assistantSays(`Perfect! Am colectat toate informațiile necesare. Detaliile operațiunii sunt: ${details}. Dorești să confirmi operațiunea? Răspunde cu da sau nu.`);
          }
          break;
        }
        
        case 'askCrateType': {
          const crateTypeName = finalTranscript.toLowerCase();
          const foundCrateType = crateTypes.find(ct => 
            ct.name.toLowerCase().includes(crateTypeName) || 
            crateTypeName.includes(ct.name.toLowerCase())
          );
          
          if (foundCrateType) {
            processConversationStep('', 'askCrateCount', { 
              crateTypeId: foundCrateType.id,
              crateTypeName: foundCrateType.name,
              crateWeight: foundCrateType.weight
            });
            assistantSays(`Am înregistrat tipul de lădiță ${foundCrateType.name}. Câte lădițe sunt?`);
          } else {
            const closestMatch = findClosestMatch(crateTypeName, crateTypes.map(ct => ct.name));
            if (closestMatch) {
              assistantSays(`Nu am găsit exact acest tip de lădiță. Te referi la ${closestMatch}? Răspunde cu da sau nu.`);
              processConversationStep('', 'confirmCrateType', { suggestedCrateType: closestMatch });
            } else {
              assistantSays("Nu am găsit acest tip de lădiță în baza de date. Te rog să încerci din nou sau să specifici un alt tip.");
              processConversationStep('', 'askCrateType');
            }
          }
          break;
        }
        
        case 'confirmCrateType': {
          const confirmation = finalTranscript.toLowerCase();
          if (confirmation.includes('da') || confirmation.includes('correct') || confirmation.includes('exact')) {
            const foundCrateType = crateTypes.find(ct => ct.name === collectedData.suggestedCrateType);
            if (foundCrateType) {
              processConversationStep('', 'askCrateCount', { 
                crateTypeId: foundCrateType.id,
                crateTypeName: foundCrateType.name,
                crateWeight: foundCrateType.weight,
                suggestedCrateType: undefined
              });
              assistantSays(`Perfect! Câte lădițe de tip ${foundCrateType.name} sunt?`);
            }
          } else {
            assistantSays("Te rog să-mi spui din nou tipul de lădiță.");
            processConversationStep('', 'askCrateType', { suggestedCrateType: undefined });
          }
          break;
        }
        
        case 'askCrateCount': {
          const crateCount = extractNumber(finalTranscript);
          if (crateCount > 0) {
            processConversationStep('', 'confirmOperation', { crateCount });
            const details = summarizeOperation();
            assistantSays(`Perfect! Am colectat toate informațiile necesare. Detaliile operațiunii sunt: ${details}. Dorești să confirmi operațiunea? Răspunde cu da sau nu.`);
          } else {
            assistantSays("Te rog să specifici un număr valid de lădițe.");
            processConversationStep('', 'askCrateCount');
          }
          break;
        }
        
        case 'askDestination': {
          const destination = finalTranscript;
          processConversationStep('', 'confirmOperation', { destination });
          const details = summarizeOperation();
          assistantSays(`Perfect! Am colectat toate informațiile necesare. Detaliile operațiunii sunt: ${details}. Dorești să confirmi operațiunea? Răspunde cu da sau nu.`);
          break;
        }
        
        case 'confirmOperation': {
          const confirmation = finalTranscript.toLowerCase();
          if (confirmation.includes('da') || confirmation.includes('confirm') || confirmation.includes('accept')) {
            processConversationStep('', 'processingOperation');
            assistantSays("Procesez operațiunea, te rog să aștepți un moment...");
            
            // Executăm operațiunea în funcție de tipul acesteia
            if (collectedData.operation === 'reception') {
              await performReception();
            } else if (collectedData.operation === 'transfer') {
              await performTransfer();
            } else if (collectedData.operation === 'production') {
              await performProduction();
            }
          } else {
            endConversation();
            assistantSays("Operațiunea a fost anulată. Mulțumesc pentru informații!");
            conversationEndedRef.current = true;
            setTimeout(() => {
              assistantSays("Mai pot să te ajut cu altceva? Spune-mi dacă dorești să faci o altă operațiune sau să închei conversația.");
              processConversationStep('', 'askForMoreHelp');
            }, 2000);
          }
          break;
        }
        
        case 'askForMoreHelp': {
          const response = finalTranscript.toLowerCase();
          if (response.includes('da') || response.includes('ajut') || response.includes('altceva')) {
            assistantSays("Cu ce te mai pot ajuta? Poți să-mi spui dacă vrei să faci o recepție de marfă, un transfer de stoc sau să introduci marfă din producție.");
            processConversationStep('', 'askOperation');
          } else {
            assistantSays("Mulțumesc pentru conversație! Să ai o zi bună! Când mai ai nevoie de ajutor, sunt aici.");
            conversationEndedRef.current = true;
            setTimeout(() => {
              setOpen(false);
              endConversation();
            }, 3000);
          }
          break;
        }
        
        case 'finishingConversation': {
          assistantSays("Mulțumesc pentru conversație! Să ai o zi bună! Când mai ai nevoie de ajutor, sunt aici.");
          conversationEndedRef.current = true;
          setTimeout(() => {
            setOpen(false);
            endConversation();
          }, 3000);
          break;
        }
      }
    };
    
    processTranscript();
  }, [finalTranscript, currentStep, conversationMode, open, products, suppliers, manufacturers, crateTypes, collectedData, processConversationStep, assistantSays, endConversation, fetchInventory, onOperationComplete]);
  
  // Funcție pentru a determina tipul de operațiune din transcriptul utilizatorului
  const determineOperation = (text: string): 'reception' | 'transfer' | 'production' | 'unknown' => {
    const lowercaseText = text.toLowerCase();
    
    if (lowercaseText.includes('recepți') || 
        lowercaseText.includes('primire') || 
        lowercaseText.includes('primesc') || 
        lowercaseText.includes('intra') || 
        lowercaseText.includes('adaug')) {
      return 'reception';
    }
    
    if (lowercaseText.includes('transfer') || 
        lowercaseText.includes('muta') || 
        lowercaseText.includes('deplasare') || 
        lowercaseText.includes('scoate')) {
      return 'transfer';
    }
    
    if (lowercaseText.includes('producți') || 
        lowercaseText.includes('fabric') || 
        lowercaseText.includes('produ')) {
      return 'production';
    }
    
    return 'unknown';
  };
  
  // Funcție pentru a extrage un număr din text
  const extractNumber = (text: string): number => {
    const match = text.match(/\d+([.,]\d+)?/);
    if (match) {
      return parseFloat(match[0].replace(',', '.'));
    }
    return 0;
  };
  
  // Funcție pentru a extrage unitatea de măsură din text
  const extractUnit = (text: string): string | null => {
    const lowercaseText = text.toLowerCase();
    
    if (lowercaseText.includes('kg') || lowercaseText.includes('kilo')) {
      return 'kg';
    }
    
    if (lowercaseText.includes('g') || lowercaseText.includes('gram')) {
      return 'g';
    }
    
    if (lowercaseText.includes('l') || lowercaseText.includes('litr')) {
      return 'l';
    }
    
    if (lowercaseText.includes('buc') || lowercaseText.includes('bucăț')) {
      return 'buc';
    }
    
    // Dacă nu găsim unitatea în text, vom folosi unitatea implicită a produsului
    return collectedData.unit || null;
  };
  
  // Funcție pentru a găsi cel mai apropiat match pentru un termen în baza de date
  const findClosestMatch = (term: string, items: string[]): string | null => {
    // Implementare simplă: verificăm dacă numele conține parțial termenul sau termenul conține parțial numele
    for (const item of items) {
      if (item.toLowerCase().includes(term) || term.includes(item.toLowerCase())) {
        return item;
      }
    }
    
    // Dacă nu găsim nicio potrivire, returnăm null
    return null;
  };
  
  // Funcție pentru a genera un sumar al operațiunii
  const summarizeOperation = (): string => {
    if (collectedData.operation === 'reception') {
      let summary = `Recepție de ${collectedData.quantity} ${collectedData.unit} de ${collectedData.productName} de la furnizorul ${collectedData.supplierName}, producător ${collectedData.manufacturerName}, lot ${collectedData.lotNumber}, document ${collectedData.documentNumber}`;
      
      if (collectedData.hasCrates && collectedData.crateCount) {
        summary += `, ambalat în ${collectedData.crateCount} lădițe de tip ${collectedData.crateTypeName}`;
      }
      
      return summary;
    } else if (collectedData.operation === 'transfer') {
      return `Transfer de ${collectedData.quantity} ${collectedData.unit} de ${collectedData.productName} către destinația ${collectedData.destination}`;
    } else if (collectedData.operation === 'production') {
      return `Introducere din producție a ${collectedData.quantity} ${collectedData.unit} de ${collectedData.productName}, lot ${collectedData.lotNumber}`;
    }
    
    return '';
  };
  
  // Funcții pentru executarea operațiunilor
  const performReception = async () => {
    try {
      // Calculăm greutatea netă dacă avem lădițe
      let netQuantity = collectedData.quantity || 0;
      if (collectedData.hasCrates && collectedData.crateCount && collectedData.crateWeight) {
        netQuantity = netQuantity - (collectedData.crateCount * collectedData.crateWeight);
      }
      
      const { error } = await supabase.from('inventory').insert({
        product_id: collectedData.productId,
        name: collectedData.productName,
        quantity: collectedData.quantity,
        net_quantity: netQuantity,
        supplier_id: collectedData.supplierId,
        supplier: collectedData.supplierName,
        manufacturer_id: collectedData.manufacturerId,
        unit: collectedData.unit,
        lot_number: collectedData.lotNumber,
        document_number: collectedData.documentNumber,
        crate_type_id: collectedData.hasCrates ? collectedData.crateTypeId : null,
        crate_count: collectedData.hasCrates ? collectedData.crateCount : 0,
        crate_weight: collectedData.hasCrates ? collectedData.crateWeight : 0
      });
      
      if (error) throw error;
      
      // Reîmprospătăm datele de inventar
      await fetchInventory();
      
      endConversation();
      assistantSays("Operațiunea de recepție a fost realizată cu succes! Produsele au fost adăugate în inventar.");
      
      toast({
        title: "Recepție finalizată",
        description: `${collectedData.quantity} ${collectedData.unit} de ${collectedData.productName} au fost adăugate în inventar.`,
        variant: "default"
      });
      
      onOperationComplete();
      
      // Întrebăm dacă mai putem ajuta cu altceva
      setTimeout(() => {
        assistantSays("Mai pot să te ajut cu altceva? Spune-mi dacă dorești să faci o altă operațiune sau să închei conversația.");
        processConversationStep('', 'askForMoreHelp');
      }, 2000);
      
    } catch (error) {
      console.error("Eroare la procesarea recepției:", error);
      assistantSays("A apărut o eroare la procesarea recepției. Te rog să încerci din nou.");
      endConversation();
      
      toast({
        title: "Eroare",
        description: "Nu am putut finaliza operațiunea de recepție.",
        variant: "destructive"
      });
      
      // Întrebăm dacă mai putem ajuta cu altceva, chiar și după eroare
      setTimeout(() => {
        assistantSays("Mai pot să te ajut cu altceva? Spune-mi dacă dorești să faci o altă operațiune sau să închei conversația.");
        processConversationStep('', 'askForMoreHelp');
      }, 2000);
    }
  };
  
  const performTransfer = async () => {
    try {
      // Implementare pentru transfer de stoc
      // Creăm un nou transfer
      const { data: transferData, error: transferError } = await supabase
        .from('stock_transfers')
        .insert({
          destination: collectedData.destination,
          notes: `Transfer vocal: ${collectedData.quantity} ${collectedData.unit} de ${collectedData.productName}`
        })
        .select('id')
        .single();

      if (transferError) throw transferError;
      
      // Găsim primul item de inventar corespunzător
      const { data: inventoryItems, error: inventoryError } = await supabase
        .from('inventory')
        .select('id, quantity, unit')
        .eq('product_id', collectedData.productId)
        .gt('quantity', 0)
        .order('created_at', { ascending: false })
        .limit(1);

      if (inventoryError) throw inventoryError;
      
      if (!inventoryItems || inventoryItems.length === 0) {
        throw new Error(`Produsul ${collectedData.productName} nu mai are stoc disponibil`);
      }

      const inventoryItem = inventoryItems[0];
      
      // Creăm un item de transfer
      const { error: insertError } = await supabase
        .from('stock_transfer_items')
        .insert({
          transfer_id: transferData?.id,
          inventory_item_id: inventoryItem.id,
          quantity: collectedData.quantity,
          unit: collectedData.unit
        });

      if (insertError) throw insertError;
      
      // Decrementăm cantitatea din inventar
      const { error: updateError } = await supabase.rpc(
        'decrement_quantity',
        {
          item_id: inventoryItem.id,
          decrement_by: collectedData.quantity || 0,
          exit_document: collectedData.destination
        }
      );

      if (updateError) throw updateError;
      
      // Reîmprospătăm datele de inventar
      await fetchInventory();
      
      endConversation();
      assistantSays("Operațiunea de transfer a fost realizată cu succes!");
      
      toast({
        title: "Transfer finalizat",
        description: `${collectedData.quantity} ${collectedData.unit} de ${collectedData.productName} au fost transferate către ${collectedData.destination}.`,
        variant: "default"
      });
      
      onOperationComplete();
      
      // Întrebăm dacă mai putem ajuta cu altceva
      setTimeout(() => {
        assistantSays("Mai pot să te ajut cu altceva? Spune-mi dacă dorești să faci o altă operațiune sau să închei conversația.");
        processConversationStep('', 'askForMoreHelp');
      }, 2000);
      
    } catch (error) {
      console.error("Eroare la procesarea transferului:", error);
      assistantSays("A apărut o eroare la procesarea transferului. Te rog să încerci din nou.");
      endConversation();
      
      toast({
        title: "Eroare",
        description: "Nu am putut finaliza operațiunea de transfer.",
        variant: "destructive"
      });
      
      // Întrebăm dacă mai putem ajuta cu altceva, chiar și după eroare
      setTimeout(() => {
        assistantSays("Mai pot să te ajut cu altceva? Spune-mi dacă dorești să faci o altă operațiune sau să închei conversația.");
        processConversationStep('', 'askForMoreHelp');
      }, 2000);
    }
  };
  
  const performProduction = async () => {
    try {
      // Implementare pentru introducere din producție
      const { error } = await supabase.from('inventory').insert({
        product_id: collectedData.productId,
        name: collectedData.productName,
        quantity: collectedData.quantity,
        net_quantity: collectedData.quantity,
        unit: collectedData.unit,
        lot_number: collectedData.lotNumber,
        document_number: "Producție internă",
        supplier: "Producție proprie"
      });
      
      if (error) throw error;
      
      // Reîmprospătăm datele de inventar
      await fetchInventory();
      
      endConversation();
      assistantSays("Operațiunea de introducere din producție a fost realizată cu succes! Produsele au fost adăugate în inventar.");
      
      toast({
        title: "Producție finalizată",
        description: `${collectedData.quantity} ${collectedData.unit} de ${collectedData.productName} au fost adăugate în inventar din producție.`,
        variant: "default"
      });
      
      onOperationComplete();
      
      // Întrebăm dacă mai putem ajuta cu altceva
      setTimeout(() => {
        assistantSays("Mai pot să te ajut cu altceva? Spune-mi dacă dorești să faci o altă operațiune sau să închei conversația.");
        processConversationStep('', 'askForMoreHelp');
      }, 2000);
      
    } catch (error) {
      console.error("Eroare la procesarea introducerii din producție:", error);
      assistantSays("A apărut o eroare la procesarea introducerii din producție. Te rog să încerci din nou.");
      endConversation();
      
      toast({
        title: "Eroare",
        description: "Nu am putut finaliza operațiunea de introducere din producție.",
        variant: "destructive"
      });
      
      // Întrebăm dacă mai putem ajuta cu altceva, chiar și după eroare
      setTimeout(() => {
        assistantSays("Mai pot să te ajut
