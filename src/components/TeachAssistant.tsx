
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
import { Lightbulb } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { learnFromConversation } from "@/lib/AIAssistantTrainer";

interface TeachAssistantProps {
  currentCommand?: string;
  conversations?: {text: string, timestamp: Date}[];
}

const TeachAssistant: React.FC<TeachAssistantProps> = ({ 
  currentCommand = "", 
  conversations = []
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const [autoLearningEnabled, setAutoLearningEnabled] = useState(true);

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
          <DialogTitle>Învățare automată</DialogTitle>
          <DialogDescription>
            Asistentul învață automat din conversațiile anterioare și îmbunătățește răspunsurile în timp.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <p className="text-sm">
            {autoLearningEnabled 
              ? "Învățarea automată este momentan activată. Asistentul învață din fiecare conversație pentru a-și îmbunătăți răspunsurile."
              : "Învățarea automată este momentan dezactivată. Asistentul nu învață din conversații."}
          </p>
          {autoLearningEnabled && (
            <p className="text-sm mt-2 text-green-600">
              Activ: Asistentul a învățat din {Math.floor(conversations.length / 2)} conversații.
            </p>
          )}
        </div>
        
        <DialogFooter>
          <Button 
            type="button" 
            onClick={toggleAutoLearning}
            variant={autoLearningEnabled ? "destructive" : "default"}
          >
            {autoLearningEnabled ? "Dezactivează" : "Activează"} învățarea automată
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TeachAssistant;
