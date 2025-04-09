
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
  utterance.pitch = 1;

  // Încercăm să găsim o voce în română
  const voices = window.speechSynthesis.getVoices();
  const romanianVoice = voices.find(voice => voice.lang.includes('ro'));
  
  if (romanianVoice) {
    utterance.voice = romanianVoice;
  } else {
    // Dacă nu există voce în română, vom utiliza vocea implicită
    console.log("Nu s-a găsit o voce în română. Se utilizează vocea implicită.");
  }

  // Vorbește textul
  window.speechSynthesis.speak(utterance);

  return {
    stop: () => window.speechSynthesis.cancel(),
    isPending: () => window.speechSynthesis.speaking
  };
};
