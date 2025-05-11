
import { useState, useEffect, useCallback, useRef } from "react";

export type ConversationStep = 
  'idle' |
  'askOperation' | 
  'askProduct' | 
  'confirmProduct' |
  'askQuantity' | 
  'askUnit' | 
  'askSupplier' | 
  'confirmSupplier' |
  'askManufacturer' | 
  'confirmManufacturer' |
  'askLot' | 
  'askDocumentNumber' | 
  'askCrateInfo' | 
  'askCrateType' |
  'confirmCrateType' |
  'askCrateCount' | 
  'askDestination' |
  'confirmOperation' |
  'processingOperation';

export type ConversationMode = 'idle' | 'active';

export type CollectedData = {
  operation?: 'reception' | 'transfer' | 'production';
  productId?: string;
  productName?: string;
  suggestedProduct?: string;
  quantity?: number;
  unit?: string;
  supplierId?: string;
  supplierName?: string;
  suggestedSupplier?: string;
  manufacturerId?: string;
  manufacturerName?: string;
  suggestedManufacturer?: string;
  lotNumber?: string;
  documentNumber?: string;
  hasCrates?: boolean;
  crateTypeId?: string;
  crateTypeName?: string;
  crateWeight?: number;
  suggestedCrateType?: string;
  crateCount?: number;
  destination?: string;
};

export const useVoiceInput = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  
  // Conversation state
  const [conversationMode, setConversationMode] = useState<ConversationMode>('idle');
  const [currentStep, setCurrentStep] = useState<ConversationStep>('idle');
  const [collectedData, setCollectedData] = useState<CollectedData>({});
  
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

  // Conversation control functions
  const startConversation = useCallback((initialStep: ConversationStep) => {
    setConversationMode('active');
    setCurrentStep(initialStep);
    setCollectedData({});
    console.log(`Conversation started with step: ${initialStep}`);
  }, []);

  const processConversationStep = useCallback((text: string, nextStep: ConversationStep, data: Partial<CollectedData> = {}) => {
    setCollectedData(prev => ({ ...prev, ...data }));
    setCurrentStep(nextStep);
    console.log(`Moving to step: ${nextStep} with data:`, data);
  }, []);

  const endConversation = useCallback(() => {
    const finalData = { ...collectedData };
    setConversationMode('idle');
    setCurrentStep('idle');
    setCollectedData({});
    console.log('Conversation ended with data:', finalData);
    return finalData;
  }, [collectedData]);

  return {
    isRecording,
    transcript,
    finalTranscript,
    error,
    toggleRecording,
    processCommand,
    hasSpeechRecognition,
    // Add conversation functionality
    startConversation,
    processConversationStep,
    endConversation,
    conversationMode,
    currentStep,
    collectedData
  };
};
