
import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  Settings,
  FileSearch,
  Home,
  Mail,
  Mic,
  Pause,
  RefreshCw,
  Users2,
  Volume2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-custom-toast";
import { speakText, improveVoiceCommand, parseUserResponse, getMissingFieldsQuestion } from "@/lib/speechService";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";

// Declarația pentru SpeechRecognition pentru TypeScript
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const Index = () => {
  const navigate = useNavigate();
  const [command, setCommand] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [response, setResponse] = useState("");
  const [conversationHistory, setConversationHistory] = useState<string[]>([]);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [speechRecognition, setSpeechRecognition] = useState<any>(null);
  const commandInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    // Verificăm dacă SpeechRecognition este disponibil în browser
    if (typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      setSpeechRecognition(new SpeechRecognition());
    } else {
      console.log("Speech Recognition API is not supported in this browser.");
      toast({
        title: "Browser Incompatibil",
        description: "API-ul Speech Recognition nu este suportat de acest browser.",
        variant: "destructive",
      });
    }

    // Verificăm dacă setarea pentru audio este salvată în localStorage
    const savedAudioSetting = localStorage.getItem('audioEnabled');
    if (savedAudioSetting !== null) {
      setAudioEnabled(savedAudioSetting === 'true');
    }
  }, []);

  useEffect(() => {
    if (speechRecognition) {
      speechRecognition.continuous = false;
      speechRecognition.interimResults = false;
      speechRecognition.lang = 'ro-RO';

      speechRecognition.onstart = () => {
        console.log("Ascultare pornită...");
        setIsListening(true);
      };

      speechRecognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result: any) => result.transcript)
          .join('');
        console.log("Transcriere:", transcript);
        setCommand(transcript);
      };

      speechRecognition.onend = () => {
        console.log("Ascultare oprită.");
        setIsListening(false);
        if (command) {
          processCommand(command);
        }
      };

      speechRecognition.onerror = (event: any) => {
        console.error("Eroare Speech Recognition:", event.error);
        setIsListening(false);
        toast({
          title: "Eroare de microfon",
          description: `A apărut o eroare la utilizarea microfonului: ${event.error}`,
          variant: "destructive",
        });
      };
    }

    return () => {
      if (speechRecognition) {
        speechRecognition.onstart = null;
        speechRecognition.onresult = null;
        speechRecognition.onend = null;
        speechRecognition.onerror = null;
      }
    };
  }, [speechRecognition, command]);

  const startListening = () => {
    if (speechRecognition) {
      try {
        speechRecognition.start();
      } catch (error: any) {
        console.error("Eroare la pornirea ascultării:", error);
        toast({
          title: "Eroare de microfon",
          description: "Microfonul este deja în uz sau nu este disponibil.",
          variant: "destructive",
        });
        setIsListening(false);
      }
    } else {
      toast({
        title: "Browser Incompatibil",
        description: "API-ul Speech Recognition nu este suportat de acest browser.",
        variant: "destructive",
      });
    }
  };

  const stopListening = () => {
    if (speechRecognition) {
      speechRecognition.stop();
      setIsListening(false);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCommand(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processCommand(command);
  };

  const processCommand = async (cmd: string) => {
    if (!cmd.trim()) return;

    setIsProcessing(true);
    let enhancedCommand = cmd;

    try {
      enhancedCommand = await improveVoiceCommand(cmd);
      console.log("Comanda îmbunătățită:", enhancedCommand);
      setCommand(enhancedCommand);

      // Adăugăm comanda îmbunătățită în istoricul conversației
      setConversationHistory(prevHistory => [...prevHistory, `Utilizator: ${enhancedCommand}`]);

      // Așteptăm 1 secundă înainte de a procesa comanda
      await new Promise(resolve => setTimeout(resolve, 1000));

      const { data: inventory } = await supabase
        .from("inventory")
        .select("*");

      const { data: suppliers } = await supabase
        .from("suppliers")
        .select("*");

      const { action, response: initialResponse, item, needsMoreInfo } = await parseUserResponse(
        enhancedCommand,
        inventory || [],
        suppliers || []
      );

      let finalResponse = initialResponse;

      if (needsMoreInfo) {
        if (needsMoreInfo.type === 'missing_fields') {
          const missingFieldsQuestion = getMissingFieldsQuestion(needsMoreInfo.question);
          finalResponse = missingFieldsQuestion || "Nu am înțeles pe deplin. Poți oferi mai multe detalii?";
        } else {
          finalResponse = needsMoreInfo.question || "Nu am înțeles pe deplin. Poți oferi mai multe detalii?";
        }
      }

      setResponse(finalResponse);
      setConversationHistory(prevHistory => [...prevHistory, `AI: ${finalResponse}`]);

      if (audioEnabled) {
        speakText(finalResponse);
      }

      if (action === 'add' && item) {
        // Așteptăm ca răspunsul vocal să se termine înainte de a naviga
        setTimeout(() => {
          navigate('/dashboard/inventory');
        }, 3000);
      }

    } catch (error: any) {
      console.error("Eroare la procesarea comenzii:", error);
      setResponse(`A apărut o eroare: ${error.message}`);
      setConversationHistory(prevHistory => [...prevHistory, `AI: A apărut o eroare: ${error.message}`]);
      if (audioEnabled) {
        speakText(`A apărut o eroare: ${error.message}`);
      }
      toast({
        title: "Eroare la procesarea comenzii",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const clearCommand = () => {
    setCommand("");
    if (commandInputRef.current) {
      commandInputRef.current.focus();
    }
  };

  const toggleAudio = () => {
    const newSetting = !audioEnabled;
    setAudioEnabled(newSetting);
    localStorage.setItem('audioEnabled', String(newSetting));

    toast({
      title: newSetting ? "Audio activat" : "Audio dezactivat",
      description: newSetting ?
        "Răspunsurile vocale au fost activate." :
        "Răspunsurile vocale au fost dezactivate."
    });
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Panou de Control
          </h1>
        </div>
      </header>

      <main className="flex-1 p-4">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Comenzi rapide */}
          <section className="bg-white shadow overflow-hidden rounded-md p-4">
            <h2 className="text-lg font-semibold text-gray-700 mb-3">Comenzi rapide</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button variant="outline" className="justify-start" onClick={() => navigate("/dashboard")}>
                <Home className="h-5 w-5 mr-2" />
                Mergi la Dashboard
              </Button>
              <Button variant="outline" className="justify-start" onClick={() => navigate("/dashboard/inventory")}>
                <FileSearch className="h-5 w-5 mr-2" />
                Vezi Inventarul
              </Button>
              <Button variant="outline" className="justify-start" onClick={() => navigate("/dashboard/products")}>
                <BarChart3 className="h-5 w-5 mr-2" />
                Vezi Produsele
              </Button>
              <Button variant="outline" className="justify-start" onClick={() => navigate("/dashboard/suppliers")}>
                <Users2 className="h-5 w-5 mr-2" />
                Vezi Furnizorii
              </Button>
              <Button variant="outline" className="justify-start" onClick={() => navigate("/dashboard/manufacturers")}>
                <Settings className="h-5 w-5 mr-2" />
                Vezi Producătorii
              </Button>
              <Button variant="outline" className="justify-start" onClick={() => {
                navigator.clipboard.writeText(response);
                toast({ description: "Răspuns copiat în clipboard!" });
              }}>
                <Mail className="h-5 w-5 mr-2" />
                Copiază ultimul răspuns
              </Button>
            </div>
          </section>

          {/* Interacțiunea principală */}
          <section className="bg-white shadow overflow-hidden rounded-md p-4">
            <h2 className="text-lg font-semibold text-gray-700 mb-3">Interacționează cu sistemul</h2>
            <form onSubmit={handleSubmit} className="flex items-center space-x-3">
              <div className="relative flex-grow">
                <input
                  type="text"
                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  placeholder="Introdu comanda ta aici..."
                  value={command}
                  onChange={handleInputChange}
                  ref={commandInputRef}
                  disabled={isProcessing}
                />
                {command && (
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    onClick={clearCommand}
                  >
                    <XCircle className="h-5 w-5" />
                  </button>
                )}
              </div>

              <Button type="submit" disabled={isProcessing}>
                {isProcessing ? (
                  <RefreshCw className="animate-spin h-5 w-5" />
                ) : (
                  "Trimite"
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={toggleListening}
                disabled={isProcessing}
                className="relative"
              >
                {isListening ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Mic className="h-5 w-5" />
                )}
              </Button>
            </form>
          </section>

          {/* Istoricul conversației și răspunsul AI */}
          <section className="bg-white shadow overflow-hidden rounded-md p-4">
            <h2 className="text-lg font-semibold text-gray-700 mb-3">Conversație</h2>
            <div className="space-y-2">
              {conversationHistory.map((message, index) => (
                <div key={index} className="text-sm text-gray-800">
                  {message}
                </div>
              ))}
              {response && (
                <div className="text-gray-900 font-medium">
                  Răspuns: {response}
                </div>
              )}
            </div>
          </section>

          {/* Setări audio */}
          <section className="bg-white shadow overflow-hidden rounded-md p-4">
            <h2 className="text-lg font-semibold text-gray-700 mb-3">Setări</h2>
            <div className="flex items-center space-x-4">
              <label htmlFor="audioToggle" className="text-sm font-medium text-gray-700">
                Răspuns vocal:
              </label>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleAudio}
                title={audioEnabled ? "Dezactivează răspunsurile vocale" : "Activează răspunsurile vocale"}
                className="h-9 w-9"
              >
                <Volume2 className={`h-5 w-5 ${audioEnabled ? "text-green-500" : "text-gray-400"}`} />
              </Button>
            </div>
          </section>
        </div>
      </main>

      <footer className="bg-gray-50 border-t border-gray-200 text-center py-4">
        <p className="text-sm text-gray-500">
          © {new Date().getFullYear()} Sistem de Gestionare a Inventarului. Toate drepturile rezervate.
        </p>
      </footer>
    </div>
  );
};

export default Index;
