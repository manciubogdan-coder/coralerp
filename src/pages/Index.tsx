import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-custom-toast";
import { useToast } from "@/components/ui/use-toast";
import { Command } from "cmdk";
import { Search, RefreshCw, Mic, Settings, HelpCircle } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { InventoryItem } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { exportToExcel } from "@/lib/excelExport";
import { speakText } from "@/lib/speechService";

const Index = () => {
  const navigate = useNavigate();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const { toast: useToastHook } = useToast();

  useEffect(() => {
    // Verificăm dacă există setarea pentru audio în localStorage
    const savedAudioSetting = localStorage.getItem('inventoryAudioEnabled');
    if (savedAudioSetting !== null) {
      setIsAudioEnabled(savedAudioSetting === 'true');
    }

    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("inventory")
        .select("*")
        .order("name");

      if (error) {
        throw error;
      }

      setInventory(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Eroare la încărcarea inventarului",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const filteredInventory = inventory.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleRefresh = () => {
    fetchInventory();

    if (isAudioEnabled) {
      speakText("Inventarul a fost actualizat.");
    }

    toast({
      title: "Reîmprospătare",
      description: "Inventarul a fost actualizat.",
    });
  };

  const toggleCommandPalette = () => {
    setIsCommandPaletteOpen(!isCommandPaletteOpen);
  };

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

  const handleExportExcelClick = () => {
    const processedData = inventory.map(item => ({
      Nume: item.name,
      Cantitate: item.quantity,
      Unitate: item.unit,
      Furnizor: item.supplier || '-',
      'Nr. Document': item.document_number || '-',
      'Data Recepție': item.receipt_date ? new Date(item.receipt_date).toLocaleDateString('ro-RO') : '-'
    }));

    exportToExcel(processedData);

    toast({
      title: "Export realizat",
      description: "Fișierul Excel a fost generat și descărcat."
    });
  };

  const someFunction = (param1: any, defaultParam2: any, defaultParam3: any) => {
    console.log("someFunction called", param1, defaultParam2, defaultParam3);
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

        <div className="mb-4 flex items-center">
          <div className="relative w-full md:flex-1 md:mr-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="search"
              placeholder="Caută în inventar..."
              value={searchTerm}
              onChange={handleSearch}
              className="pl-10"
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleExportExcelClick}>
            Export Excel
          </Button>
        </div>

        <div className="bg-white rounded-lg shadow-md">
          {loading ? (
            <div className="p-4">Se încarcă inventarul...</div>
          ) : filteredInventory.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="p-3 text-left">Nume</th>
                  <th className="p-3 text-left">Cantitate</th>
                  <th className="p-3 text-left">Unitate</th>
                  <th className="p-3 text-left">Furnizor</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.map((item) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="p-3">{item.name}</td>
                    <td className="p-3">{item.quantity}</td>
                    <td className="p-3">{item.unit}</td>
                    <td className="p-3">{item.supplier || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-4">Niciun produs găsit în inventar.</div>
          )}
        </div>
      </main>

      <Footer />

      <Command
        className="dark"
        open={isCommandPaletteOpen}
        onOpenChange={setIsCommandPaletteOpen}
      >
        <Command.Dialog>
          <Command.Input placeholder="Caută comenzi sau tastează un command" />
          <Command.List>
            <Command.Empty>Nu am găsit nimic.</Command.Empty>

            <Command.Group heading="Setări">
              <Command.Item
                onSelect={() => {
                  setIsCommandPaletteOpen(false);
                  navigate("/dashboard/settings");
                }}
              >
                <Settings className="mr-2 h-4 w-4" />
                Setări
              </Command.Item>
            </Command.Group>

            <Command.Group heading="Ajutor">
              <Command.Item
                onSelect={() => {
                  setIsCommandPaletteOpen(false);
                  navigate("/dashboard/help");
                }}
              >
                <HelpCircle className="mr-2 h-4 w-4" />
                Ajutor
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command.Dialog>
      </Command>
    </div>
  );
};

export default Index;
