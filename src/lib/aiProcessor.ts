
import { CommandResult, InventoryItem, ChartData } from "@/types";

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
    
    // Check if it's a conversation query 
    const isConversationalQuery = isConversation(command);

    // Build conversation history for context
    const messages = [
      {
        role: "system",
        content: `Ești un asistent inteligent care gestionează marfă într-un depozit. Răspunde în română, ca un uman, utilizând un ton conversațional prietenos. Înțelege expresii naturale și acționează pe baza comenzilor primite. Răspunde la întrebări despre stoc într-un mod conversațional și clar, ca și când ai fi un coleg real.
        
        ${isConversationalQuery ? `FOARTE IMPORTANT: Aceasta pare a fi o întrebare conversațională generală, nu specifică managementului de stoc. Răspunde ca un asistent general inteligent, fără a te limita la operațiuni de stoc. Poți discuta orice subiect, dar păstrează un ton profesionist și amabil.` : `
        IMPORTANT - Distincția între tipuri de acțiuni:
        1. "add" - când utilizatorul vrea să ADAUGE o cantitate la stoc (ex: "adaugă 5kg de roșii", "pune 3 cutii")
        2. "remove" - când utilizatorul vrea să SCADĂ o cantitate din stoc (ex: "scoate 2 kg de mere", "elimină 3 cutii") 
        3. "set" - când utilizatorul vrea să SETEZE stocul la o anumită valoare (ex: "reglează stocul de roșii la 10kg", "setează 20 de bucăți de mere", "pune stocul de cartofi la 15kg")
        4. "view" - când utilizatorul vrea să VADĂ stocul
        5. "export" - când utilizatorul vrea să EXPORTE stocul
        6. "email" - când utilizatorul vrea să TRIMITĂ stocul pe email
        7. "query" - când utilizatorul întreabă despre stoc (ex: "câte kg de roșii am?", "ce loturi de mentă am în stoc?")`}
        
        IMPORTANT - Noile câmpuri pentru inventar includ:
        - supplier (furnizorul)
        - batch_number (numărul lotului)
        - pallets (numărul de paleți)
        - receipt_date (data recepției)
        
        ${isConversationalQuery ? "" : `
        FOARTE IMPORTANT! Când utilizatorul menționează paleți, dar nu specifică detalii suficiente (de exemplu, "adaugă un palet de roșii" sau "adaugă un palet de mentă"), TREBUIE să ceri informații suplimentare:
        - câte kg/bucăți are un palet
        - detalii despre furnizor
        - numărul lotului
        
        Când utilizatorul menționează un lot, înțelege că se referă la "batch_number".
        
        Nu încerca să ghicești aceste informații, ci cere-le mereu de la utilizator într-un mod conversațional, ca și cum ai fi un coleg de muncă. Poți spune: "Îmi poți da mai multe detalii despre paleții de mentă? Câte kg conține un palet? De la ce furnizor provine? Care este numărul lotului?"
        
        FOARTE IMPORTANT! Când utilizatorul vrea să SCOATĂ sau să ELIMINE ceva din stoc, verifică dacă există mai multe loturi din produsul respectiv. Dacă da, îl vei întreba din care lot dorește să scoată produsul.

        FOARTE IMPORTANT! Când utilizatorul întreabă despre stoc (ex: "câte kg de mentă am?", "câte loturi de mentă avem?"), trebuie să răspunzi cu informațiile disponibile. Aceste întrebări trebuie interpretatate cu action "query".
        
        Răspunsul tău va include grafice atunci când se solicită informații statistice sau cantitative despre stoc (la întrebări de tip "câte", "care", etc.). Poți crea grafice de tip bar, pie sau line când datele permit.`}
        
        FOARTE IMPORTANT! Răspunde întotdeauna ca un obiect JSON cu următoarea structură exactă:
        {
          "action": ${isConversationalQuery ? `"query"` : `"add" | "remove" | "set" | "view" | "export" | "email" | "query" | "unknown"`},
          "response": "Răspunsul în text natural pentru utilizator"${isConversationalQuery ? "" : `,
          "item": {
            "name": "numele produsului",
            "quantity": numărul (cantitatea),
            "unit": "unitatea de măsură",
            "supplier": "numele furnizorului (opțional)",
            "batch_number": "numărul lotului (opțional)",
            "pallets": numărul de paleți (opțional),
            "receipt_date": "data recepției în format ISO (opțional)"
          },
          "charts": [
            {
              "type": "bar" | "pie" | "line",
              "title": "Titlul graficului",
              "data": [
                { "name": "Numele elementului", "value": valoare_numerica }
              ],
              "description": "Descrierea graficului (opțional)"
            }
          ],
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
          }`}
        }
        
        ${isConversationalQuery ? "" : `Dacă ai nevoie de mai multe informații de la utilizator, adaugă câmpul "needsMoreInfo" și lasă câmpul "action" ca "unknown".
        
        Când utilizatorul adaugă, elimină sau setează cantități în stoc, indiferent dacă există deja sau nu, procesează comanda corect.

        Analizează cu atenție TOATE comenzile pentru a detecta numărul lotului ("lot" sau "nr lot"), numele furnizorului și cantitatea. Verifică mereu dacă comanda conține informații despre lot și furnizor.
        
        Când utilizatorul solicită grafice sau date vizuale, trebuie să incluzi date relevante în câmpul "charts" din răspuns.

        FOARTE IMPORTANT! Când utilizatorul face întrebări precum "cate produse am in total?", "ce produse am în stoc?", "arată-mi distribuția pe furnizori", "care sunt cantitățile pe loturi", "cate intrari ai avut azi?", etc., răspunde cu acțiunea "query" și include grafice relevante în câmpul "charts".`}

        Răspunde DOAR cu un obiect JSON valid - nici un text în afara acestui obiect!
        
        ${isConversationalQuery ? "" : `Câteva exemple:
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
        
        Pentru "Câte intrări ai avut azi?":
        {
          "action": "query",
          "response": "Astăzi au fost înregistrate 5 intrări de produse în stoc. Detalii: 2 loturi de roșii, 1 lot de cartofi și 2 loturi de mere."
        }`}
        
        Actuala stare a inventarului este: ${JSON.stringify(inventory)}
        `
      }
    ];
    
    // Add conversation history
    if (conversation.length > 0) {
      // Limitează contextul conversațional la ultimele 10 mesaje pentru performanță
      const recentConversation = conversation.slice(-10);
      recentConversation.forEach((text, index) => {
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
        max_tokens: 800,
        response_format: { type: "json_object" } // Specificăm explicit că vrem JSON
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
      
      // Parse JSON response
      let jsonContent = content;
      
      try {
        // Încercăm să parsăm direct răspunsul
        const parsedResponse = JSON.parse(jsonContent);
        
        // Process any charts în răspuns
        let charts: ChartData[] = [];
        if (parsedResponse.charts && Array.isArray(parsedResponse.charts)) {
          charts = parsedResponse.charts.map((chart: any) => ({
            type: chart.type || 'bar',
            title: chart.title || 'Grafic',
            data: chart.data || [],
            xKey: chart.xKey,
            yKey: chart.yKey,
            description: chart.description
          }));
        }

        return {
          action: parsedResponse.action || "unknown",
          response: parsedResponse.response || "Nu am putut procesa comanda.",
          item: parsedResponse.item || undefined,
          charts: charts.length > 0 ? charts : undefined,
          needsMoreInfo: parsedResponse.needsMoreInfo || undefined
        };
      } catch (parseJsonError) {
        console.error("Error parsing AI response as JSON:", parseJsonError);
        
        // Dacă răspunsul nu este JSON valid, căutăm un obiect JSON în text
        const jsonStartIndex = content.indexOf('{');
        const jsonEndIndex = content.lastIndexOf('}') + 1;
        
        if (jsonStartIndex >= 0 && jsonEndIndex > jsonStartIndex) {
          try {
            jsonContent = content.substring(jsonStartIndex, jsonEndIndex);
            console.log("Extracted JSON content:", jsonContent);
            const parsedResponse = JSON.parse(jsonContent);
            
            // Process any charts în răspuns
            let charts: ChartData[] = [];
            if (parsedResponse.charts && Array.isArray(parsedResponse.charts)) {
              charts = parsedResponse.charts.map((chart: any) => ({
                type: chart.type || 'bar',
                title: chart.title || 'Grafic',
                data: chart.data || [],
                xKey: chart.xKey,
                yKey: chart.yKey,
                description: chart.description
              }));
            }

            return {
              action: parsedResponse.action || "unknown",
              response: parsedResponse.response || "Nu am putut procesa comanda.",
              item: parsedResponse.item || undefined,
              charts: charts.length > 0 ? charts : undefined,
              needsMoreInfo: parsedResponse.needsMoreInfo || undefined
            };
          } catch (extractError) {
            console.error("Error parsing extracted JSON:", extractError);
          }
        }
        
        // Dacă tot nu putem obține un JSON valid, folosim conținutul ca răspuns simplu
        return {
          action: "query",
          response: content
        };
      }
    } catch (error) {
      console.error("Error processing command:", error);
      
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

// Function to detect if a command is a conversational query rather than an inventory command
function isConversation(command: string): boolean {
  const lowercaseCommand = command.toLowerCase();
  
  // List of inventory-related keywords
  const inventoryKeywords = [
    'stoc', 'adaugă', 'adauga', 'adăuga', 'pune', 'scoate', 'elimină', 'elimina', 
    'sterge', 'șterge', 'kg', 'produs', 'produse', 'cantitate', 'cantitați', 
    'lot', 'loturi', 'palet', 'paleți', 'paleti', 'furnizor', 'inventar', 
    'export', 'excel', 'email', 'raport', 'intrări', 'intrari', 'iesiri', 'ieșiri'
  ];
  
  // Check if command contains inventory-related keywords
  const containsInventoryKeywords = inventoryKeywords.some(keyword => 
    lowercaseCommand.includes(keyword)
  );
  
  // Commands asking about inventory-specific quantities
  if (lowercaseCommand.match(/câte|cate|câți|cati/i) && 
      (lowercaseCommand.includes('stoc') || 
       lowercaseCommand.includes('avem') || 
       lowercaseCommand.includes('sunt') ||
       lowercaseCommand.includes('produse'))) {
    return false; // This is an inventory query
  }
  
  // Check for specific inventory actions
  if (lowercaseCommand.match(/^(adaugă|adauga|pune|scoate|elimină|elimina|șterge|sterge|vezi|arată|arata)/i)) {
    return false; // This is an inventory command
  }
  
  // If the command doesn't contain inventory keywords, it's more likely a conversational query
  return !containsInventoryKeywords;
}

// Direct command handler for very specific patterns we know work consistently
function handleDirectCommand(command: string, inventory: InventoryItem[]): CommandResult | null {
  const lowercaseCommand = command.toLowerCase();

  // Handle queries about entries/intrări de azi
  if (lowercaseCommand.includes("intrări") || lowercaseCommand.includes("intrari") || 
      lowercaseCommand.includes("azi") || lowercaseCommand.includes("astăzi") || 
      lowercaseCommand.includes("astazi")) {
    
    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    
    // Filter inventory for items added today
    const todayItems = inventory.filter(item => {
      if (!item.receipt_date) return false;
      
      // Convert receipt_date to a Date object if it isn't already
      const receiptDate = item.receipt_date instanceof Date ? 
        item.receipt_date : 
        new Date(item.receipt_date);
      
      // Set time to start of day for comparison
      receiptDate.setHours(0, 0, 0, 0);
      
      // Compare dates
      return receiptDate.getTime() === today.getTime();
    });
    
    if (todayItems.length > 0) {
      // Create summary by product
      const productSummary: Record<string, {name: string, count: number, totalQuantity: number, unit: string}> = {};
      
      todayItems.forEach(item => {
        if (!productSummary[item.name]) {
          productSummary[item.name] = {
            name: item.name,
            count: 0,
            totalQuantity: 0,
            unit: item.unit
          };
        }
        
        productSummary[item.name].count++;
        productSummary[item.name].totalQuantity += item.quantity;
      });
      
      // Create chart data
      const chartData: ChartData[] = [
        {
          type: 'bar',
          title: 'Intrări de astăzi',
          data: Object.values(productSummary).map(p => ({
            name: p.name,
            value: p.totalQuantity
          })),
          description: 'Cantități adăugate astăzi'
        },
        {
          type: 'pie',
          title: 'Distribuția intrărilor de astăzi',
          data: Object.values(productSummary).map(p => ({
            name: p.name,
            value: p.totalQuantity
          })),
        }
      ];
      
      const productList = Object.values(productSummary)
        .map(p => `${p.count} ${p.count === 1 ? 'intrare' : 'intrări'} de ${p.name} (total: ${p.totalQuantity} ${p.unit})`)
        .join(', ');
      
      return {
        action: "query",
        response: `Astăzi au fost înregistrate ${todayItems.length} intrări în stoc: ${productList}.`,
        charts: chartData
      };
    } else {
      return {
        action: "query",
        response: "Nu am înregistrat nicio intrare în stoc astăzi."
      };
    }
  }
  
  // Handle queries about exits/ieșiri de azi
  if (lowercaseCommand.includes("ieșiri") || lowercaseCommand.includes("iesiri") || 
      lowercaseCommand.includes("scos") || lowercaseCommand.includes("eliminat")) {
    
    // This would require tracking exits in a separate table or with timestamps
    // For now, we'll return a placeholder response
    return {
      action: "query",
      response: "Sistemul nu monitorizează momentan ieșirile cu timestamp. Pot doar să vă arăt starea curentă a stocului."
    };
  }
  
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

        // Create chart data
        const chartData: ChartData[] = [
          {
            type: 'bar',
            title: 'Loturi de mentă în stoc',
            data: mentaBatches.map(batch => ({
              name: `Lot ${batch.batch_number || 'necunoscut'}`,
              value: batch.quantity,
              supplier: batch.supplier || 'Necunoscut'
            })),
            description: 'Cantități de mentă pe loturi'
          },
          {
            type: 'pie',
            title: 'Distribuția mentei pe loturi',
            data: mentaBatches.map(batch => ({
              name: `Lot ${batch.batch_number || 'necunoscut'}`,
              value: batch.quantity
            }))
          }
        ];
        
        return {
          action: "query",
          response: `Avem ${mentaBatches.length} ${mentaBatches.length === 1 ? 'lot' : 'loturi'} de mentă în stoc: ${batchDetails}. În total, avem ${totalQuantity} kg de mentă.`,
          charts: chartData
        };
      } else {
        return {
          action: "query",
          response: "Nu avem mentă în stoc momentan."
        };
      }
    }
    
    // Cereri pentru afișarea distribuției pe furnizori
    if (lowercaseCommand.includes("furnizor") && (lowercaseCommand.includes("distribuție") || 
       lowercaseCommand.includes("distributie") || lowercaseCommand.includes("cantitate"))) {
       
      // Colectează date pe furnizori
      const supplierItems = inventory.filter(item => item.supplier);
      if (supplierItems.length > 0) {
        const supplierData: Record<string, {name: string, value: number}> = {};
        
        supplierItems.forEach(item => {
          const supplier = item.supplier || 'Necunoscut';
          if (!supplierData[supplier]) {
            supplierData[supplier] = { name: supplier, value: 0 };
          }
          supplierData[supplier].value += item.quantity;
        });
        
        const chartData: ChartData[] = [
          {
            type: 'bar',
            title: 'Distribuția produselor pe furnizori',
            data: Object.values(supplierData),
            description: 'Cantități totale pe furnizori'
          },
          {
            type: 'pie',
            title: 'Proporția produselor pe furnizori',
            data: Object.values(supplierData)
          }
        ];
        
        const supplierText = Object.values(supplierData)
          .map(s => `${s.name}: ${s.value} unități`)
          .join(', ');
        
        return {
          action: "query",
          response: `Iată distribuția produselor pe furnizori: ${supplierText}`,
          charts: chartData
        };
      }
    }
    
    // Generic inventory query
    if (lowercaseCommand.includes("stoc") || lowercaseCommand.includes("avem") || 
        lowercaseCommand.includes("arată") || lowercaseCommand.includes("arata")) {
      
      // Generate inventory overview
      if (inventory.length > 0) {
        // Agregate by product name
        const products: Record<string, {name: string, quantity: number, unit: string}> = {};
        inventory.forEach(item => {
          if (!products[item.name]) {
            products[item.name] = {name: item.name, quantity: 0, unit: item.unit};
          }
          products[item.name].quantity += item.quantity;
        });
        
        // Create chart data
        const chartData: ChartData[] = [
          {
            type: 'bar',
            title: 'Produse în stoc',
            data: Object.values(products).map(p => ({ name: p.name, value: p.quantity })),
            description: 'Cantități totale pe produse'
          },
          {
            type: 'pie',
            title: 'Distribuția produselor în stoc',
            data: Object.values(products).map(p => ({ name: p.name, value: p.quantity })),
          }
        ];
        
        const productList = Object.values(products)
          .map(p => `${p.name}: ${p.quantity} ${p.unit}`)
          .join(', ');
        
        return {
          action: "view",
          response: `În stoc avem următoarele produse: ${productList}`,
          charts: chartData
        };
      } else {
        return {
          action: "view",
          response: "Stocul este gol momentan."
        };
      }
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
        
        // Create chart data
        const chartData: ChartData[] = [];
        if (matchingItems.length > 1) {
          chartData.push({
            type: 'bar',
            title: `Loturi de ${product} în stoc`,
            data: matchingItems.map(item => ({
              name: item.batch_number ? `Lot ${item.batch_number}` : `${item.supplier || 'Necunoscut'}`,
              value: item.quantity
            })),
            description: `Cantități de ${product} pe loturi`
          });
        }
        
        return {
          action: "query",
          response: `Avem în total ${totalQuantity} ${unit} de ${product} în stoc, în ${matchingItems.length} ${matchingItems.length === 1 ? 'lot' : 'loturi'} diferite.`,
          charts: chartData.length > 0 ? chartData : undefined
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
  
  // Check if this is a conversational query rather than an inventory command
  if (isConversation(command)) {
    return {
      action: "query",
      response: "Îmi pare rău, dar nu am destule informații pentru a răspunde la această întrebare. Sunt specializat în asistență pentru gestiunea stocurilor. Puteți să mă întrebați despre stoc, produse, furnizori sau să îmi cereți să adaug sau să scot produse din inventar."
    };
  }
  
  // Default error response for other cases
  return {
    action: "unknown",
    response: "Nu am înțeles exact ce dorești să faci. Poți să reformulezi comanda cu detalii despre cantitate, produs și eventual furnizor sau număr de lot?",
  };
}
