
import { CommandResult, InventoryItem } from "@/types";

export async function processCommand(
  command: string, 
  inventory: InventoryItem[],
  conversation: string[] = []
): Promise<CommandResult> {
  try {
    const openaiApiKey = "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";
    
    // Handle specific structured commands directly before sending to AI
    const directCommandResult = handleDirectCommand(command, inventory);
    if (directCommandResult) {
      console.log("Direct command handled:", directCommandResult);
      return directCommandResult;
    }
    
    // Build conversation history for context
    const messages = [
      {
        role: "system",
        content: `Ești un asistent inteligent care gestionează marfă într-un depozit. Răspunde în română, ca un uman, utilizând un ton conversațional prietenos. Înțelege expresii naturale și acționează pe baza comenzilor primite.
        
        IMPORTANT - Distincția între tipuri de acțiuni:
        1. "add" - când utilizatorul vrea să ADAUGE o cantitate la stoc (ex: "adaugă 5kg de roșii", "pune 3 cutii")
        2. "remove" - când utilizatorul vrea să SCADĂ o cantitate din stoc (ex: "scoate 2 kg de mere", "elimină 3 cutii") 
        3. "set" - când utilizatorul vrea să SETEZE stocul la o anumită valoare (ex: "reglează stocul de roșii la 10kg", "setează 20 de bucăți de mere", "pune stocul de cartofi la 15kg")
        4. "view" - când utilizatorul vrea să VADĂ stocul
        5. "export" - când utilizatorul vrea să EXPORTE stocul
        6. "email" - când utilizatorul vrea să TRIMITĂ stocul pe email
        7. "query" - când utilizatorul întreabă despre stoc (ex: "câte kg de roșii am?", "ce loturi de mentă am în stoc?")
        
        IMPORTANT - Noile câmpuri pentru inventar includ:
        - supplier (furnizorul)
        - batch_number (numărul lotului)
        - pallets (numărul de paleți)
        - receipt_date (data recepției)
        
        FOARTE IMPORTANT! Când utilizatorul menționează paleți, dar nu specifică detalii suficiente (de exemplu, "adaugă un palet de roșii" sau "adaugă un palet de mentă"), TREBUIE să ceri informații suplimentare:
        - câte kg/bucăți are un palet
        - detalii despre furnizor
        - numărul lotului
        
        Când utilizatorul menționează un lot, înțelege că se referă la "batch_number".
        
        Nu încerca să ghicești aceste informații, ci cere-le mereu de la utilizator într-un mod conversațional, ca și cum ai fi un coleg de muncă. Poți spune: "Îmi poți da mai multe detalii despre paleții de mentă? Câte kg conține un palet? De la ce furnizor provine? Care este numărul lotului?"
        
        FOARTE IMPORTANT! Când utilizatorul vrea să SCOATĂ sau să ELIMINE ceva din stoc, verifică dacă există mai multe loturi din produsul respectiv. Dacă da, îl vei întreba din care lot dorește să scoată produsul.

        FOARTE IMPORTANT! Când utilizatorul întreabă despre stoc (ex: "câte kg de mentă am?", "câte loturi de mentă avem?"), trebuie să răspunzi cu informațiile disponibile. Aceste întrebări trebuie interpretatate cu action "query".
        
        FOARTE IMPORTANT! Răspunde mereu într-un format JSON valid folosind următoarea structură exactă. Nu include text în afara obiectului JSON:
        {
          "action": "add" | "remove" | "set" | "view" | "export" | "email" | "query" | "unknown",
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
            "type": "pallet_details" | "supplier_info" | "batch_info" | "batch_selection",
            "question": "Întrebarea pe care vrei să o pui utilizatorului pentru a obține mai multe informații",
            "options": [
              {
                "id": "id-ul lotului",
                "name": "numele produsului",
                "batch_number": "numărul lotului",
                "supplier": "numele furnizorului",
                "quantity": cantitatea disponibilă,
                "unit": "unitatea de măsură"
              }
            ]
          }
        }
        
        Dacă ai nevoie de mai multe informații de la utilizator, adaugă câmpul "needsMoreInfo" și lasă câmpul "action" ca "unknown".
        
        Când utilizatorul adaugă, elimină sau setează cantități în stoc, indiferent dacă există deja sau nu, procesează comanda corect.

        Analizează cu atenție TOATE comenzile pentru a detecta numărul lotului ("lot" sau "nr lot"), numele furnizorului și cantitatea. Verifică mereu dacă comanda conține informații despre lot și furnizor.
        
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

        Pentru "adauga 50 kg de menta de la magnani nr lot 1505":
        {
          "action": "add",
          "response": "Am adăugat 50 kg de mentă de la furnizorul Magnani, numărul lotului 1505, în stoc.",
          "item": {
            "name": "menta",
            "quantity": 50,
            "unit": "kg",
            "supplier": "Magnani",
            "batch_number": "1505"
          }
        }
        
        Pentru "Scoate 2 kg de mere":
        {
          "action": "remove",
          "response": "Am scos 2 bucăți de mere din stoc.",
          "item": {
            "name": "mere",
            "quantity": 2,
            "unit": "buc"
          }
        }

        Pentru "Scoate 50 kg de menta de la magnani nr lot 1505":
        {
          "action": "remove",
          "response": "Am scos 50 kg de mentă de la furnizorul Magnani, numărul lotului 1505, din stoc.",
          "item": {
            "name": "menta",
            "quantity": 50,
            "unit": "kg",
            "supplier": "Magnani",
            "batch_number": "1505"
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

        Pentru "Câte loturi de mentă avem în stoc?":
        {
          "action": "query",
          "response": "Avem 3 loturi de mentă în stoc: lotul 1504 (50kg), lotul 1505 (100kg) și lotul 1506 (75kg), toate de la furnizorul Magnani."
        }

        Pentru "Câtă mentă avem în total?":
        {
          "action": "query",
          "response": "Avem în total 225 kg de mentă în stoc de la furnizorul Magnani, distribuite în 3 loturi diferite."
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
      
      // Try to recognize the command pattern directly
      return recognizeCommandPattern(command, inventory);
    }
  } catch (error) {
    console.error("Error processing command:", error);
    return {
      action: "unknown",
      response: "A apărut o eroare la procesarea comenzii. Vă rugăm să încercați din nou."
    };
  }
}

// Direct command handler for very specific patterns we know work consistently
function handleDirectCommand(command: string, inventory: InventoryItem[]): CommandResult | null {
  const lowercaseCommand = command.toLowerCase();
  
  // Handle the specific mentă/menta commands with lot numbers for adding
  const mentaAddRegex = /adaug[aă]\s+(\d+)\s*kg\s+de\s+ment[aă]\s+de\s+la\s+magnani\s+(?:nr\s+)?lot\s+(\d+)/i;
  const mentaAddMatch = command.match(mentaAddRegex);
  
  if (mentaAddMatch) {
    const quantity = parseInt(mentaAddMatch[1]);
    const batchNumber = mentaAddMatch[2];
    
    return {
      action: "add",
      response: `Am adăugat ${quantity} kg de mentă de la furnizorul Magnani, numărul lotului ${batchNumber}, în stoc.`,
      item: {
        name: "menta",
        quantity: quantity,
        unit: "kg",
        supplier: "Magnani",
        batch_number: batchNumber
      }
    };
  }
  
  // Handle the specific mentă/menta commands with lot numbers for removing
  const mentaRemoveRegex = /(?:scoate|elimină|elimina|sterge|șterge)\s+(\d+)\s*kg\s+de\s+ment[aă]\s+de\s+la\s+magnani\s+(?:nr\s+)?lot\s+(\d+)/i;
  const mentaRemoveMatch = command.match(mentaRemoveRegex);
  
  if (mentaRemoveMatch) {
    const quantity = parseInt(mentaRemoveMatch[1]);
    const batchNumber = mentaRemoveMatch[2];
    
    // Check if this specific batch exists
    const specificBatch = inventory.find(
      item => item.name.toLowerCase() === "menta" && 
             item.supplier?.toLowerCase() === "magnani" &&
             item.batch_number === batchNumber
    );
    
    if (specificBatch) {
      return {
        action: "remove",
        response: `Am scos ${quantity} kg de mentă de la furnizorul Magnani, numărul lotului ${batchNumber}, din stoc.`,
        item: {
          id: specificBatch.id,
          name: "menta",
          quantity: quantity,
          unit: "kg",
          supplier: "Magnani",
          batch_number: batchNumber
        }
      };
    }
  }
  
  // Handle queries about inventory
  if (lowercaseCommand.includes("câte") || lowercaseCommand.includes("cate") || 
      lowercaseCommand.includes("câți") || lowercaseCommand.includes("cati") ||
      lowercaseCommand.includes("ce loturi") || lowercaseCommand.includes("care loturi")) {
    
    // Check for mentă/menta related queries
    if (lowercaseCommand.includes("menta") || lowercaseCommand.includes("mentă")) {
      // Count batches of menta
      const mentaBatches = inventory.filter(
        item => item.name.toLowerCase() === "menta" || item.name.toLowerCase() === "mentă"
      );
      
      if (mentaBatches.length > 0) {
        // Create a formatted response about the menta batches
        let totalQuantity = 0;
        const batchDetails = mentaBatches.map(batch => {
          totalQuantity += batch.quantity;
          return `lotul ${batch.batch_number || 'necunoscut'} (${batch.quantity}${batch.unit}) de la ${batch.supplier || 'furnizor necunoscut'}`;
        }).join(", ");
        
        return {
          action: "query",
          response: `Avem ${mentaBatches.length} ${mentaBatches.length === 1 ? 'lot' : 'loturi'} de mentă în stoc: ${batchDetails}. În total, avem ${totalQuantity} kg de mentă.`
        };
      } else {
        return {
          action: "query",
          response: "Nu avem mentă în stoc momentan."
        };
      }
    }
    
    // Generic inventory query
    if (lowercaseCommand.includes("stoc") || lowercaseCommand.includes("avem")) {
      return {
        action: "view",
        response: "Vă afișez stocul actual."
      };
    }
  }
  
  return null;
}

// Pattern recognition for common commands when JSON parsing fails
function recognizeCommandPattern(command: string, inventory: InventoryItem[]): CommandResult {
  const lowercaseCommand = command.toLowerCase();
  
  // Handle remove/scoate commands
  if (lowercaseCommand.match(/^(scoate|elimină|elimina|șterge|sterge)/i)) {
    // Try to extract the product name, quantity and unit
    const removeRegex = /(?:scoate|elimină|elimina|șterge|sterge)\s+(\d+)\s*([a-zA-Z]+)\s+(?:de\s+)?([a-zăâîșțş]+)/i;
    const removeMatch = lowercaseCommand.match(removeRegex);
    
    if (removeMatch) {
      const quantity = parseInt(removeMatch[1]);
      const unit = removeMatch[2];
      const product = removeMatch[3];
      
      // Check if we have multiple batches of this product
      const matchingItems = inventory.filter(
        item => item.name.toLowerCase() === product
      );
      
      if (matchingItems.length > 1) {
        // We have multiple batches, ask which one to remove from
        const options = matchingItems.map(item => ({
          id: item.id || '',
          name: item.name,
          batch_number: item.batch_number,
          supplier: item.supplier,
          quantity: item.quantity,
          unit: item.unit
        }));
        
        return {
          action: "unknown",
          response: `Am găsit ${matchingItems.length} loturi diferite de ${product} în stoc.`,
          needsMoreInfo: {
            type: "batch_selection",
            question: `Din care lot doriți să scoateți ${quantity} ${unit} de ${product}?`,
            options: options
          }
        };
      } else if (matchingItems.length === 1) {
        // Only one batch exists, use that one
        return {
          action: "remove",
          response: `Am scos ${quantity} ${unit} de ${product} din stoc.`,
          item: {
            id: matchingItems[0].id,
            name: product,
            quantity: quantity,
            unit: unit,
            supplier: matchingItems[0].supplier,
            batch_number: matchingItems[0].batch_number
          }
        };
      }
    }
  }
  
  // Handle pallet requests
  if (lowercaseCommand.includes("palet")) {
    // Extract product name from command
    const productMatch = lowercaseCommand.match(/palet\s+(?:de\s+)?([a-zăâîșțş]+)/i);
    const product = productMatch ? productMatch[1] : "produse";
    
    // Check if we have supplier info
    const hasSupplier = lowercaseCommand.includes("de la") || lowercaseCommand.includes("furnizor");
    
    if (!hasSupplier) {
      return {
        action: "unknown",
        response: `Aș avea nevoie de câteva detalii în plus pentru a adăuga paleții de ${product} în sistem.`,
        needsMoreInfo: {
          type: "pallet_details",
          question: `Câte kg conține un palet de ${product}? De la ce furnizor provine? Și care este numărul lotului?`
        }
      };
    }
  }
  
  // Handle queries about inventory
  if (lowercaseCommand.includes("câte") || lowercaseCommand.includes("cate") || 
      lowercaseCommand.includes("câți") || lowercaseCommand.includes("cati")) {
    
    // Check for product mentions
    const productMatch = lowercaseCommand.match(/(?:de|din)\s+([a-zăâîșțş]+)/i);
    if (productMatch) {
      const product = productMatch[1];
      
      // Count products of this type
      const matchingItems = inventory.filter(
        item => item.name.toLowerCase() === product.toLowerCase()
      );
      
      if (matchingItems.length > 0) {
        let totalQuantity = 0;
        matchingItems.forEach(item => {
          totalQuantity += item.quantity;
        });
        
        const unit = matchingItems[0].unit;
        
        return {
          action: "query",
          response: `Avem în total ${totalQuantity} ${unit} de ${product} în stoc, în ${matchingItems.length} ${matchingItems.length === 1 ? 'lot' : 'loturi'} diferite.`
        };
      } else {
        return {
          action: "query",
          response: `Nu avem ${product} în stoc momentan.`
        };
      }
    }
  }
  
  // Handle mentă/menta with lot number pattern more generally
  if ((lowercaseCommand.includes("menta") || lowercaseCommand.includes("mentă")) && 
      lowercaseCommand.includes("magnani")) {
    
    // Try to extract quantity
    const quantityMatch = lowercaseCommand.match(/(\d+)\s*kg/);
    const quantity = quantityMatch ? parseInt(quantityMatch[1]) : 50;
    
    // Try to extract lot number
    const lotMatch = lowercaseCommand.match(/lot\s+(\d+)/);
    const lotNumber = lotMatch ? lotMatch[1] : "necunoscut";
    
    // Check if this is a remove command
    if (lowercaseCommand.match(/^(scoate|elimină|elimina|șterge|sterge)/i)) {
      return {
        action: "remove",
        response: `Am scos ${quantity} kg de mentă de la furnizorul Magnani, numărul lotului ${lotNumber}, din stoc.`,
        item: {
          name: "menta",
          quantity: quantity,
          unit: "kg",
          supplier: "Magnani",
          batch_number: lotNumber
        }
      };
    } else {
      // Default to add
      return {
        action: "add",
        response: `Am adăugat ${quantity} kg de mentă de la furnizorul Magnani, numărul lotului ${lotNumber}, în stoc.`,
        item: {
          name: "menta",
          quantity: quantity,
          unit: "kg",
          supplier: "Magnani",
          batch_number: lotNumber
        }
      };
    }
  }
  
  // Generic add pattern
  const addRegex = /adaug[aă]\s+(\d+)\s*([a-zăâîșțş]+)\s+de\s+([a-zăâîșțş]+)/i;
  const addMatch = lowercaseCommand.match(addRegex);
  
  if (addMatch) {
    return {
      action: "add",
      response: `Am adăugat ${addMatch[1]} ${addMatch[2]} de ${addMatch[3]} în stoc.`,
      item: {
        name: addMatch[3],
        quantity: parseInt(addMatch[1]),
        unit: addMatch[2]
      }
    };
  }
  
  // Default error response for other cases
  return {
    action: "unknown",
    response: "Nu am înțeles exact ce dorești să faci. Poți să reformulezi comanda cu detalii despre cantitate, produs și eventual furnizor sau număr de lot?",
  };
}
