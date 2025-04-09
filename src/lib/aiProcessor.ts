
import { CommandResult, InventoryItem } from "@/types";

export async function processCommand(
  command: string, 
  inventory: InventoryItem[]
): Promise<CommandResult> {
  try {
    const openaiApiKey = "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";
    
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `Ești un asistent inteligent care gestionează marfă. Răspunde în română, scurt, clar. Înțelege expresii naturale și acționează pe baza comenzilor primite.
            Analizează comanda și furnizează un răspuns în format JSON cu următoarea structură:
            {
              "action": "add" | "remove" | "view" | "export" | "email" | "unknown",
              "response": "Răspunsul în text natural pentru utilizator",
              "item": {
                "name": "numele produsului",
                "quantity": numărul (cantitatea),
                "unit": "unitatea de măsură"
              }
            }
            
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
            
            Dacă comanda nu poate fi înțeleasă:
            {
              "action": "unknown",
              "response": "Nu am înțeles comanda. Puteți încerca altceva?"
            }
            
            Actuala stare a inventarului este: ${JSON.stringify(inventory)}
            `
          },
          {
            role: "user",
            content: command
          }
        ],
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
      const parsedResponse = JSON.parse(content);

      return {
        action: parsedResponse.action || "unknown",
        response: parsedResponse.response || "Nu am putut procesa comanda.",
        item: parsedResponse.item || undefined
      };
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError);
      return {
        action: "unknown",
        response: "Nu am putut interpreta răspunsul. Vă rugăm să încercați din nou."
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
