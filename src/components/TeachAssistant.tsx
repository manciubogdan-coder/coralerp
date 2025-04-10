
import React, { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Lightbulb } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { addTrainingEntry } from "@/lib/AIAssistantTrainer";

interface TeachAssistantProps {
  currentCommand?: string;
}

const TeachAssistant: React.FC<TeachAssistantProps> = ({ currentCommand = "" }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [command, setCommand] = useState(currentCommand);
  const [explanation, setExplanation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!command.trim() || !explanation.trim()) {
      toast({
        title: "Completează toate câmpurile",
        description: "Te rog să completezi atât comanda cât și explicația",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Salvăm perechea comandă-explicație folosind funcția din AIAssistantTrainer
      const success = await addTrainingEntry(command.trim(), explanation.trim());

      if (!success) {
        throw new Error("Nu s-a putut salva în baza de date");
      }

      toast({
        title: "Mulțumesc!",
        description: "Voi învăța să procesez această comandă.",
      });
      
      setIsDialogOpen(false);
      setCommand("");
      setExplanation("");
    } catch (error) {
      console.error("Eroare la salvarea datelor de învățare:", error);
      toast({
        title: "Nu am putut salva",
        description: "A apărut o eroare la salvarea informațiilor. Încearcă din nou.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          className="flex items-center gap-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50" 
          onClick={() => setCommand(currentCommand)}
        >
          <Lightbulb className="h-4 w-4" />
          <span className="hidden sm:inline">Învață asistentul</span>
          <span className="sm:hidden">Învață</span>
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Învață asistentul vocal</DialogTitle>
          <DialogDescription>
            Ajută-mă să înțeleg ce vrei să fac când îmi spui această comandă.
            Explain-mi cum ar trebui să procesez această comandă pentru a-ți oferi ce ai nevoie.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-3">
          <div className="grid gap-2">
            <Label htmlFor="command">Comanda</Label>
            <Input
              id="command"
              placeholder="Ex: vezi consumul săptămânal pentru menta"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="explanation">Explicație</Label>
            <Textarea
              id="explanation"
              placeholder="Ex: Verifică toate operațiunile de eliminare pentru produsul menționat din ultima săptămână și arată-mi un grafic cu cantitățile scoase în fiecare zi"
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              rows={5}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => setIsDialogOpen(false)}>
            Anulează
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Se salvează..." : "Salvează"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TeachAssistant;
