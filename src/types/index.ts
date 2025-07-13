
// Inventory related interfaces
export interface InventoryItem {
  id?: string;
  name: string;
  quantity: number; // Doar cantitatea netă
  unit: string;
  supplier?: string;
  supplier_id?: string;
  supplier_name?: string;
  product_id?: string;
  manufacturer_id?: string;
  manufacturer?: string; 
  receipt_date?: string | Date;
  document_number?: string;
  entry_number?: number;
  lot_number?: string;
  isHeader?: boolean;
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
  products?: { name: string; cod_produs?: string };
  manufacturers?: { name: string };
}

// Interface pentru inventory history (simplified structure)
export interface InventoryHistoryResponse {
  action: string;
  document_number: string | null;
  exit_timestamp: string | null;
  id: string;
  inventory_item_id: string | null;
  lot_number: string | null;
  manufacturer_id: string | null;
  name: string;
  notes: string | null;
  operation_date: string;
  pallets: number | null;
  previous_quantity: number | null;
  product_id: string | null;
  quantity: number;
  supplier: string | null;
  supplier_id: string | null;
  unit: string;
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
  cod_produs?: string;
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
  operation_date: Date;
  exit_timestamp?: Date;
  notes?: string;
  lot_number?: string;
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
