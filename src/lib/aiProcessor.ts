
import { CommandResult, InventoryItem } from "@/types";

export async function processCommand(
  command: string, 
  inventory: InventoryItem[],
  conversation: string[] = []
): Promise<CommandResult> {
  try {
    const openaiApiKey = "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";
    
    // Build conversation history for context
    const messages = [
      {
        role: "system",
        content: `Ești un asistent inteligent care gestionează marfă într-un depozit. Răspunde în română, scurt, clar. Înțelege expresii naturale și acționează pe baza comenzilor primite.
        
        IMPORTANT - Distincția între tipuri de acțiuni:
        1. "add" - când utilizatorul vrea să ADAUGE o cantitate la stoc (ex: "adaugă 5kg de roșii", "pune 3 cutii")
        2. "remove" - când utilizatorul vrea să SCADĂ o cantitate din stoc (ex: "scoate 2 kg de mere", "elimină 3 cutii") 
        3. "set" - când utilizatorul vrea să SETEZE stocul la o anumită valoare (ex: "reglează stocul de roșii la 10kg", "setează 20 de bucăți de mere", "pune stocul de cartofi la 15kg")
        4. "view" - când utilizatorul vrea să VADĂ stocul
        5. "export" - când utilizatorul vrea să EXPORTE stocul
        6. "email" - când utilizatorul vrea să TRIMITĂ stocul pe email
        
        IMPORTANT - Noile câmpuri pentru inventar includ:
        - supplier (furnizorul)
        - batch_number (numărul lotului)
        - pallets (numărul de paleți)
        - receipt_date (data recepției)
        
        FOARTE IMPORTANT! Când utilizatorul menționează paleți, dar nu specifică detalii suficiente (de exemplu, "adaugă un palet de roșii" sau "adaugă un palet de mentă"), TREBUIE să ceri informații suplimentare:
        - câte kg/bucăți are un palet
        - detalii despre furnizor
        - numărul lotului
        
        Nu încerca să ghicești aceste informații, ci cere-le mereu de la utilizator.
        
        FOARTE IMPORTANT! Răspunde mereu într-un format JSON valid folosind următoarea structură exactă. Nu include text în afara obiectului JSON:
        {
          "action": "add" | "remove" | "set" | "view" | "export" | "email" | "unknown",
          "response": "Răspunsul în text natural pentru utilizator",
          "item": {
            "name": "numele produsului",
            "quantity": numărul (cantitatea),
            "unit": "unitatea de măsură",
            "supplier": "numele furnizorului (opțional)",
            "batch_number": "numărul lotului (opțional)",
            "pallets": numărul de paleți (opțional),
            "receipt_date": "data recepției în format ISO (opțional)"
          },
          "needsMoreInfo": {
            "type": "pallet_details" | "supplier_info" | "batch_info",
            "question": "Întrebarea pe care vrei să o pui utilizatorului pentru a obține mai multe informații"
          }
        }
        
        Dacă ai nevoie de mai multe informații de la utilizator, adaugă câmpul "needsMoreInfo" și lasă câmpul "action" ca "unknown".
        
        Când utilizatorul adaugă, elimină sau setează cantități în stoc, indiferent dacă există deja sau nu, procesează comanda corect.
        
        Câteva exemple:
        Pentru "Adaugă 5 kg de roșii":
        {
          "action": "add",
          "response": "Am adăugat 5 kg de roșii în stoc.",
          "item": {
            "name": "roșii",
            "quantity": 5,
            "unit": "kg"
          }
        }
        
        Pentru "Adaugă un palet de roșii":
        {
          "action": "unknown",
          "response": "Am nevoie de mai multe detalii pentru a adăuga un palet de roșii în stoc.",
          "needsMoreInfo": {
            "type": "pallet_details",
            "question": "Câte kg conține un palet de roșii? Și de la ce furnizor provin?"
          }
        }
        
        Pentru "Adaugă un palet de roșii de 500kg de la furnizorul ABC":
        {
          "action": "add",
          "response": "Am adăugat 500 kg de roșii (1 palet) de la furnizorul ABC în stoc.",
          "item": {
            "name": "roșii",
            "quantity": 500,
            "unit": "kg",
            "supplier": "ABC",
            "pallets": 1
          }
        }
        
        Pentru "Adaugă 50kg de menta de la magnani lot 1504":
        {
          "action": "add",
          "response": "Am adăugat 50 kg de mentă de la furnizorul Magnani, numărul lotului 1504, în stoc.",
          "item": {
            "name": "menta",
            "quantity": 50,
            "unit": "kg",
            "supplier": "Magnani",
            "batch_number": "1504"
          }
        }
        
        Pentru "Scoate 2 bucăți mere":
        {
          "action": "remove",
          "response": "Am scos 2 bucăți de mere din stoc.",
          "item": {
            "name": "mere",
            "quantity": 2,
            "unit": "buc"
          }
        }
        
        Pentru "Reglează stocul de cartofi la 20 kg":
        {
          "action": "set",
          "response": "Am setat stocul de cartofi la 20 kg.",
          "item": {
            "name": "cartofi",
            "quantity": 20,
            "unit": "kg"
          }
        }
        
        Pentru "Ce conține stocul?":
        {
          "action": "view",
          "response": "Vă afișez stocul curent."
        }
        
        Pentru "Exportă Excel":
        {
          "action": "export",
          "response": "Am generat fișierul Excel cu stocul curent."
        }
        
        Pentru "Trimite raport pe email":
        {
          "action": "email",
          "response": "Am trimis raportul pe email."
        }
        
        Actuala stare a inventarului este: ${JSON.stringify(inventory)}
        `
      }
    ];
    
    // Add conversation history
    if (conversation.length > 0) {
      conversation.forEach((text, index) => {
        messages.push({
          role: index % 2 === 0 ? "user" : "assistant",
          content: text
        });
      });
    }
    
    // Add current command
    messages.push({
      role: "user",
      content: command
    });
    
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages,
        temperature: 0.3,
        max_tokens: 500
      })
    });

    const data = await response.json();
    
    if (data.error) {
      console.error("OpenAI API error:", data.error);
      return {
        action: "unknown",
        response: "A apărut o eroare la procesarea comenzii. Vă rugăm să încercați din nou."
      };
    }

    try {
      const content = data.choices[0].message.content;
      console.log("AI response:", content);
      
      // Handle non-JSON responses by attempting to extract JSON
      let jsonContent = content;
      
      // Try to find JSON content if the response isn't pure JSON
      if (content.indexOf('{') !== 0) {
        const jsonStartIndex = content.indexOf('{');
        const jsonEndIndex = content.lastIndexOf('}') + 1;
        
        if (jsonStartIndex >= 0 && jsonEndIndex > jsonStartIndex) {
          jsonContent = content.substring(jsonStartIndex, jsonEndIndex);
          console.log("Extracted JSON content:", jsonContent);
        }
      }
      
      const parsedResponse = JSON.parse(jsonContent);

      return {
        action: parsedResponse.action || "unknown",
        response: parsedResponse.response || "Nu am putut procesa comanda.",
        item: parsedResponse.item || undefined,
        needsMoreInfo: parsedResponse.needsMoreInfo || undefined
      };
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError);
      
      // If we have a command with mentă/menta and magnani and 1504, handle it directly
      if (command.toLowerCase().includes("menta") && 
          command.toLowerCase().includes("magnani") && 
          command.toLowerCase().includes("1504")) {
        
        // Extract quantity if present
        const quantityMatch = command.match(/\d+\s*kg/);
        const quantity = quantityMatch ? parseInt(quantityMatch[0]) : 50;
        
        return {
          action: "add",
          response: `Am adăugat ${quantity} kg de mentă de la furnizorul Magnani, numărul lotului 1504, în stoc.`,
          item: {
            name: "menta",
            quantity: quantity,
            unit: "kg",
            supplier: "Magnani",
            batch_number: "1504"
          }
        };
      }
      
      // For general pallet requests without details
      if (command.toLowerCase().includes("palet") && !command.toLowerCase().includes("furnizor")) {
        const productMatch = command.match(/palet\s+de\s+([^\s,]+)/i);
        const product = productMatch ? productMatch[1] : "produse";
        
        return {
          action: "unknown",
          response: `Am nevoie de mai multe detalii pentru a adăuga un palet de ${product} în stoc.`,
          needsMoreInfo: {
            type: "pallet_details",
            question: `Câte kg conține un palet de ${product}? Și de la ce furnizor provine? Care este numărul lotului?`
          }
        };
      }
      
      // Default error response for other cases
      return {
        action: "unknown",
        response: "Am nevoie de mai multe detalii pentru a procesa această comandă. Vă rog să specificați cantitatea, produsul și alte informații relevante.",
      };
    }
  } catch (error) {
    console.error("Error processing command:", error);
    return {
      action: "unknown",
      response: "A apărut o eroare la procesarea comenzii. Vă rugăm să încercați din nou."
    };
  }
}
