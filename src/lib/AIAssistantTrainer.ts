
import { supabase } from "@/integrations/supabase/client";

interface TrainingEntry {
  id: string;
  command: string;
  explanation: string;
  learned: boolean;
  created_at: string;
  updated_at: string;
}

export const getRelevantTrainingData = async (userCommand: string): Promise<string | null> => {
  try {
    // Normalizăm comanda utilizatorului
    const normalizedCommand = userCommand.toLowerCase().trim();
    
    // Căutăm cuvinte cheie din comanda utilizatorului
    const keywords = extractKeywords(normalizedCommand);
    
    if (keywords.length === 0) return null;
    
    // Construim interogarea pentru a căuta intrări relevante în baza de date de antrenare
    const { data, error } = await supabase
      .rpc('search_assistant_training', { search_term: keywords[0] });
    
    if (error || !data || data.length === 0) {
      console.log("Nu am găsit date de antrenare relevante:", error);
      return null;
    }
    
    // Calculăm relevanța pentru fiecare intrare de antrenare
    const rankedEntries = data.map((entry: any) => {
      const relevanceScore = calculateRelevance(normalizedCommand, entry.command, keywords);
      return { ...entry, relevanceScore };
    });
    
    // Sortăm intrările după scorul de relevanță
    rankedEntries.sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    // Returnăm explicația intrării cea mai relevantă dacă scorul este suficient de mare
    if (rankedEntries[0]?.relevanceScore > 0.5) {
      return rankedEntries[0].explanation;
    }
    
    return null;
  } catch (error) {
    console.error("Eroare la obținerea datelor de antrenare:", error);
    return null;
  }
};

// Extrage cuvinte cheie dintr-o comandă
const extractKeywords = (command: string): string[] => {
  // Eliminăm cuvintele foarte comune
  const stopWords = ['de', 'la', 'pe', 'un', 'o', 'în', 'din', 'și', 'sau', 'pentru', 'cu', 'ce', 'care'];
  
  // Împărțim textul în cuvinte
  const words = command.split(/\s+/);
  
  // Filtrăm cuvintele cu lungime mai mare sau egală cu 3 și care nu sunt în lista de stopwords
  return words
    .filter(word => word.length >= 3 && !stopWords.includes(word))
    .filter(word => !word.match(/^\d+$/)); // Excludem numerele
};

// Calculează relevanța între două comenzi
const calculateRelevance = (userCommand: string, trainingCommand: string, keywords: string[]): number => {
  let score = 0;
  const normalizedTraining = trainingCommand.toLowerCase();
  
  // Verificăm cât de multe cuvinte cheie se regăsesc în comanda de antrenare
  keywords.forEach(keyword => {
    if (normalizedTraining.includes(keyword)) {
      score += 1;
    }
  });
  
  // Normalizăm scorul în funcție de numărul de cuvinte cheie
  if (keywords.length > 0) {
    score = score / keywords.length;
    
    // Bonus pentru potriviri exacte
    if (userCommand === normalizedTraining) {
      score = 1;
    } else if (normalizedTraining.includes(userCommand) || userCommand.includes(normalizedTraining)) {
      score += 0.3;
    }
  }
  
  return Math.min(1, score); // Asigurăm că scorul este între 0 și 1
};

export const addTrainingEntry = async (command: string, explanation: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .rpc('add_assistant_training', { 
        p_command: command.toLowerCase(), 
        p_explanation: explanation 
      });
      
    return !error;
  } catch (error) {
    console.error("Eroare la adăugarea intrării de antrenare:", error);
    return false;
  }
};
