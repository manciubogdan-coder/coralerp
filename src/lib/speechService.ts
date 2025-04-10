
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
  
  // Cuvinte cheie pentru comenzi legate de stoc
  const stockKeywords = ['stoc', 'inventar', 'produse', 'depozit', 'cantitate'];
  const viewKeywords = ['arata', 'vezi', 'afișează', 'arată', 'ce', 'câte', 'cate'];
  
  // Verificăm dacă textul conține cuvinte cheie pentru afișarea stocului
  const hasStockKeyword = stockKeywords.some(keyword => normalizedText.includes(keyword));
  const hasViewKeyword = viewKeywords.some(keyword => normalizedText.includes(keyword));
  
  // Dacă avem ambele tipuri de cuvinte cheie, este probabil o comandă de afișare a stocului
  if (hasStockKeyword && hasViewKeyword) {
    console.log("Comandă de stoc detectată, normalizare la 'arată stocul'");
    return "arată stocul";
  }
  
  // Alte potențiale comenzi de normalizat
  if (normalizedText.includes("ce") && normalizedText.includes("avem") && 
      (normalizedText.includes("stoc") || normalizedText.includes("depozit"))) {
    return "arată stocul";
  }
  
  if ((normalizedText.includes("cat") || normalizedText.includes("câte") || normalizedText.includes("cate")) && 
      (normalizedText.includes("produse") || normalizedText.includes("stoc"))) {
    return "câte produse avem în stoc";
  }
  
  return transcript;
};
