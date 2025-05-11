import { CommandResult } from "@/types";

// Adaugă această funcție pentru procesarea comenzilor vocale legate de inventar
export const processInventoryCommand = async (command: string): Promise<CommandResult> => {
  try {
    const lowercaseCmd = command.toLowerCase();
    
    // Comenzi pentru adăugarea de produse în inventar
    if (lowercaseCmd.startsWith('adaugă') || lowercaseCmd.startsWith('adauga')) {
      // Extrage informațiile din comandă
      const match = lowercaseCmd.match(/adaug[ăa]\s+([0-9]+(?:[,.][0-9]+)?)\s*(kg|g|l|buc)\s+(?:de\s+)?([a-zăîâșț]+(?:\s+[a-zăîâșț]+)*)/i);
      
      if (match) {
        const quantity = parseFloat(match[1].replace(',', '.'));
        const unit = match[2];
        const productName = match[3].trim();
        
        // Aici ar trebui să faci apelul către baza de date pentru a adăuga produsul
        // Simulăm un răspuns pentru acum
        return {
          action: 'add',
          response: `Am adăugat ${quantity} ${unit} de ${productName} în inventar.`,
          success: true
        };
      }
    }
    
    // Comenzi pentru eliminarea de produse din inventar
    if (lowercaseCmd.startsWith('scoate') || lowercaseCmd.startsWith('elimină')) {
      // Extrage informațiile din comandă
      const match = lowercaseCmd.match(/(?:scoate|elimină)\s+([0-9]+(?:[,.][0-9]+)?)\s*(kg|g|l|buc)\s+(?:de\s+)?([a-zăîâșț]+(?:\s+[a-zăîâșț]+)*)/i);
      
      if (match) {
        const quantity = parseFloat(match[1].replace(',', '.'));
        const unit = match[2];
        const productName = match[3].trim();
        
        // Aici ar trebui să faci apelul către baza de date pentru a elimina produsul
        // Simulăm un răspuns pentru acum
        return {
          action: 'remove',
          response: `Am scos ${quantity} ${unit} de ${productName} din inventar.`,
          success: true
        };
      }
    }
    
    // Comenzi pentru afișarea stocului
    if (lowercaseCmd.includes('arată stocul') || lowercaseCmd.includes('vezi stocul')) {
      return {
        action: 'show',
        response: 'Aici este stocul curent.',
        success: true
      };
    }
    
    // Comenzi pentru generarea rapoartelor
    if (lowercaseCmd.includes('raport') || lowercaseCmd.includes('generează')) {
      return {
        action: 'report',
        response: 'Am generat raportul solicitat.',
        success: true
      };
    }
    
    // Dacă nu se potrivește cu nicio comandă cunoscută
    return {
      action: 'unknown',
      response: 'Nu am înțeles comanda. Poți să încerci din nou?',
      success: false
    };
  } catch (error) {
    console.error('Eroare la procesarea comenzii:', error);
    return {
      action: 'error',
      response: 'A apărut o eroare la procesarea comenzii.',
      success: false
    };
  }
};
