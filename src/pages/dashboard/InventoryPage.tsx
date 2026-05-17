
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-custom-toast";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import InventoryManagement from "@/components/dashboard/InventoryManagement";
import { speakText } from "@/lib/speechService";

const InventoryPage = () => {
  const navigate = useNavigate();
  const [isAudioEnabled, setIsAudioEnabled] = React.useState(true);
  
  useEffect(() => {
    const savedAudioSetting = localStorage.getItem('inventoryAudioEnabled');
    if (savedAudioSetting !== null) {
      setIsAudioEnabled(savedAudioSetting === 'true');
    }
  }, []);
  
  const toggleAudio = () => {
    const newAudioSetting = !isAudioEnabled;
    setIsAudioEnabled(newAudioSetting);
    localStorage.setItem('inventoryAudioEnabled', String(newAudioSetting));
    
    toast({
      title: newAudioSetting ? "Audio activat" : "Audio dezactivat",
      description: newAudioSetting ? 
        "Răspunsurile vocale au fost activate." : 
        "Răspunsurile vocale au fost dezactivate."
    });
  };
  
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <main className="flex-1 container mx-auto px-2 md:px-6 py-2 md:py-6">
        <div className="mb-4 md:mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-0">
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate("/dashboard")}
              className="w-full md:w-auto justify-center md:justify-start"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Înapoi la panou
            </Button>
            <h1 className="text-xl md:text-2xl font-bold">Gestionare Stoc Depozit</h1>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleAudio}
            title={isAudioEnabled ? "Dezactivează răspunsurile vocale" : "Activează răspunsurile vocale"}
            className="h-9 w-9"
          >
            <Mic className={`h-4 w-4 ${isAudioEnabled ? "text-green-500" : "text-gray-400"}`} />
          </Button>
        </div>
        
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <InventoryManagement />
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default InventoryPage;
