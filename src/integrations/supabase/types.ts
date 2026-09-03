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
      depozit_mp_iesiri: {
        Row: {
          cantitate: number
          client: string | null
          created_at: string
          created_by_email: string | null
          document: string | null
          id: string
          lot: string | null
          observatii: string | null
          occurred_at: string
          produs_id: string | null
          produs_nume: string
          unitate: string
          updated_at: string
        }
        Insert: {
          cantitate?: number
          client?: string | null
          created_at?: string
          created_by_email?: string | null
          document?: string | null
          id?: string
          lot?: string | null
          observatii?: string | null
          occurred_at?: string
          produs_id?: string | null
          produs_nume: string
          unitate?: string
          updated_at?: string
        }
        Update: {
          cantitate?: number
          client?: string | null
          created_at?: string
          created_by_email?: string | null
          document?: string | null
          id?: string
          lot?: string | null
          observatii?: string | null
          occurred_at?: string
          produs_id?: string | null
          produs_nume?: string
          unitate?: string
          updated_at?: string
        }
        Relationships: []
      }
      depozit_mp_intrari: {
        Row: {
          cantitate: number
          created_at: string
          created_by_email: string | null
          document: string | null
          furnizor: string | null
          id: string
          lot: string | null
          observatii: string | null
          occurred_at: string
          produs_id: string | null
          produs_nume: string
          unitate: string
          updated_at: string
        }
        Insert: {
          cantitate?: number
          created_at?: string
          created_by_email?: string | null
          document?: string | null
          furnizor?: string | null
          id?: string
          lot?: string | null
          observatii?: string | null
          occurred_at?: string
          produs_id?: string | null
          produs_nume: string
          unitate?: string
          updated_at?: string
        }
        Update: {
          cantitate?: number
          created_at?: string
          created_by_email?: string | null
          document?: string | null
          furnizor?: string | null
          id?: string
          lot?: string | null
          observatii?: string | null
          occurred_at?: string
          produs_id?: string | null
          produs_nume?: string
          unitate?: string
          updated_at?: string
        }
        Relationships: []
      }
      evidenta_andrada_access: {
        Row: {
          created_at: string
          email: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          user_id?: string
        }
        Relationships: []
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
      ggn_codes: {
        Row: {
          created_at: string
          display_name: string | null
          ggn_code: string | null
          id: string
          inventory_type: string
          kind: string
          name_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          ggn_code?: string | null
          id?: string
          inventory_type: string
          kind: string
          name_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          ggn_code?: string | null
          id?: string
          inventory_type?: string
          kind?: string
          name_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventar_session_items: {
        Row: {
          applied: boolean
          created_at: string
          fizic: number | null
          id: string
          inventory_row_id: string | null
          lot_number: string | null
          manufacturer: string | null
          name: string
          product_code: string | null
          scriptic: number
          session_id: string
          supplier: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          applied?: boolean
          created_at?: string
          fizic?: number | null
          id?: string
          inventory_row_id?: string | null
          lot_number?: string | null
          manufacturer?: string | null
          name: string
          product_code?: string | null
          scriptic?: number
          session_id: string
          supplier?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          applied?: boolean
          created_at?: string
          fizic?: number | null
          id?: string
          inventory_row_id?: string | null
          lot_number?: string | null
          manufacturer?: string | null
          name?: string
          product_code?: string | null
          scriptic?: number
          session_id?: string
          supplier?: string | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventar_session_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "inventar_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      inventar_sessions: {
        Row: {
          closed_at: string | null
          created_at: string
          created_by_email: string | null
          id: string
          inventory_type: string
          name: string
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          created_by_email?: string | null
          id?: string
          inventory_type: string
          name: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          created_by_email?: string | null
          id?: string
          inventory_type?: string
          name?: string
          notes?: string | null
          status?: string
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
      planner_personal: {
        Row: {
          created_at: string
          id: string
          linie_id: string | null
          linie_nume: string | null
          nume: string
          order_index: number
          post: string | null
          schimb: string | null
          status: string
          status_from: string | null
          status_note: string | null
          status_to: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          linie_id?: string | null
          linie_nume?: string | null
          nume: string
          order_index?: number
          post?: string | null
          schimb?: string | null
          status?: string
          status_from?: string | null
          status_note?: string | null
          status_to?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          linie_id?: string | null
          linie_nume?: string | null
          nume?: string
          order_index?: number
          post?: string | null
          schimb?: string | null
          status?: string
          status_from?: string | null
          status_note?: string | null
          status_to?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      productie_grupare_ambalare: {
        Row: {
          created_at: string
          grup_nume: string
          produs_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          grup_nume: string
          produs_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          grup_nume?: string
          produs_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      productie_order_cuts: {
        Row: {
          cantitate_taiata: number
          comanda_id: string
          created_at: string
          motiv: string | null
          produs_nume: string | null
          updated_at: string
        }
        Insert: {
          cantitate_taiata?: number
          comanda_id: string
          created_at?: string
          motiv?: string | null
          produs_nume?: string | null
          updated_at?: string
        }
        Update: {
          cantitate_taiata?: number
          comanda_id?: string
          created_at?: string
          motiv?: string | null
          produs_nume?: string | null
          updated_at?: string
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
      traction_kpi_values: {
        Row: {
          created_at: string
          id: string
          kpi_id: string
          notes: string | null
          period_label: string
          period_start: string | null
          updated_at: string
          value: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          kpi_id: string
          notes?: string | null
          period_label: string
          period_start?: string | null
          updated_at?: string
          value?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          kpi_id?: string
          notes?: string | null
          period_label?: string
          period_start?: string | null
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "traction_kpi_values_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "traction_kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      traction_kpis: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          name: string
          order_index: number
          strategic_id: string
          target_operator: string
          target_value: number | null
          threshold_green: number | null
          threshold_yellow: number | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          name: string
          order_index?: number
          strategic_id: string
          target_operator?: string
          target_value?: number | null
          threshold_green?: number | null
          threshold_yellow?: number | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          name?: string
          order_index?: number
          strategic_id?: string
          target_operator?: string
          target_value?: number | null
          threshold_green?: number | null
          threshold_yellow?: number | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "traction_kpis_strategic_id_fkey"
            columns: ["strategic_id"]
            isOneToOne: false
            referencedRelation: "traction_strategic_objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      traction_operational_objectives: {
        Row: {
          action: string | null
          completed_at: string | null
          created_at: string
          deadline: string | null
          id: string
          kpi_id: string | null
          order_index: number
          period_label: string | null
          status: string
          title: string
          tracker_id: string
          updated_at: string
        }
        Insert: {
          action?: string | null
          completed_at?: string | null
          created_at?: string
          deadline?: string | null
          id?: string
          kpi_id?: string | null
          order_index?: number
          period_label?: string | null
          status?: string
          title: string
          tracker_id: string
          updated_at?: string
        }
        Update: {
          action?: string | null
          completed_at?: string | null
          created_at?: string
          deadline?: string | null
          id?: string
          kpi_id?: string | null
          order_index?: number
          period_label?: string | null
          status?: string
          title?: string
          tracker_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "traction_operational_objectives_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "traction_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traction_operational_objectives_tracker_id_fkey"
            columns: ["tracker_id"]
            isOneToOne: false
            referencedRelation: "traction_trackers"
            referencedColumns: ["id"]
          },
        ]
      }
      traction_operational_progress: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          operational_id: string
          period_label: string | null
          period_start: string
          progress: number | null
          status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          operational_id: string
          period_label?: string | null
          period_start: string
          progress?: number | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          operational_id?: string
          period_label?: string | null
          period_start?: string
          progress?: number | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "traction_operational_progress_operational_id_fkey"
            columns: ["operational_id"]
            isOneToOne: false
            referencedRelation: "traction_operational_objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      traction_strategic_objectives: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          id: string
          order_index: number
          title: string
          tracker_id: string
          updated_at: string
          year: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number
          title: string
          tracker_id: string
          updated_at?: string
          year?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number
          title?: string
          tracker_id?: string
          updated_at?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "traction_strategic_objectives_tracker_id_fkey"
            columns: ["tracker_id"]
            isOneToOne: false
            referencedRelation: "traction_trackers"
            referencedColumns: ["id"]
          },
        ]
      }
      traction_strategic_progress: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          period_label: string | null
          period_start: string
          progress: number | null
          status: string | null
          strategic_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          period_label?: string | null
          period_start: string
          progress?: number | null
          status?: string | null
          strategic_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          period_label?: string | null
          period_start?: string
          progress?: number | null
          status?: string | null
          strategic_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "traction_strategic_progress_strategic_id_fkey"
            columns: ["strategic_id"]
            isOneToOne: false
            referencedRelation: "traction_strategic_objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      traction_tracker_access: {
        Row: {
          created_at: string
          email: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          user_id?: string
        }
        Relationships: []
      }
      traction_trackers: {
        Row: {
          created_at: string
          department: string
          id: string
          name: string
          owner_email: string | null
          owner_id: string
          owner_name: string | null
          period_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department: string
          id?: string
          name: string
          owner_email?: string | null
          owner_id: string
          owner_name?: string | null
          period_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string
          id?: string
          name?: string
          owner_email?: string | null
          owner_id?: string
          owner_name?: string | null
          period_type?: string
          updated_at?: string
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
