
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [response, setResponse] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const conversationsEndRef = useRef<HTMLDivElement>(null);

  // Set up speech recognition
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

  // Load inventory data from Supabase
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
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
        setTranscript("");
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
    } catch (error) {
      console.error("Error saving conversation:", error);
    }
  };

  const updateInventoryItem = async (item: InventoryItem) => {
    try {
      if (item.id) {
        // Update existing item
        const { error } = await supabase
          .from('inventory')
          .update({
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id);
          
        if (error) throw error;
      } else {
        // Add new item
        const { error } = await supabase
          .from('inventory')
          .insert({
            name: item.name,
            quantity: item.quantity,
            unit: item.unit
          });
          
        if (error) throw error;
      }
      
      // Refresh inventory
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
      // Save conversation
      await saveConversation(input);
      
      // Process the command with AI
      const result = await processCommand(input, inventory);
      setResponse(result.response);

      // Handle inventory updates if needed
      if (result.action === 'add' || result.action === 'remove') {
        if (result.item) {
          // Check if item exists in inventory
          const existingItemIndex = inventory.findIndex(
            item => item.name.toLowerCase() === result.item?.name.toLowerCase()
          );
          
          if (existingItemIndex >= 0) {
            // Update existing item
            const updatedItem = {
              ...inventory[existingItemIndex],
              quantity: result.action === 'add' 
                ? inventory[existingItemIndex].quantity + result.item.quantity
                : Math.max(0, inventory[existingItemIndex].quantity - result.item.quantity)
            };
            
            await updateInventoryItem(updatedItem);
          } else if (result.action === 'add') {
            // Add new item
            await updateInventoryItem(result.item);
          }
        }
      } else if (result.action === 'export') {
        exportToExcel(inventory);
      } else if (result.action === 'email') {
        await sendEmail(inventory);
        toast({
          title: "Email trimis",
          description: "Raportul a fost trimis pe email."
        });
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
        {/* Left Panel - Voice Commands */}
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
        
        {/* Right Panel - Inventory Management */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow-md p-4">
            <form onSubmit={handleSubmit} className="flex space-x-2">
              <Input
                placeholder="Introduceți comanda (ex: Adaugă 5kg roșii)"
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
