
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SimpleInventoryTable from "@/components/SimpleInventoryTable";
import { useInventoryData } from "@/hooks/use-inventory-data";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import VoiceInputButton from "@/components/VoiceInputButton";
import VoiceTranscript from "@/components/VoiceTranscript";
import { CommandResult } from "@/types";
import { toast } from "@/hooks/use-custom-toast";
import { processInventoryCommand } from "@/lib/aiProcessor";
import { speakText } from "@/lib/speechService";
import { ConversationalVoiceAssistant } from "@/components/ConversationalVoiceAssistant";

const InventoryPage = () => {
  const navigate = useNavigate();
  const { inventory, loading, fetchInventory } = useInventoryData();
  const { isRecording, transcript, finalTranscript, toggleRecording, processCommand } = useVoiceInput();
  const [processingCommand, setProcessingCommand] = useState(false);
  
  // Procesează transcriptul final când devine disponibil
  useEffect(() => {
    if (!finalTranscript) return;
    
    const processVoiceCommand = async () => {
      try {
        setProcessingCommand(true);
        const processedCommand = processCommand(finalTranscript);
        
        if (processedCommand === "DUPLICATE_COMMAND") {
          console.log("Comandă duplicată detectată, se ignoră");
          return;
        }
        
        console.log("Procesez comanda:", processedCommand);
        
        if (processedCommand.startsWith("NEED_MORE_INFO:") || 
            processedCommand.startsWith("NEED_OPTIONAL_INFO:")) {
          // Aici am putea adăuga o interfață pentru a solicita mai multe informații
          toast({
            title: "Informații insuficiente",
            description: "Vă rugăm să furnizați mai multe detalii pentru această comandă.",
            variant: "warning"
          });
          return;
        }
        
        // Procesează comanda prin AI sau un alt procesor
        const result = await processInventoryCommand(processedCommand);
        
        if (result) {
          console.log("Rezultat comandă:", result);
          
          if (result.response) {
            toast({
              title: result.action === 'add' ? "Produs adăugat" : 
                     result.action === 'remove' ? "Produs scos" : "Comandă procesată",
              description: result.response,
              variant: "default"
            });
            
            // Opțional: redă răspunsul vocal
            speakText(result.response);
          }
          
          // Reîmprospătează datele de inventar după adăugare/scoatere
          if (result.action === 'add' || result.action === 'remove' || result.action === 'set') {
            fetchInventory();
          }
        }
      } catch (error) {
        console.error("Eroare la procesarea comenzii vocale:", error);
        toast({
          title: "Eroare",
          description: "Nu am putut procesa comanda vocală.",
          variant: "destructive"
        });
      } finally {
        setProcessingCommand(false);
      }
    };
    
    processVoiceCommand();
  }, [finalTranscript, processCommand, fetchInventory]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <main className="flex-1 container mx-auto px-2 sm:px-4 py-2 sm:py-6">
        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h1 className="text-xl sm:text-2xl font-bold">Stoc Produse</h1>
          
          <div className="flex items-center gap-2">
            <ConversationalVoiceAssistant onOperationComplete={fetchInventory} />
            <VoiceInputButton 
              isRecording={isRecording} 
              toggleRecording={toggleRecording} 
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/dashboard/inventory")}
              className="flex items-center gap-1"
            >
              <MessageSquare className="h-4 w-4" />
              <span className="hidden md:inline">Asistent</span>
            </Button>
          </div>
        </div>
        
        <VoiceTranscript transcript={transcript} isRecording={isRecording} />
        
        <div className="bg-white rounded-lg shadow-md mt-2">
          {loading || processingCommand ? (
            <div className="p-4 sm:p-8 text-center text-gray-500">
              {processingCommand ? "Se procesează comanda..." : "Se încarcă datele..."}
            </div>
          ) : (
            <SimpleInventoryTable inventory={inventory} />
          )}
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default InventoryPage;
