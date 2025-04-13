
// Inventory related interfaces
export interface InventoryItem {
  id?: string;
  name: string;
  quantity: number;
  unit: string;
  supplier?: string;
  supplier_id?: string;
  product_id?: string;
  manufacturer_id?: string;
  batch_number?: string;
  receipt_date?: string | Date; // Updated to accept both string and Date
  document_number?: string;
  entry_number?: number;
  crate_type_id?: string;
  crate_count?: number;
  gross_quantity?: number;
  net_quantity?: number;
  crate_weight?: number;
  createdAt?: {
    seconds: number;
    nanoseconds: number;
  };
  updatedAt?: {
    seconds: number;
    nanoseconds: number;
  };
  isHeader?: boolean;
  action?: 'add' | 'remove' | 'set';
}

export interface CommandResult {
  action: 'add' | 'remove' | 'set' | 'view' | 'export' | 'email' | 'query' | 'unknown';
  response: string;
  item?: InventoryItem;
  charts?: ChartData[];
  needsMoreInfo?: {
    type: 'supplier_info' | 'batch_info' | 'batch_selection' | 'quantity_adjustment';
    question: string;
    options?: {
      id: string;
      name: string;
      batch_number?: string;
      supplier?: string;
      quantity: number;
      unit: string;
    }[];
    suggestedAction?: 'partial_removal' | 'split_removal' | 'cancel';
  };
}

export interface ChartData {
  type: 'bar' | 'pie' | 'line';
  title: string;
  data: Array<{
    name: string;
    value: number;
    [key: string]: string | number;
  }>;
  xKey?: string;
  yKey?: string;
  description?: string;
}

// Product, Supplier, and Manufacturer interfaces
export interface Product {
  id: string;
  name: string;
  description?: string;
  default_unit: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact?: string;
  phone?: string;
  email?: string;
}

export interface Manufacturer {
  id: string;
  name: string;
  country?: string;
  description?: string;
}

export interface CrateType {
  id: string;
  name: string;
  weight: number;
  description?: string;
}

// History related interfaces
export interface InventoryHistoryItem {
  id: string;
  inventory_item_id?: string;
  action: 'add' | 'remove' | 'set';
  name: string;
  quantity: number;
  unit: string;
  previous_quantity?: number;
  supplier?: string;
  supplier_id?: string;
  product_id?: string;
  manufacturer_id?: string;
  batch_number?: string;
  document_number?: string;
  crate_type_id?: string;
  crate_count?: number;
  gross_quantity?: number;
  net_quantity?: number;
  crate_weight?: number;
  operation_date: Date | string; // Updated to accept both Date and string
  exit_timestamp?: Date | string; // Updated to accept both Date and string
  notes?: string;
}

// Analytics related interfaces
export interface InventoryAnalytics {
  name: string;
  unit: string;
  total_quantity: number;
  batch_count: number;
  first_receipt?: Date;
  last_receipt?: Date;
  all_batches?: string;
  all_suppliers?: string;
  avg_daily_consumption_rate: number;
}

export interface ConsumptionAnalytics {
  name: string;
  unit: string;
  action: string;
  operation_day: Date;
  removed_quantity: number;
  operation_count: number;
}

// Dashboard related interfaces
export interface DashboardMenuItem {
  id: string;
  name: string;
  icon: React.ElementType;
  path: string;
  description?: string;
}

// Web Speech API type definitions
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
    SpeechSynthesisUtterance: {
      new(text?: string): SpeechSynthesisUtterance;
      prototype: SpeechSynthesisUtterance;
    };
  }

  // Speech Recognition interfaces
  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    onresult: (event: SpeechRecognitionEvent) => void;
    onerror: (event: SpeechRecognitionErrorEvent) => void;
  }

  interface SpeechRecognitionEvent {
    readonly resultIndex: number;
    readonly results: SpeechRecognitionResultList;
  }

  interface SpeechRecognitionResultList {
    readonly [index: number]: SpeechRecognitionResult;
    readonly length: number;
  }

  interface SpeechRecognitionResult {
    readonly isFinal: boolean;
    readonly [index: number]: SpeechRecognitionAlternative;
    readonly length: number;
  }

  interface SpeechRecognitionAlternative {
    readonly transcript: string;
    readonly confidence: number;
  }

  interface SpeechRecognitionErrorEvent extends Event {
    readonly error: string;
    readonly message: string;
  }

  // SpeechSynthesis interfaces
  interface SpeechSynthesisVoice {
    readonly default: boolean;
    readonly lang: string;
    readonly localService: boolean;
    readonly name: string;
    readonly voiceURI: string;
  }

  interface SpeechSynthesisUtterance extends EventTarget {
    lang: string;
    pitch: number;
    rate: number;
    text: string;
    voice: SpeechSynthesisVoice | null;
    volume: number;
    onend: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => any) | null;
  }

  interface SpeechSynthesisEvent extends Event {
    readonly utterance: SpeechSynthesisUtterance;
  }

  interface SpeechSynthesis {
    readonly speaking: boolean;
    onvoiceschanged: ((this: SpeechSynthesis, ev: Event) => any) | null;
    cancel(): void;
    getVoices(): SpeechSynthesisVoice[];
    pause(): void;
    resume(): void;
    speak(utterance: SpeechSynthesisUtterance): void;
  }
}
