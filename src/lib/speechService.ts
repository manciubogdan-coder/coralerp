
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
          // Alternativele sunt 'alloy', 'echo', 'fable', 'onyx', 'shimmer'
          voice: 'nova' 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Eroare la generarea vocii:", errorData);
        return;
      }

      const { audioContent } = await response.json();
      
      if (!audioContent) {
        console.error("Nu s-a primit conținut audio de la server");
        return;
      }

      // Creăm un element audio și setăm sursa
      if (audioElement) {
        audioElement.pause();
      }
      
      // Convertim base64 în URL pentru audio
      const audioSrc = `data:audio/mp3;base64,${audioContent}`;
      
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
    utterance.pitch = 1.5;

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
