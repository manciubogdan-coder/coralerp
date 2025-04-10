
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
  // Normalizăm textul pentru a avea mai multă consistență
  const normalizedText = transcript.toLowerCase().trim();
  
  // Listă extinsă de cuvinte cheie pentru comenzi legate de stoc
  const stockKeywords = ['stoc', 'inventar', 'produse', 'depozit', 'cantitate', 'marfa', 'lot', 'loturi', 'consum'];
  const viewKeywords = ['arata', 'vezi', 'afișează', 'arată', 'ce', 'câte', 'cate', 'vreau', 'să', 'văd', 'vad', 'lista', 'listează', 'raport'];
  const timeKeywords = ['zilnic', 'ieri', 'astăzi', 'azi', 'luni', 'marti', 'miercuri', 'joi', 'vineri', 'săptămâna', 'saptamana', 'luna', 'lunar'];
  
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
  
  // Verificăm comenzile de adăugare sau scoatere produse
  if (normalizedText.match(/adaug[aă]|pun|bag|adăugăm/) && 
      (normalizedText.includes("kg") || normalizedText.includes("litri") || normalizedText.includes("buc"))) {
    return transcript; // Păstrăm comanda originală pentru că conține cantități specifice
  }
  
  if (normalizedText.match(/scoate|elimină|scoatem|elimina|șterge|sterge|ștergem|stergem/) && 
      (normalizedText.includes("kg") || normalizedText.includes("litri") || normalizedText.includes("buc"))) {
    return transcript; // Păstrăm comanda originală pentru că conține cantități specifice
  }
  
  // Dacă nu se potrivește cu niciunul din tiparele de mai sus, returnăm textul original
  return transcript;
};
