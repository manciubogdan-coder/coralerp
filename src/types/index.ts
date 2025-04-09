
export interface InventoryItem {
  id?: string;
  name: string;
  quantity: number;
  unit: string;
  createdAt?: {
    seconds: number;
    nanoseconds: number;
  };
  updatedAt?: {
    seconds: number;
    nanoseconds: number;
  };
}

export interface CommandResult {
  action: 'add' | 'remove' | 'view' | 'export' | 'email' | 'unknown';
  response: string;
  item?: InventoryItem;
}

// Web Speech API type definitions
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}
