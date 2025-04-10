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
      recognitionRef.current.maxAlternatives = 5;

      let silenceTimer: number | null = null;
      let finalTranscriptText = "";

      recognitionRef.current.onresult = (event) => {
        const current = event.resultIndex;
        const transcriptText = event.results[current][0].transcript;
        
        let hasStockKeywords = false;
        if (event.results[current].length > 1) {
          for (let i = 0; i < event.results[current].length; i++) {
            const alt = event.results[current][i].transcript.toLowerCase();
            if (alt.includes("stoc") || alt.includes("inventar") || alt.includes("produse") || 
                alt.includes("arata") || alt.includes("vezi") || alt.includes("afiseaza")) {
              hasStockKeywords = true;
              break;
            }
          }
        }
        
        let normalizedTranscript = transcriptText.toLowerCase();
        
        if (normalizedTranscript.includes("arata") && 
            (normalizedTranscript.includes("stoc") || normalizedTranscript.includes("produse"))) {
          normalizedTranscript = "arată stocul";
        }
        
        if (normalizedTranscript.includes("ce") && normalizedTranscript.includes("avem") && 
            (normalizedTranscript.includes("stoc") || normalizedTranscript.includes("depozit"))) {
          normalizedTranscript = "arată stocul";
        }
        
        const displayTranscript = hasStockKeywords ? normalizedTranscript : transcriptText;
        setTranscript(displayTranscript);
        
        if (silenceTimer) {
          window.clearTimeout(silenceTimer);
          silenceTimer = null;
        }

        if (event.results[current].isFinal) {
          finalTranscriptText = hasStockKeywords ? normalizedTranscript : transcriptText;
          
          setInputText(finalTranscriptText);
          
          silenceTimer = window.setTimeout(() => {
            if (finalTranscriptText.trim()) {
              processUserInput(finalTranscriptText);
              setIsRecording(false);
              if (recognitionRef.current) {
                recognitionRef.current.stop();
              }
            }
          }, 3000);
        } else {
          setInputText(displayTranscript);
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
    // ... keep existing code (inventory update logic)
  };

  const processUserInput = async (input: string) => {
    if (!input.trim()) return;
    
    setIsProcessing(true);
    setResponse("");
    setCharts([]);
    
    const isStockCommand = input.toLowerCase().match(/stoc|inventar|produse|arată|vezi|afișează|raport|cantitate/i);
    
    try {
      await saveConversation(input);
      
      const contextInput = input;
      const recentMessages = conversationTexts.slice(-5).join("\n");
      
      const result = await processCommand(contextInput, inventory, conversationTexts);
      console.log("Command result:", result);
      
      let processedResponse = result.response;
      if (isStockCommand && processedResponse.includes("nu am nici o informatie") && inventory.length > 0) {
        processedResponse = `În prezent avem ${inventory.length} produse în stoc. Iată o prezentare generală:`;
        
        result.action = 'view';
      }
      
      setResponse(processedResponse);
      
      if (isAudioEnabled) {
        if (speechUtteranceRef.current) {
          speechUtteranceRef.current.stop();
        }
        
        speechUtteranceRef.current = speakText(processedResponse);
      }

      if (result.charts && result.charts.length > 0) {
        setCharts(result.charts);
      } else if (result.action === 'view' || 
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
