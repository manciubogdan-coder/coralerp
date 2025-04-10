
import { CommandResult, InventoryItem, ChartData } from "@/types";
import { supabase } from "@/integrations/supabase/client";

export async function processCommand(
  command: string, 
  inventory: InventoryItem[],
  conversation: string[] = []
): Promise<CommandResult> {
  try {
    const openaiApiKey = "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";
    
    // Check for "remove all" specific commands first
    const removeAllMatch = command.match(/(?:elimina|scoate|sterge)\s+(?:to[a]t[a]|tot|toate)\s+(?:de\s+)?([a-zA-Z]+)/i);
    if (removeAllMatch) {
      const productName = removeAllMatch[1].toLowerCase();
      
      // Get all instances of this product
      const productItems = inventory.filter(
        item => item.name.toLowerCase() === productName
      );
      
      if (productItems.length > 0) {
        // Calculate total quantity
        const totalQuantity = productItems.reduce((sum, item) => sum + item.quantity, 0);
        const unit = productItems[0].unit;
        
        // Return a remove command for all of this product
        return {
          action: "remove",
          response: `Am eliminat toata ${productName} din stoc.`,
          item: {
            name: productName,
            quantity: totalQuantity,
            unit: unit
          }
        };
      }
    }
    
    // Handle direct commands directly before sending to AI
    const directCommandResult = await handleDirectCommand(command, inventory);
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
        content: `Esti un asistent inteligent care gestioneaza marfa intr-un depozit. Raspunde in romana, ca un uman, utilizand un ton conversational prietenos. Intelege expresii naturale si actioneaza pe baza comenzilor primite. Raspunde la intrebari despre stoc intr-un mod conversational si clar, ca si cand ai fi un coleg real.
        
        FOARTE IMPORTANT: Nu folosi diacritice in raspunsurile tale. Foloseste doar caractere fara diacritice pentru toate raspunsurile in limba romana.
        
        ${isConversationalQuery ? `FOARTE IMPORTANT: Aceasta pare a fi o intrebare conversationala generala, nu specifica managementului de stoc. Raspunde ca un asistent general inteligent, fara a te limita la operatiuni de stoc. Poti discuta orice subiect, dar pastreaza un ton profesionist si amabil.` : `
        IMPORTANT - Distinctia intre tipuri de actiuni:
        1. "add" - cand utilizatorul vrea sa ADAUGE o cantitate la stoc (ex: "adauga 5kg de rosii", "pune 3 cutii")
        2. "remove" - cand utilizatorul vrea sa SCADA o cantitate din stoc (ex: "scoate 2 kg de mere", "elimina 3 cutii") 
        3. "set" - cand utilizatorul vrea sa SETEZE stocul la o anumita valoare (ex: "regleaza stocul de rosii la 10kg", "seteaza 20 de bucati de mere", "pune stocul de cartofi la 15kg")
        4. "view" - cand utilizatorul vrea sa VADA stocul
        5. "export" - cand utilizatorul vrea sa EXPORTE stocul
        6. "email" - cand utilizatorul vrea sa TRIMITA stocul pe email
        7. "query" - cand utilizatorul intreaba despre stoc (ex: "cate kg de rosii am?", "ce loturi de menta am in stoc?")`}
        
        IMPORTANT - Noile campuri pentru inventar includ:
        - supplier (furnizorul)
        - batch_number (numarul lotului)
        - pallets (numarul de paleti)
        - receipt_date (data receptiei)
        
        ${isConversationalQuery ? "" : `
        FOARTE IMPORTANT! Cand utilizatorul mentioneaza paleti, dar nu specifica detalii suficiente (de exemplu, "adauga un palet de rosii" sau "adauga un palet de menta"), TREBUIE sa ceri informatii suplimentare:
        - cate kg/bucati are un palet
        - detalii despre furnizor
        - numarul lotului
        
        Cand utilizatorul mentioneaza un lot, intelege ca se refera la "batch_number".
        
        Nu incerca sa ghicesti aceste informatii, ci cere-le mereu de la utilizator intr-un mod conversational, ca si cum ai fi un coleg de munca. Poti spune: "Imi poti da mai multe detalii despre paletii de menta? Cate kg contine un palet? De la ce furnizor provine? Care este numarul lotului?"
        
        FOARTE IMPORTANT! Cand utilizatorul vrea sa SCOATA sau sa ELIMINE ceva din stoc, verifica daca exista mai multe loturi din produsul respectiv. Daca da, il vei intreba din care lot doreste sa scoata produsul.
        
        PENTRU COMENZI SPECIALE: Daca utilizatorul spune "elimina toata menta" sau "sterge tot stockul de rosii", trebuie sa intelegi ca vrea sa elimine COMPLET toate loturile ale acelui produs din stoc. Raspunde cu actiunea "remove" si cantitatea totala a produsului din toate loturile.

        FOARTE IMPORTANT! Cand utilizatorul intreaba despre stoc (ex: "cate kg de menta am?", "cate loturi de menta avem?"), trebuie sa raspunzi cu informatiile disponibile. Aceste intrebari trebuie interpretatate cu action "query".
        
        Raspunsul tau va include grafice atunci cand se solicita informatii statistice sau cantitative despre stoc (la intrebari de tip "cate", "care", etc.). Poti crea grafice de tip bar, pie sau line cand datele permit.`}
        
        FOARTE IMPORTANT! Raspunde intotdeauna ca un obiect JSON cu urmatoarea structura exacta:
        {
          "action": ${isConversationalQuery ? `"query"` : `"add" | "remove" | "set" | "view" | "export" | "email" | "query" | "unknown"`},
          "response": "Raspunsul in text natural pentru utilizator"${isConversationalQuery ? "" : `,
          "item": {
            "name": "numele produsului",
            "quantity": numarul (cantitatea),
            "unit": "unitatea de masura",
            "supplier": "numele furnizorului (optional)",
            "batch_number": "numarul lotului (optional)",
            "pallets": numarul de paleti (optional),
            "receipt_date": "data receptiei in format ISO (optional)"
          },
          "charts": [
            {
              "type": "bar" | "pie" | "line",
              "title": "Titlul graficului",
              "data": [
                { "name": "Numele elementului", "value": valoare_numerica }
              ],
              "description": "Descrierea graficului (optional)"
            }
          ],
          "needsMoreInfo": {
            "type": "pallet_details" | "supplier_info" | "batch_info" | "batch_selection",
            "question": "Intrebarea pe care vrei sa o pui utilizatorului pentru a obtine mai multe informatii",
            "options": [
              {
                "id": "id-ul lotului",
                "name": "numele produsului",
                "batch_number": "numarul lotului",
                "supplier": "numele furnizorului",
                "quantity": cantitatea disponibila,
                "unit": "unitatea de masura"
              }
            ]
          }`}
        }
        
        ${isConversationalQuery ? "" : `Daca ai nevoie de mai multe informatii de la utilizator, adauga campul "needsMoreInfo" si lasa campul "action" ca "unknown".
        
        Cand utilizatorul adauga, elimina sau seteaza cantitati in stoc, indiferent daca exista deja sau nu, proceseaza comanda corect.

        Analizeaza cu atentie TOATE comenzile pentru a detecta numarul lotului ("lot" sau "nr lot"), numele furnizorului si cantitatea. Verifica mereu daca comanda contine informatii despre lot si furnizor.
        
        Cand utilizatorul solicita grafice sau date vizuale, trebuie sa incluzi date relevante in campul "charts" din raspuns.

        FOARTE IMPORTANT! Cand utilizatorul face intrebari precum "cate produse am in total?", "ce produse am in stoc?", "arata-mi distributia pe furnizori", "care sunt cantitatile pe loturi", "cate intrari ai avut azi?", etc., raspunde cu actiunea "query" si include grafice relevante in campul "charts".`}

        Raspunde DOAR cu un obiect JSON valid - nici un text in afara acestui obiect!
        
        ${isConversationalQuery ? "" : `Cateva exemple:
        Pentru "Adauga 5 kg de rosii":
        {
          "action": "add",
          "response": "Am adaugat 5 kg de rosii in stoc.",
          "item": {
            "name": "rosii",
            "quantity": 5,
            "unit": "kg"
          }
        }
        
        Pentru "Elimina toata menta":
        {
          "action": "remove",
          "response": "Am eliminat toata menta din stoc.",
          "item": {
            "name": "menta",
            "quantity": 1360,
            "unit": "kg"
          }
        }
        
        Pentru "Adauga un palet de rosii":
        {
          "action": "unknown",
          "response": "Am nevoie de mai multe detalii pentru a adauga un palet de rosii in stoc.",
          "needsMoreInfo": {
            "type": "pallet_details",
            "question": "Cate kg contine un palet de rosii? Si de la ce furnizor provin?"
          }
        }
        
        Pentru "Cate intrari ai avut azi?":
        {
          "action": "query",
          "response": "Astazi au fost inregistrate 5 intrari de produse in stoc. Detalii: 2 loturi de rosii, 1 lot de cartofi si 2 loturi de mere."
        }`}
        
        Actuala stare a inventarului este: ${JSON.stringify(inventory)}
        `
      }
    ];
    
    // Add conversation history
    if (conversation.length > 0) {
      // Limiteaza contextul conversational la ultimele 10 mesaje pentru performanta
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
        response_format: { type: "json_object" } // Specificam explicit ca vrem JSON
      })
    });

    const data = await response.json();
    
    if (data.error) {
      console.error("OpenAI API error:", data.error);
      return {
        action: "unknown",
        response: "A aparut o eroare la procesarea comenzii. Va rugam sa incercati din nou."
      };
    }

    try {
      const content = data.choices[0].message.content;
      console.log("AI response:", content);
      
      // Parse JSON response
      let jsonContent = content;
      
      try {
        // Incercam sa parsam direct raspunsul
        const parsedResponse = JSON.parse(jsonContent);
        
        // Process any charts in raspuns
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
        
        // Daca raspunsul nu este JSON valid, cautam un obiect JSON in text
        const jsonStartIndex = content.indexOf('{');
        const jsonEndIndex = content.lastIndexOf('}') + 1;
        
        if (jsonStartIndex >= 0 && jsonEndIndex > jsonStartIndex) {
          try {
            jsonContent = content.substring(jsonStartIndex, jsonEndIndex);
            console.log("Extracted JSON content:", jsonContent);
            const parsedResponse = JSON.parse(jsonContent);
            
            // Process any charts in raspuns
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
        
        // Daca tot nu putem obtine un JSON valid, folosim continutul ca raspuns simplu
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
      response: "A aparut o eroare la procesarea comenzii. Va rugam sa incercati din nou."
    };
  }
}

// Function to detect if a command is a conversational query rather than an inventory command
function isConversation(command: string): boolean {
  const lowercaseCommand = command.toLowerCase();
  
  // List of inventory-related keywords
  const inventoryKeywords = [
    'stoc', 'adauga', 'adauga', 'adauga', 'pune', 'scoate', 'elimina', 'elimina', 
    'sterge', 'sterge', 'kg', 'produs', 'produse', 'cantitate', 'cantitati', 
    'lot', 'loturi', 'palet', 'paleti', 'paleti', 'furnizor', 'inventar', 
    'export', 'excel', 'email', 'raport', 'intrari', 'intrari', 'iesiri', 'iesiri'
  ];
  
  // Check if command contains inventory-related keywords
  const containsInventoryKeywords = inventoryKeywords.some(keyword => 
    lowercaseCommand.includes(keyword)
  );
  
  // Commands asking about inventory-specific quantities
  if (lowercaseCommand.match(/cate|cate|cati|cati/i) && 
      (lowercaseCommand.includes('stoc') || 
       lowercaseCommand.includes('avem') || 
       lowercaseCommand.includes('sunt') ||
       lowercaseCommand.includes('produse'))) {
    return false; // This is an inventory query
  }
  
  // Check for specific inventory actions
  if (lowercaseCommand.match(/^(adauga|adauga|pune|scoate|elimina|elimina|sterge|sterge|vezi|arata|arata)/i)) {
    return false; // This is an inventory command
  }
  
  // If the command doesn't contain inventory keywords, it's more likely a conversational query
  return !containsInventoryKeywords;
}

// Direct command handler for very specific patterns we know work consistently
async function handleDirectCommand(command: string, inventory: InventoryItem[]): Promise<CommandResult | null> {
  const lowercaseCommand = command.toLowerCase();

  // Handle "remove all" command for specific products
  const removeAllMatch = command.match(/(?:elimina|scoate|sterge)\s+(?:to[a]t[a]|tot|toate)\s+(?:de\s+)?([a-zA-Z]+)/i);
  if (removeAllMatch) {
    const productName = removeAllMatch[1].toLowerCase();
    
    // Get all instances of this product
    const productItems = inventory.filter(
      item => item.name.toLowerCase() === productName
    );
    
    if (productItems.length > 0) {
      // Calculate total quantity
      const totalQuantity = productItems.reduce((sum, item) => sum + item.quantity, 0);
      const unit = productItems[0].unit;
      
      // Return a remove command for all of this product
      return {
        action: "remove",
        response: `Am eliminat toata ${productName} din stoc.`,
        item: {
          name: productName,
          quantity: totalQuantity,
          unit: unit
        }
      };
    }
  }

  // Handle queries about entries/intrari de azi
  if (lowercaseCommand.includes("intrari") || lowercaseCommand.includes("intrari") || 
      (lowercaseCommand.includes("azi") && lowercaseCommand.includes("adaugat")) || 
      lowercaseCommand.includes("astazi") || lowercaseCommand.includes("astazi")) {
    
    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    const todayISOString = today.toISOString();
    
    // Query inventory_history for items added today (action = 'add')
    try {
      const { data: todayAdditions, error } = await supabase
        .from('inventory_history')
        .select('*')
        .eq('action', 'add')
        .gte('operation_date', todayISOString);
      
      if (error) {
        console.error("Error fetching today's additions:", error);
        return {
          action: "query",
          response: "Nu am putut verifica intrarile de astazi din cauza unei erori."
        };
      }
      
      if (todayAdditions && todayAdditions.length > 0) {
        // Create summary by product
        const productSummary: Record<string, {name: string, count: number, totalQuantity: number, unit: string}> = {};
        
        todayAdditions.forEach(item => {
          if (!productSummary[item.name]) {
            productSummary[item.name] = {
              name: item.name,
              count: 0,
              totalQuantity: 0,
              unit: item.unit
            };
          }
          
          productSummary[item.name].count++;
          productSummary[item.name].totalQuantity += Number(item.quantity);
        });
        
        // Create chart data
        const chartData: ChartData[] = [
          {
            type: 'bar',
            title: 'Intrari de astazi',
            data: Object.values(productSummary).map(p => ({
              name: p.name,
              value: p.totalQuantity
            })),
            description: 'Cantitati adaugate astazi'
          },
          {
            type: 'pie',
            title: 'Distributia intrarilor de astazi',
            data: Object.values(productSummary).map(p => ({
              name: p.name,
              value: p.totalQuantity
            })),
          }
        ];
        
        const productList = Object.values(productSummary)
          .map(p => `${p.count} ${p.count === 1 ? 'intrare' : 'intrari'} de ${p.name} (total: ${p.totalQuantity} ${p.unit})`)
          .join(', ');
        
        return {
          action: "query",
          response: `Astazi au fost inregistrate ${todayAdditions.length} intrari in stoc: ${productList}.`,
          charts: chartData
        };
      } else {
        return {
          action: "query",
          response: "Nu am inregistrat nicio intrare in stoc astazi."
        };
      }
    } catch (error) {
      console.error("Error in intrari query:", error);
      return {
        action: "query",
        response: "Nu am putut verifica intrarile de astazi din cauza unei erori."
      };
    }
  }
  
  // Handle queries about exits/iesiri de azi
  if (lowercaseCommand.includes("iesiri") || lowercaseCommand.includes("iesiri") || 
      (lowercaseCommand.includes("azi") && (lowercaseCommand.includes("scos") || lowercaseCommand.includes("eliminat")))) {
    
    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    const todayISOString = today.toISOString();
    
    // Query inventory_history for items removed today (action = 'remove')
    try {
      const { data: todayRemovals, error } = await supabase
        .from('inventory_history')
        .select('*')
        .eq('action', 'remove')
        .gte('operation_date', todayISOString);
      
      if (error) {
        console.error("Error fetching today's removals:", error);
        return {
          action: "query",
          response: "Nu am putut verifica iesirile de astazi din cauza unei erori."
        };
      }
      
      if (todayRemovals && todayRemovals.length > 0) {
        // Create summary by product
        const productSummary: Record<string, {name: string, count: number, totalQuantity: number, unit: string}> = {};
        
        todayRemovals.forEach(item => {
          if (!productSummary[item.name]) {
            productSummary[item.name] = {
              name: item.name,
              count: 0,
              totalQuantity: 0,
              unit: item.unit
            };
          }
          
          productSummary[item.name].count++;
          productSummary[item.name].totalQuantity += Number(item.quantity);
        });
        
        // Create chart data
        const chartData: ChartData[] = [
          {
            type: 'bar',
            title: 'Iesiri de astazi',
            data: Object.values(productSummary).map(p => ({
              name: p.name,
              value: p.totalQuantity
            })),
            description: 'Cantitati scoase astazi'
          },
          {
            type: 'pie',
            title: 'Distributia iesirilor de astazi',
            data: Object.values(productSummary).map(p => ({
              name: p.name,
              value: p.totalQuantity
            })),
          }
        ];
        
        const productList = Object.values(productSummary)
          .map(p => `${p.count} ${p.count === 1 ? 'iesire' : 'iesiri'} de ${p.name} (total: ${p.totalQuantity} ${p.unit})`)
          .join(', ');
        
        return {
          action: "query",
          response: `Astazi au fost inregistrate ${todayRemovals.length} iesiri din stoc: ${productList}.`,
          charts: chartData
        };
      } else {
        return {
          action: "query",
          response: "Nu am inregistrat nicio iesire din stoc astazi."
        };
      }
    } catch (error) {
      console.error("Error in iesiri query:", error);
      return {
        action: "query",
        response: "Nu am putut verifica iesirile de astazi din cauza unei erori."
      };
    }
  }
  
  // Handle the specific menta/menta commands with lot numbers for adding
  const mentaAddRegex = /adaug[a]\s+(\d+)\s*kg\s+de\s+menta\s+de\s+la\s+magnani\s+(?:nr\s+)?lot\s+(\d+)/i;
  const mentaAddMatch = command.match(mentaAddRegex);
  
  if (mentaAddMatch) {
    const quantity = parseInt(mentaAddMatch[1]);
    const batchNumber = mentaAddMatch[2];
    
    return {
      action: "add",
      response: `Am adaugat ${quantity} kg de menta de la furnizorul Magnani, numarul lotului ${batchNumber}, in stoc.`,
      item: {
        name: "menta",
        quantity: quantity,
        unit: "kg",
        supplier: "Magnani",
        batch_number: batchNumber
      }
    };
  }
  
  // Handle the specific menta/menta commands with lot numbers for removing
  const mentaRemoveRegex = /(?:scoate|elimina|elimina|sterge|sterge)\s+(\d+)\s*kg\s+de\s+menta\s+de\s+la\s+magnani\s+(?:nr\s+)?lot\s+(\d+)/i;
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
        response: `Am scos ${quantity} kg de menta de la furnizorul Magnani, numarul lotului ${batchNumber}, din stoc.`,
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
  if (lowercaseCommand.includes("cate") || lowercaseCommand.includes("cate") || 
      lowercaseCommand.includes("cati") || lowercaseCommand.includes("cati") ||
      lowercaseCommand.includes("ce loturi") || lowercaseCommand.includes("care loturi")) {
    
    // Check for menta/menta related queries
    if (lowercaseCommand.includes("menta") || lowercaseCommand.includes("menta")) {
      // Count batches of menta
      const mentaBatches = inventory.filter(
        item => item.name.toLowerCase() === "menta" || item.name.toLowerCase() === "menta"
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
            title: 'Loturi de menta in stoc',
            data: mentaBatches.map(batch => ({
              name: `Lot ${batch.batch_number || 'necunoscut'}`,
              value: batch.quantity,
              supplier: batch.supplier || 'Necunoscut'
            })),
            description: 'Cantitati de menta pe loturi'
          },
          {
            type: 'pie',
            title: 'Distributia mentei pe loturi',
            data: mentaBatches.map(batch => ({
              name: `Lot ${batch.batch_number || 'necunoscut'}`,
              value: batch.quantity
            }))
          }
        ];
        
        return {
          action: "query",
          response: `Avem ${mentaBatches.length} ${mentaBatches.length === 1 ? 'lot' : 'loturi'} de menta in stoc: ${batchDetails}. In total, avem ${totalQuantity} kg de menta.`,
          charts: chartData
        };
      } else {
        return {
          action: "query",
          response: "Nu avem menta in stoc momentan."
        };
      }
    }
    
    // Cereri pentru afisarea distributiei pe furnizori
    if (lowercaseCommand.includes("furnizor") && (lowercaseCommand.includes("distributie") || 
       lowercaseCommand.includes("distributie") || lowercaseCommand.includes("cantitate"))) {
       
      // Colecteaza date pe furnizori
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
            title: 'Distributia produselor pe furnizori',
            data: Object.values(supplierData),
            description: 'Cantitati totale pe furnizori'
          },
          {
            type: 'pie',
            title: 'Proportia produselor pe furnizori',
            data: Object.values(supplierData)
          }
        ];
        
        const supplierText = Object.values(supplierData)
          .map(s => `${s.name}: ${s.value} unitati`)
          .join(', ');
        
        return {
          action: "query",
          response: `Iata distributia produselor pe furnizori: ${supplierText}`,
          charts: chartData
        };
      }
    }
    
    // Generic inventory query
    if (lowercaseCommand.includes("stoc") || lowercaseCommand.includes("avem") || 
        lowercaseCommand.includes("arata") || lowercaseCommand.includes("arata")) {
      
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
            title: 'Produse in stoc',
            data: Object.values(products).map(p => ({ name: p.name, value: p.quantity })),
            description: 'Cantitati totale pe produse'
          },
          {
            type: 'pie',
            title: 'Distributia produselor in stoc',
            data: Object.values(products).map(p => ({ name: p.name, value: p.quantity })),
          }
        ];
        
        const productList = Object.values(products)
          .map(p => `${p.name}: ${p.quantity} ${p.unit}`)
          .join(', ');
        
        return {
          action: "view",
          response: `In stoc avem urmatoarele produse: ${productList}`,
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
  if (lowercaseCommand.match(/^(scoate|elimina|elimina|sterge|sterge)/i)) {
    // Try to extract the product name, quantity and unit
    const removeRegex = /(?:scoate|elimina|elimina|sterge|sterge)\s+(\d+)\s*([a-zA-Z]+)\s+(?:de\s+)?([a-z]+)/i;
    const removeMatch = lowercaseCommand.match(removeRegex);
    
    if (removeMatch) {
      const quantity = parseInt(removeMatch[1]);
      const unit = removeMatch[2];
      const product = removeMatch[3];
      
      // Check if we have multiple batches of this product
      const matchingItems = inventory.filter(
        item => item.name.toLowerCase() === product && item.quantity > 0
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
          response: `Am gasit ${matchingItems.length} loturi diferite de ${product} in stoc.`,
          needsMoreInfo: {
            type: "batch_selection",
            question: `Din care lot doresti sa scoti ${quantity} ${unit} de ${product}?`,
            options: options
          }
        };
      } else if (matchingItems.length === 1) {
        // Only one batch exists, use that one
        const item = matchingItems[0];
        
        // Check if we have enough quantity
        if (item.quantity < quantity) {
          // We don't have enough in this batch
          return {
            action: "unknown",
            response: `Atentie! In lotul disponibil avem doar ${item.quantity} ${unit} de ${product}, dar ai solicitat ${quantity} ${unit}.`,
            needsMoreInfo: {
              type: "batch_selection",
              question: `Doresti sa scoti doar cantitatea disponibila (${item.quantity} ${unit}) sau sa anulezi operatiunea?`,
              options: [
                {
                  id: item.id || '',
                  name: item.name,
                  batch_number: item.batch_number,
                  supplier: item.supplier,
                  quantity: item.quantity,
                  unit: unit
                }
              ]
            }
          };
        }
        
        return {
          action: "remove",
          response: `Am scos ${quantity} ${unit} de ${product} din stoc.`,
          item: {
            id: item.id,
            name: product,
            quantity: quantity,
            unit: unit,
            supplier: item.supplier,
            batch_number: item.batch_number
          }
        };
      } else {
        // No matching items with stock
        return {
          action: "unknown",
          response: `Nu exista ${product} cu stoc disponibil in inventar.`,
        };
      }
    }
  }
  
  // Also check for specific batch removal with batch number specified
  const batchRemoveRegex = /(?:scoate|elimina|elimina|sterge|sterge)\s+(\d+)\s*([a-zA-Z]+)\s+(?:de\s+)?([a-z]+).*lot\s+(\d+)/i;
  const batchRemoveMatch = lowercaseCommand.match(batchRemoveRegex);
  
  if (batchRemoveMatch) {
    const quantity = parseInt(batchRemoveMatch[1]);
    const unit = batchRemoveMatch[2];
    const product = batchRemoveMatch[3];
    const batchNumber = batchRemoveMatch[4];
    
    // Find the specific batch
    const specificBatch = inventory.find(
      item => item.name.toLowerCase() === product.toLowerCase() && 
             item.batch_number === batchNumber &&
             item.quantity > 0
    );
    
    if (specificBatch) {
      // Check if we have enough quantity in this batch
      if (specificBatch.quantity < quantity) {
        // Not enough in this batch, suggest alternatives
        const otherBatches = inventory.filter(
          item => item.name.toLowerCase() === product.toLowerCase() && 
                item.id !== specificBatch.id &&
                item.quantity > 0
        );
        
        let responseText = `Atentie! In lotul ${batchNumber} avem doar ${specificBatch.quantity} ${unit} de ${product}, dar ai solicitat ${quantity} ${unit}.`;
        
        if (otherBatches.length > 0) {
          // We have other batches of the same product with stock
          const options = [
            {
              id: specificBatch.id || '',
              name: specificBatch.name,
              batch_number: specificBatch.batch_number,
              supplier: specificBatch.supplier,
              quantity: specificBatch.quantity,
              unit: unit
            },
            ...otherBatches.map(item => ({
              id: item.id || '',
              name: item.name,
              batch_number: item.batch_number,
              supplier: item.supplier,
              quantity: item.quantity,
              unit: item.unit
            }))
          ];
          
          responseText += ` Doresti sa scoti cele ${specificBatch.quantity} ${unit} disponibile din lotul ${batchNumber} si restul de ${quantity - specificBatch.quantity} ${unit} din alt lot?`;
          
          return {
            action: "unknown",
            response: responseText,
            needsMoreInfo: {
              type: "batch_selection",
              question: `Din care alt lot doresti sa scoti diferenta de ${quantity - specificBatch.quantity} ${unit}?`,
              options: otherBatches.map(item => ({
                id: item.id || '',
                name: item.name,
                batch_number: item.batch_number,
                supplier: item.supplier,
                quantity: item.quantity,
                unit: item.unit
              }))
            }
          };
        } else {
          // No other batches available
          return {
            action: "unknown",
            response: `Atentie! In lotul ${batchNumber} avem doar ${specificBatch.quantity} ${unit} de ${product}, dar ai solicitat ${quantity} ${unit}. Nu exista alte loturi disponibile.`,
            needsMoreInfo: {
              type: "batch_selection",
              question: `Doresti sa scoti doar cantitatea disponibila (${specificBatch.quantity} ${unit}) sau sa anulezi operatiunea?`,
              options: [
                {
                  id: specificBatch.id || '',
                  name: specificBatch.name,
                  batch_number: specificBatch.batch_number,
                  supplier: specificBatch.supplier,
                  quantity: specificBatch.quantity,
                  unit: unit
                }
              ]
            }
          };
        }
      }
      
      // We have enough quantity, proceed with removal
      return {
        action: "remove",
        response: `Am scos ${quantity} ${unit} de ${product} din lotul ${batchNumber}.`,
        item: {
          id: specificBatch.id,
          name: product,
          quantity: quantity,
          unit: unit,
          supplier: specificBatch.supplier,
          batch_number: specificBatch.batch_number
        }
      };
    } else {
      // Check if batch exists but has zero quantity
      const emptyBatch = inventory.find(
        item => item.name.toLowerCase() === product.toLowerCase() && 
               item.batch_number === batchNumber &&
               item.quantity === 0
      );
      
      if (emptyBatch) {
        return {
          action: "unknown",
          response: `Lotul ${batchNumber} de ${product} exista, dar nu mai are stoc disponibil.`
        };
      }
      
      // Batch not found
      const availableBatches = inventory.filter(
        item => item.name.toLowerCase() === product.toLowerCase() && 
               item.quantity > 0
      );
      
      if (availableBatches.length > 0) {
        return {
          action: "unknown",
          response: `Nu am gasit lotul ${batchNumber} de ${product}, dar exista alte loturi disponibile.`,
          needsMoreInfo: {
            type: "batch_selection",
            question: `Din care lot doresti sa scoti ${quantity} ${unit} de ${product}?`,
            options: availableBatches.map(item => ({
              id: item.id || '',
              name: item.name,
              batch_number: item.batch_number,
              supplier: item.supplier,
              quantity: item.quantity,
              unit: item.unit
            }))
          }
        };
      } else {
        return {
          action: "unknown",
          response: `Nu exista ${product} cu stoc disponibil in inventar.`
        };
      }
    }
  }
  
  // Handle pallet requests
  if (lowercaseCommand.includes("palet")) {
    // Extract product name from command
    const productMatch = lowercaseCommand.match(/palet\s+(?:de\s+)?([a-z]+)/i);
    const product = productMatch ? productMatch[1] : "produse";
    
    // Check if we have supplier info
    const hasSupplier = lowercaseCommand.includes("de la") || lowercaseCommand.includes("furnizor");
    
    if (!hasSupplier) {
      return {
        action: "unknown",
        response: `As avea nevoie de cateva detalii in plus pentru a adauga paletii de ${product} in sistem.`,
        needsMoreInfo: {
          type: "pallet_details",
          question: `Cate kg contine un palet de ${product}? De la ce furnizor provine? Si care este numarul lotului?`
        }
      };
    }
  }
  
  // Handle queries about inventory
  if (lowercaseCommand.includes("cate") || lowercaseCommand.includes("cate") || 
      lowercaseCommand.includes("cati") || lowercaseCommand.includes("cati")) {
    
    // Check for product mentions
    const productMatch = lowercaseCommand.match(/(?:de|din)\s+([a-z]+)/i);
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
            title: `Loturi de ${product} in stoc`,
            data: matchingItems.map(item => ({
              name: item.batch_number ? `Lot ${item.batch_number}` : `${item.supplier || 'Necunoscut'}`,
              value: item.quantity
            })),
            description: `Cantitati de ${product} pe loturi`
          });
        }
        
        return {
          action: "query",
          response: `Avem in total ${totalQuantity} ${unit} de ${product} in stoc, in ${matchingItems.length} ${matchingItems.length === 1 ? 'lot' : 'loturi'} diferite.`,
          charts: chartData.length > 0 ? chartData : undefined
        };
      } else {
        return {
          action: "query",
          response: `Nu avem ${product} in stoc momentan.`
        };
      }
    }
  }
  
  // Handle menta/menta with lot number pattern more generally
  if ((lowercaseCommand.includes("menta") || lowercaseCommand.includes("menta")) && 
      lowercaseCommand.includes("magnani")) {
    
    // Try to extract quantity
    const quantityMatch = lowercaseCommand.match(/(\d+)\s*kg/);
    const quantity = quantityMatch ? parseInt(quantityMatch[1]) : 50;
    
    // Try to extract lot number
    const lotMatch = lowercaseCommand.match(/lot\s+(\d+)/);
    const lotNumber = lotMatch ? lotMatch[1] : "necunoscut";
    
    // Check if this is a remove command
    if (lowercaseCommand.match(/^(scoate|elimina|elimina|sterge|sterge)/i)) {
      return {
        action: "remove",
        response: `Am scos ${quantity} kg de menta de la furnizorul Magnani, numarul lotului ${lotNumber}, din stoc.`,
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
        response: `Am adaugat ${quantity} kg de menta de la furnizorul Magnani, numarul lotului ${lotNumber}, in stoc.`,
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
  const addRegex = /adaug[a]\s+(\d+)\s*([a-z]+)\s+de\s+([a-z]+)/i;
  const addMatch = lowercaseCommand.match(addRegex);
  
  if (addMatch) {
    return {
      action: "add",
      response: `Am adaugat ${addMatch[1]} ${addMatch[2]} de ${addMatch[3]} in stoc.`,
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
      response: "Imi pare rau, dar nu am destule informatii pentru a raspunde la aceasta intrebare. Sunt specializat in asistenta pentru gestiunea stocurilor. Puteti sa ma intrebati despre stoc, produse, furnizori sau sa imi cereti sa adaug sau sa scot produse din inventar."
    };
  }
  
  // Default error response for other cases
  return {
    action: "unknown",
    response: "Nu am inteles exact ce doresti sa faci. Poti sa reformulezi comanda cu detalii despre cantitate, produs si eventual furnizor sau numar de lot?",
  };
}
