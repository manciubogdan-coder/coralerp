export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      conversations: {
        Row: {
          id: string
          text: string
          timestamp: string | null
        }
        Insert: {
          id?: string
          text: string
          timestamp?: string | null
        }
        Update: {
          id?: string
          text?: string
          timestamp?: string | null
        }
        Relationships: []
      }
      crate_types: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          weight: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          weight?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          weight?: number
        }
        Relationships: []
      }
      inventory: {
        Row: {
          crate_count: number | null
          crate_type_id: string | null
          crate_weight: number | null
          created_at: string | null
          document_number: string | null
          entry_number: number
          gross_quantity: number | null
          id: string
          manufacturer_id: string | null
          name: string
          net_quantity: number | null
          product_id: string | null
          quantity: number
          receipt_date: string | null
          supplier: string | null
          supplier_id: string | null
          unit: string
          updated_at: string | null
        }
        Insert: {
          crate_count?: number | null
          crate_type_id?: string | null
          crate_weight?: number | null
          created_at?: string | null
          document_number?: string | null
          entry_number?: number
          gross_quantity?: number | null
          id?: string
          manufacturer_id?: string | null
          name: string
          net_quantity?: number | null
          product_id?: string | null
          quantity?: number
          receipt_date?: string | null
          supplier?: string | null
          supplier_id?: string | null
          unit: string
          updated_at?: string | null
        }
        Update: {
          crate_count?: number | null
          crate_type_id?: string | null
          crate_weight?: number | null
          created_at?: string | null
          document_number?: string | null
          entry_number?: number
          gross_quantity?: number | null
          id?: string
          manufacturer_id?: string | null
          name?: string
          net_quantity?: number | null
          product_id?: string | null
          quantity?: number
          receipt_date?: string | null
          supplier?: string | null
          supplier_id?: string | null
          unit?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_crate_type_id_fkey"
            columns: ["crate_type_id"]
            isOneToOne: false
            referencedRelation: "crate_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_manufacturer_id_fkey"
            columns: ["manufacturer_id"]
            isOneToOne: false
            referencedRelation: "manufacturers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_history: {
        Row: {
          action: string
          crate_count: number | null
          crate_type_id: string | null
          crate_weight: number | null
          document_number: string | null
          exit_timestamp: string | null
          id: string
          inventory_item_id: string | null
          manufacturer_id: string | null
          name: string
          notes: string | null
          operation_date: string
          pallets: number | null
          previous_quantity: number | null
          product_id: string | null
          quantity: number
          supplier: string | null
          supplier_id: string | null
          unit: string
        }
        Insert: {
          action: string
          crate_count?: number | null
          crate_type_id?: string | null
          crate_weight?: number | null
          document_number?: string | null
          exit_timestamp?: string | null
          id?: string
          inventory_item_id?: string | null
          manufacturer_id?: string | null
          name: string
          notes?: string | null
          operation_date?: string
          pallets?: number | null
          previous_quantity?: number | null
          product_id?: string | null
          quantity: number
          supplier?: string | null
          supplier_id?: string | null
          unit: string
        }
        Update: {
          action?: string
          crate_count?: number | null
          crate_type_id?: string | null
          crate_weight?: number | null
          document_number?: string | null
          exit_timestamp?: string | null
          id?: string
          inventory_item_id?: string | null
          manufacturer_id?: string | null
          name?: string
          notes?: string | null
          operation_date?: string
          pallets?: number | null
          previous_quantity?: number | null
          product_id?: string | null
          quantity?: number
          supplier?: string | null
          supplier_id?: string | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_history_crate_type_id_fkey"
            columns: ["crate_type_id"]
            isOneToOne: false
            referencedRelation: "crate_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_history_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_history_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_with_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_history_manufacturer_id_fkey"
            columns: ["manufacturer_id"]
            isOneToOne: false
            referencedRelation: "manufacturers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_history_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      manufacturers: {
        Row: {
          country: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          country?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          created_at: string
          default_unit: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_unit?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_unit?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      stock_transfer_items: {
        Row: {
          created_at: string
          id: string
          inventory_item_id: string
          net_quantity: number | null
          quantity: number
          transfer_id: string
          unit: string
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_item_id: string
          net_quantity?: number | null
          quantity: number
          transfer_id: string
          unit: string
        }
        Update: {
          created_at?: string
          id?: string
          inventory_item_id?: string
          net_quantity?: number | null
          quantity?: number
          transfer_id?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfer_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_with_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_items_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "stock_transfer_view"
            referencedColumns: ["transfer_id"]
          },
          {
            foreignKeyName: "stock_transfer_items_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "stock_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfers: {
        Row: {
          created_at: string
          destination: string
          id: string
          notes: string | null
          transfer_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          destination: string
          id?: string
          notes?: string | null
          transfer_date?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          destination?: string
          id?: string
          notes?: string | null
          transfer_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          contact: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          contact?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          contact?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      consumption_analytics: {
        Row: {
          action: string | null
          name: string | null
          operation_count: number | null
          operation_day: string | null
          removed_quantity: number | null
          unit: string | null
        }
        Relationships: []
      }
      inventory_aggregated_view: {
        Row: {
          entries: number | null
          first_receipt: string | null
          last_receipt: string | null
          name: string | null
          supplier: string | null
          total_quantity: number | null
          unit: string | null
        }
        Relationships: []
      }
      inventory_analytics: {
        Row: {
          all_suppliers: string | null
          first_receipt: string | null
          last_receipt: string | null
          name: string | null
          total_quantity: number | null
          unit: string | null
        }
        Relationships: []
      }
      inventory_with_history: {
        Row: {
          created_at: string | null
          id: string | null
          name: string | null
          operations_count: number | null
          quantity: number | null
          receipt_date: string | null
          supplier: string | null
          unit: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      stock_transfer_view: {
        Row: {
          crate_count: number | null
          destination: string | null
          document_number: string | null
          entry_number: number | null
          inventory_item_id: string | null
          manufacturer_name: string | null
          net_quantity: number | null
          notes: string | null
          product_name: string | null
          quantity: number | null
          supplier_name: string | null
          transfer_date: string | null
          transfer_id: string | null
          unit: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfer_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_with_history"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_operations: {
        Row: {
          crate_count: number | null
          document_number: string | null
          id: string | null
          notes: string | null
          operation_date: string | null
          product_name: string | null
          quantity: number | null
          unit: string | null
        }
        Insert: {
          crate_count?: number | null
          document_number?: string | null
          id?: string | null
          notes?: string | null
          operation_date?: string | null
          product_name?: string | null
          quantity?: number | null
          unit?: string | null
        }
        Update: {
          crate_count?: number | null
          document_number?: string | null
          id?: string | null
          notes?: string | null
          operation_date?: string | null
          product_name?: string | null
          quantity?: number | null
          unit?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_next_inventory_entry: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
