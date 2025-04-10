
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
  utterance.rate = 0.95; // Ușor mai lent pentru claritate
  utterance.pitch = 1.5; // Am crescut pitch-ul și mai mult pentru o voce mai feminină

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

  // Funcție pentru a găsi cea mai bună voce feminină
  const findBestVoice = async () => {
    const voices = await loadVoices();
    console.log("Voci disponibile:", voices.map(v => `${v.name} (${v.lang})`).join(', '));
    
    // Liste de nume comune pentru voci feminine
    const femaleNameIndicators = [
      'female', 'femeie', 'woman', 'girl', 
      'alina', 'alice', 'ioana', 'maria', 'ana', 
      'samantha', 'victoria', 'zira', 'eva',
      'karen', 'monika', 'tina', 'amelie', 'lisa',
      'sabrina', 'laura', 'julia'
    ];
    
    // Funcție pentru a evalua cât de probabilă e o voce să fie feminină
    const isFemaleVoice = (voice: SpeechSynthesisVoice): boolean => {
      const nameLower = voice.name.toLowerCase();
      // Excludem explicit vocile masculine
      if (nameLower.includes('male') || 
          nameLower.includes('barbat') || 
          nameLower.includes('david') || 
          nameLower.includes('paul') || 
          nameLower.includes('george') ||
          nameLower.includes('andrei')) {
        return false;
      }
      
      // Verificăm pentru indicatori feminini
      return femaleNameIndicators.some(indicator => 
        nameLower.includes(indicator.toLowerCase())
      );
    };
    
    // Căutăm voci în ordinea preferinței
    // 1. Voce feminină în română
    const romanianFemaleVoice = voices.find(voice => 
      voice.lang.includes('ro') && isFemaleVoice(voice)
    );
    
    if (romanianFemaleVoice) {
      console.log("Am găsit o voce feminină în română:", romanianFemaleVoice.name);
      return romanianFemaleVoice;
    }
    
    // 2. Orice voce în română (exceptăm vocile explicit masculine)
    const romanianVoice = voices.find(voice => 
      voice.lang.includes('ro') && !voice.name.toLowerCase().includes('male')
    );
    if (romanianVoice) {
      console.log("Am găsit o voce în română (posibil feminină):", romanianVoice.name);
      return romanianVoice;
    }
    
    // 3. Voce feminină în engleză sau altă limbă
    const femaleFallbackVoice = voices.find(voice => isFemaleVoice(voice));
    if (femaleFallbackVoice) {
      console.log("Am găsit o voce feminină (altă limbă):", femaleFallbackVoice.name);
      return femaleFallbackVoice;
    }
    
    // 4. Orice voce disponibilă care nu e explicit masculină
    const anyNonMaleVoice = voices.find(voice => 
      !voice.name.toLowerCase().includes('male') && 
      !voice.name.toLowerCase().includes('barbat')
    );
    if (anyNonMaleVoice) {
      console.log("Folosesc o voce posibil feminină:", anyNonMaleVoice.name);
      return anyNonMaleVoice;
    }
    
    // 5. Absolut orice voce disponibilă ca ultimă soluție
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
      console.log("Voce selectată pentru vorbire:", bestVoice.name);
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
