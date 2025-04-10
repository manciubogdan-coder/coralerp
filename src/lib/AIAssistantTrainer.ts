
import { supabase } from "@/integrations/supabase/client";

// Model simplu pentru învățarea automată din conversații
interface ConversationPair {
  userMessage: string;
  aiResponse: string; 
  timestamp: Date;
}

// Cache pentru conversații recente pentru învățare continuă
let recentConversations: ConversationPair[] = [];

// Cuvinte frecvente care nu ajută la identificarea contextului
const stopWords = ['de', 'la', 'pe', 'un', 'o', 'în', 'din', 'și', 'sau', 'pentru', 'cu', 'ce', 'care', 'este', 'sunt'];

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
    
    // Actualizăm cache-ul pentru învățare continuă
    if (bestMatch.similarity > 0) {
      recentConversations.unshift({
        userMessage: normalizedCommand,
        aiResponse: bestMatch.response,
        timestamp: new Date()
      });
      
      // Limităm dimensiunea cache-ului
      if (recentConversations.length > 50) {
        recentConversations.pop();
      }
    }
    
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
  // Adăugăm în cache pentru învățarea continuă
  recentConversations.unshift({
    userMessage: userMessage.toLowerCase().trim(),
    aiResponse,
    timestamp: new Date()
  });
  
  // Limităm dimensiunea cache-ului
  if (recentConversations.length > 50) {
    recentConversations.pop();
  }
};
