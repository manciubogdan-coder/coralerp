// Funcție pentru a converti textul în vorbire folosind OpenAI TTS API
export const speakText = (text: string) => {
  // Verificăm dacă browserul suportă Audio API
  if (typeof Audio === 'undefined') {
    console.error("Audio API nu este suportată de acest browser.");
    return;
  }

  let audioElement: HTMLAudioElement | null = null;
  let isSpeaking = false;
  
  const playTTS = async () => {
    try {
      console.log("Se generează vocea...");
      
      // Verificăm dacă API-ul TTS este disponibil, dacă nu, folosim fallback direct
      // pentru a evita erorile 404
      let shouldUseFallback = false;
      
      try {
        const checkResponse = await fetch('/api/health', { 
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        shouldUseFallback = !checkResponse.ok;
      } catch (e) {
        console.log("API-ul TTS nu este disponibil, se folosește fallback");
        shouldUseFallback = true;
      }
      
      if (shouldUseFallback) {
        useWebSpeechAPIFallback(text);
        return;
      }
      
      // Apelăm serviciul pentru a converti textul în vorbire
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text, 
          // Folosim vocea 'nova' care este foarte naturală și feminină
          voice: 'nova'
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Eroare la generarea vocii:", errorText);
        throw new Error(`Eroare server TTS: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      
      if (!data || !data.audioContent) {
        console.error("Nu s-a primit conținut audio de la server");
        throw new Error("Nu s-a primit conținut audio");
      }

      // Creăm un element audio și setăm sursa
      if (audioElement) {
        audioElement.pause();
      }
      
      // Convertim base64 în URL pentru audio
      const audioSrc = `data:audio/mp3;base64,${data.audioContent}`;
      
      audioElement = new Audio(audioSrc);
      
      // Setăm flag-ul și ascultătorii de evenimente
      isSpeaking = true;
      
      audioElement.onended = () => {
        isSpeaking = false;
        audioElement = null;
      };

      audioElement.onerror = (e) => {
        console.error("Eroare la redarea audio:", e);
        isSpeaking = false;
        audioElement = null;
        useWebSpeechAPIFallback(text);
      };

      // Redăm audio
      await audioElement.play();
      console.log("Se redă mesajul vocal");
    } catch (error) {
      console.error("Eroare la generarea sau redarea vocii:", error);
      isSpeaking = false;
      
      // Fallback la Web Speech API dacă OpenAI TTS eșuează
      useWebSpeechAPIFallback(text);
    }
  };
  
  // Funcție de rezervă care folosește Web Speech API
  const useWebSpeechAPIFallback = (fallbackText: string) => {
    console.log("Se folosește Web Speech API ca metodă de rezervă");
    
    if (!('speechSynthesis' in window) || !window.speechSynthesis) {
      console.error("Web Speech API nu este suportată de acest browser.");
      return;
    }
    
    // Oprim orice vorbire în curs
    window.speechSynthesis.cancel();

    // Creăm un nou obiect utterance
    const utterance = new window.SpeechSynthesisUtterance(fallbackText);
    utterance.lang = 'ro-RO';
    utterance.volume = 1;
    utterance.rate = 0.90;
    utterance.pitch = 1.2;

    // Încercăm să găsim o voce feminină
    const voices = window.speechSynthesis.getVoices();
    const femaleVoice = voices.find(voice => 
      (voice.name.toLowerCase().includes('female') || 
       voice.name.toLowerCase().includes('femeie') ||
       voice.name.toLowerCase().includes('woman') ||
       voice.name.toLowerCase().includes('girl')) && 
      !voice.name.toLowerCase().includes('male')
    );
    
    if (femaleVoice) {
      utterance.voice = femaleVoice;
    }
    
    // Vorbește textul
    window.speechSynthesis.speak(utterance);
  };
  
  // Inițiem procesul de redare vocală
  playTTS();

  return {
    stop: () => {
      if (audioElement) {
        audioElement.pause();
        audioElement = null;
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      isSpeaking = false;
    },
    isPending: () => isSpeaking
  };
};

// Adăugăm o funcție pentru îmbunătățirea recunoașterii comenzilor vocale
export const improveVoiceCommand = (transcript: string): string => {
  // Adăugăm logging pentru a vedea cum este procesat transcriptul
  console.log("Procesare comandă vocală brută:", transcript);
  
  // Verificăm dacă este o repetare a unei confirmări a asistentului
  if (transcript.startsWith("Am adaugat") || 
      transcript.startsWith("Am eliminat") || 
      transcript.startsWith("Am scos") ||
      transcript.startsWith("Am actualizat") ||
      transcript.match(/^Am (adaugat|eliminat|scos|actualizat) [0-9]+ (kg|buc|l|g) de/i)) {
    console.log("Comandă ignorată (confirmarea asistentului):", transcript);
    return "DUPLICATE_COMMAND";
  }
  
  // Creăm un hash unic pentru comanda curentă pentru a preveni dublarea 
  const commandHash = createCommandHash(transcript);
  console.log("Comanda hash:", commandHash);
  
  // Verificăm dacă această comandă a fost deja executată recent
  if (isCommandRecentlyExecuted(commandHash)) {
    console.log("Comandă vocală blocată (duplicat recent):", transcript);
    return "DUPLICATE_COMMAND";
  }
  
  // Marcăm comanda ca fiind executată
  markCommandAsExecuted(commandHash);
  
  // Normalizăm textul pentru a avea mai multă consistență
  const normalizedText = transcript.toLowerCase().trim();
  
  // Listă extinsă de cuvinte cheie pentru comenzi legate de stoc
  const stockKeywords = ['stoc', 'inventar', 'produse', 'depozit', 'cantitate', 'marfa', 'lot', 'loturi', 'consum'];
  const viewKeywords = ['arata', 'vezi', 'afișează', 'arată', 'ce', 'câte', 'cate', 'vreau', 'să', 'văd', 'vad', 'lista', 'listează', 'raport'];
  const timeKeywords = ['zilnic', 'ieri', 'astăzi', 'azi', 'luni', 'marti', 'miercuri', 'joi', 'vineri', 'săptămâna', 'saptamana', 'luna', 'lunar'];
  
  // Detectăm dacă este o comandă pentru a adăuga sau elimina elemente din inventar
  const isAddCommand = normalizedText.match(/adaug[aă]|pun|bag|adăugăm|inserez|înscriu|introduc|înregistrez|adaug/i);
  const isRemoveCommand = normalizedText.match(/scoate|elimină|scoatem|elimina|șterge|sterge|ștergem|stergem|scot/i);
  
  // Verificăm dacă este o comandă de adăugare cu cantități
  if (isAddCommand) {
    console.log("Comandă de adăugare detectată:", normalizedText);
    // Verificăm dacă comanda conține informații complete
    return checkCommandCompleteness(transcript, 'add');
  }
  
  // Verificăm dacă este o comandă de eliminare cu cantități
  if (isRemoveCommand) {
    console.log("Comandă de eliminare detectată:", normalizedText);
    return checkCommandCompleteness(transcript, 'remove');
  }
  
  // Verificăm dacă textul conține cuvinte cheie pentru afișarea stocului
  const hasStockKeyword = stockKeywords.some(keyword => normalizedText.includes(keyword));
  const hasViewKeyword = viewKeywords.some(keyword => normalizedText.includes(keyword));
  const hasTimeKeyword = timeKeywords.some(keyword => normalizedText.includes(keyword));
  
  // Îmbunătățim regula de detectare pentru comenzi de stoc
  if (hasStockKeyword) {
    // Pentru comenzi de vizualizare stoc
    if (hasViewKeyword || 
        normalizedText.includes("ce avem") || 
        normalizedText.includes("cum stam") ||
        normalizedText.includes("situatia") ||
        normalizedText.match(/^stoc/) ||
        normalizedText.match(/arata.*stoc/) ||
        normalizedText.match(/vezi.*stoc/) ||
        normalizedText.includes("mi") && (normalizedText.includes("stoc") || normalizedText.includes("inventar"))) {
      console.log("Comandă de stoc detectată, normalizare la 'arată stocul'");
      return "arată stocul";
    }
    
    // Pentru comenzi legate de rapoarte temporale (zilnic, lunar, etc.)
    if (hasTimeKeyword && (normalizedText.includes("raport") || normalizedText.includes("consum"))) {
      if (normalizedText.includes("zilnic") || normalizedText.includes("zi de zi") || 
         (normalizedText.includes("consum") && normalizedText.includes("azi")) ||
         (normalizedText.includes("consum") && normalizedText.includes("astazi"))) {
        console.log("Raport zilnic detectat");
        return "generează raport de consum zilnic";
      }
      
      if (normalizedText.includes("săptămânal") || normalizedText.includes("saptamanal") || 
         (normalizedText.includes("consum") && normalizedText.includes("saptamana")) ||
         (normalizedText.includes("consum") && normalizedText.includes("săptămâna")) ||
         (normalizedText.includes("consum") && normalizedText.includes("ultima saptamana")) ||
         (normalizedText.includes("consum") && normalizedText.includes("ultima săptămână"))) {
        console.log("Raport săptămânal detectat");
        return "generează raport de consum săptămânal";
      }
      
      if (normalizedText.includes("lunar") || normalizedText.includes("pe lună") || 
         (normalizedText.includes("consum") && normalizedText.includes("luna"))) {
        console.log("Raport lunar detectat");
        return "generează raport de consum lunar";
      }
      
      // Dacă menționează un anumit produs pentru raport
      const productMatch = normalizedText.match(/consum(?:ul)?\s+(?:de|la|pentru)?\s+([a-z]+)/i);
      if (productMatch) {
        const product = productMatch[1];
        console.log(`Raport pentru produsul ${product} detectat`);
        return `generează raport de consum pentru ${product}`;
      }
      
      // Pentru raport de consum general
      return "generează raport de consum";
    }
    
    // Pentru comenzi legate de cantități specifice
    if ((normalizedText.includes("cat") || normalizedText.includes("câte") || normalizedText.includes("cate")) && 
        (normalizedText.includes("produse") || normalizedText.includes("stoc"))) {
      return "câte produse avem în stoc";
    }
    
    // Pentru comenzi legate de produse expirabile
    if (normalizedText.includes("expir")) {
      return "ce produse expiră în curând";
    }
    
    // Pentru comenzi legate de furnizori
    if (normalizedText.includes("furnizor")) {
      return "arată cantitățile pe furnizori";
    }
    
    // Pentru comenzi legate de consum
    if (normalizedText.includes("consum")) {
      // Verificăm dacă este specificat un produs
      const productMatch = normalizedText.match(/consum(?:ul)?\s+(?:de|la|pentru)?\s+([a-z]+)/i);
      if (productMatch) {
        const product = productMatch[1];
        return `arată consumul pentru ${product}`;
      }
      
      // Verificăm dacă este specificată o perioadă
      if (normalizedText.includes("ieri")) {
        return "arată consumul de ieri";
      } else if (normalizedText.includes("azi") || normalizedText.includes("astăzi")) {
        return "arată consumul de azi";
      } else if (normalizedText.includes("săptămâna") || normalizedText.includes("saptamana")) {
        return "arată consumul săptămânal";
      } else if (normalizedText.includes("ultima saptamana") || normalizedText.includes("ultima săptămână")) {
        return "generează raport de consum săptămânal";
      }
      
      return "arată raportul de consum";
    }
  }
  
  console.log("Comandă care nu se potrivește cu tiparele cunoscute, se păstrează textul original");
  // Dacă nu se potrivește cu niciunul din tiparele de mai sus, returnăm textul original
  return transcript;
};

// Un sistem mai robust pentru a preveni executarea dublă a comenzilor vocale
// Stocăm hashurile comenzilor recente în această hartă împreună cu timestamp-ul
const recentCommandsMap = new Map<string, number>();

// Durata în milisecunde pentru a considera o comandă ca fiind duplicat (10 secunde)
const DUPLICATE_COMMAND_TIMEOUT = 10000;

// Crează un hash simplu pentru o comandă, care va fi mai restrictiv pentru a evita dublurile
function createCommandHash(command: string): string {
  // Curățăm textul pentru a avea un hash mai consistent
  const cleanedCommand = command.toLowerCase()
              .trim()
              .replace(/\s+/g, ' ')                      // Reduce toate spațiile multiple la unul singur
              .replace(/[,.;:?!]/g, '')                  // Eliminăm punctuația
              .replace(/^(adauga|adaugă|adaug)\s+/i, '') // Standardizăm verbele comune
              .replace(/^(scoate|elimină)\s+/i, '');     // Standardizăm verbele comune
              
  console.log("Command text normalizat pentru hash:", cleanedCommand);
  return cleanedCommand;
}

// Verifică dacă o comandă a fost executată recent
function isCommandRecentlyExecuted(commandHash: string): boolean {
  const lastTime = recentCommandsMap.get(commandHash);
  if (!lastTime) return false;
  
  // Verificăm dacă comanda a fost executată în ultimele X milisecunde
  const now = Date.now();
  const isRecent = (now - lastTime) < DUPLICATE_COMMAND_TIMEOUT;
  
  console.log(`Verificare comandă: ${commandHash}, executată acum ${now - lastTime} ms, este duplicat: ${isRecent}`);
  
  return isRecent;
}

// Marchează o comandă ca fiind executată
function markCommandAsExecuted(commandHash: string): void {
  const now = Date.now();
  recentCommandsMap.set(commandHash, now);
  console.log(`Comandă marcată ca executată la ${new Date(now).toISOString()}: ${commandHash}`);
  
  // Curățăm comenzile vechi din hartă
  cleanupOldCommands(now);
}

// Elimină comenzile vechi din mapă pentru a evita consumul excesiv de memorie
function cleanupOldCommands(currentTime: number): void {
  let cleaned = 0;
  for (const [command, timestamp] of recentCommandsMap.entries()) {
    if (currentTime - timestamp > DUPLICATE_COMMAND_TIMEOUT) {
      recentCommandsMap.delete(command);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.log(`S-au curățat ${cleaned} comenzi vechi din cache`);
  }
}

// Stocăm informații despre ultima interacțiune pentru a folosi valorile implicite
interface LastInteractionData {
  action: 'add' | 'remove' | 'set' | null;
  product?: string;
  quantity?: number;
  unit?: string;
  supplier?: string;
  batch?: string;
  manufacturer?: string;
  documentNumber?: string;
  crateType?: string;
  crateCount?: number;
  timestamp: number;
}

// Folosim un obiect singleton pentru a păstra starea între apeluri
let lastInteraction: LastInteractionData = {
  action: null,
  timestamp: 0
};

// Funcție pentru a verifica și completa informațiile lipsă dintr-o comandă
export function checkCommandCompleteness(command: string, action: 'add' | 'remove' | 'set'): string {
  const normalizedCmd = command.toLowerCase();
  
  console.log(`Verificare completitudine comandă ${action}:`, command);
  
  // Regulile pentru extragerea informațiilor din comandă vocală
  const productRegex = /(?:adaug[aă]|pun|bag|scoate|elimină|scot)\s+(?:([0-9]+(?:[,.][0-9]+)?)\s*(?:kg|buc|l|g|litri|litru|buc[aă]t[iî]|cutii|cutie|pachete|pachet))\s+(?:de\s+)?([a-zăîâșț]+)/i;
  const quantityRegex = /([0-9]+(?:[,.][0-9]+)?)\s*(?:kg|buc|l|g|litri|litru|buc[aă]t[iî]|cutii|cutie|pachete|pachet)/i;
  const unitRegex = /(?:[0-9]+(?:[,.][0-9]+)?)\s*(kg|buc|l|g|litri|litru|buc[aă]t[iî]|cutii|cutie|pachete|pachet)/i;
  const supplierRegex = /(?:de\s+la|furnizor|furnizorul)\s+([a-zăîâșț]+)/i;
  const batchRegex = /(?:lot|lotul|lotului)\s+([a-z0-9]+)/i;
  const manufacturerRegex = /(?:produc[aă]tor|produc[aă]torul)\s+([a-zăîâșț]+)/i;
  const crateRegex = /(?:pe|în|in)\s+([0-9]+)\s+(?:lăz|lazi|l[aă]di[țt][aăe]|cutii|cutie|crate|crates)/i;
  const documentRegex = /(?:document|factur[aă]|aviz|bon)\s+([a-z0-9]+)/i;
  
  // Extragem informațiile disponibile
  const productMatch = productRegex.exec(normalizedCmd);
  const quantityMatch = quantityRegex.exec(normalizedCmd);
  const unitMatch = unitRegex.exec(normalizedCmd);
  const supplierMatch = supplierRegex.exec(normalizedCmd);
  const batchMatch = batchRegex.exec(normalizedCmd);
  const manufacturerMatch = manufacturerRegex.exec(normalizedCmd);
  const crateMatch = crateRegex.exec(normalizedCmd);
  const documentMatch = documentRegex.exec(normalizedCmd);
  
  // Determinăm valorile extrase
  let product = productMatch ? productMatch[2] : null;
  let quantity = quantityMatch ? parseFloat(quantityMatch[1].replace(',', '.')) : null;
  let unit = unitMatch ? standardizeUnit(unitMatch[1]) : null;
  let supplier = supplierMatch ? supplierMatch[1] : null;
  let batch = batchMatch ? batchMatch[1] : null;
  let manufacturer = manufacturerMatch ? manufacturerMatch[1] : null;
  let crateCount = crateMatch ? parseInt(crateMatch[1]) : null;
  let documentNumber = documentMatch ? documentMatch[1] : null;
  
  // Extragem produsul și fără regexul complex în cazul în care prima metodă eșuează
  if (!product) {
    // Încercăm să găsim produsul după cuvintele cheie
    const simpleProductMatch = normalizedCmd.match(/(?:adaug[aă]|pun|bag|scoate|elimină|scot)\s+.*?\s+(?:de\s+)?([a-zăîâșț]+)(?:\s|$)/i);
    if (simpleProductMatch) {
      product = simpleProductMatch[1];
    }
  }
  
  console.log("Informații extrase:", { product, quantity, unit, supplier, batch, manufacturer, crateCount, documentNumber });
  
  // Verificăm dacă informațiile extrase sunt suficiente
  const missingFields = [];
  
  if (!product) missingFields.push("produsul");
  if (!quantity) missingFields.push("cantitatea");
  if (!unit) missingFields.push("unitatea de măsură");
  
  // Pentru acțiuni de adăugare, cerem și informații suplimentare
  if (action === 'add') {
    // Aceste câmpuri sunt opționale, dar dorim să le solicităm dacă nu sunt specificate
    if (!supplier) missingFields.push("furnizorul");
    if (!manufacturer) missingFields.push("producătorul");
    if (!batch) missingFields.push("numărul de lot");
    if (!documentNumber) missingFields.push("numărul de document");
    if (!crateCount) missingFields.push("numărul de lădițe");
  }
  
  // Actualizăm ultima interacțiune pentru valorile care au fost furnizate
  const now = Date.now();
  
  if (product || quantity || unit || supplier || batch || manufacturer || crateCount || documentNumber) {
    // Actualizăm doar valorile care au fost furnizate
    lastInteraction = {
      action,
      timestamp: now,
      ...(product && { product }),
      ...(quantity && { quantity }),
      ...(unit && { unit }),
      ...(supplier && { supplier }),
      ...(batch && { batch }),
      ...(manufacturer && { manufacturer }),
      ...(crateCount && { crateCount }),
      ...(documentNumber && { documentNumber })
    };
  } else if (now - lastInteraction.timestamp < 60000 && lastInteraction.action === action) {
    // Folosim valori din ultima interacțiune dacă sunt recente (sub 1 minut)
    console.log("Folosim valori din ultima interacțiune:", lastInteraction);
    product = product || lastInteraction.product;
    quantity = quantity || lastInteraction.quantity;
    unit = unit || lastInteraction.unit;
    supplier = supplier || lastInteraction.supplier;
    batch = batch || lastInteraction.batch;
    manufacturer = manufacturer || lastInteraction.manufacturer;
    crateCount = crateCount || lastInteraction.crateCount;
    documentNumber = documentNumber || lastInteraction.documentNumber;
  }
  
  // Verificăm din nou pentru câmpuri lipsă după preluarea valorilor din interacțiunea anterioară
  const essentialMissingFields = [];
  if (!product) essentialMissingFields.push('produsul');
  if (!quantity) essentialMissingFields.push('cantitatea');
  if (!unit) essentialMissingFields.push('unitatea de măsură');
  
  // Dacă lipsesc informații esențiale, returnăm o comandă specială pentru a solicita mai multe detalii
  if (essentialMissingFields.length > 0) {
    return `NEED_MORE_INFO:${action}:${essentialMissingFields.join(',')}:${JSON.stringify({
      product,
      quantity,
      unit,
      supplier,
      batch,
      manufacturer,
      crateCount,
      documentNumber
    })}`;
  }
  
  // Dacă avem informațiile esențiale, dar lipsesc unele detalii opționale, putem cere și acestea
  const optionalMissingFields = missingFields.filter(field => 
    !['produsul', 'cantitatea', 'unitatea de măsură'].includes(field)
  );
  
  if (optionalMissingFields.length > 0 && action === 'add') {
    return `NEED_OPTIONAL_INFO:${action}:${optionalMissingFields.join(',')}:${JSON.stringify({
      product,
      quantity,
      unit,
      supplier,
      batch,
      manufacturer,
      crateCount,
      documentNumber
    })}`;
  }
  
  // Construim comanda completă pentru procesare
  let processedCommand = `${action === 'add' ? 'adaugă' : 'scoate'} ${quantity} ${unit} de ${product}`;
  
  if (supplier) {
    processedCommand += ` de la ${supplier}`;
  }
  
  if (manufacturer) {
    processedCommand += ` producător ${manufacturer}`;
  }
  
  if (batch) {
    processedCommand += ` lot ${batch}`;
  }
  
  if (documentNumber) {
    processedCommand += ` document ${documentNumber}`;
  }
  
  if (crateCount && crateCount > 0) {
    processedCommand += ` în ${crateCount} lădițe`;
  }
  
  console.log("Comandă procesată:", processedCommand);
  return processedCommand;
}

// Funcție pentru a standardiza unitățile de măsură
function standardizeUnit(unit: string): string {
  unit = unit.toLowerCase();
  
  if (['kg', 'kilograme', 'kilogram', 'kg.'].includes(unit)) return 'kg';
  if (['l', 'litri', 'litru', 'l.', 'litrii'].includes(unit)) return 'l';
  if (['g', 'gram', 'grame', 'g.'].includes(unit)) return 'g';
  if (['buc', 'bucăți', 'bucati', 'bucată', 'bucata'].includes(unit)) return 'buc';
  if (['cutie', 'cutii'].includes(unit)) return 'cutie';
  if (['pachet', 'pachete'].includes(unit)) return 'pachet';
  
  return unit;
}

// Funcție pentru a parsa răspunsul utilizatorului la solicitarea de informații suplimentare
export function parseUserResponse(response: string, missingFields: string[], partialData: any): any {
  const normalizedResponse = response.toLowerCase();
  
  const productRegex = /(?:produs(?:ul)?|e)\s+([a-zăîâșț]+)/i;
  const quantityRegex = /([0-9]+(?:[,.][0-9]+)?)\s*(?:kg|buc|l|g|litri|litru|buc[aă]t[iî]|cutii|cutie|pachete|pachet)/i;
  const unitRegex = /(?:[0-9]+(?:[,.][0-9]+)?)\s*(kg|buc|l|g|litri|litru|buc[aă]t[iî]|cutii|cutie|pachete|pachet)/i;
  const supplierRegex = /(?:furnizor(?:ul)?|de la)\s+([a-zăîâșț]+)/i;
  const batchRegex = /(?:lot(?:ul)?)\s+([a-z0-9]+)/i;
  const manufacturerRegex = /(?:producător(?:ul)?)\s+([a-zăîâșț]+)/i;
  const documentRegex = /(?:document(?:ul)?|factur[aă]|aviz|bon)\s+([a-z0-9]+)/i;
  const crateRegex = /([0-9]+)\s+(?:lăz|lazi|l[aă]di[țt][aăe]|cutii|cutie|crate|crates)/i;
  
  const simpleProductMatch = normalizedResponse.match(/^([a-zăîâșț]+)$/i); // Dacă răspunsul este doar produsul
  const simpleQuantityMatch = normalizedResponse.match(/^([0-9]+(?:[,.][0-9]+)?)$/i); // Dacă răspunsul este doar cantitatea
  const simpleNumberMatch = normalizedResponse.match(/^([0-9]+)$/i); // Dacă răspunsul este doar un număr
  
  const data = { ...partialData };
  
  if (missingFields.includes('produsul')) {
    const match = productRegex.exec(normalizedResponse) || simpleProductMatch;
    if (match) {
      data.product = match[1];
    }
  }
  
  if (missingFields.includes('cantitatea')) {
    const match = quantityRegex.exec(normalizedResponse) || simpleQuantityMatch;
    if (match) {
      data.quantity = parseFloat(match[1].replace(',', '.'));
    }
  }
  
  if (missingFields.includes('unitatea de măsură')) {
    const match = unitRegex.exec(normalizedResponse);
    if (match) {
      data.unit = standardizeUnit(match[1]);
    } else if (normalizedResponse.match(/^(kg|buc|l|g|litri|litru|cutii|cutie|pachete|pachet)$/i)) {
      data.unit = standardizeUnit(normalizedResponse);
    }
  }
  
  if (missingFields.includes('furnizorul')) {
    const match = supplierRegex.exec(normalizedResponse);
    if (match) {
      data.supplier = match[1];
    } else if (simpleProductMatch && !missingFields.includes('produsul')) {
      // Dacă răspunsul este doar un cuvânt și nu așteptăm produsul, presupunem că este furnizorul
      data.supplier = simpleProductMatch[1];
    }
  }
  
  if (missingFields.includes('numărul de lot')) {
    const match = batchRegex.exec(normalizedResponse);
    if (match) {
      data.batch = match[1];
    } else if (simpleNumberMatch && !missingFields.includes('cantitatea') && 
               !missingFields.includes('numărul de lădițe') && !missingFields.includes('numărul de document')) {
      // Dacă răspunsul este doar un număr și nu așteptăm cantitatea sau alte numere, presupunem că este lot
      data.batch = simpleNumberMatch[1];
    }
  }
  
  if (missingFields.includes('producatorul')) {
    const match = manufacturerRegex.exec(normalizedResponse);
    if (match) {
      data.manufacturer = match[1];
    } else if (simpleProductMatch && !missingFields.includes('produsul') && !missingFields.includes('furnizorul')) {
      // Dacă răspunsul este doar un cuvânt și nu așteptăm produsul sau furnizorul, presupunem că este producătorul
      data.manufacturer = simpleProductMatch[1];
    }
  }
  
  if (missingFields.includes('numărul de document')) {
    const match = documentRegex.exec(normalizedResponse);
    if (match) {
      data.documentNumber = match[1];
    } else if (simpleNumberMatch && !missingFields.includes('cantitatea') && 
               !missingFields.includes('numărul de lădițe') && !missingFields.includes('numărul de lot')) {
      // Dacă răspunsul este doar un număr și nu așteptăm alte numere, presupunem că este numărul de document
      data.documentNumber = simpleNumberMatch[1];
    }
  }
  
  if (missingFields.includes('numărul de lădițe')) {
    const match = crateRegex.exec(normalizedResponse);
    if (match) {
      data.crateCount = parseInt(match[1]);
    } else if (simpleNumberMatch && !missingFields.includes('cantitatea') && 
               !missingFields.includes('numărul de lot') && !missingFields.includes('numărul de document')) {
      // Dacă răspunsul este doar un număr și nu așteptăm alte numere, presupunem că este numărul de lădițe
      data.crateCount = parseInt(simpleNumberMatch[1]);
    }
  }
  
  return data;
}

// Funcție pentru a obține o întrebare pentru câmpurile lipsă
export function getMissingFieldsQuestion(missingFields: string[], action: 'add' | 'remove' | 'set', partialData: any): string {
  const actionVerb = action === 'add' ? 'adăuga' : 'scoate';
  
  // Dacă lipsesc mai multe câmpuri, creăm o întrebare generală
  if (missingFields.length > 1) {
    return `Pentru a ${actionVerb} în inventar, am nevoie să știu ${missingFields.join(' și ')}. Poți să-mi spui aceste informații?`;
  }
  
  // Întrebări specifice pentru fiecare câmp lipsă
  if (missingFields[0] === 'produsul') {
    return `Ce produs dorești să ${actionVerb}?`;
  }
  
  if (missingFields[0] === 'cantitatea') {
    if (partialData.product) {
      return `Ce cantitate de ${partialData.product} dorești să ${actionVerb}?`;
    }
    return `Ce cantitate dorești să ${actionVerb}?`;
  }
  
  if (missingFields[0] === 'unitatea de măsură') {
    if (partialData.product) {
      return `În ce unitate de măsură exprimi cantitatea de ${partialData.product}? (kg, buc, l, etc.)`;
    }
    return `În ce unitate de măsură exprimi cantitatea? (kg, buc, l, etc.)`;
  }
  
  if (missingFields[0] === 'furnizorul') {
    if (partialData.product) {
      return `De la ce furnizor provine produsul ${partialData.product}?`;
    }
    return `De la ce furnizor provine produsul?`;
  }
  
  if (missingFields[0] === 'producatorul') {
    if (partialData.product) {
      return `Cine este producătorul pentru ${partialData.product}?`;
    }
    return `Cine este producătorul produsului?`;
  }
  
  if (missingFields[0] === 'numărul de lot') {
    if (partialData.product) {
      return `Care este numărul de lot pentru ${partialData.product}?`;
    }
    return `Care este numărul de lot?`;
  }
  
  if (missingFields[0] === 'numărul de document') {
    return `Care este numărul documentului de intrare? (factură, aviz, bon, etc.)`;
  }
  
  if (missingFields[0] === 'numărul de lădițe') {
    if (partialData.product) {
      return `În câte lădițe este ambalat produsul ${partialData.product}?`;
    }
    return `În câte lădițe este ambalat produsul? (introdu 0 dacă nu se aplică)`;
  }
  
  return `Te rog să-mi spui ${missingFields[0]} pentru a putea ${actionVerb} în inventar.`;
}
