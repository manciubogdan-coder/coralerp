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
      inventory: {
        Row: {
          batch_number: string | null
          created_at: string | null
          id: string
          name: string
          quantity: number
          receipt_date: string | null
          supplier: string | null
          unit: string
          updated_at: string | null
        }
        Insert: {
          batch_number?: string | null
          created_at?: string | null
          id?: string
          name: string
          quantity?: number
          receipt_date?: string | null
          supplier?: string | null
          unit: string
          updated_at?: string | null
        }
        Update: {
          batch_number?: string | null
          created_at?: string | null
          id?: string
          name?: string
          quantity?: number
          receipt_date?: string | null
          supplier?: string | null
          unit?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      inventory_history: {
        Row: {
          action: string
          batch_number: string | null
          exit_timestamp: string | null
          id: string
          inventory_item_id: string | null
          name: string
          notes: string | null
          operation_date: string
          pallets: number | null
          previous_quantity: number | null
          quantity: number
          supplier: string | null
          unit: string
        }
        Insert: {
          action: string
          batch_number?: string | null
          exit_timestamp?: string | null
          id?: string
          inventory_item_id?: string | null
          name: string
          notes?: string | null
          operation_date?: string
          pallets?: number | null
          previous_quantity?: number | null
          quantity: number
          supplier?: string | null
          unit: string
        }
        Update: {
          action?: string
          batch_number?: string | null
          exit_timestamp?: string | null
          id?: string
          inventory_item_id?: string | null
          name?: string
          notes?: string | null
          operation_date?: string
          pallets?: number | null
          previous_quantity?: number | null
          quantity?: number
          supplier?: string | null
          unit?: string
        }
        Relationships: [
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
        ]
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
          batch_number: string | null
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
          all_batches: string | null
          all_suppliers: string | null
          avg_daily_consumption_rate: number | null
          batch_count: number | null
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
          batch_number: string | null
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
    }
    Functions: {
      [_ in never]: never
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
