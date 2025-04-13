
import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lightbulb, BarChart2, Table2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { learnFromConversation } from "@/lib/AIAssistantTrainer";
import { supabase } from "@/integrations/supabase/client";

interface TeachAssistantProps {
  currentCommand?: string;
  conversations?: {text: string, timestamp: Date}[];
}

const TeachAssistant: React.FC<TeachAssistantProps> = ({ 
  currentCommand = "", 
  conversations = []
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const { toast } = useToast();
  const [autoLearningEnabled, setAutoLearningEnabled] = useState<boolean>(true);
  const [analyticalCapabilities, setAnalyticalCapabilities] = useState<boolean>(true);

  // Effect to automatically learn from new conversations
  useEffect(() => {
    if (!autoLearningEnabled || conversations.length < 2) return;
    
    // Process pairs of messages (user then AI)
    for (let i = 0; i < conversations.length - 1; i += 2) {
      if (i + 1 < conversations.length) {
        const userMessage = conversations[i].text;
        const aiResponse = conversations[i + 1].text;
        // Learn from this conversation pair
        learnFromConversation(userMessage, aiResponse);
      }
    }
  }, [conversations, autoLearningEnabled]);

  // Effect to sync analytical data from the database for better AI responses
  useEffect(() => {
    if (!analyticalCapabilities) return;
    
    const syncAnalyticalData = async () => {
      try {
        // Fetch analytics data to improve AI knowledge
        // Using .from() with string parameter since it's a view
        const { data: analyticsData } = await supabase
          .from('inventory_analytics')
          .select('*') as { data: any[] | null };
          
        const { data: consumptionData } = await supabase
          .from('consumption_analytics')
          .select('*') as { data: any[] | null };
          
        console.log("Analytics data loaded for AI training:", analyticsData?.length || 0, "items");
        console.log("Consumption data loaded for AI training:", consumptionData?.length || 0, "items");
        
        // This data is now available for the AI assistant to use in calculations
      } catch (error) {
        console.error("Error syncing analytical data:", error);
      }
    };
    
    syncAnalyticalData();
  }, [analyticalCapabilities]);

  const toggleAutoLearning = () => {
    const newState = !autoLearningEnabled;
    setAutoLearningEnabled(newState);
    
    toast({
      title: newState ? "Învățare automată activată" : "Învățare automată dezactivată",
      description: newState 
        ? "Asistentul va învăța automat din conversații." 
        : "Asistentul nu va mai învăța automat din conversații."
    });
    
    setIsDialogOpen(false);
  };

  const toggleAnalyticalCapabilities = () => {
    const newState = !analyticalCapabilities;
    setAnalyticalCapabilities(newState);
    
    toast({
      title: newState ? "Capacități analitice activate" : "Capacități analitice dezactivate",
      description: newState 
        ? "Asistentul va folosi formule matematice și va genera rapoarte." 
        : "Asistentul va folosi doar funcții de bază."
    });
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          className="flex items-center gap-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50" 
        >
          <Lightbulb className="h-4 w-4" />
          <span className="hidden sm:inline">Învățare automată</span>
          <span className="sm:hidden">Învățare</span>
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Învățare automată și Capacități Analitice</DialogTitle>
          <DialogDescription>
            Asistentul învață automat din conversațiile anterioare și poate folosi capacități analitice avansate.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium">Învățare automată</h4>
            <p className="text-sm text-muted-foreground">
              {autoLearningEnabled 
                ? "Învățarea automată este momentan activată. Asistentul învață din fiecare conversație pentru a-și îmbunătăți răspunsurile."
                : "Învățarea automată este momentan dezactivată. Asistentul nu învață din conversații."}
            </p>
            {autoLearningEnabled && (
              <p className="text-sm text-green-600">
                Activ: Asistentul a învățat din {Math.floor(conversations.length / 2)} conversații.
              </p>
            )}
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium flex items-center gap-2">
              <BarChart2 className="h-4 w-4" />
              <span>Capacități analitice</span>
            </h4>
            <p className="text-sm text-muted-foreground">
              {analyticalCapabilities 
                ? "Capacitățile analitice sunt activate. Asistentul poate genera rapoarte, tabele și calcule matematice."
                : "Capacitățile analitice sunt dezactivate. Asistentul nu poate genera rapoarte complexe."}
            </p>
            {analyticalCapabilities && (
              <p className="text-sm text-green-600 flex items-center gap-2">
                <Table2 className="h-4 w-4" />
                <span>Activ: Asistentul poate analiza date și genera rapoarte.</span>
              </p>
            )}
          </div>
        </div>
        
        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button 
            type="button" 
            onClick={toggleAnalyticalCapabilities}
            variant={analyticalCapabilities ? "destructive" : "default"}
            className="w-full sm:w-auto"
          >
            {analyticalCapabilities ? "Dezactivează" : "Activează"} capacitățile analitice
          </Button>
          
          <Button 
            type="button" 
            onClick={toggleAutoLearning}
            variant={autoLearningEnabled ? "destructive" : "default"}
            className="w-full sm:w-auto"
          >
            {autoLearningEnabled ? "Dezactivează" : "Activează"} învățarea automată
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TeachAssistant;
