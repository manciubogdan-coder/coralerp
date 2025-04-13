import React, { useState, useEffect, useRef } from "react";
import { toast } from "@/hooks/use-custom-toast";
import { Mic, MicOff, Send, Download, Mail, ListFilter, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import VoiceCommandPanel from "@/components/VoiceCommandPanel";
import InventoryTable from "@/components/InventoryTable";
import InventoryHistory from "@/components/InventoryHistory";
import { processCommand } from "@/lib/aiProcessor";
import { ChartData, InventoryItem, InventoryHistoryItem } from "@/types";
import { exportToExcel } from "@/lib/excelExport";
import { sendEmail } from "@/lib/emailService";
import { speakText, improveVoiceCommand } from "@/lib/speechService";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";

const Index = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [inputText, setInputText] = useState("");
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [conversations, setConversations] = useState<{text: string, timestamp: Date}[]>([]);
  const [conversationTexts, setConversationTexts] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [awaitingMoreInfo, setAwaitingMoreInfo] = useState(false);
  const [response, setResponse] = useState("");
  const [charts, setCharts] = useState<ChartData[]>([]);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const conversationsEndRef = useRef<HTMLDivElement>(null);
  const speechUtteranceRef = useRef<{stop: () => void; isPending: () => boolean} | null>(null);
  const [activeTab, setActiveTab] = useState("inventory");
  const isMobile = useIsMobile();

  const formatToISOString = (date: Date | string): string => {
    if (date instanceof Date) {
      return date.toISOString();
    } else if (typeof date === 'string') {
      const parsed = new Date(date);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
      return date;
    }
    return '';
  };

  useEffect(() => {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognitionConstructor();
      
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'ro-RO';
      
      if ('webkitSpeechRecognition' in window) {
        (recognitionRef.current as any).maxAlternatives = 5;
      }

      let silenceTimer: number | null = null;
      let finalTranscriptText = "";

      recognitionRef.current.onresult = (event) => {
        const current = event.resultIndex;
        let transcriptText = event.results[current][0].transcript;
        
        let hasStockKeywords = false;
        
        if (event.results[current].length > 1) {
          for (let i = 0; i < event.results[current].length; i++) {
            const alt = event.results[current][i].transcript.toLowerCase();
            if (alt.includes("stoc") || alt.includes("inventar") || alt.includes("produse") || 
                alt.includes("arata") || alt.includes("vezi") || alt.includes("afiseaza") ||
                alt.includes("marfa") || alt.includes("depozit")) {
              hasStockKeywords = true;
              console.log("Alternativă de recunoaștere cu cuvinte cheie:", alt);
              break;
            }
          }
        }
        
        const improvedTranscript = improveVoiceCommand(transcriptText);
        if (improvedTranscript !== transcriptText) {
          console.log("Transcriptul a fost îmbunătățit:", transcriptText, "->", improvedTranscript);
          transcriptText = improvedTranscript;
          hasStockKeywords = true;
        }
        
        setTranscript(transcriptText);
        
        if (silenceTimer) {
          window.clearTimeout(silenceTimer);
          silenceTimer = null;
        }

        if (event.results[current].isFinal) {
          finalTranscriptText = transcriptText;
          setInputText(finalTranscriptText);
          
          silenceTimer = window.setTimeout(() => {
            if (finalTranscriptText.trim()) {
              let commandToProcess = finalTranscriptText;
              
              if (finalTranscriptText.toLowerCase().includes("stoc") || 
                  finalTranscriptText.toLowerCase().includes("inventar") ||
                  finalTranscriptText.toLowerCase().includes("produse") ||
                  hasStockKeywords) {
                if (finalTranscriptText.toLowerCase().includes("arata") || 
                    finalTranscriptText.toLowerCase().includes("vezi") || 
                    finalTranscriptText.toLowerCase().includes("ce avem")) {
                  commandToProcess = "arată stocul";
                  console.log("Comandă normalizată la: arată stocul");
                }
              }
              
              processUserInput(commandToProcess);
              setIsRecording(false);
              if (recognitionRef.current) {
                recognitionRef.current.stop();
              }
            }
          }, 5000);
        } else {
          setInputText(transcriptText);
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        setIsRecording(false);
        toast({
          variant: "destructive",
          title: "Eroare la inregistrarea vocii",
          description: `A aparut o eroare: ${event.error}`
        });
      };
    } else {
      toast({
        variant: "destructive",
        title: "Recunoasterea vocala nu este suportata",
        description: "Browserul dvs. nu suporta recunoasterea vocala."
      });
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (speechUtteranceRef.current) {
        speechUtteranceRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    const fetchInventory = async () => {
      try {
        const { data, error } = await supabase
          .from('inventory')
          .select('*')
          .order('updated_at', { ascending: false });
        
        if (error) throw error;

        const items: InventoryItem[] = data.map(item => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity ? Number(item.quantity) : 0,
          unit: item.unit,
          supplier: item.supplier || undefined,
          batch_number: item.batch_number || undefined,
          receipt_date: item.receipt_date ? new Date(item.receipt_date) : undefined,
          createdAt: {
            seconds: new Date(item.created_at || '').getTime() / 1000,
            nanoseconds: 0
          },
          updatedAt: {
            seconds: new Date(item.updated_at || '').getTime() / 1000,
            nanoseconds: 0
          }
        }));
        
        setInventory(items);
      } catch (error) {
        console.error("Error fetching inventory:", error);
        toast({
          variant: "destructive",
          title: "Eroare la incarcarea stocului",
          description: "Nu s-a putut incarca stocul. Verificati conexiunea."
        });
      }
    };

    const fetchConversations = async () => {
      try {
        const { data, error } = await supabase
          .from('conversations')
          .select('*')
          .order('timestamp', { ascending: true });
        
        if (error) throw error;

        const convs: {text: string, timestamp: Date}[] = data.map(conv => ({
          text: conv.text,
          timestamp: new Date(conv.timestamp || '')
        }));
        
        setConversations(convs);
        setConversationTexts(data.map(conv => conv.text));
      } catch (error) {
        console.error("Error fetching conversations:", error);
      }
    };

    fetchInventory();
    fetchConversations();
  }, []);

  useEffect(() => {
    if (conversationsEndRef.current) {
      conversationsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [conversations]);

  const toggleRecording = () => {
    if (!recognitionRef.current) return;
    
    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
      
      if (transcript.trim()) {
        setTimeout(() => {
          const improvedTranscript = improveVoiceCommand(transcript);
          if (improvedTranscript === "DUPLICATE_COMMAND") {
            console.log("Comandă duplicată detectată, se ignoră");
            toast({
              title: "Comandă ignorată",
              description: "Această comandă a fost deja procesată recent."
            });
            return;
          }
          console.log("Procesez comanda vocală finală:", improvedTranscript);
          processUserInput(improvedTranscript);
        }, 1000);
      }
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
        setTranscript("");
        
        setInputText("");
        setResponse("");
        setCharts([]);
      } catch (error) {
        console.error("Error starting speech recognition:", error);
        toast({
          variant: "destructive",
          title: "Eroare",
          description: "Nu s-a putut porni inregistrarea vocii."
        });
      }
    }
  };

  const toggleAudio = () => {
    setIsAudioEnabled(!isAudioEnabled);
    
    if (isAudioEnabled && speechUtteranceRef.current) {
      speechUtteranceRef.current.stop();
    }
    
    toast({
      title: isAudioEnabled ? "Raspuns audio dezactivat" : "Raspuns audio activat",
      description: isAudioEnabled ? 
        "Asistentul nu va mai raspunde vocal." : 
        "Asistentul va raspunde si vocal."
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
  };

  const saveConversation = async (text: string) => {
    try {
      const { error } = await supabase
        .from('conversations')
        .insert({ text });
      
      if (error) throw error;
      
      setConversations(prev => [...prev, { text, timestamp: new Date() }]);
      setConversationTexts(prev => [...prev, text]);
    } catch (error) {
      console.error("Error saving conversation:", error);
    }
  };

  const updateInventoryItem = async (item: InventoryItem) => {
    try {
      console.log("Processing inventory update:", item);

      if (item.action === 'remove') {
        if (item.id) {
          const { data: oldItem } = await supabase
            .from('inventory')
            .select('*')
            .eq('id', item.id)
            .single();
          
          if (!oldItem) {
            throw new Error(`Item with ID ${item.id} not found`);
          }
          
          if (Number(oldItem.quantity) <= Number(item.quantity)) {
            console.log(`Removing entire inventory item (ID: ${item.id})`);
            const { error } = await supabase
              .from('inventory')
              .delete()
              .eq('id', item.id);
            
            if (error) throw error;
            
            setInventory(prev => prev.filter(invItem => invItem.id !== item.id));
            
            await saveInventoryHistory(oldItem, 'remove', oldItem, true);
            
            toast({
              title: "Produs eliminat",
              description: `"${item.name}" a fost eliminat complet din stoc.`
            });
          } else {
            const newQuantity = Number(oldItem.quantity) - Number(item.quantity);
            console.log(`Updating quantity from ${oldItem.quantity} to ${newQuantity}`);
            
            const { error } = await supabase
              .from('inventory')
              .update({
                quantity: newQuantity
              })
              .eq('id', item.id);
            
            if (error) throw error;
            
            setInventory(prev =>
              prev.map(invItem => (invItem.id === item.id ? { ...invItem, quantity: newQuantity } : invItem))
            );
            
            await saveInventoryHistory(item, 'remove', oldItem, false);
            
            toast({
              title: "Stoc actualizat",
              description: `Au fost scoase ${item.quantity} ${item.unit} de ${item.name} din stoc.`
            });
          }
          return;
        }
        
        if (item.batch_number && item.supplier) {
          const { data: existingItems } = await supabase
            .from('inventory')
            .select('*')
            .eq('name', item.name)
            .eq('batch_number', item.batch_number)
            .eq('supplier', item.supplier);
            
          if (existingItems && existingItems.length > 0) {
            item.id = existingItems[0].id;
            return updateInventoryItem(item);
          }
        }
        
        const { data: matchingItems } = await supabase
          .from('inventory')
          .select('*')
          .eq('name', item.name);
          
        if (matchingItems && matchingItems.length > 0) {
          item.id = matchingItems[0].id;
          return updateInventoryItem(item);
        }
        
        toast({
          variant: "destructive",
          title: "Produsul nu exista",
          description: `Nu s-a gasit produsul "${item.name}" in stoc.`
        });
        return;
      }
      
      if (!item.id && (item.action === 'add' || item.action === 'set')) {
        console.log("Checking for existing batch before creating:", item);
        
        if (item.batch_number && item.supplier) {
          const { data: existingItems } = await supabase
            .from('inventory')
            .select('*')
            .eq('name', item.name)
            .eq('batch_number', item.batch_number)
            .eq('supplier', item.supplier);
            
          if (existingItems && existingItems.length > 0) {
            console.log("Found existing batch, updating instead:", existingItems[0]);
            
            const oldItem = existingItems[0];
            item.id = oldItem.id;
            
            if (item.action === 'add') {
              item.quantity = Number(oldItem.quantity) + Number(item.quantity);
            }
            
            const { error } = await supabase
              .from('inventory')
              .update({
                quantity: item.quantity,
                receipt_date: item.receipt_date ? formatToISOString(item.receipt_date) : oldItem.receipt_date,
                updated_at: new Date().toISOString()
              })
              .eq('id', item.id);
            
            if (error) throw error;
            
            setInventory(prev =>
              prev.map(invItem => (invItem.id === item.id ? { ...invItem, ...item } : invItem))
            );
            
            toast({
              title: "Stoc actualizat",
              description: `Stocul pentru "${item.name}" a fost actualizat.`
            });
            
            await saveInventoryHistory(item, item.action || 'add', oldItem, false);
            return;
          }
        }
        
        console.log("Creating new inventory entry:", item);
        
        const { data, error } = await supabase
          .from('inventory')
          .insert({
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            supplier: item.supplier,
            batch_number: item.batch_number,
            receipt_date: item.receipt_date ? formatToISOString(item.receipt_date) : null,
          })
          .select()
          .single();
        
        if (error) throw error;
        
        const newItem: InventoryItem = {
          id: data.id,
          name: data.name,
          quantity: data.quantity ? Number(data.quantity) : 0,
          unit: data.unit,
          supplier: data.supplier || undefined,
          batch_number: data.batch_number || undefined,
          receipt_date: data.receipt_date ? new Date(data.receipt_date) : undefined,
          createdAt: {
            seconds: new Date(data.created_at || '').getTime() / 1000,
            nanoseconds: 0
          },
          updatedAt: {
            seconds: new Date(data.updated_at || '').getTime() / 1000,
            nanoseconds: 0
          }
        };
        
        setInventory(prev => [...prev, newItem]);
        
        toast({
          title: "Produs adaugat",
          description: `Produsul "${item.name}" a fost adaugat in stoc.`
        });
        
        await saveInventoryHistory(data, item.action || 'add', null, false);
        return;
      }
      
      if (item.id) {
        console.log("Updating existing item by ID:", item);
        
        const { data: oldItem } = await supabase
          .from('inventory')
          .select('*')
          .eq('id', item.id)
          .single();
        
        const { error } = await supabase
          .from('inventory')
          .update({
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            supplier: item.supplier,
            batch_number: item.batch_number,
            receipt_date: item.receipt_date ? formatToISOString(item.receipt_date) : null,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id);
        
        if (error) throw error;
        
        setInventory(prev =>
          prev.map(invItem => (invItem.id === item.id ? { ...invItem, ...item } : invItem))
        );
        
        toast({
          title: "Stoc actualizat",
          description: `Stocul pentru "${item.name}" a fost actualizat.`
        });
        
        await saveInventoryHistory(item, item.action || 'set', oldItem, false);
      }
    } catch (error) {
      console.error("Error updating inventory:", error);
      toast({
        variant: "destructive",
        title: "Eroare",
        description: "Nu s-a putut actualiza stocul."
      });
    }
  };

  const saveInventoryHistory = async (item: any, action: 'add' | 'remove' | 'set', oldItem: any, isComplete: boolean) => {
    try {
      const historyEntry = {
        inventory_item_id: isComplete ? null : item.id,
        action: action,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        previous_quantity: oldItem ? oldItem.quantity : 0,
        supplier: item.supplier,
        batch_number: item.batch_number,
        operation_date: new Date().toISOString(),
        exit_timestamp: action === 'remove' ? new Date().toISOString() : null,
        notes: isComplete ? "Produs eliminat complet din stoc" : null
      };
      
      const { error: historyError } = await supabase
        .from('inventory_history')
        .insert(historyEntry);
      
      if (historyError) {
        console.error("Error saving inventory history:", historyError);
      }
    } catch (error) {
      console.error("Error saving history:", error);
    }
  };

  const processUserInput = async (input: string) => {
    if (!input.trim() || input === "DUPLICATE_COMMAND") return;
    
    const commandHash = input.toLowerCase().trim().replace(/\s+/g, ' ');
    console.log("Verificare finală duplicat pentru comandă:", commandHash);
    
    setIsProcessing(true);
    setResponse("");
    setCharts([]);
    
    const isStockCommand = input.toLowerCase().match(/stoc|inventar|produse|arată|vezi|afișează|raport|cantitate|total|marfă|marfa|depozit/i);
    const isShowStockCommand = input.toLowerCase().includes("arată stocul") || 
                              input.toLowerCase().includes("arată produsele") ||
                              input.toLowerCase().includes("vezi stocul") ||
                              input.toLowerCase().includes("afișează stocul") ||
                              (input.toLowerCase().includes("ce") && input.toLowerCase().includes("avem") && 
                               (input.toLowerCase().includes("stoc") || input.toLowerCase().includes("depozit")));
    
    try {
      await saveConversation(input);
      
      const contextInput = input;
      
      console.log("Trimit comanda spre procesare:", contextInput);
      const result = await processCommand(contextInput, inventory, conversationTexts);
      console.log("Command result:", result);
      
      let processedResponse = result.response;
      
      if ((isStockCommand || isShowStockCommand) && 
          (processedResponse.includes("nu am nici o informatie") || 
           processedResponse.includes("nu am nicio informatie")) && 
          inventory.length > 0) {
        
        processedResponse = `În prezent avem ${inventory.length} produse în stoc. Iată o prezentare generală:`;
        result.action = 'view';
        
        console.log("Am corectat răspunsul pentru comanda de stoc:", processedResponse);
      }
      
      setResponse(processedResponse);
      
      import("@/lib/AIAssistantTrainer").then(module => {
        module.learnFromConversation(input, processedResponse);
        console.log("Asistentul a învățat din conversație.");
      }).catch(error => {
        console.error("Eroare la încărcarea modulului de învățare:", error);
      });
      
      if (isAudioEnabled) {
        if (speechUtteranceRef.current) {
          speechUtteranceRef.current.stop();
        }
        
        speechUtteranceRef.current = speakText(processedResponse);
      }

      if (result.charts && result.charts.length > 0) {
        setCharts(result.charts);
      } else if (result.action === 'view' || 
                isShowStockCommand ||
                (result.action === 'query' && (input.toLowerCase().includes('stoc') || isStockCommand))) {
        const inventoryCharts = generateInventoryCharts();
        setCharts(inventoryCharts);
      }

      if (result.needsMoreInfo) {
        setAwaitingMoreInfo(true);
        await saveConversation(result.response);
        setResponse(result.needsMoreInfo.question);
        
        toast({
          title: "Informatii suplimentare necesare",
          description: result.needsMoreInfo.question
        });
        
        if (result.needsMoreInfo.type === 'batch_selection' && result.needsMoreInfo.options) {
          const optionsMessage = result.needsMoreInfo.options
            .map(option => `- ${option.name} (lot ${option.batch_number || 'necunoscut'}) de la ${option.supplier || 'furnizor necunoscut'}: ${option.quantity} ${option.unit}`)
            .join('\n');
          
          setResponse(`${result.needsMoreInfo.question}\n\nLoturi disponibile:\n${optionsMessage}`);
        }
      } else {
        setAwaitingMoreInfo(false);
        
        if (result.action === 'add' || result.action === 'remove' || result.action === 'set') {
          if (result.item) {
            const updatedItem = {
              ...result.item,
              action: result.action
            };
            
            const isRemoveAllCommand = 
              result.action === 'remove' && 
              input.toLowerCase().match(/elimina|scoate|sterge/i) && 
              input.toLowerCase().match(/to[a]t[a]|tot/i) && 
              !result.item.batch_number;
              
            if (isRemoveAllCommand) {
              console.log("Detected command to remove all of a product:", result.item.name);
              await updateInventoryItem({
                ...updatedItem,
                batch_number: undefined,
                supplier: undefined,
                id: undefined
              });
              setIsProcessing(false);
              return;
            }
            
            if (result.action === 'remove') {
              const matchingItems = inventory.filter(
                item => item.name.toLowerCase() === result.item!.name.toLowerCase()
              );
              
              if (matchingItems.length > 1 && !result.item.batch_number && !result.item.id) {
                const options = matchingItems.map(item => ({
                  id: item.id || '',
                  name: item.name,
                  batch_number: item.batch_number,
                  supplier: item.supplier,
                  quantity: item.quantity,
                  unit: item.unit
                }));
                
                const batchInfo = options.map(option => 
                  `- ${option.name} (lot ${option.batch_number || 'necunoscut'}) de la ${option.supplier || 'furnizor necunoscut'}: ${option.quantity} ${option.unit}`
                ).join('\n');
                
                const responseText = `Exista ${matchingItems.length} loturi diferite de ${result.item.name} in stoc. Din care lot doriti sa eliminati?\n\n${batchInfo}`;
                
                await saveConversation(responseText);
                setResponse(responseText);
                setAwaitingMoreInfo(true);
                setIsProcessing(false);
                return;
              } else if (matchingItems.length === 1 && !result.item.id) {
                updatedItem.id = matchingItems[0].id;
                updatedItem.batch_number = matchingItems[0].batch_number;
                updatedItem.supplier = matchingItems[0].supplier;
                
                if (matchingItems[0].quantity < updatedItem.quantity) {
                  const responseText = `Atentie! In stoc avem doar ${matchingItems[0].quantity} ${updatedItem.unit} de ${updatedItem.name}, dar ai solicitat ${updatedItem.quantity} ${updatedItem.unit}.`;
                  await saveConversation(responseText);
                  setResponse(responseText);
                  
                  toast({
                    variant: "warning",
                    title: "Cantitate insuficienta",
                    description: `Am scos doar cantitatea disponibila (${matchingItems[0].quantity} ${updatedItem.unit}) din stoc.`
                  });
                  
                  updatedItem.quantity = matchingItems[0].quantity;
                }
              } else if (matchingItems.length === 0) {
                toast({
                  variant: "destructive",
                  title: "Produsul nu exista",
                  description: `Nu s-a gasit produsul "${result.item.name}" in stoc.`
                });
                setIsProcessing(false);
                return;
              }
            }
            
            if (result.action === 'add' || result.action === 'set') {
              updatedItem.receipt_date = updatedItem.receipt_date || new Date();
            }
            
            await updateInventoryItem(updatedItem);
          }
        } else if (result.action === 'export') {
          exportToExcel(inventory);
          toast({
            title: "Export realizat",
            description: "Fisierul Excel a fost generat si descarcat."
          });
        } else if (result.action === 'email') {
          await sendEmail(inventory);
          toast({
            title: "Email trimis",
            description: "Raportul a fost trimis pe email."
          });
        } else if (result.action === 'query') {
          const productNames = [...new Set(inventory.map(item => item.name.toLowerCase()))];
          let highlightedResponse = result.response;
          
          productNames.forEach(product => {
            const regex = new RegExp(`\\b${product}\\b`, 'gi');
            highlightedResponse = highlightedResponse.replace(regex, match => `<strong>${match}</strong>`);
          });
          
          setResponse(highlightedResponse);
        }
        
        await saveConversation(result.response);
      }
    } catch (error) {
      console.error("Error processing command:", error);
      toast({
        variant: "destructive",
        title: "Eroare",
        description: "A aparut o eroare la procesarea comenzii."
      });
    } finally {
      setIsProcessing(false);
      setInputText("");
    }
  };

  const generateInventoryCharts = (): ChartData[] => {
    const charts: ChartData[] = [];
    
    if (inventory.length > 0) {
      const productTotals = inventory.reduce((acc, item) => {
        const name = item.name;
        if (!acc[name]) {
          acc[name] = {
            name,
            value: 0,
            unit: item.unit
          };
        }
        acc[name].value += item.quantity;
        return acc;
      }, {} as Record<string, {name: string, value: number, unit: string}>);
      
      charts.push({
        type: 'pie',
        title: 'Distributia produselor in stoc',
        data: Object.values(productTotals).map(item => ({
          name: item.name,
          value: item.value,
          unit: item.unit
        })),
        description: 'Vizualizare proportionala a cantitatilor de produse in stoc'
      });
      
      const supplierItems = inventory.filter(item => item.supplier);
      if (supplierItems.length > 0) {
        const supplierTotals = supplierItems.reduce((acc, item) => {
          const supplier = item.supplier || 'Necunoscut';
          if (!acc[supplier]) {
            acc[supplier] = {
              name: supplier,
              value: 0
            };
          }
          acc[supplier].value += item.quantity;
          return acc;
        }, {} as Record<string, {name: string, value: number}>);
        
        charts.push({
          type: 'bar',
          title: 'Distributia pe furnizori',
          data: Object.values(supplierTotals),
          description: 'Cantitati totale pe furnizori'
        });
      }
    }
    
    return charts;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processUserInput(inputText);
  };

  const handleExportExcel = () => {
    exportToExcel(inventory);
    toast({
      title: "Export realizat",
      description: "Fisierul Excel a fost generat si descarcat."
    });
  };

  const handleSendEmail = async () => {
    try {
      await sendEmail(inventory);
      toast({
        title: "Email trimis",
        description: "Raportul a fost trimis pe email."
      });
    } catch (error) {
      console.error("Error sending email:", error);
      toast({
        variant: "destructive",
        title: "Eroare",
        description: "Nu s-a putut trimite emailul."
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <main className="flex-1 container mx-auto p-2 md:p-6 grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6">
        <div className={`${isMobile ? "order-1" : "order-0"} md:col-span-1`}>
          <VoiceCommandPanel 
            isRecording={isRecording}
            toggleRecording={toggleRecording}
            transcript={transcript}
            conversations={conversations}
            response={response}
            charts={charts}
            isAudioEnabled={isAudioEnabled}
            toggleAudio={toggleAudio}
            conversationsEndRef={conversationsEndRef}
          />
        </div>
        
        <div className={`${isMobile ? "order-0" : "order-1"} md:col-span-2 space-y-3 md:space-y-6`}>
          <div className="bg-white rounded-lg shadow-md p-2 md:p-4">
            <form onSubmit={handleSubmit} className="flex space-x-2">
              <Input
                placeholder={awaitingMoreInfo 
                  ? "Raspundeti la intrebarea asistentului..." 
                  : "Ce ai vrea sa faci? (ex: Adauga 5kg rosii sau Cate loturi de menta avem?)"
                }
                value={inputText}
                onChange={handleInputChange}
                className="flex-1"
                disabled={isProcessing}
              />
              <Button 
                type="button" 
                variant={isRecording ? "destructive" : "outline"}
                size="icon"
                onClick={toggleRecording}
                className={isRecording ? "animate-pulse" : ""}
              >
                {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
              <Button type="submit" disabled={isProcessing || !inputText.trim()}>
                {isMobile ? <Send className="h-4 w-4" /> : <><Send className="h-4 w-4 mr-2" />Trimite</>}
              </Button>
            </form>
          </div>
          
          <div className="bg-white rounded-lg shadow-md">
            <div className="border-b border-gray-200 p-2 md:p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
              <div>
                <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="inventory">
                  <TabsList className={isMobile ? "h-8" : ""}>
                    <TabsTrigger value="inventory" className="flex items-center text-xs md:text-sm">
                      <ListFilter className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                      Stoc curent
                    </TabsTrigger>
                    <TabsTrigger value="history" className="flex items-center text-xs md:text-sm">
                      <History className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                      Istoric
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <div className="flex space-x-2 w-full md:w-auto">
                <Button variant="outline" size="sm" onClick={handleExportExcel} className="text-xs md:text-sm flex-1 md:flex-none">
                  <Download className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                  {isMobile ? "" : "Excel"}
                </Button>
                <Button variant="outline" size="sm" onClick={handleSendEmail} className="text-xs md:text-sm flex-1 md:flex-none">
                  <Mail className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                  {isMobile ? "" : "Email"}
                </Button>
              </div>
            </div>
            
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsContent value="inventory">
                <InventoryTable inventory={inventory} />
              </TabsContent>
              
              <TabsContent value="history">
                <InventoryHistory />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Index;
