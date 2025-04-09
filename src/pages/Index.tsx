import React, { useState, useEffect, useRef } from "react";
import { toast } from "@/hooks/use-toast";
import { Mic, MicOff, Send, Download, Mail, ListFilter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import VoiceCommandPanel from "@/components/VoiceCommandPanel";
import InventoryTable from "@/components/InventoryTable";
import { processCommand } from "@/lib/aiProcessor";
import { InventoryItem } from "@/types";
import { exportToExcel } from "@/lib/excelExport";
import { sendEmail } from "@/lib/emailService";
import { supabase } from "@/integrations/supabase/client";

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
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const conversationsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognitionConstructor();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'ro-RO';

      recognitionRef.current.onresult = (event) => {
        const current = event.resultIndex;
        if (event.results[current].isFinal) {
          const transcriptText = event.results[current][0].transcript;
          setTranscript(transcriptText);
          setInputText(transcriptText);
          
          if (transcriptText.trim()) {
            setTimeout(() => {
              processUserInput(transcriptText);
              setIsRecording(false);
              if (recognitionRef.current) {
                recognitionRef.current.stop();
              }
            }, 500);
          }
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        setIsRecording(false);
        toast({
          variant: "destructive",
          title: "Eroare la înregistrarea vocii",
          description: `A apărut o eroare: ${event.error}`
        });
      };
    } else {
      toast({
        variant: "destructive",
        title: "Recunoașterea vocală nu este suportată",
        description: "Browserul dvs. nu suportă recunoașterea vocală."
      });
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
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
          title: "Eroare la încărcarea stocului",
          description: "Nu s-a putut încărca stocul. Verificați conexiunea."
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
        processUserInput(transcript);
      }
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
        setTranscript("");
        
        setInputText("");
        setResponse("");
      } catch (error) {
        console.error("Error starting speech recognition:", error);
        toast({
          variant: "destructive",
          title: "Eroare",
          description: "Nu s-a putut porni înregistrarea vocii."
        });
      }
    }
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
      
      // Check if item with same name, supplier AND batch_number exists
      let existingItem = null;
      
      if (item.batch_number) {
        const { data } = await supabase
          .from('inventory')
          .select('*')
          .eq('name', item.name)
          .eq('supplier', item.supplier || null)
          .eq('batch_number', item.batch_number)
          .maybeSingle();
          
        existingItem = data;
      }
      
      if (existingItem?.id) {
        // Update existing record with same name + supplier + batch_number
        const { error } = await supabase
          .from('inventory')
          .update({
            quantity: item.action === 'add' 
              ? Number(existingItem.quantity) + Number(item.quantity)
              : item.action === 'remove' 
                ? Math.max(0, Number(existingItem.quantity) - Number(item.quantity))
                : Number(item.quantity),
            pallets: item.pallets !== undefined 
              ? (item.action === 'add' 
                ? (existingItem.pallets || 0) + item.pallets
                : item.action === 'set' 
                  ? item.pallets
                  : existingItem.pallets || 0)
              : existingItem.pallets || 0,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingItem.id);
          
        if (error) throw error;
      } else if (item.id) {
        // Update existing record by ID
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
          
        if (error) throw error;
      } else {
        // Insert new record
        const { error } = await supabase
          .from('inventory')
          .insert({
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            supplier: item.supplier || null,
            batch_number: item.batch_number || null,
            pallets: item.pallets || 0,
            receipt_date: receipt_date
          });
          
        if (error) throw error;
      }
      
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
      
      toast({
        title: "Operațiune reușită",
        description: `${item.quantity} ${item.unit} de ${item.name} ${item.supplier ? `de la ${item.supplier}` : ''} ${item.batch_number ? `(lot ${item.batch_number})` : ''} ${existingItem ? 'actualizat' : 'adăugat'} în stoc.`,
      });
      
    } catch (error) {
      console.error("Error updating inventory:", error);
      toast({
        variant: "destructive",
        title: "Eroare",
        description: "Nu s-a putut actualiza stocul."
      });
    }
  };

  const processUserInput = async (input: string) => {
    if (!input.trim()) return;
    
    setIsProcessing(true);
    setResponse("");
    
    try {
      await saveConversation(input);
      
      const result = await processCommand(input, inventory, conversationTexts);
      console.log("Command result:", result);
      
      setResponse(result.response);

      if (result.needsMoreInfo) {
        setAwaitingMoreInfo(true);
        await saveConversation(result.response);
        setResponse(result.needsMoreInfo.question);
        
        toast({
          title: "Informații suplimentare necesare",
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
                
                const responseText = `Există ${matchingItems.length} loturi diferite de ${result.item.name} în stoc. Din care lot doriți să eliminați?\n\n${batchInfo}`;
                
                await saveConversation(responseText);
                setResponse(responseText);
                setAwaitingMoreInfo(true);
                setIsProcessing(false);
                return;
              } else if (matchingItems.length === 1 && !result.item.id) {
                updatedItem.id = matchingItems[0].id;
                updatedItem.batch_number = matchingItems[0].batch_number;
                updatedItem.supplier = matchingItems[0].supplier;
              } else if (matchingItems.length === 0) {
                toast({
                  variant: "destructive",
                  title: "Produsul nu există",
                  description: `Nu s-a găsit produsul "${result.item.name}" în stoc.`
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
            description: "Fișierul Excel a fost generat și descărcat."
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
        description: "A apărut o eroare la procesarea comenzii."
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
      description: "Fișierul Excel a fost generat și descărcat."
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
      
      <main className="flex-1 container mx-auto p-4 md:p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <VoiceCommandPanel 
            isRecording={isRecording}
            toggleRecording={toggleRecording}
            transcript={transcript}
            conversations={conversations}
            response={response}
            conversationsEndRef={conversationsEndRef}
          />
        </div>
        
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow-md p-4">
            <form onSubmit={handleSubmit} className="flex space-x-2">
              <Input
                placeholder={awaitingMoreInfo 
                  ? "Răspundeți la întrebarea asistentului..." 
                  : "Ce ai vrea să faci? (ex: Adaugă 5kg roșii sau Câte loturi de mentă avem?)"
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
                <Send className="h-4 w-4 mr-2" />
                Trimite
              </Button>
            </form>
          </div>
          
          <div className="bg-white rounded-lg shadow-md">
            <div className="border-b border-gray-200 p-4 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                <ListFilter className="h-5 w-5 mr-2 text-coral-DEFAULT" />
                Stoc produse
              </h2>
              <div className="flex space-x-2">
                <Button variant="outline" size="sm" onClick={handleExportExcel}>
                  <Download className="h-4 w-4 mr-2" />
                  Excel
                </Button>
                <Button variant="outline" size="sm" onClick={handleSendEmail}>
                  <Mail className="h-4 w-4 mr-2" />
                  Email
                </Button>
              </div>
            </div>
            <InventoryTable inventory={inventory} />
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Index;
