
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
  manufacturer?: string; // Ensure this is properly typed
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
  // Added more context for manufacturers
  created_at?: {
    seconds: number;
    nanoseconds: number;
  };
  updated_at?: {
    seconds: number;
    nanoseconds: number;
  };
}
