export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_task_checklist: {
        Row: {
          created_at: string
          done: boolean
          id: string
          label: string
          position: number
          task_id: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          id?: string
          label: string
          position?: number
          task_id: string
        }
        Update: {
          created_at?: string
          done?: boolean
          id?: string
          label?: string
          position?: number
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_task_checklist_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "app_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      app_task_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          task_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          task_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "app_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      app_tasks: {
        Row: {
          assignee_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          department: string | null
          description: string | null
          due_at: string | null
          id: string
          parent_task_id: string | null
          priority: string
          recurrence: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          department?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          parent_task_id?: string | null
          priority?: string
          recurrence?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          department?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          parent_task_id?: string | null
          priority?: string
          recurrence?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_conversations: {
        Row: {
          created_at: string
          created_by: string | null
          department: string | null
          id: string
          name: string | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department?: string | null
          id?: string
          name?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department?: string | null
          id?: string
          name?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_members: {
        Row: {
          conversation_id: string
          joined_at: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          joined_at?: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          joined_at?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          author_id: string
          body: string
          conversation_id: string
          created_at: string
          id: string
        }
        Insert: {
          author_id: string
          body: string
          conversation_id: string
          created_at?: string
          id?: string
        }
        Update: {
          author_id?: string
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      evidenta_andrada_rows: {
        Row: {
          bucati_100g: number | null
          bucati_15g: number | null
          bucati_250g: number | null
          bucati_30g: number | null
          bucati_500g: number | null
          bucati_70g: number | null
          cantitate_intrata: number | null
          cantitate_ramasa: number | null
          created_at: string
          data: string
          data_productie: string | null
          furnizor: string | null
          id: string
          inventory_type: string
          kg_final: number | null
          kg_solicitat: number | null
          lot: string | null
          mp_intrata_in_prod: number | null
          mp_utilizata_vanduta: number | null
          nr_pers: number | null
          observatii: string | null
          ora_start: string | null
          ora_stop: string | null
          pauza_min: number | null
          pierdere_tehnologica: number | null
          pierdere_totala: number | null
          procent_cantar: number | null
          procent_cn_solicitata: number | null
          procent_nc: number | null
          producator: string | null
          produs: string | null
          rebut: number | null
          retur: string | null
          retur_repozit: number | null
          schimb: string | null
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          bucati_100g?: number | null
          bucati_15g?: number | null
          bucati_250g?: number | null
          bucati_30g?: number | null
          bucati_500g?: number | null
          bucati_70g?: number | null
          cantitate_intrata?: number | null
          cantitate_ramasa?: number | null
          created_at?: string
          data: string
          data_productie?: string | null
          furnizor?: string | null
          id?: string
          inventory_type?: string
          kg_final?: number | null
          kg_solicitat?: number | null
          lot?: string | null
          mp_intrata_in_prod?: number | null
          mp_utilizata_vanduta?: number | null
          nr_pers?: number | null
          observatii?: string | null
          ora_start?: string | null
          ora_stop?: string | null
          pauza_min?: number | null
          pierdere_tehnologica?: number | null
          pierdere_totala?: number | null
          procent_cantar?: number | null
          procent_cn_solicitata?: number | null
          procent_nc?: number | null
          producator?: string | null
          produs?: string | null
          rebut?: number | null
          retur?: string | null
          retur_repozit?: number | null
          schimb?: string | null
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          bucati_100g?: number | null
          bucati_15g?: number | null
          bucati_250g?: number | null
          bucati_30g?: number | null
          bucati_500g?: number | null
          bucati_70g?: number | null
          cantitate_intrata?: number | null
          cantitate_ramasa?: number | null
          created_at?: string
          data?: string
          data_productie?: string | null
          furnizor?: string | null
          id?: string
          inventory_type?: string
          kg_final?: number | null
          kg_solicitat?: number | null
          lot?: string | null
          mp_intrata_in_prod?: number | null
          mp_utilizata_vanduta?: number | null
          nr_pers?: number | null
          observatii?: string | null
          ora_start?: string | null
          ora_stop?: string | null
          pauza_min?: number | null
          pierdere_tehnologica?: number | null
          pierdere_totala?: number | null
          procent_cantar?: number | null
          procent_cn_solicitata?: number | null
          procent_nc?: number | null
          producator?: string | null
          produs?: string | null
          rebut?: number | null
          retur?: string | null
          retur_repozit?: number | null
          schimb?: string | null
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      notif_events_catalog: {
        Row: {
          description: string | null
          event_key: string
          label: string
        }
        Insert: {
          description?: string | null
          event_key: string
          label: string
        }
        Update: {
          description?: string | null
          event_key?: string
          label?: string
        }
        Relationships: []
      }
      notif_rules: {
        Row: {
          body_template: string | null
          created_at: string
          enabled: boolean
          event_key: string
          id: string
          target_department: string | null
          target_user_id: string | null
          title_template: string
        }
        Insert: {
          body_template?: string | null
          created_at?: string
          enabled?: boolean
          event_key: string
          id?: string
          target_department?: string | null
          target_user_id?: string | null
          title_template: string
        }
        Update: {
          body_template?: string | null
          created_at?: string
          enabled?: boolean
          event_key?: string
          id?: string
          target_department?: string | null
          target_user_id?: string | null
          title_template?: string
        }
        Relationships: [
          {
            foreignKeyName: "notif_rules_event_key_fkey"
            columns: ["event_key"]
            isOneToOne: false
            referencedRelation: "notif_events_catalog"
            referencedColumns: ["event_key"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          event_key: string | null
          id: string
          link: string | null
          payload: Json | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          event_key?: string | null
          id?: string
          link?: string | null
          payload?: Json | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          event_key?: string | null
          id?: string
          link?: string | null
          payload?: Json | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      productie_trasabilitate: {
        Row: {
          cod: string
          comanda_id: string
          created_at: string
          id: string
          scanned_at: string
          scanned_by: string | null
          sesiune_id: string | null
          tip: string
        }
        Insert: {
          cod: string
          comanda_id: string
          created_at?: string
          id?: string
          scanned_at?: string
          scanned_by?: string | null
          sesiune_id?: string | null
          tip: string
        }
        Update: {
          cod?: string
          comanda_id?: string
          created_at?: string
          id?: string
          scanned_at?: string
          scanned_by?: string | null
          sesiune_id?: string | null
          tip?: string
        }
        Relationships: []
      }
      purchase_orders_imported: {
        Row: {
          created_at: string
          created_by: string | null
          data: string
          id: string
          inventory_type: string
          notes: string | null
          numar: string | null
          partener: string
          serie: string | null
          source: string
          supplier_id: string | null
          tip_document: string | null
          total_lines: number
          total_value: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data: string
          id?: string
          inventory_type: string
          notes?: string | null
          numar?: string | null
          partener: string
          serie?: string | null
          source?: string
          supplier_id?: string | null
          tip_document?: string | null
          total_lines?: number
          total_value?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: string
          id?: string
          inventory_type?: string
          notes?: string | null
          numar?: string | null
          partener?: string
          serie?: string | null
          source?: string
          supplier_id?: string | null
          tip_document?: string | null
          total_lines?: number
          total_value?: number
          updated_at?: string
        }
        Relationships: []
      }
      purchase_orders_imported_items: {
        Row: {
          cantitate: number
          cod_articol: string | null
          created_at: string
          denumire_articol: string
          descriere_articol: string | null
          id: string
          order_id: string
          palet: number
          pret_final: number
          product_id: string | null
          unit: string | null
          valoare_neta: number
        }
        Insert: {
          cantitate?: number
          cod_articol?: string | null
          created_at?: string
          denumire_articol: string
          descriere_articol?: string | null
          id?: string
          order_id: string
          palet?: number
          pret_final?: number
          product_id?: string | null
          unit?: string | null
          valoare_neta?: number
        }
        Update: {
          cantitate?: number
          cod_articol?: string | null
          created_at?: string
          denumire_articol?: string
          descriere_articol?: string | null
          id?: string
          order_id?: string
          palet?: number
          pret_final?: number
          product_id?: string | null
          unit?: string | null
          valoare_neta?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_imported_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders_imported"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          device_label: string | null
          endpoint: string
          id: string
          last_used_at: string
          p256dh_key: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string
          device_label?: string | null
          endpoint: string
          id?: string
          last_used_at?: string
          p256dh_key: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string
          device_label?: string | null
          endpoint?: string
          id?: string
          last_used_at?: string
          p256dh_key?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      reception_audit_log: {
        Row: {
          changes: Json
          created_at: string
          id: string
          inventory_type: string
          reception_id: string
          reception_table: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          changes?: Json
          created_at?: string
          id?: string
          inventory_type: string
          reception_id: string
          reception_table: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          changes?: Json
          created_at?: string
          id?: string
          inventory_type?: string
          reception_id?: string
          reception_table?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_push_subscription: {
        Args: { p_endpoint: string }
        Returns: undefined
      }
      emit_notification_event: {
        Args: {
          p_body?: string
          p_event_key: string
          p_link?: string
          p_payload?: Json
          p_title_default: string
        }
        Returns: number
      }
      is_chat_member: {
        Args: { _conv: string; _user: string }
        Returns: boolean
      }
      register_push_subscription: {
        Args: {
          p_auth: string
          p_device_label?: string
          p_endpoint: string
          p_p256dh: string
          p_user_agent?: string
        }
        Returns: string
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
