
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
    // Verificăm dacă comanda conține cantități, evitând duplicarea
    return transcript;
  }
  
  // Verificăm dacă este o comandă de eliminare cu cantități
  if (isRemoveCommand) {
    console.log("Comandă de eliminare detectată:", normalizedText);
    return transcript;
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

// Durata în milisecunde pentru a considera o comandă ca fiind duplicat (5 secunde)
const DUPLICATE_COMMAND_TIMEOUT = 5000; 

// Crează un hash simplu pentru o comandă, care va fi mai restrictiv pentru a evita dublurile
function createCommandHash(command: string): string {
  // Curățăm textul pentru a avea un hash mai consistent
  return command.toLowerCase()
              .trim()
              .replace(/\s+/g, ' ')                      // Reduce toate spațiile multiple la unul singur
              .replace(/[,.;:?!]/g, '')                  // Eliminăm punctuația
              .replace(/^(adauga|adaugă|adaug)\s+/i, '') // Standardizăm verbele comune
              .replace(/^(scoate|elimină)\s+/i, '');     // Standardizăm verbele comune
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
