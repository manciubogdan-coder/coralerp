
import { useState, useEffect, useCallback } from 'react';
import { improveVoiceCommand } from '@/lib/speechService';

/**
 * Hook pentru folosirea comenzilor vocale în aplicație
 */
export const useVoiceInput = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error('Browserul nu suportă recunoașterea vocală');
      return;
    }
    
    const recognitionInstance = new SpeechRecognition();
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
  }, [isRecording]);

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

  return {
    isRecording,
    transcript,
    finalTranscript,
    toggleRecording,
    processCommand
  };
};
