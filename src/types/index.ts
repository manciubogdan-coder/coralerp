
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
  manufacturer?: string; 
  receipt_date?: string | Date;
  document_number?: string;
  entry_number?: number;
  crate_type_id?: string;
  crate_count?: number;
  crate_weight?: number;
  gross_quantity?: number;
  net_quantity?: number;
  isHeader?: boolean;
  action?: 'add' | 'remove' | 'set';
  lot_number?: string;  // Added lot_number property
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
  document_number?: string;
  crate_type_id?: string;
  crate_count?: number;
  crate_weight?: number;
  operation_date: Date;
  exit_timestamp?: Date;
  notes?: string;
  lot_number?: string;  // Added lot_number property
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
  icon: React.ComponentType;
  route: string;
  description?: string;
  path?: string;
}
