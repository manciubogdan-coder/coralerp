
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
  manufacturer?: string; // Added for manufacturer display
  batch_number?: string;
  receipt_date?: string | Date; // Updated to accept both string and Date
  document_number?: string;
  entry_number?: number;
  crate_type_id?: string;
  crate_count?: number;
  gross_quantity?: number;
  net_quantity?: number;
  crate_weight?: number;
  isHeader?: boolean; // For grouped views
  action?: 'add' | 'remove' | 'set';
  // Added timestamps with the correct format
  created_at?: string | {
    seconds: number;
    nanoseconds: number;
  };
  updated_at?: string | {
    seconds: number;
    nanoseconds: number;
  };
  // Legacy properties to support current code until refactored
  updatedAt?: {
    seconds: number;
    nanoseconds: number;
  };
  createdAt?: {
    seconds: number;
    nanoseconds: number;
  };
  // For join queries
  suppliers?: { name: string };
  products?: { name: string };
  manufacturers?: { name: string };
  crate_types?: { name: string; weight: number };
}

// Chart data for visualization
export interface ChartData {
  type: 'bar' | 'pie' | 'line';
  title: string;
  data: Array<{ name: string; value: number; unit?: string }>;
  description?: string;
  xKey?: string;
  yKey?: string;
}

// Product interface
export interface Product {
  id: string;
  name: string;
  description?: string;
  category?: string;
  default_unit: string;
  created_at?: string;
  updated_at?: string;
}

// Supplier interface
export interface Supplier {
  id: string;
  name: string;
  contact?: string;
  email?: string;
  phone?: string;
  address?: string;
  created_at?: string;
  updated_at?: string;
}

// Manufacturer interface
export interface Manufacturer {
  id: string;
  name: string;
  contact?: string;
  email?: string;
  phone?: string;
  address?: string;
  created_at?: string;
  updated_at?: string;
}

// Crate Type interface
export interface CrateType {
  id: string;
  name: string;
  weight: number;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

// Inventory history item
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
  operation_date: Date;
  exit_timestamp?: Date;
  notes?: string;
}

// Command processing result
export interface CommandResult {
  action: 'add' | 'remove' | 'set' | 'view' | 'query' | 'export' | 'email';
  response: string;
  item?: InventoryItem;
  charts?: ChartData[];
  needsMoreInfo?: {
    question: string;
    type: 'batch_selection' | 'missing_fields' | 'supplier_info';
    options?: InventoryItem[];
  };
}

// Dashboard menu item
export interface DashboardMenuItem {
  id: string;
  name: string;
  icon: React.ComponentType; // Updated to use React.ComponentType instead of string
  route: string;
  description?: string;
  path?: string; // Added for backward compatibility
}

// SpeechRecognition type declaration for global window
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: SpeechRecognition, ev: Event) => any) | null;
  onnomatch: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}
