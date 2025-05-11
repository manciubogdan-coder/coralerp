import { useState, useEffect, useCallback, useRef } from "react";

export const useVoiceInput = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  
  const recognitionRef = useRef<any>(null);
  const lastFinalTranscriptRef = useRef<string>("");
  
  // Check if SpeechRecognition is available in the browser
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const hasSpeechRecognition = !!SpeechRecognition;

  const processCommand = useCallback((command: string) => {
    const lastTranscript = lastFinalTranscriptRef.current;
    
    if (command.trim() === lastTranscript?.trim()) {
      return "DUPLICATE_COMMAND";
    }
    
    lastFinalTranscriptRef.current = command;
    return command;
  }, []);

  const toggleRecording = useCallback(() => {
    if (!hasSpeechRecognition) {
      alert("Speech Recognition API is not supported in this browser.");
      return;
    }

    setIsRecording((prevState) => {
      const newState = !prevState;
      if (newState) {
        setFinalTranscript("");
        setTranscript("");
        setError(null);

        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'ro-RO';

        recognitionRef.current.onstart = () => {
          console.log("Recording started");
        };

        recognitionRef.current.onresult = (event: any) => {
          let interimTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              setFinalTranscript(event.results[i][0].transcript.trim());
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }
          setTranscript(interimTranscript.trim());
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error("Speech recognition error:", event.error);
          setError(`Error: ${event.error}`);
        };

        recognitionRef.current.onend = () => {
          console.log("Recording ended");
          setIsRecording(false);
        };

        recognitionRef.current.start();
      } else {
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }
      }
      return newState;
    });
  }, [hasSpeechRecognition]);

  return {
    isRecording,
    transcript,
    finalTranscript,
    error,
    toggleRecording,
    processCommand,
    hasSpeechRecognition
  };
};
