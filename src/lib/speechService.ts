
// Funcție pentru a converti textul în vorbire
export const speakText = (text: string) => {
  // Verificăm dacă browserul suportă Web Speech API
  if (!('speechSynthesis' in window) || !window.speechSynthesis || !window.SpeechSynthesisUtterance) {
    console.error("Web Speech API nu este suportată de acest browser.");
    return;
  }

  // Oprim orice vorbire în curs
  window.speechSynthesis.cancel();

  // Creăm un nou obiect utterance
  const utterance = new window.SpeechSynthesisUtterance(text);
  utterance.lang = 'ro-RO';
  utterance.volume = 1;
  utterance.rate = 1;
  utterance.pitch = 1.3; // Am crescut pitch-ul pentru o voce mai feminină

  // Așteptăm să se încarce lista de voci
  const loadVoices = async () => {
    return new Promise<SpeechSynthesisVoice[]>((resolve) => {
      // Verificăm dacă vocile sunt deja disponibile
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        return resolve(voices);
      }

      // Altfel, așteptăm evenimentul voiceschanged
      window.speechSynthesis.onvoiceschanged = () => {
        const availableVoices = window.speechSynthesis.getVoices();
        resolve(availableVoices);
      };
    });
  };

  // Funcție pentru a găsi cea mai bună voce
  const findBestVoice = async () => {
    const voices = await loadVoices();
    
    // Căutăm voci în ordinea preferinței
    // 1. Voce feminină în română
    const romanianFemaleVoice = voices.find(voice => 
      voice.lang.includes('ro') && 
      (voice.name.includes('female') || voice.name.toLowerCase().includes('femeie') || !voice.name.toLowerCase().includes('male'))
    );
    
    if (romanianFemaleVoice) {
      console.log("Am găsit o voce feminină în română:", romanianFemaleVoice.name);
      return romanianFemaleVoice;
    }
    
    // 2. Orice voce în română
    const romanianVoice = voices.find(voice => voice.lang.includes('ro'));
    if (romanianVoice) {
      console.log("Am găsit o voce în română:", romanianVoice.name);
      return romanianVoice;
    }
    
    // 3. Voce feminină în engleză sau altă limbă
    const femaleFallbackVoice = voices.find(voice => 
      voice.name.includes('female') || 
      (voice.name.includes('Google') && !voice.name.includes('Male')) ||
      voice.name.includes('Samantha') || 
      voice.name.includes('Victoria') || 
      voice.name.includes('Zira')
    );
    
    if (femaleFallbackVoice) {
      console.log("Am găsit o voce feminină (fallback):", femaleFallbackVoice.name);
      return femaleFallbackVoice;
    }
    
    // 4. Orice voce disponibilă
    if (voices.length > 0) {
      console.log("Folosesc prima voce disponibilă:", voices[0].name);
      return voices[0];
    }
    
    return null;
  };

  // Aplicăm vocea optimă și vorbim textul
  const setupVoiceAndSpeak = async () => {
    const bestVoice = await findBestVoice();
    
    if (bestVoice) {
      utterance.voice = bestVoice;
    } else {
      console.log("Nu s-a găsit o voce potrivită. Se utilizează vocea implicită.");
    }
    
    // Vorbește textul
    window.speechSynthesis.speak(utterance);
  };
  
  // Inițiem procesul de configurare și vorbire
  setupVoiceAndSpeak();

  return {
    stop: () => window.speechSynthesis.cancel(),
    isPending: () => window.speechSynthesis.speaking
  };
};
