import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-custom-toast";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CurrentInventoryTable from "@/components/CurrentInventoryTable";
import { speakText } from "@/lib/speechService";

const InventoryPage = () => {
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [isAudioEnabled, setIsAudioEnabled] = React.useState(true);
  
  const handleRefresh = () => {
    console.log("Refreshing inventory data...");
    setRefreshKey(prevKey => prevKey + 1);
    
    if (isAudioEnabled) {
      speakText("Datele din inventar au fost actualizate.");
    }
    
    toast({
      title: "Reîmprospătare",
      description: "Datele din inventar au fost actualizate."
    });
  };
  
  useEffect(() => {
    // Verificăm dacă există setarea pentru audio în localStorage
    const savedAudioSetting = localStorage.getItem('inventoryAudioEnabled');
    if (savedAudioSetting !== null) {
      setIsAudioEnabled(savedAudioSetting === 'true');
    }
    
    // Adăugăm un refresh la încărcarea paginii pentru a ne asigura că datele sunt la zi
    console.log("Inventory page loaded, triggering initial data refresh");
    setRefreshKey(prevKey => prevKey + 1);
  }, []);
  
  const toggleAudio = () => {
    const newSetting = !isAudioEnabled;
    setIsAudioEnabled(newSetting);
    localStorage.setItem('inventoryAudioEnabled', String(newSetting));
    
    toast({
      title: newSetting ? "Audio activat" : "Audio dezactivat",
      description: newSetting ? 
        "Răspunsurile vocale au fost activate." : 
        "Răspunsurile vocale au fost dezactivate."
    });
  };
  
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <main className="flex-1 container mx-auto p-4 md:p-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate("/dashboard")}
              className="mr-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Înapoi la panou
            </Button>
            <h1 className="text-2xl font-bold">Gestionare Inventar</h1>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleAudio}
              title={isAudioEnabled ? "Dezactivează răspunsurile vocale" : "Activează răspunsurile vocale"}
              className="h-9 w-9"
            >
              <Mic className={`h-4 w-4 ${isAudioEnabled ? "text-green-500" : "text-gray-400"}`} />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              title="Reîmprospătează datele din inventar"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reîmprospătează
            </Button>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md">
          <CurrentInventoryTable inventory={inventory} />
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default InventoryPage;
