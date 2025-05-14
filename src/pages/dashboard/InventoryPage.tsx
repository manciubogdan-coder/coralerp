
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import InventoryManagement from "@/components/dashboard/InventoryManagement";
import { speakText } from "@/lib/speechService";

const InventoryPage = () => {
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [isAudioEnabled, setIsAudioEnabled] = React.useState(true);
  
  const handleRefresh = () => {
    console.log("Refreshing inventory data...");
    setRefreshKey(prevKey => prevKey + 1);
    
    if (isAudioEnabled) {
      speakText("Datele din stoc au fost actualizate.");
    }
    
    toast({
      title: "Reîmprospătare",
      description: "Datele din stoc au fost actualizate."
    });
  };
  
  useEffect(() => {
    const savedAudioSetting = localStorage.getItem('inventoryAudioEnabled');
    if (savedAudioSetting !== null) {
      setIsAudioEnabled(savedAudioSetting === 'true');
    }
    
    console.log("Inventory page loaded, triggering initial data refresh");
    setRefreshKey(prevKey => prevKey + 1);
  }, []);
  
  const toggleAudio = () => {
    const newState = !isAudioEnabled;
    setIsAudioEnabled(newState);
    localStorage.setItem('inventoryAudioEnabled', String(newSetting));
    
    toast({
      title: newState ? "Audio activat" : "Audio dezactivat",
      description: newState ? 
        "Răspunsurile vocale au fost activate." : 
        "Răspunsurile vocale au fost dezactivate."
    });
  };
  
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <main className="flex-1 container mx-auto p-2 md:p-6">
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
          
          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
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
              title="Reîmprospătează datele din stoc"
              className="w-full md:w-auto justify-center"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reîmprospătează
            </Button>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <InventoryManagement key={refreshKey} />
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default InventoryPage;
