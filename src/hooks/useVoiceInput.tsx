
import { useState, useEffect, useCallback } from 'react';
import { improveVoiceCommand } from '@/lib/speechService';

/**
 * Hook pentru folosirea comenzilor vocale în aplicație
 */
export const useVoiceInput = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [recognition, setRecognition] = useState<any>(null);
  // Adăugăm un nou state pentru a ține evidența conversației
  const [conversationMode, setConversationMode] = useState<'idle' | 'active'>('idle');
  const [currentStep, setCurrentStep] = useState<string>('');
  const [collectedData, setCollectedData] = useState<Record<string, any>>({});

  useEffect(() => {
    // Use the global types from the declaration file
    const SpeechRecognitionAPI = 
      window.SpeechRecognition || window.webkitSpeechRecognition;
      
    if (!SpeechRecognitionAPI) {
      console.error('Browserul nu suportă recunoașterea vocală');
      return;
    }
    
    const recognitionInstance = new SpeechRecognitionAPI();
    recognitionInstance.continuous = true;
    recognitionInstance.interimResults = true;
    recognitionInstance.lang = 'ro-RO';
    
    recognitionInstance.onresult = (event) => {
      let interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          const finalText = event.results[i][0].transcript.trim();
          setFinalTranscript(finalText);
          setTranscript('');
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      
      setTranscript(interimTranscript);
    };
    
    recognitionInstance.onerror = (event) => {
      console.error('Eroare la recunoașterea vocală:', event.error);
      setIsRecording(false);
    };
    
    recognitionInstance.onend = () => {
      // Repornește automat dacă înregistrarea este încă activă
      if (isRecording) {
        recognitionInstance.start();
      } else {
        setIsRecording(false);
      }
    };
    
    setRecognition(recognitionInstance);
    
    return () => {
      if (recognition) {
        recognition.onend = null;
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.abort();
      }
    };
  }, [isRecording, recognition]);

  // Funcție pentru a porni/opri înregistrarea
  const toggleRecording = useCallback(() => {
    if (!recognition) return;
    
    if (!isRecording) {
      setTranscript('');
      setFinalTranscript('');
      recognition.start();
    } else {
      recognition.stop();
    }
    
    setIsRecording(!isRecording);
  }, [isRecording, recognition]);

  // Procesează comanda vocală pentru a îmbunătăți recunoașterea
  const processCommand = useCallback((command: string) => {
    if (!command.trim()) return '';
    return improveVoiceCommand(command);
  }, []);

  // Metodă pentru a începe o nouă conversație ghidată
  const startConversation = useCallback((initialStep: string) => {
    setConversationMode('active');
    setCurrentStep(initialStep);
    setCollectedData({});
    
    if (!isRecording) {
      toggleRecording();
    }
  }, [isRecording, toggleRecording]);

  // Metodă pentru a procesa și a avansa în conversație
  const processConversationStep = useCallback((response: string, nextStep?: string, data?: Record<string, any>) => {
    // Actualizăm datele colectate dacă avem date noi
    if (data) {
      setCollectedData(prev => ({ ...prev, ...data }));
    }
    
    // Dacă există un pas următor, setăm pasul curent
    if (nextStep) {
      setCurrentStep(nextStep);
    } else {
      // Dacă nu există pas următor, conversația s-a terminat
      setConversationMode('idle');
    }
    
    // Resetăm transcript-ul pentru a permite o nouă intrare
    setTranscript('');
    setFinalTranscript('');
  }, []);

  // Metodă pentru a termina conversația
  const endConversation = useCallback(() => {
    setConversationMode('idle');
    setCurrentStep('');
    
    if (isRecording) {
      toggleRecording();
    }
    
    return collectedData;
  }, [isRecording, toggleRecording, collectedData]);

  return {
    isRecording,
    transcript,
    finalTranscript,
    toggleRecording,
    processCommand,
    // Adăugăm metodele pentru conversație
    startConversation,
    processConversationStep,
    endConversation,
    conversationMode,
    currentStep,
    collectedData
  };
};
