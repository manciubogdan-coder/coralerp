
import { supabase } from "@/integrations/supabase/client";

// Model simplu pentru învățarea automată din conversații
interface ConversationPair {
  userMessage: string;
  aiResponse: string; 
  timestamp: Date;
}

// Cache pentru conversații recente pentru învățare continuă
let recentConversations: ConversationPair[] = [];
let isLearningInitialized = false;

// Cuvinte frecvente care nu ajută la identificarea contextului
const stopWords = ['de', 'la', 'pe', 'un', 'o', 'în', 'din', 'și', 'sau', 'pentru', 'cu', 'ce', 'care', 'este', 'sunt'];

/**
 * Inițializează modulul de învățare cu datele din baza de date
 */
const initializeLearning = async () => {
  try {
    if (isLearningInitialized) return;
    
    console.log("Inițializare modul de învățare automată...");
    
    const { data: conversations, error } = await supabase
      .from('conversations')
      .select('*')
      .order('timestamp', { ascending: true })
      .limit(200);
    
    if (error) {
      console.error("Eroare la încărcarea conversațiilor pentru învățare:", error);
      return;
    }
    
    if (conversations && conversations.length > 0) {
      // Construim perechi de conversații (utilizator -> AI)
      for (let i = 0; i < conversations.length - 1; i++) {
        if (i % 2 === 0 && i + 1 < conversations.length) {
          recentConversations.push({
            userMessage: conversations[i].text.toLowerCase().trim(),
            aiResponse: conversations[i+1].text,
            timestamp: new Date(conversations[i].timestamp)
          });
        }
      }
      
      console.log(`Învățare inițializată cu ${recentConversations.length} conversații.`);
    }
    
    isLearningInitialized = true;
  } catch (error) {
    console.error("Eroare la inițializarea învățării:", error);
  }
};

// Încărcăm datele de învățare la importarea modulului
initializeLearning();

/**
 * Procesează un text pentru a extrage cuvinte cheie relevante
 */
const extractKeywords = (text: string): string[] => {
  const words = text.toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
    .split(/\s+/);
    
  return words
    .filter(word => word.length >= 3 && !stopWords.includes(word))
    .filter(word => !word.match(/^\d+$/));
};

/**
 * Calculează similaritatea între două texte pe baza cuvintelor cheie
 */
const calculateSimilarity = (text1: string, text2: string): number => {
  const keywords1 = extractKeywords(text1);
  const keywords2 = extractKeywords(text2);
  
  if (keywords1.length === 0 || keywords2.length === 0) return 0;
  
  let matches = 0;
  keywords1.forEach(word => {
    if (keywords2.includes(word)) matches++;
  });
  
  // Calculăm scorul ca procent din maximul posibil de potriviri
  return matches / Math.max(keywords1.length, keywords2.length);
};

/**
 * Găsește un răspuns relevant pe baza comenzii utilizatorului și a conversațiilor anterioare
 */
export const getRelevantTrainingData = async (userCommand: string): Promise<string | null> => {
  try {
    // Ne asigurăm că modulul de învățare este inițializat
    if (!isLearningInitialized) {
      await initializeLearning();
    }
    
    // Normalizăm comanda utilizatorului
    const normalizedCommand = userCommand.toLowerCase().trim();
    
    // Verificăm mai întâi în cache-ul de conversații recente
    let bestMatch: { similarity: number, response: string } = { similarity: 0, response: '' };
    
    // Căutăm în conversațiile recente
    recentConversations.forEach(conv => {
      const similarity = calculateSimilarity(normalizedCommand, conv.userMessage);
      if (similarity > bestMatch.similarity && similarity > 0.5) {
        bestMatch = { similarity, response: conv.aiResponse };
      }
    });
    
    if (bestMatch.similarity > 0.5) {
      console.log(`Am găsit o potrivire în cache cu similaritatea: ${bestMatch.similarity}`);
      return bestMatch.response;
    }
    
    // Dacă nu am găsit în cache, căutăm în baza de date
    const { data: conversations, error } = await supabase
      .from('conversations')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100);
    
    if (error || !conversations) {
      console.log("Eroare la căutarea în conversații:", error);
      return null;
    }
    
    // Construim perechi de conversații (utilizator -> AI)
    const conversationPairs: ConversationPair[] = [];
    for (let i = 0; i < conversations.length - 1; i++) {
      if (i % 2 === 0 && i + 1 < conversations.length) {
        conversationPairs.push({
          userMessage: conversations[i].text,
          aiResponse: conversations[i+1].text,
          timestamp: new Date(conversations[i].timestamp)
        });
      }
    }
    
    // Căutăm cea mai relevantă conversație
    for (const pair of conversationPairs) {
      const similarity = calculateSimilarity(normalizedCommand, pair.userMessage);
      if (similarity > bestMatch.similarity && similarity > 0.4) {
        bestMatch = { similarity, response: pair.aiResponse };
      }
    }
    
    console.log(`Cea mai bună potrivire are similaritatea: ${bestMatch.similarity}`);
    
    return bestMatch.similarity > 0.4 ? bestMatch.response : null;
  } catch (error) {
    console.error("Eroare la obținerea datelor relevante:", error);
    return null;
  }
};

/**
 * Învață din conversațiile recente - este apelată automat după fiecare răspuns al asistentului
 */
export const learnFromConversation = (userMessage: string, aiResponse: string): void => {
  if (!userMessage || !aiResponse) return;
  
  const normalizedUserMessage = userMessage.toLowerCase().trim();
  
  // Verificăm dacă această conversație este deja învățată
  const isDuplicate = recentConversations.some(conv => 
    conv.userMessage === normalizedUserMessage && conv.aiResponse === aiResponse
  );
  
  if (isDuplicate) {
    console.log("Conversație deja învățată, se omite.");
    return;
  }
  
  console.log(`Învățare nouă: "${normalizedUserMessage.substring(0, 30)}..."`);
  
  // Adăugăm în cache pentru învățarea continuă
  recentConversations.unshift({
    userMessage: normalizedUserMessage,
    aiResponse,
    timestamp: new Date()
  });
  
  // Limităm dimensiunea cache-ului
  if (recentConversations.length > 100) {
    recentConversations.pop();
  }
  
  // Adăugăm și în baza de date pentru învățare pe termen lung (opțional)
  try {
    // În loc să adăugăm direct, vom lăsa procesul normal de salvare a conversațiilor să se ocupe
    console.log("Conversație adăugată în memoria de învățare.");
  } catch (error) {
    console.error("Eroare la salvarea conversației pentru învățare:", error);
  }
};
