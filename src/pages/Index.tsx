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
import { ChartData, InventoryItem } from "@/types";
import { exportToExcel } from "@/lib/excelExport";
import { sendEmail } from "@/lib/emailService";
import { speakText } from "@/lib/speechService";
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

  useEffect(() => {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognitionConstructor();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'ro-RO';

      let silenceTimer: number | null = null;
      let lastTranscriptLength = 0;
      let finalTranscriptText = "";

      recognitionRef.current.onresult = (event) => {
        const current = event.resultIndex;
        const transcriptText = event.results[current][0].transcript;
        setTranscript(transcriptText);
        
        if (silenceTimer) {
          window.clearTimeout(silenceTimer);
          silenceTimer = null;
        }

        if (event.results[current].isFinal) {
          finalTranscriptText = transcriptText;
          lastTranscriptLength = transcriptText.length;
          
          setInputText(transcriptText);
          
          silenceTimer = window.setTimeout(() => {
            if (finalTranscriptText.trim()) {
              processUserInput(finalTranscriptText);
              setIsRecording(false);
              if (recognitionRef.current) {
                recognitionRef.current.stop();
              }
            }
          }, 2000);
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
          pallets: item.pallets ? Number(item.pallets) : 0,
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
          processUserInput(transcript);
        }, 500);
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
      const receipt_date = item.receipt_date ? item.receipt_date.toISOString() : null;
      console.log("Updating inventory item:", item);
      
      let existingItem = null;
      
      if (item.batch_number && item.supplier) {
        const { data, error } = await supabase
          .from('inventory')
          .select('*')
          .eq('name', item.name)
          .eq('supplier', item.supplier)
          .eq('batch_number', item.batch_number);
          
        if (error) {
          console.error("Error finding existing item:", error);
          throw error;
        }
        
        if (data && data.length > 0) {
          existingItem = data[0];
          console.log("Found existing item by batch:", existingItem);
        }
      } 
      else if (item.id) {
        const { data, error } = await supabase
          .from('inventory')
          .select('*')
          .eq('id', item.id);
          
        if (error) {
          console.error("Error finding item by ID:", error);
          throw error;
        }
        
        if (data && data.length > 0) {
          existingItem = data[0];
          console.log("Found existing item by ID:", existingItem);
        }
      }
      else if (item.action === 'remove' && item.name) {
        const { data, error } = await supabase
          .from('inventory')
          .select('*')
          .eq('name', item.name)
          .gt('quantity', 0);
          
        if (error) {
          console.error("Error finding items by name:", error);
          throw error;
        }
        
        if (data && data.length > 0) {
          for (const inventoryItem of data) {
            const now = new Date().toISOString();
            
            const historyData = {
              inventory_item_id: inventoryItem.id,
              action: 'remove',
              name: inventoryItem.name,
              quantity: inventoryItem.quantity,
              unit: inventoryItem.unit,
              previous_quantity: inventoryItem.quantity,
              supplier: inventoryItem.supplier || null,
              batch_number: inventoryItem.batch_number || null,
              pallets: inventoryItem.pallets || 0,
              notes: "Scos din stoc complet",
              operation_date: now,
              exit_timestamp: now
            };
            
            const { error: historyError } = await supabase
              .from('inventory_history')
              .insert(historyData);
              
            if (historyError) {
              console.error("Error recording history:", historyError);
            }
            
            const { error: deleteError } = await supabase
              .from('inventory')
              .delete()
              .eq('id', inventoryItem.id);
              
            if (deleteError) {
              console.error("Error deleting inventory item:", deleteError);
            }
          }
          
          const { data: updatedInventory, error: updateError } = await supabase
            .from('inventory')
            .select('*')
            .order('updated_at', { ascending: false });
            
          if (updateError) {
            console.error("Error fetching updated inventory:", updateError);
          } else {
            const items = updatedInventory.map(item => ({
              id: item.id,
              name: item.name,
              quantity: item.quantity ? Number(item.quantity) : 0,
              unit: item.unit,
              supplier: item.supplier || undefined,
              batch_number: item.batch_number || undefined,
              pallets: item.pallets ? Number(item.pallets) : 0,
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
          }
          
          toast({
            title: "Operatiune reusita",
            description: `Am eliminat complet toate loturile de ${item.name} (${data.length} ${data.length === 1 ? 'lot' : 'loturi'}) din stoc.`
          });
          
          return;
        }
      }
      
      let updatedItemId;
      let previousQuantity = 0;
      let newQuantity = item.quantity;
      
      if (existingItem?.id) {
        updatedItemId = existingItem.id;
        previousQuantity = Number(existingItem.quantity);
        
        if (previousQuantity <= 0 && item.action === 'remove') {
          console.log(`Skipping removal from ${item.name} as quantity is already 0`);
          return;
        }
        
        if (item.action === 'add') {
          newQuantity = Number(existingItem.quantity) + Number(item.quantity);
        } else if (item.action === 'remove') {
          if (Number(existingItem.quantity) < Number(item.quantity)) {
            const availableQuantity = Number(existingItem.quantity);
            console.log(`Warning: Requested to remove ${item.quantity} but only ${availableQuantity} available`);
            newQuantity = 0;
            
            toast({
              variant: "warning",
              title: "Atentie",
              description: `Ai solicitat sa scoti ${item.quantity} ${item.unit} de ${item.name}, dar erau disponibile doar ${availableQuantity} ${item.unit} in lotul ${item.batch_number || 'existent'}.`
            });
          } else {
            newQuantity = Math.max(0, Number(existingItem.quantity) - Number(item.quantity));
          }
        } else if (item.action === 'set') {
          newQuantity = Number(item.quantity);
        }
        
        console.log(`Updating quantity: ${existingItem.quantity} to ${newQuantity} (action: ${item.action})`);
        
        let newPallets = existingItem.pallets || 0;
        if (item.pallets !== undefined) {
          if (item.action === 'add') {
            newPallets = (existingItem.pallets || 0) + (item.pallets || 0);
          } else if (item.action === 'set') {
            newPallets = item.pallets || 0;
          } else if (item.action === 'remove' && existingItem.pallets) {
            const removalRatio = Math.min(1, Number(item.quantity) / previousQuantity);
            newPallets = Math.max(0, Math.round(existingItem.pallets * (1 - removalRatio)));
          }
        }
        
        if (newQuantity === 0) {
          const { data: otherBatches, error: batchError } = await supabase
            .from('inventory')
            .select('*')
            .eq('name', existingItem.name)
            .neq('id', existingItem.id)
            .gt('quantity', 0);
            
          if (batchError) {
            console.error("Error checking other batches:", batchError);
            throw batchError;
          }
          
          if (otherBatches && otherBatches.length > 0) {
            const { error: deleteError } = await supabase
              .from('inventory')
              .delete()
              .eq('id', existingItem.id);
              
            if (deleteError) {
              console.error("Error deleting empty inventory item:", deleteError);
              throw deleteError;
            }
            
            console.log(`Deleted empty inventory item (${existingItem.name}, batch ${existingItem.batch_number}) as other batches exist`);
          } else {
            const { error } = await supabase
              .from('inventory')
              .update({
                quantity: newQuantity,
                pallets: newPallets,
                updated_at: new Date().toISOString()
              })
              .eq('id', existingItem.id);
              
            if (error) {
              console.error("Error updating existing item:", error);
              throw error;
            }
          }
        } else {
          const { error } = await supabase
            .from('inventory')
            .update({
              quantity: newQuantity,
              pallets: newPallets,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingItem.id);
            
          if (error) {
            console.error("Error updating existing item:", error);
            throw error;
          }
        }
        
        console.log("Updated existing item successfully");
      }
      else if (item.id) {
        updatedItemId = item.id;
        
        const { data: currentData, error: fetchError } = await supabase
          .from('inventory')
          .select('quantity')
          .eq('id', item.id)
          .single();
          
        if (fetchError) {
          console.error("Error fetching current item data:", fetchError);
          throw fetchError;
        }
        
        if (currentData) {
          previousQuantity = Number(currentData.quantity);
        }
        
        console.log("Updating item by ID:", item.id);
        
        const { error } = await supabase
          .from('inventory')
          .update({
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            supplier: item.supplier || null,
            batch_number: item.batch_number || null,
            pallets: item.pallets || 0,
            receipt_date: receipt_date,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id);
          
        if (error) {
          console.error("Error updating item by ID:", error);
          throw error;
        }
        
        console.log("Updated item by ID successfully");
      }
      else {
        console.log("Inserting new item:", item);
        
        const { data, error } = await supabase
          .from('inventory')
          .insert({
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            supplier: item.supplier || null,
            batch_number: item.batch_number || null,
            pallets: item.pallets || 0,
            receipt_date: receipt_date
          })
          .select();
          
        if (error) {
          console.error("Error inserting new item:", error);
          throw error;
        }
        
        if (data && data[0]) {
          updatedItemId = data[0].id;
        }
        
        console.log("Inserted new item successfully");
      }
      
      if (updatedItemId) {
        const now = new Date().toISOString();
        let actualQuantity = item.quantity;
        
        if (item.action === 'remove' && previousQuantity < item.quantity) {
          actualQuantity = previousQuantity;
        }
        
        const historyData = {
          inventory_item_id: updatedItemId,
          action: item.action || 'set',
          name: item.name,
          quantity: actualQuantity,
          unit: item.unit,
          previous_quantity: previousQuantity,
          supplier: item.supplier || null,
          batch_number: item.batch_number || null,
          pallets: item.pallets || 0,
          notes: null,
          operation_date: now
        };
        
        if (item.action === 'remove') {
          historyData['exit_timestamp'] = now;
        }
        
        const { error: historyError } = await supabase
          .from('inventory_history')
          .insert(historyData);
          
        if (historyError) {
          console.error("Error recording history:", historyError);
        } else {
          console.log("Recorded operation in history successfully");
        }
      }
      
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .order('updated_at', { ascending: false });
        
      if (error) {
        console.error("Error fetching updated inventory:", error);
        throw error;
      }
      
      console.log("Fetched updated inventory:", data);
      
      const items: InventoryItem[] = data.map(item => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity ? Number(item.quantity) : 0,
        unit: item.unit,
        supplier: item.supplier || undefined,
        batch_number: item.batch_number || undefined,
        pallets: item.pallets ? Number(item.pallets) : 0,
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
      
      const actionVerb = item.action === 'add' ? 'adaugat' : item.action === 'remove' ? 'scos' : 'actualizat';
      
      if (!(item.action === 'remove' && previousQuantity === 0)) {
        toast({
          title: "Operatiune reusita",
          description: `${item.action === 'remove' && previousQuantity < item.quantity ? previousQuantity : item.quantity} ${item.unit} de ${item.name} ${item.supplier ? `de la ${item.supplier}` : ''} ${item.batch_number ? `(lot ${item.batch_number})` : ''} ${actionVerb} in stoc.`
        });
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

  const processUserInput = async (input: string) => {
    if (!input.trim()) return;
    
    setIsProcessing(true);
    setResponse("");
    setCharts([]);
    
    try {
      await saveConversation(input);
      
      const contextInput = input;
      const recentMessages = conversationTexts.slice(-5).join("\n");
      
      const result = await processCommand(contextInput, inventory, conversationTexts);
      console.log("Command result:", result);
      
      setResponse(result.response);
      
      if (isAudioEnabled) {
        if (speechUtteranceRef.current) {
          speechUtteranceRef.current.stop();
        }
        
        speechUtteranceRef.current = speakText(result.response);
      }

      if (result.charts && result.charts.length > 0) {
        setCharts(result.charts);
      } else if (result.action === 'view' || 
                (result.action === 'query' && input.toLowerCase().includes('stoc'))) {
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
