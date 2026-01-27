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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      agvanzari_agent_price_lists: {
        Row: {
          activ: boolean | null
          agent_id: string | null
          created_at: string | null
          id: string
          pret_special: number
          product_id: string | null
          valabil_de_la: string | null
          valabil_pana_la: string | null
        }
        Insert: {
          activ?: boolean | null
          agent_id?: string | null
          created_at?: string | null
          id?: string
          pret_special: number
          product_id?: string | null
          valabil_de_la?: string | null
          valabil_pana_la?: string | null
        }
        Update: {
          activ?: boolean | null
          agent_id?: string | null
          created_at?: string | null
          id?: string
          pret_special?: number
          product_id?: string | null
          valabil_de_la?: string | null
          valabil_pana_la?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agvanzari_agent_price_lists_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agvanzari_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agvanzari_agent_price_lists_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "agvanzari_products"
            referencedColumns: ["id"]
          },
        ]
      }
      agvanzari_agents: {
        Row: {
          activ: boolean | null
          comision_procent: number | null
          created_at: string | null
          email: string
          id: string
          nume: string
          telefon: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          activ?: boolean | null
          comision_procent?: number | null
          created_at?: string | null
          email: string
          id?: string
          nume: string
          telefon?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          activ?: boolean | null
          comision_procent?: number | null
          created_at?: string | null
          email?: string
          id?: string
          nume?: string
          telefon?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      agvanzari_categories: {
        Row: {
          created_at: string | null
          descriere: string | null
          id: string
          nume: string
        }
        Insert: {
          created_at?: string | null
          descriere?: string | null
          id?: string
          nume: string
        }
        Update: {
          created_at?: string | null
          descriere?: string | null
          id?: string
          nume?: string
        }
        Relationships: []
      }
      agvanzari_clients: {
        Row: {
          adresa: string
          banca: string | null
          cod_postal: string | null
          created_at: string | null
          cui: string
          email: string | null
          iban: string | null
          id: string
          judet: string
          nr_reg_com: string | null
          nume_firma: string
          oras: string
          persoana_contact: string | null
          telefon: string | null
          tip_client: string | null
          updated_at: string | null
        }
        Insert: {
          adresa: string
          banca?: string | null
          cod_postal?: string | null
          created_at?: string | null
          cui: string
          email?: string | null
          iban?: string | null
          id?: string
          judet: string
          nr_reg_com?: string | null
          nume_firma: string
          oras: string
          persoana_contact?: string | null
          telefon?: string | null
          tip_client?: string | null
          updated_at?: string | null
        }
        Update: {
          adresa?: string
          banca?: string | null
          cod_postal?: string | null
          created_at?: string | null
          cui?: string
          email?: string | null
          iban?: string | null
          id?: string
          judet?: string
          nr_reg_com?: string | null
          nume_firma?: string
          oras?: string
          persoana_contact?: string | null
          telefon?: string | null
          tip_client?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      agvanzari_document_settings: {
        Row: {
          adresa_firma: string | null
          banca_firma: string | null
          created_at: string | null
          cui: string | null
          culoare_primara: string | null
          culoare_secundara: string | null
          email_firma: string | null
          font_familie: string | null
          iban_firma: string | null
          id: string
          include_semnatura: boolean | null
          include_stampila: boolean | null
          logo_url: string | null
          nr_reg_com: string | null
          nume_firma: string | null
          telefon_firma: string | null
          text_footer: string | null
          tip_document: string
          updated_at: string | null
        }
        Insert: {
          adresa_firma?: string | null
          banca_firma?: string | null
          created_at?: string | null
          cui?: string | null
          culoare_primara?: string | null
          culoare_secundara?: string | null
          email_firma?: string | null
          font_familie?: string | null
          iban_firma?: string | null
          id?: string
          include_semnatura?: boolean | null
          include_stampila?: boolean | null
          logo_url?: string | null
          nr_reg_com?: string | null
          nume_firma?: string | null
          telefon_firma?: string | null
          text_footer?: string | null
          tip_document: string
          updated_at?: string | null
        }
        Update: {
          adresa_firma?: string | null
          banca_firma?: string | null
          created_at?: string | null
          cui?: string | null
          culoare_primara?: string | null
          culoare_secundara?: string | null
          email_firma?: string | null
          font_familie?: string | null
          iban_firma?: string | null
          id?: string
          include_semnatura?: boolean | null
          include_stampila?: boolean | null
          logo_url?: string | null
          nr_reg_com?: string | null
          nume_firma?: string | null
          telefon_firma?: string | null
          text_footer?: string | null
          tip_document?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      agvanzari_invoice_items: {
        Row: {
          cantitate: number
          created_at: string | null
          id: string
          invoice_id: string | null
          nume_produs: string
          pret_unitar: number
          product_id: string | null
          total_cu_tva: number
          total_fara_tva: number
          total_tva: number
          tva_procent: number
          unitate_masura: string
        }
        Insert: {
          cantitate: number
          created_at?: string | null
          id?: string
          invoice_id?: string | null
          nume_produs: string
          pret_unitar: number
          product_id?: string | null
          total_cu_tva: number
          total_fara_tva: number
          total_tva: number
          tva_procent: number
          unitate_masura: string
        }
        Update: {
          cantitate?: number
          created_at?: string | null
          id?: string
          invoice_id?: string | null
          nume_produs?: string
          pret_unitar?: number
          product_id?: string | null
          total_cu_tva?: number
          total_fara_tva?: number
          total_tva?: number
          tva_procent?: number
          unitate_masura?: string
        }
        Relationships: [
          {
            foreignKeyName: "agvanzari_invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "agvanzari_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agvanzari_invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "agvanzari_products"
            referencedColumns: ["id"]
          },
        ]
      }
      agvanzari_invoices: {
        Row: {
          agent_id: string | null
          client_id: string | null
          created_at: string | null
          data_achitare: string | null
          data_emitere: string | null
          data_scadenta: string | null
          document_pdf_url: string | null
          id: string
          mod_plata: string | null
          numar_factura: string
          observatii_plata: string | null
          order_id: string | null
          seria_factura: string | null
          status_plata: string | null
          suma_achitata: number | null
          termen_plata_zile: number | null
          total_cu_tva: number
          total_fara_tva: number
          total_tva: number
          updated_at: string | null
        }
        Insert: {
          agent_id?: string | null
          client_id?: string | null
          created_at?: string | null
          data_achitare?: string | null
          data_emitere?: string | null
          data_scadenta?: string | null
          document_pdf_url?: string | null
          id?: string
          mod_plata?: string | null
          numar_factura: string
          observatii_plata?: string | null
          order_id?: string | null
          seria_factura?: string | null
          status_plata?: string | null
          suma_achitata?: number | null
          termen_plata_zile?: number | null
          total_cu_tva: number
          total_fara_tva: number
          total_tva: number
          updated_at?: string | null
        }
        Update: {
          agent_id?: string | null
          client_id?: string | null
          created_at?: string | null
          data_achitare?: string | null
          data_emitere?: string | null
          data_scadenta?: string | null
          document_pdf_url?: string | null
          id?: string
          mod_plata?: string | null
          numar_factura?: string
          observatii_plata?: string | null
          order_id?: string | null
          seria_factura?: string | null
          status_plata?: string | null
          suma_achitata?: number | null
          termen_plata_zile?: number | null
          total_cu_tva?: number
          total_fara_tva?: number
          total_tva?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agvanzari_invoices_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agvanzari_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agvanzari_invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "agvanzari_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agvanzari_invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "agvanzari_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      agvanzari_order_items: {
        Row: {
          cantitate: number
          created_at: string | null
          id: string
          observatii: string | null
          order_id: string | null
          pret_unitar: number
          product_id: string | null
          total_cu_tva: number
          total_fara_tva: number
          total_tva: number
          tva_procent: number
        }
        Insert: {
          cantitate: number
          created_at?: string | null
          id?: string
          observatii?: string | null
          order_id?: string | null
          pret_unitar: number
          product_id?: string | null
          total_cu_tva: number
          total_fara_tva: number
          total_tva: number
          tva_procent: number
        }
        Update: {
          cantitate?: number
          created_at?: string | null
          id?: string
          observatii?: string | null
          order_id?: string | null
          pret_unitar?: number
          product_id?: string | null
          total_cu_tva?: number
          total_fara_tva?: number
          total_tva?: number
          tva_procent?: number
        }
        Relationships: [
          {
            foreignKeyName: "agvanzari_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "agvanzari_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agvanzari_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "agvanzari_products"
            referencedColumns: ["id"]
          },
        ]
      }
      agvanzari_orders: {
        Row: {
          agent_id: string | null
          client_id: string | null
          created_at: string | null
          data_comanda: string | null
          data_livrare_dorita: string | null
          id: string
          numar_comanda: string
          observatii: string | null
          status: string | null
          total_cu_tva: number | null
          total_fara_tva: number | null
          total_tva: number | null
          updated_at: string | null
        }
        Insert: {
          agent_id?: string | null
          client_id?: string | null
          created_at?: string | null
          data_comanda?: string | null
          data_livrare_dorita?: string | null
          id?: string
          numar_comanda: string
          observatii?: string | null
          status?: string | null
          total_cu_tva?: number | null
          total_fara_tva?: number | null
          total_tva?: number | null
          updated_at?: string | null
        }
        Update: {
          agent_id?: string | null
          client_id?: string | null
          created_at?: string | null
          data_comanda?: string | null
          data_livrare_dorita?: string | null
          id?: string
          numar_comanda?: string
          observatii?: string | null
          status?: string | null
          total_cu_tva?: number | null
          total_fara_tva?: number | null
          total_tva?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agvanzari_orders_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agvanzari_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agvanzari_orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "agvanzari_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      agvanzari_products: {
        Row: {
          activ: boolean | null
          category_id: string | null
          created_at: string | null
          descriere: string | null
          id: string
          nume: string
          pret_baza: number
          tva_procent: number | null
          unitate_masura: string | null
          updated_at: string | null
        }
        Insert: {
          activ?: boolean | null
          category_id?: string | null
          created_at?: string | null
          descriere?: string | null
          id?: string
          nume: string
          pret_baza: number
          tva_procent?: number | null
          unitate_masura?: string | null
          updated_at?: string | null
        }
        Update: {
          activ?: boolean | null
          category_id?: string | null
          created_at?: string | null
          descriere?: string | null
          id?: string
          nume?: string
          pret_baza?: number
          tva_procent?: number | null
          unitate_masura?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agvanzari_products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "agvanzari_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      agvanzari_return_items: {
        Row: {
          cantitate_returnata: number
          created_at: string | null
          id: string
          motiv_item: string | null
          product_id: string | null
          return_id: string | null
          valoare_estimata: number | null
        }
        Insert: {
          cantitate_returnata: number
          created_at?: string | null
          id?: string
          motiv_item?: string | null
          product_id?: string | null
          return_id?: string | null
          valoare_estimata?: number | null
        }
        Update: {
          cantitate_returnata?: number
          created_at?: string | null
          id?: string
          motiv_item?: string | null
          product_id?: string | null
          return_id?: string | null
          valoare_estimata?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agvanzari_return_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "agvanzari_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agvanzari_return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "agvanzari_returns"
            referencedColumns: ["id"]
          },
        ]
      }
      agvanzari_returns: {
        Row: {
          agent_id: string | null
          client_id: string | null
          created_at: string | null
          data_retur: string | null
          id: string
          motiv_retur: string
          numar_retur: string
          observatii: string | null
          order_id: string | null
          status: string | null
          updated_at: string | null
          valoare_estimata: number | null
        }
        Insert: {
          agent_id?: string | null
          client_id?: string | null
          created_at?: string | null
          data_retur?: string | null
          id?: string
          motiv_retur: string
          numar_retur: string
          observatii?: string | null
          order_id?: string | null
          status?: string | null
          updated_at?: string | null
          valoare_estimata?: number | null
        }
        Update: {
          agent_id?: string | null
          client_id?: string | null
          created_at?: string | null
          data_retur?: string | null
          id?: string
          motiv_retur?: string
          numar_retur?: string
          observatii?: string | null
          order_id?: string | null
          status?: string | null
          updated_at?: string | null
          valoare_estimata?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agvanzari_returns_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agvanzari_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agvanzari_returns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "agvanzari_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agvanzari_returns_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "agvanzari_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      ambalaje_crate_types: {
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
      ambalaje_daily_stock_quality: {
        Row: {
          consider_quantity: number
          created_at: string
          id: string
          nonconform_percent: number
          obs: string | null
          snapshot_id: string
          updated_at: string
        }
        Insert: {
          consider_quantity?: number
          created_at?: string
          id?: string
          nonconform_percent?: number
          obs?: string | null
          snapshot_id: string
          updated_at?: string
        }
        Update: {
          consider_quantity?: number
          created_at?: string
          id?: string
          nonconform_percent?: number
          obs?: string | null
          snapshot_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ambalaje_daily_stock_quality_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: true
            referencedRelation: "ambalaje_daily_stock_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      ambalaje_daily_stock_snapshots: {
        Row: {
          crate_count: number | null
          crate_type_id: string | null
          crate_weight: number | null
          created_at: string
          document_number: string | null
          entry_number: number | null
          gross_quantity: number | null
          id: string
          lot_number: string | null
          manufacturer_id: string | null
          name: string
          net_quantity: number | null
          product_id: string | null
          quantity: number
          receipt_date: string | null
          snapshot_date: string
          supplier_id: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          crate_count?: number | null
          crate_type_id?: string | null
          crate_weight?: number | null
          created_at?: string
          document_number?: string | null
          entry_number?: number | null
          gross_quantity?: number | null
          id?: string
          lot_number?: string | null
          manufacturer_id?: string | null
          name: string
          net_quantity?: number | null
          product_id?: string | null
          quantity?: number
          receipt_date?: string | null
          snapshot_date: string
          supplier_id?: string | null
          unit: string
          updated_at?: string
        }
        Update: {
          crate_count?: number | null
          crate_type_id?: string | null
          crate_weight?: number | null
          created_at?: string
          document_number?: string | null
          entry_number?: number | null
          gross_quantity?: number | null
          id?: string
          lot_number?: string | null
          manufacturer_id?: string | null
          name?: string
          net_quantity?: number | null
          product_id?: string | null
          quantity?: number
          receipt_date?: string | null
          snapshot_date?: string
          supplier_id?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ambalaje_daily_stock_snapshots_crate_type_id_fkey"
            columns: ["crate_type_id"]
            isOneToOne: false
            referencedRelation: "ambalaje_crate_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ambalaje_daily_stock_snapshots_manufacturer_id_fkey"
            columns: ["manufacturer_id"]
            isOneToOne: false
            referencedRelation: "ambalaje_manufacturers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ambalaje_daily_stock_snapshots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "ambalaje_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ambalaje_daily_stock_snapshots_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "ambalaje_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      ambalaje_inventory: {
        Row: {
          crate_count: number | null
          crate_type_id: string | null
          crate_weight: number | null
          created_at: string | null
          document_number: string | null
          entry_number: number
          gross_quantity: number | null
          id: string
          lot_number: string | null
          manufacturer_id: string | null
          name: string
          net_quantity: number | null
          product_id: string | null
          quantity: number
          receipt_date: string | null
          supplier: string | null
          supplier_id: string | null
          supplier_name: string | null
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
          lot_number?: string | null
          manufacturer_id?: string | null
          name: string
          net_quantity?: number | null
          product_id?: string | null
          quantity?: number
          receipt_date?: string | null
          supplier?: string | null
          supplier_id?: string | null
          supplier_name?: string | null
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
          lot_number?: string | null
          manufacturer_id?: string | null
          name?: string
          net_quantity?: number | null
          product_id?: string | null
          quantity?: number
          receipt_date?: string | null
          supplier?: string | null
          supplier_id?: string | null
          supplier_name?: string | null
          unit?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ambalaje_inventory_crate_type_id_fkey"
            columns: ["crate_type_id"]
            isOneToOne: false
            referencedRelation: "ambalaje_crate_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ambalaje_inventory_manufacturer_id_fkey"
            columns: ["manufacturer_id"]
            isOneToOne: false
            referencedRelation: "ambalaje_manufacturers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ambalaje_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "ambalaje_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ambalaje_inventory_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "ambalaje_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      ambalaje_inventory_history: {
        Row: {
          action: string
          document_number: string | null
          exit_timestamp: string | null
          id: string
          inventory_item_id: string | null
          lot_number: string | null
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
          document_number?: string | null
          exit_timestamp?: string | null
          id?: string
          inventory_item_id?: string | null
          lot_number?: string | null
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
          document_number?: string | null
          exit_timestamp?: string | null
          id?: string
          inventory_item_id?: string | null
          lot_number?: string | null
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
            foreignKeyName: "ambalaje_inventory_history_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "ambalaje_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ambalaje_inventory_history_manufacturer_id_fkey"
            columns: ["manufacturer_id"]
            isOneToOne: false
            referencedRelation: "ambalaje_manufacturers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ambalaje_inventory_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "ambalaje_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ambalaje_inventory_history_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "ambalaje_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      ambalaje_manufacturers: {
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
      ambalaje_product_order_settings: {
        Row: {
          created_at: string
          id: string
          lead_time_days: number
          min_order_quantity: number
          product_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_time_days?: number
          min_order_quantity?: number
          product_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_time_days?: number
          min_order_quantity?: number
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ambalaje_product_order_settings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "ambalaje_products"
            referencedColumns: ["id"]
          },
        ]
      }
      ambalaje_production_stock: {
        Row: {
          created_at: string
          document_number: string | null
          id: string
          inventory_item_id: string | null
          lot_number: string | null
          manufacturer_id: string | null
          name: string
          product_id: string | null
          quantity: number
          supplier_id: string | null
          transfer_date: string
          transfer_id: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          document_number?: string | null
          id?: string
          inventory_item_id?: string | null
          lot_number?: string | null
          manufacturer_id?: string | null
          name: string
          product_id?: string | null
          quantity?: number
          supplier_id?: string | null
          transfer_date?: string
          transfer_id?: string | null
          unit: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          document_number?: string | null
          id?: string
          inventory_item_id?: string | null
          lot_number?: string | null
          manufacturer_id?: string | null
          name?: string
          product_id?: string | null
          quantity?: number
          supplier_id?: string | null
          transfer_date?: string
          transfer_id?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ambalaje_production_stock_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "ambalaje_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ambalaje_production_stock_manufacturer_id_fkey"
            columns: ["manufacturer_id"]
            isOneToOne: false
            referencedRelation: "ambalaje_manufacturers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ambalaje_production_stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "ambalaje_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ambalaje_production_stock_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "ambalaje_suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ambalaje_production_stock_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "ambalaje_stock_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      ambalaje_production_stock_history: {
        Row: {
          action: string
          created_at: string
          id: string
          notes: string | null
          previous_quantity: number | null
          production_stock_id: string | null
          quantity: number
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          notes?: string | null
          previous_quantity?: number | null
          production_stock_id?: string | null
          quantity: number
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          notes?: string | null
          previous_quantity?: number | null
          production_stock_id?: string | null
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "ambalaje_production_stock_history_production_stock_id_fkey"
            columns: ["production_stock_id"]
            isOneToOne: false
            referencedRelation: "ambalaje_production_stock"
            referencedColumns: ["id"]
          },
        ]
      }
      ambalaje_products: {
        Row: {
          category: string | null
          cod_produs: string | null
          created_at: string
          default_unit: string
          description: string | null
          id: string
          name: string
          pt_percent: number
          updated_at: string
        }
        Insert: {
          category?: string | null
          cod_produs?: string | null
          created_at?: string
          default_unit: string
          description?: string | null
          id?: string
          name: string
          pt_percent?: number
          updated_at?: string
        }
        Update: {
          category?: string | null
          cod_produs?: string | null
          created_at?: string
          default_unit?: string
          description?: string | null
          id?: string
          name?: string
          pt_percent?: number
          updated_at?: string
        }
        Relationships: []
      }
      ambalaje_reception_records: {
        Row: {
          consider_quantity: number | null
          crate_count: number | null
          crate_type_id: string | null
          crate_weight: number | null
          created_at: string
          document_number: string | null
          entry_number: number
          gross_quantity: number | null
          id: string
          lot_number: string | null
          manufacturer_id: string | null
          name: string
          net_quantity: number | null
          nonconform_percent: number | null
          obs: string | null
          original_quantity: number
          product_id: string | null
          receipt_date: string
          supplier_id: string | null
          supplier_name: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          consider_quantity?: number | null
          crate_count?: number | null
          crate_type_id?: string | null
          crate_weight?: number | null
          created_at?: string
          document_number?: string | null
          entry_number?: number
          gross_quantity?: number | null
          id?: string
          lot_number?: string | null
          manufacturer_id?: string | null
          name: string
          net_quantity?: number | null
          nonconform_percent?: number | null
          obs?: string | null
          original_quantity?: number
          product_id?: string | null
          receipt_date?: string
          supplier_id?: string | null
          supplier_name?: string | null
          unit: string
          updated_at?: string
        }
        Update: {
          consider_quantity?: number | null
          crate_count?: number | null
          crate_type_id?: string | null
          crate_weight?: number | null
          created_at?: string
          document_number?: string | null
          entry_number?: number
          gross_quantity?: number | null
          id?: string
          lot_number?: string | null
          manufacturer_id?: string | null
          name?: string
          net_quantity?: number | null
          nonconform_percent?: number | null
          obs?: string | null
          original_quantity?: number
          product_id?: string | null
          receipt_date?: string
          supplier_id?: string | null
          supplier_name?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ambalaje_reception_records_crate_type_id_fkey"
            columns: ["crate_type_id"]
            isOneToOne: false
            referencedRelation: "ambalaje_crate_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ambalaje_reception_records_manufacturer_id_fkey"
            columns: ["manufacturer_id"]
            isOneToOne: false
            referencedRelation: "ambalaje_manufacturers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ambalaje_reception_records_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "ambalaje_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ambalaje_reception_records_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "ambalaje_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      ambalaje_stock_transfer_items: {
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
            foreignKeyName: "ambalaje_stock_transfer_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "ambalaje_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ambalaje_stock_transfer_items_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "ambalaje_stock_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      ambalaje_stock_transfers: {
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
      ambalaje_suppliers: {
        Row: {
          address: string | null
          contact: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          supplier_code: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          supplier_code?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          supplier_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      angajati: {
        Row: {
          cod_angajat: string
          created_at: string
          id: string
          nume: string
          poza: string | null
          updated_at: string
        }
        Insert: {
          cod_angajat: string
          created_at?: string
          id?: string
          nume: string
          poza?: string | null
          updated_at?: string
        }
        Update: {
          cod_angajat?: string
          created_at?: string
          id?: string
          nume?: string
          poza?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      angajati_sistem_pontaj: {
        Row: {
          cod_angajat: string
          created_at: string
          id: string
          nume: string
          poza_url: string | null
          updated_at: string
        }
        Insert: {
          cod_angajat: string
          created_at?: string
          id?: string
          nume: string
          poza_url?: string | null
          updated_at?: string
        }
        Update: {
          cod_angajat?: string
          created_at?: string
          id?: string
          nume?: string
          poza_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      app_profiles: {
        Row: {
          approved: boolean | null
          created_at: string | null
          email: string
          id: string
          name: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          approved?: boolean | null
          created_at?: string | null
          email: string
          id?: string
          name?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          approved?: boolean | null
          created_at?: string | null
          email?: string
          id?: string
          name?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      app_user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_user_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_user_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_user_role"]
          user_id?: string
        }
        Relationships: []
      }
      cash_flow_categories: {
        Row: {
          color: string
          created_at: string
          icon: string | null
          id: string
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          type: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      cash_flow_entries: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          description: string
          document_date: string
          document_number: string | null
          document_type: string | null
          entry_date: string
          id: string
          is_recurring: boolean | null
          notes: string | null
          payment_date: string | null
          payment_status: string | null
          recurring_frequency: string | null
          tags: string[] | null
          type: string
          updated_at: string
          user_id: string | null
          week_start_date: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          description: string
          document_date: string
          document_number?: string | null
          document_type?: string | null
          entry_date?: string
          id?: string
          is_recurring?: boolean | null
          notes?: string | null
          payment_date?: string | null
          payment_status?: string | null
          recurring_frequency?: string | null
          tags?: string[] | null
          type: string
          updated_at?: string
          user_id?: string | null
          week_start_date: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          description?: string
          document_date?: string
          document_number?: string | null
          document_type?: string | null
          entry_date?: string
          id?: string
          is_recurring?: boolean | null
          notes?: string | null
          payment_date?: string | null
          payment_status?: string | null
          recurring_frequency?: string | null
          tags?: string[] | null
          type?: string
          updated_at?: string
          user_id?: string | null
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_flow_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "cash_flow_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      concedii: {
        Row: {
          angajat_id: string
          created_at: string
          data_inceput: string
          data_sfarsit: string
          document_url: string | null
          id: string
          numar_document: string | null
          numar_zile: number
          observatii: string | null
          tip_concediu: string
          updated_at: string
        }
        Insert: {
          angajat_id: string
          created_at?: string
          data_inceput: string
          data_sfarsit: string
          document_url?: string | null
          id?: string
          numar_document?: string | null
          numar_zile: number
          observatii?: string | null
          tip_concediu: string
          updated_at?: string
        }
        Update: {
          angajat_id?: string
          created_at?: string
          data_inceput?: string
          data_sfarsit?: string
          document_url?: string | null
          id?: string
          numar_document?: string | null
          numar_zile?: number
          observatii?: string | null
          tip_concediu?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "concedii_angajat_id_fkey"
            columns: ["angajat_id"]
            isOneToOne: false
            referencedRelation: "angajati_sistem_pontaj"
            referencedColumns: ["id"]
          },
        ]
      }
      conturi_pontaje: {
        Row: {
          activ: boolean
          created_at: string
          email: string
          id: string
          nume: string
          parola_hash: string
          rol: string
          updated_at: string
        }
        Insert: {
          activ?: boolean
          created_at?: string
          email: string
          id?: string
          nume: string
          parola_hash: string
          rol?: string
          updated_at?: string
        }
        Update: {
          activ?: boolean
          created_at?: string
          email?: string
          id?: string
          nume?: string
          parola_hash?: string
          rol?: string
          updated_at?: string
        }
        Relationships: []
      }
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
      coralmanagement_departments: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          manager_id: string | null
          name: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          manager_id?: string | null
          name: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          manager_id?: string | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coralmanagement_departments_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "coralmanagement_users"
            referencedColumns: ["id"]
          },
        ]
      }
      coralmanagement_employees: {
        Row: {
          active: boolean | null
          created_at: string | null
          department_id: string | null
          email: string | null
          hired_date: string | null
          id: string
          name: string
          total_points: number | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          department_id?: string | null
          email?: string | null
          hired_date?: string | null
          id?: string
          name: string
          total_points?: number | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          department_id?: string | null
          email?: string | null
          hired_date?: string | null
          id?: string
          name?: string
          total_points?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coralmanagement_employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "coralmanagement_departments"
            referencedColumns: ["id"]
          },
        ]
      }
      coralmanagement_metrics: {
        Row: {
          created_at: string | null
          department_id: string | null
          employee_id: string | null
          id: string
          metadata: Json | null
          metric_type: string
          period_end: string
          period_start: string
          unit: string | null
          value: number
        }
        Insert: {
          created_at?: string | null
          department_id?: string | null
          employee_id?: string | null
          id?: string
          metadata?: Json | null
          metric_type: string
          period_end: string
          period_start: string
          unit?: string | null
          value: number
        }
        Update: {
          created_at?: string | null
          department_id?: string | null
          employee_id?: string | null
          id?: string
          metadata?: Json | null
          metric_type?: string
          period_end?: string
          period_start?: string
          unit?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "coralmanagement_metrics_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "coralmanagement_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coralmanagement_metrics_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "coralmanagement_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      coralmanagement_missed_tasks: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          points_deducted: number
          reason: string
          scheduled_date: string
          task_assignment_id: string
          task_id: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          points_deducted?: number
          reason?: string
          scheduled_date: string
          task_assignment_id: string
          task_id: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          points_deducted?: number
          reason?: string
          scheduled_date?: string
          task_assignment_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_missed_tasks_assignment"
            columns: ["task_assignment_id"]
            isOneToOne: false
            referencedRelation: "coralmanagement_task_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_missed_tasks_employee"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "coralmanagement_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_missed_tasks_task"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "coralmanagement_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      coralmanagement_notifications: {
        Row: {
          created_at: string | null
          id: string
          message: string
          read: boolean | null
          recipient_id: string | null
          task_id: string | null
          title: string
          type: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          read?: boolean | null
          recipient_id?: string | null
          task_id?: string | null
          title: string
          type?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          read?: boolean | null
          recipient_id?: string | null
          task_id?: string | null
          title?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coralmanagement_notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "coralmanagement_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coralmanagement_notifications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "coralmanagement_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      coralmanagement_points_history: {
        Row: {
          awarded_by: string | null
          created_at: string | null
          employee_id: string | null
          id: string
          points_change: number
          reason: string
          task_assignment_id: string | null
          type: string | null
        }
        Insert: {
          awarded_by?: string | null
          created_at?: string | null
          employee_id?: string | null
          id?: string
          points_change: number
          reason: string
          task_assignment_id?: string | null
          type?: string | null
        }
        Update: {
          awarded_by?: string | null
          created_at?: string | null
          employee_id?: string | null
          id?: string
          points_change?: number
          reason?: string
          task_assignment_id?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coralmanagement_points_history_awarded_by_fkey"
            columns: ["awarded_by"]
            isOneToOne: false
            referencedRelation: "coralmanagement_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coralmanagement_points_history_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "coralmanagement_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coralmanagement_points_history_task_assignment_id_fkey"
            columns: ["task_assignment_id"]
            isOneToOne: false
            referencedRelation: "coralmanagement_task_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      coralmanagement_procedure_executions: {
        Row: {
          completed_at: string | null
          created_at: string | null
          current_step: number | null
          executed_by: string | null
          id: string
          notes: string | null
          procedure_id: string | null
          progress_percentage: number | null
          started_at: string | null
          status: string | null
          step_results: Json | null
          total_steps: number | null
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          current_step?: number | null
          executed_by?: string | null
          id?: string
          notes?: string | null
          procedure_id?: string | null
          progress_percentage?: number | null
          started_at?: string | null
          status?: string | null
          step_results?: Json | null
          total_steps?: number | null
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          current_step?: number | null
          executed_by?: string | null
          id?: string
          notes?: string | null
          procedure_id?: string | null
          progress_percentage?: number | null
          started_at?: string | null
          status?: string | null
          step_results?: Json | null
          total_steps?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coralmanagement_procedure_executions_executed_by_fkey"
            columns: ["executed_by"]
            isOneToOne: false
            referencedRelation: "coralmanagement_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coralmanagement_procedure_executions_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "coralmanagement_procedures"
            referencedColumns: ["id"]
          },
        ]
      }
      coralmanagement_procedures: {
        Row: {
          active: boolean | null
          checklist: Json | null
          created_at: string | null
          created_by: string | null
          department_id: string | null
          description: string | null
          files_urls: string[] | null
          id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          checklist?: Json | null
          created_at?: string | null
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          files_urls?: string[] | null
          id?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          checklist?: Json | null
          created_at?: string | null
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          files_urls?: string[] | null
          id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coralmanagement_procedures_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "coralmanagement_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coralmanagement_procedures_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "coralmanagement_departments"
            referencedColumns: ["id"]
          },
        ]
      }
      coralmanagement_task_assignments: {
        Row: {
          actual_start: string | null
          assigned_by: string | null
          blockers: Json | null
          completed_at: string | null
          created_at: string | null
          difficulty_rating: number | null
          employee_id: string | null
          estimated_completion: string | null
          id: string
          notes: string | null
          points_earned: number | null
          progress_percentage: number | null
          quality_score: number | null
          requires_review: boolean | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          task_id: string | null
          time_spent_minutes: number | null
          updated_at: string | null
        }
        Insert: {
          actual_start?: string | null
          assigned_by?: string | null
          blockers?: Json | null
          completed_at?: string | null
          created_at?: string | null
          difficulty_rating?: number | null
          employee_id?: string | null
          estimated_completion?: string | null
          id?: string
          notes?: string | null
          points_earned?: number | null
          progress_percentage?: number | null
          quality_score?: number | null
          requires_review?: boolean | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          task_id?: string | null
          time_spent_minutes?: number | null
          updated_at?: string | null
        }
        Update: {
          actual_start?: string | null
          assigned_by?: string | null
          blockers?: Json | null
          completed_at?: string | null
          created_at?: string | null
          difficulty_rating?: number | null
          employee_id?: string | null
          estimated_completion?: string | null
          id?: string
          notes?: string | null
          points_earned?: number | null
          progress_percentage?: number | null
          quality_score?: number | null
          requires_review?: boolean | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          task_id?: string | null
          time_spent_minutes?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coralmanagement_task_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "coralmanagement_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coralmanagement_task_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "coralmanagement_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coralmanagement_task_assignments_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "coralmanagement_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coralmanagement_task_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "coralmanagement_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      coralmanagement_task_comments: {
        Row: {
          attachments: Json | null
          author_id: string | null
          content: string
          created_at: string | null
          id: string
          task_assignment_id: string | null
          updated_at: string | null
        }
        Insert: {
          attachments?: Json | null
          author_id?: string | null
          content: string
          created_at?: string | null
          id?: string
          task_assignment_id?: string | null
          updated_at?: string | null
        }
        Update: {
          attachments?: Json | null
          author_id?: string | null
          content?: string
          created_at?: string | null
          id?: string
          task_assignment_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coralmanagement_task_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "coralmanagement_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coralmanagement_task_comments_task_assignment_id_fkey"
            columns: ["task_assignment_id"]
            isOneToOne: false
            referencedRelation: "coralmanagement_task_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      coralmanagement_task_completion_history: {
        Row: {
          completed_at: string
          created_at: string
          employee_id: string
          id: string
          notes: string | null
          points_earned: number
          task_assignment_id: string
          task_id: string
          was_on_time: boolean
        }
        Insert: {
          completed_at?: string
          created_at?: string
          employee_id: string
          id?: string
          notes?: string | null
          points_earned?: number
          task_assignment_id: string
          task_id: string
          was_on_time?: boolean
        }
        Update: {
          completed_at?: string
          created_at?: string
          employee_id?: string
          id?: string
          notes?: string | null
          points_earned?: number
          task_assignment_id?: string
          task_id?: string
          was_on_time?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "fk_task_completion_history_assignment"
            columns: ["task_assignment_id"]
            isOneToOne: false
            referencedRelation: "coralmanagement_task_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_task_completion_history_employee"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "coralmanagement_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_task_completion_history_task"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "coralmanagement_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      coralmanagement_task_templates: {
        Row: {
          active: boolean | null
          checklist: Json | null
          created_at: string | null
          created_by: string | null
          department_id: string | null
          description: string | null
          difficulty_level: string | null
          estimated_duration_minutes: number | null
          id: string
          name: string
          tags: string[] | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          checklist?: Json | null
          created_at?: string | null
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          difficulty_level?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          name: string
          tags?: string[] | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          checklist?: Json | null
          created_at?: string | null
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          difficulty_level?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          name?: string
          tags?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coralmanagement_task_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "coralmanagement_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coralmanagement_task_templates_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "coralmanagement_departments"
            referencedColumns: ["id"]
          },
        ]
      }
      coralmanagement_tasks: {
        Row: {
          actual_duration_minutes: number | null
          attachments: Json | null
          auto_assign: boolean | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          department_id: string | null
          description: string | null
          difficulty_level: string | null
          due_date: string | null
          estimated_duration_minutes: number | null
          id: string
          is_recurring: boolean | null
          next_occurrence: string | null
          parent_task_id: string | null
          points_reward: number | null
          priority: string | null
          procedure_id: string | null
          progress_percentage: number | null
          recurring_pattern: Json | null
          requires_approval: boolean | null
          started_at: string | null
          status: string | null
          tags: string[] | null
          template_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          actual_duration_minutes?: number | null
          attachments?: Json | null
          auto_assign?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          difficulty_level?: string | null
          due_date?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          is_recurring?: boolean | null
          next_occurrence?: string | null
          parent_task_id?: string | null
          points_reward?: number | null
          priority?: string | null
          procedure_id?: string | null
          progress_percentage?: number | null
          recurring_pattern?: Json | null
          requires_approval?: boolean | null
          started_at?: string | null
          status?: string | null
          tags?: string[] | null
          template_id?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          actual_duration_minutes?: number | null
          attachments?: Json | null
          auto_assign?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          difficulty_level?: string | null
          due_date?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          is_recurring?: boolean | null
          next_occurrence?: string | null
          parent_task_id?: string | null
          points_reward?: number | null
          priority?: string | null
          procedure_id?: string | null
          progress_percentage?: number | null
          recurring_pattern?: Json | null
          requires_approval?: boolean | null
          started_at?: string | null
          status?: string | null
          tags?: string[] | null
          template_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coralmanagement_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "coralmanagement_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coralmanagement_tasks_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "coralmanagement_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coralmanagement_tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "coralmanagement_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coralmanagement_tasks_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "coralmanagement_procedures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coralmanagement_tasks_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "coralmanagement_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      coralmanagement_users: {
        Row: {
          active: boolean | null
          created_at: string | null
          email: string
          id: string
          name: string
          password_hash: string
          role: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          email: string
          id?: string
          name: string
          password_hash: string
          role: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          password_hash?: string
          role?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      coralmanagement_work_sessions: {
        Row: {
          break_duration_minutes: number | null
          created_at: string | null
          duration_minutes: number | null
          employee_id: string | null
          ended_at: string | null
          id: string
          notes: string | null
          productivity_score: number | null
          started_at: string | null
          task_assignment_id: string | null
        }
        Insert: {
          break_duration_minutes?: number | null
          created_at?: string | null
          duration_minutes?: number | null
          employee_id?: string | null
          ended_at?: string | null
          id?: string
          notes?: string | null
          productivity_score?: number | null
          started_at?: string | null
          task_assignment_id?: string | null
        }
        Update: {
          break_duration_minutes?: number | null
          created_at?: string | null
          duration_minutes?: number | null
          employee_id?: string | null
          ended_at?: string | null
          id?: string
          notes?: string | null
          productivity_score?: number | null
          started_at?: string | null
          task_assignment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coralmanagement_work_sessions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "coralmanagement_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coralmanagement_work_sessions_task_assignment_id_fkey"
            columns: ["task_assignment_id"]
            isOneToOne: false
            referencedRelation: "coralmanagement_task_assignments"
            referencedColumns: ["id"]
          },
        ]
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
      daily_stock_quality: {
        Row: {
          consider_quantity: number
          created_at: string
          id: string
          nonconform_percent: number
          obs: string | null
          snapshot_id: string
          updated_at: string
        }
        Insert: {
          consider_quantity?: number
          created_at?: string
          id?: string
          nonconform_percent?: number
          obs?: string | null
          snapshot_id: string
          updated_at?: string
        }
        Update: {
          consider_quantity?: number
          created_at?: string
          id?: string
          nonconform_percent?: number
          obs?: string | null
          snapshot_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_stock_quality_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: true
            referencedRelation: "daily_stock_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_stock_snapshots: {
        Row: {
          crate_count: number | null
          crate_type_id: string | null
          crate_weight: number | null
          created_at: string
          document_number: string | null
          entry_number: number | null
          gross_quantity: number | null
          id: string
          lot_number: string | null
          manufacturer_id: string | null
          name: string
          net_quantity: number | null
          product_id: string | null
          quantity: number
          receipt_date: string | null
          snapshot_date: string
          supplier_id: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          crate_count?: number | null
          crate_type_id?: string | null
          crate_weight?: number | null
          created_at?: string
          document_number?: string | null
          entry_number?: number | null
          gross_quantity?: number | null
          id?: string
          lot_number?: string | null
          manufacturer_id?: string | null
          name: string
          net_quantity?: number | null
          product_id?: string | null
          quantity?: number
          receipt_date?: string | null
          snapshot_date: string
          supplier_id?: string | null
          unit: string
          updated_at?: string
        }
        Update: {
          crate_count?: number | null
          crate_type_id?: string | null
          crate_weight?: number | null
          created_at?: string
          document_number?: string | null
          entry_number?: number | null
          gross_quantity?: number | null
          id?: string
          lot_number?: string | null
          manufacturer_id?: string | null
          name?: string
          net_quantity?: number | null
          product_id?: string | null
          quantity?: number
          receipt_date?: string | null
          snapshot_date?: string
          supplier_id?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_stock_snapshots_crate_type_id_fkey"
            columns: ["crate_type_id"]
            isOneToOne: false
            referencedRelation: "crate_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_stock_snapshots_manufacturer_id_fkey"
            columns: ["manufacturer_id"]
            isOneToOne: false
            referencedRelation: "manufacturers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_stock_snapshots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_stock_snapshots_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      etichete_crate_types: {
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
      etichete_daily_stock_quality: {
        Row: {
          consider_quantity: number
          created_at: string
          id: string
          nonconform_percent: number
          obs: string | null
          snapshot_id: string
          updated_at: string
        }
        Insert: {
          consider_quantity?: number
          created_at?: string
          id?: string
          nonconform_percent?: number
          obs?: string | null
          snapshot_id: string
          updated_at?: string
        }
        Update: {
          consider_quantity?: number
          created_at?: string
          id?: string
          nonconform_percent?: number
          obs?: string | null
          snapshot_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "etichete_daily_stock_quality_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: true
            referencedRelation: "etichete_daily_stock_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      etichete_daily_stock_snapshots: {
        Row: {
          crate_count: number | null
          crate_type_id: string | null
          crate_weight: number | null
          created_at: string
          document_number: string | null
          entry_number: number | null
          gross_quantity: number | null
          id: string
          lot_number: string | null
          manufacturer_id: string | null
          name: string
          net_quantity: number | null
          product_id: string | null
          quantity: number
          receipt_date: string | null
          snapshot_date: string
          supplier_id: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          crate_count?: number | null
          crate_type_id?: string | null
          crate_weight?: number | null
          created_at?: string
          document_number?: string | null
          entry_number?: number | null
          gross_quantity?: number | null
          id?: string
          lot_number?: string | null
          manufacturer_id?: string | null
          name: string
          net_quantity?: number | null
          product_id?: string | null
          quantity?: number
          receipt_date?: string | null
          snapshot_date: string
          supplier_id?: string | null
          unit: string
          updated_at?: string
        }
        Update: {
          crate_count?: number | null
          crate_type_id?: string | null
          crate_weight?: number | null
          created_at?: string
          document_number?: string | null
          entry_number?: number | null
          gross_quantity?: number | null
          id?: string
          lot_number?: string | null
          manufacturer_id?: string | null
          name?: string
          net_quantity?: number | null
          product_id?: string | null
          quantity?: number
          receipt_date?: string | null
          snapshot_date?: string
          supplier_id?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "etichete_daily_stock_snapshots_crate_type_id_fkey"
            columns: ["crate_type_id"]
            isOneToOne: false
            referencedRelation: "etichete_crate_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "etichete_daily_stock_snapshots_manufacturer_id_fkey"
            columns: ["manufacturer_id"]
            isOneToOne: false
            referencedRelation: "etichete_manufacturers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "etichete_daily_stock_snapshots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "etichete_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "etichete_daily_stock_snapshots_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "etichete_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      etichete_inventory: {
        Row: {
          crate_count: number | null
          crate_type_id: string | null
          crate_weight: number | null
          created_at: string | null
          document_number: string | null
          entry_number: number
          gross_quantity: number | null
          id: string
          lot_number: string | null
          manufacturer_id: string | null
          name: string
          net_quantity: number | null
          product_id: string | null
          quantity: number
          receipt_date: string | null
          supplier: string | null
          supplier_id: string | null
          supplier_name: string | null
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
          lot_number?: string | null
          manufacturer_id?: string | null
          name: string
          net_quantity?: number | null
          product_id?: string | null
          quantity?: number
          receipt_date?: string | null
          supplier?: string | null
          supplier_id?: string | null
          supplier_name?: string | null
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
          lot_number?: string | null
          manufacturer_id?: string | null
          name?: string
          net_quantity?: number | null
          product_id?: string | null
          quantity?: number
          receipt_date?: string | null
          supplier?: string | null
          supplier_id?: string | null
          supplier_name?: string | null
          unit?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "etichete_inventory_crate_type_id_fkey"
            columns: ["crate_type_id"]
            isOneToOne: false
            referencedRelation: "etichete_crate_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "etichete_inventory_manufacturer_id_fkey"
            columns: ["manufacturer_id"]
            isOneToOne: false
            referencedRelation: "etichete_manufacturers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "etichete_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "etichete_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "etichete_inventory_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "etichete_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      etichete_inventory_history: {
        Row: {
          action: string
          document_number: string | null
          exit_timestamp: string | null
          id: string
          inventory_item_id: string | null
          lot_number: string | null
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
          document_number?: string | null
          exit_timestamp?: string | null
          id?: string
          inventory_item_id?: string | null
          lot_number?: string | null
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
          document_number?: string | null
          exit_timestamp?: string | null
          id?: string
          inventory_item_id?: string | null
          lot_number?: string | null
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
            foreignKeyName: "etichete_inventory_history_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "etichete_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "etichete_inventory_history_manufacturer_id_fkey"
            columns: ["manufacturer_id"]
            isOneToOne: false
            referencedRelation: "etichete_manufacturers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "etichete_inventory_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "etichete_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "etichete_inventory_history_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "etichete_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      etichete_manufacturers: {
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
      etichete_product_order_settings: {
        Row: {
          created_at: string
          id: string
          lead_time_days: number
          min_order_quantity: number
          product_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_time_days?: number
          min_order_quantity?: number
          product_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_time_days?: number
          min_order_quantity?: number
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "etichete_product_order_settings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "etichete_products"
            referencedColumns: ["id"]
          },
        ]
      }
      etichete_production_stock: {
        Row: {
          created_at: string
          document_number: string | null
          id: string
          inventory_item_id: string | null
          lot_number: string | null
          manufacturer_id: string | null
          name: string
          product_id: string | null
          quantity: number
          supplier_id: string | null
          transfer_date: string
          transfer_id: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          document_number?: string | null
          id?: string
          inventory_item_id?: string | null
          lot_number?: string | null
          manufacturer_id?: string | null
          name: string
          product_id?: string | null
          quantity?: number
          supplier_id?: string | null
          transfer_date?: string
          transfer_id?: string | null
          unit: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          document_number?: string | null
          id?: string
          inventory_item_id?: string | null
          lot_number?: string | null
          manufacturer_id?: string | null
          name?: string
          product_id?: string | null
          quantity?: number
          supplier_id?: string | null
          transfer_date?: string
          transfer_id?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "etichete_production_stock_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "etichete_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "etichete_production_stock_manufacturer_id_fkey"
            columns: ["manufacturer_id"]
            isOneToOne: false
            referencedRelation: "etichete_manufacturers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "etichete_production_stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "etichete_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "etichete_production_stock_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "etichete_suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "etichete_production_stock_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "etichete_stock_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      etichete_production_stock_history: {
        Row: {
          action: string
          created_at: string
          id: string
          notes: string | null
          previous_quantity: number | null
          production_stock_id: string | null
          quantity: number
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          notes?: string | null
          previous_quantity?: number | null
          production_stock_id?: string | null
          quantity: number
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          notes?: string | null
          previous_quantity?: number | null
          production_stock_id?: string | null
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "etichete_production_stock_history_production_stock_id_fkey"
            columns: ["production_stock_id"]
            isOneToOne: false
            referencedRelation: "etichete_production_stock"
            referencedColumns: ["id"]
          },
        ]
      }
      etichete_products: {
        Row: {
          category: string | null
          cod_produs: string | null
          created_at: string
          default_unit: string
          description: string | null
          id: string
          name: string
          pt_percent: number | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          cod_produs?: string | null
          created_at?: string
          default_unit: string
          description?: string | null
          id?: string
          name: string
          pt_percent?: number | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          cod_produs?: string | null
          created_at?: string
          default_unit?: string
          description?: string | null
          id?: string
          name?: string
          pt_percent?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      etichete_reception_records: {
        Row: {
          consider_quantity: number | null
          crate_count: number | null
          crate_type_id: string | null
          crate_weight: number | null
          created_at: string
          document_number: string | null
          entry_number: number
          gross_quantity: number | null
          id: string
          lot_number: string | null
          manufacturer_id: string | null
          name: string
          net_quantity: number | null
          nonconform_percent: number | null
          obs: string | null
          original_quantity: number
          product_id: string | null
          receipt_date: string
          supplier_id: string | null
          supplier_name: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          consider_quantity?: number | null
          crate_count?: number | null
          crate_type_id?: string | null
          crate_weight?: number | null
          created_at?: string
          document_number?: string | null
          entry_number?: number
          gross_quantity?: number | null
          id?: string
          lot_number?: string | null
          manufacturer_id?: string | null
          name: string
          net_quantity?: number | null
          nonconform_percent?: number | null
          obs?: string | null
          original_quantity?: number
          product_id?: string | null
          receipt_date?: string
          supplier_id?: string | null
          supplier_name?: string | null
          unit: string
          updated_at?: string
        }
        Update: {
          consider_quantity?: number | null
          crate_count?: number | null
          crate_type_id?: string | null
          crate_weight?: number | null
          created_at?: string
          document_number?: string | null
          entry_number?: number
          gross_quantity?: number | null
          id?: string
          lot_number?: string | null
          manufacturer_id?: string | null
          name?: string
          net_quantity?: number | null
          nonconform_percent?: number | null
          obs?: string | null
          original_quantity?: number
          product_id?: string | null
          receipt_date?: string
          supplier_id?: string | null
          supplier_name?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "etichete_reception_records_crate_type_id_fkey"
            columns: ["crate_type_id"]
            isOneToOne: false
            referencedRelation: "etichete_crate_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "etichete_reception_records_manufacturer_id_fkey"
            columns: ["manufacturer_id"]
            isOneToOne: false
            referencedRelation: "etichete_manufacturers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "etichete_reception_records_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "etichete_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "etichete_reception_records_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "etichete_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      etichete_stock_transfer_items: {
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
            foreignKeyName: "etichete_stock_transfer_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "etichete_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "etichete_stock_transfer_items_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "etichete_stock_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      etichete_stock_transfers: {
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
      etichete_suppliers: {
        Row: {
          address: string | null
          contact: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          supplier_code: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          supplier_code?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          supplier_code?: string | null
          updated_at?: string
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
          lot_number: string | null
          manufacturer_id: string | null
          name: string
          net_quantity: number | null
          product_id: string | null
          quantity: number
          receipt_date: string | null
          supplier: string | null
          supplier_id: string | null
          supplier_name: string | null
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
          lot_number?: string | null
          manufacturer_id?: string | null
          name: string
          net_quantity?: number | null
          product_id?: string | null
          quantity?: number
          receipt_date?: string | null
          supplier?: string | null
          supplier_id?: string | null
          supplier_name?: string | null
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
          lot_number?: string | null
          manufacturer_id?: string | null
          name?: string
          net_quantity?: number | null
          product_id?: string | null
          quantity?: number
          receipt_date?: string | null
          supplier?: string | null
          supplier_id?: string | null
          supplier_name?: string | null
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
          document_number: string | null
          exit_timestamp: string | null
          id: string
          inventory_item_id: string | null
          lot_number: string | null
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
          document_number?: string | null
          exit_timestamp?: string | null
          id?: string
          inventory_item_id?: string | null
          lot_number?: string | null
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
          document_number?: string | null
          exit_timestamp?: string | null
          id?: string
          inventory_item_id?: string | null
          lot_number?: string | null
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
            foreignKeyName: "inventory_history_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory"
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
      inventory_locations: {
        Row: {
          address: string | null
          code: string
          created_at: string
          id: string
          is_active: boolean | null
          manager_name: string | null
          name: string
          phone: string | null
          type: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          code: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          manager_name?: string | null
          name: string
          phone?: string | null
          type?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          manager_name?: string | null
          name?: string
          phone?: string | null
          type?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      inventory_receipt_items: {
        Row: {
          created_at: string
          expiry_date: string | null
          id: string
          lot_number: string | null
          notes: string | null
          product_id: string
          quality_check: string | null
          quantity: number
          receipt_id: string | null
          serial_number: string | null
          total_cost: number | null
          unit_cost: number
        }
        Insert: {
          created_at?: string
          expiry_date?: string | null
          id?: string
          lot_number?: string | null
          notes?: string | null
          product_id: string
          quality_check?: string | null
          quantity: number
          receipt_id?: string | null
          serial_number?: string | null
          total_cost?: number | null
          unit_cost: number
        }
        Update: {
          created_at?: string
          expiry_date?: string | null
          id?: string
          lot_number?: string | null
          notes?: string | null
          product_id?: string
          quality_check?: string | null
          quantity?: number
          receipt_id?: string | null
          serial_number?: string | null
          total_cost?: number | null
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_receipt_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "lre_inventory_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_receipt_items_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "inventory_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_receipts: {
        Row: {
          created_at: string
          document_number: string | null
          id: string
          invoice_number: string | null
          location_id: string
          notes: string | null
          purchase_order_id: string | null
          receipt_date: string | null
          receipt_number: string
          received_by: string | null
          status: string | null
          supplier_id: string | null
          total_amount: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          document_number?: string | null
          id?: string
          invoice_number?: string | null
          location_id: string
          notes?: string | null
          purchase_order_id?: string | null
          receipt_date?: string | null
          receipt_number: string
          received_by?: string | null
          status?: string | null
          supplier_id?: string | null
          total_amount?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          document_number?: string | null
          id?: string
          invoice_number?: string | null
          location_id?: string
          notes?: string | null
          purchase_order_id?: string | null
          receipt_date?: string | null
          receipt_number?: string
          received_by?: string | null
          status?: string | null
          supplier_id?: string | null
          total_amount?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_receipts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "inventory_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_receipts_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "lre_purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_receipts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "lre_inventory_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      lre_categorii_cheltuieli: {
        Row: {
          activa: boolean | null
          created_at: string
          culoare: string | null
          descriere: string | null
          id: string
          nume: string
          updated_at: string
        }
        Insert: {
          activa?: boolean | null
          created_at?: string
          culoare?: string | null
          descriere?: string | null
          id?: string
          nume: string
          updated_at?: string
        }
        Update: {
          activa?: boolean | null
          created_at?: string
          culoare?: string | null
          descriere?: string | null
          id?: string
          nume?: string
          updated_at?: string
        }
        Relationships: []
      }
      lre_cheltuieli: {
        Row: {
          categoria: string
          created_at: string
          data_cheltuiala: string | null
          factura_url: string | null
          furnizor: string | null
          id: string
          nr_factura: string | null
          nume: string
          observatii: string | null
          suma: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          categoria: string
          created_at?: string
          data_cheltuiala?: string | null
          factura_url?: string | null
          furnizor?: string | null
          id?: string
          nr_factura?: string | null
          nume: string
          observatii?: string | null
          suma: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          categoria?: string
          created_at?: string
          data_cheltuiala?: string | null
          factura_url?: string | null
          furnizor?: string | null
          id?: string
          nr_factura?: string | null
          nume?: string
          observatii?: string | null
          suma?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      lre_clienti: {
        Row: {
          adresa: string | null
          created_at: string
          data_nasterii: string | null
          email: string | null
          id: string
          nume_complet: string
          observatii: string | null
          programari_anulate: number | null
          telefon: string | null
          total_programari: number | null
          updated_at: string
        }
        Insert: {
          adresa?: string | null
          created_at?: string
          data_nasterii?: string | null
          email?: string | null
          id?: string
          nume_complet: string
          observatii?: string | null
          programari_anulate?: number | null
          telefon?: string | null
          total_programari?: number | null
          updated_at?: string
        }
        Update: {
          adresa?: string | null
          created_at?: string
          data_nasterii?: string | null
          email?: string | null
          id?: string
          nume_complet?: string
          observatii?: string | null
          programari_anulate?: number | null
          telefon?: string | null
          total_programari?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      lre_deviz_items: {
        Row: {
          cantitate: number
          created_at: string
          descriere_lucrare: string
          deviz_id: string | null
          id: string
          observatii: string | null
          unitate_masura: string
        }
        Insert: {
          cantitate?: number
          created_at?: string
          descriere_lucrare: string
          deviz_id?: string | null
          id?: string
          observatii?: string | null
          unitate_masura?: string
        }
        Update: {
          cantitate?: number
          created_at?: string
          descriere_lucrare?: string
          deviz_id?: string | null
          id?: string
          observatii?: string | null
          unitate_masura?: string
        }
        Relationships: [
          {
            foreignKeyName: "lre_deviz_items_deviz_id_fkey"
            columns: ["deviz_id"]
            isOneToOne: false
            referencedRelation: "lre_devize_lucru"
            referencedColumns: ["id"]
          },
        ]
      }
      lre_devize_lucru: {
        Row: {
          client_id: string | null
          created_at: string
          data_emitere: string
          descriere_generala: string | null
          factura_id: string | null
          id: string
          lucrare_id: string | null
          numar_deviz: string
          observatii: string | null
          oferta_id: string | null
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          data_emitere?: string
          descriere_generala?: string | null
          factura_id?: string | null
          id?: string
          lucrare_id?: string | null
          numar_deviz: string
          observatii?: string | null
          oferta_id?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          data_emitere?: string
          descriere_generala?: string | null
          factura_id?: string | null
          id?: string
          lucrare_id?: string | null
          numar_deviz?: string
          observatii?: string | null
          oferta_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lre_devize_lucru_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "lre_clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lre_devize_lucru_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "lre_facturi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lre_devize_lucru_lucrare_id_fkey"
            columns: ["lucrare_id"]
            isOneToOne: false
            referencedRelation: "lre_lucrari"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lre_devize_lucru_oferta_id_fkey"
            columns: ["oferta_id"]
            isOneToOne: false
            referencedRelation: "lre_oferte"
            referencedColumns: ["id"]
          },
        ]
      }
      lre_document_settings: {
        Row: {
          adresa_firma: string | null
          banca_firma: string | null
          created_at: string | null
          cui: string | null
          culoare_primara: string | null
          culoare_secundara: string | null
          email_firma: string | null
          font_familie: string | null
          iban_firma: string | null
          id: string
          include_semnatura: boolean | null
          include_stampila: boolean | null
          logo_url: string | null
          nr_reg_com: string | null
          nume_firma: string | null
          telefon_firma: string | null
          text_footer: string | null
          tip_document: string
          updated_at: string | null
        }
        Insert: {
          adresa_firma?: string | null
          banca_firma?: string | null
          created_at?: string | null
          cui?: string | null
          culoare_primara?: string | null
          culoare_secundara?: string | null
          email_firma?: string | null
          font_familie?: string | null
          iban_firma?: string | null
          id?: string
          include_semnatura?: boolean | null
          include_stampila?: boolean | null
          logo_url?: string | null
          nr_reg_com?: string | null
          nume_firma?: string | null
          telefon_firma?: string | null
          text_footer?: string | null
          tip_document: string
          updated_at?: string | null
        }
        Update: {
          adresa_firma?: string | null
          banca_firma?: string | null
          created_at?: string | null
          cui?: string | null
          culoare_primara?: string | null
          culoare_secundara?: string | null
          email_firma?: string | null
          font_familie?: string | null
          iban_firma?: string | null
          id?: string
          include_semnatura?: boolean | null
          include_stampila?: boolean | null
          logo_url?: string | null
          nr_reg_com?: string | null
          nume_firma?: string | null
          telefon_firma?: string | null
          text_footer?: string | null
          tip_document?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      lre_factura_items: {
        Row: {
          cantitate: number | null
          created_at: string
          factura_id: string | null
          id: string
          nume_serviciu: string
          pret_unitar: number
          serviciu_id: string | null
          total_cu_tva: number
          total_fara_tva: number
          total_tva: number
          tva_procent: number | null
        }
        Insert: {
          cantitate?: number | null
          created_at?: string
          factura_id?: string | null
          id?: string
          nume_serviciu: string
          pret_unitar: number
          serviciu_id?: string | null
          total_cu_tva: number
          total_fara_tva: number
          total_tva: number
          tva_procent?: number | null
        }
        Update: {
          cantitate?: number | null
          created_at?: string
          factura_id?: string | null
          id?: string
          nume_serviciu?: string
          pret_unitar?: number
          serviciu_id?: string | null
          total_cu_tva?: number
          total_fara_tva?: number
          total_tva?: number
          tva_procent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lre_factura_items_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "lre_facturi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lre_factura_items_serviciu_id_fkey"
            columns: ["serviciu_id"]
            isOneToOne: false
            referencedRelation: "lre_servicii"
            referencedColumns: ["id"]
          },
        ]
      }
      lre_facturi: {
        Row: {
          client_id: string | null
          created_at: string
          data_emitere: string | null
          data_scadenta: string | null
          deviz_id: string | null
          id: string
          lucrare_id: string | null
          numar_factura: string
          observatii: string | null
          oferta_id: string | null
          programare_id: string | null
          status_plata: string | null
          suma_achitata: number | null
          total_cu_tva: number
          total_fara_tva: number
          total_tva: number
          tva_procent: number | null
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          data_emitere?: string | null
          data_scadenta?: string | null
          deviz_id?: string | null
          id?: string
          lucrare_id?: string | null
          numar_factura: string
          observatii?: string | null
          oferta_id?: string | null
          programare_id?: string | null
          status_plata?: string | null
          suma_achitata?: number | null
          total_cu_tva?: number
          total_fara_tva?: number
          total_tva?: number
          tva_procent?: number | null
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          data_emitere?: string | null
          data_scadenta?: string | null
          deviz_id?: string | null
          id?: string
          lucrare_id?: string | null
          numar_factura?: string
          observatii?: string | null
          oferta_id?: string | null
          programare_id?: string | null
          status_plata?: string | null
          suma_achitata?: number | null
          total_cu_tva?: number
          total_fara_tva?: number
          total_tva?: number
          tva_procent?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_lre_facturi_oferta"
            columns: ["oferta_id"]
            isOneToOne: false
            referencedRelation: "lre_oferte"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lre_facturi_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "lre_clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lre_facturi_deviz_id_fkey"
            columns: ["deviz_id"]
            isOneToOne: false
            referencedRelation: "lre_devize_lucru"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lre_facturi_lucrare_id_fkey"
            columns: ["lucrare_id"]
            isOneToOne: false
            referencedRelation: "lre_lucrari"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lre_facturi_programare_id_fkey"
            columns: ["programare_id"]
            isOneToOne: false
            referencedRelation: "lre_programari"
            referencedColumns: ["id"]
          },
        ]
      }
      lre_inventory_categories: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "lre_inventory_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      lre_inventory_movements: {
        Row: {
          created_at: string
          created_by: string | null
          document_number: string | null
          expiry_date: string | null
          id: string
          location_id: string
          lot_number: string | null
          movement_date: string
          movement_type: string
          notes: string | null
          product_id: string
          quantity: number
          reference_id: string | null
          reference_type: string | null
          serial_number: string | null
          total_cost: number | null
          unit_cost: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          document_number?: string | null
          expiry_date?: string | null
          id?: string
          location_id: string
          lot_number?: string | null
          movement_date?: string
          movement_type: string
          notes?: string | null
          product_id: string
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          serial_number?: string | null
          total_cost?: number | null
          unit_cost?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          document_number?: string | null
          expiry_date?: string | null
          id?: string
          location_id?: string
          lot_number?: string | null
          movement_date?: string
          movement_type?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          serial_number?: string | null
          total_cost?: number | null
          unit_cost?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "inventory_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lre_inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "lre_inventory_products"
            referencedColumns: ["id"]
          },
        ]
      }
      lre_inventory_products: {
        Row: {
          barcode: string | null
          category_id: string | null
          cost_price: number | null
          created_at: string
          description: string | null
          dimensions: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          is_perishable: boolean | null
          is_serialized: boolean | null
          max_stock: number | null
          min_stock: number | null
          name: string
          qr_code: string | null
          reorder_point: number | null
          selling_price: number | null
          shelf_life_days: number | null
          sku: string
          storage_location: string | null
          unit_id: string | null
          updated_at: string
          user_id: string | null
          weight: number | null
        }
        Insert: {
          barcode?: string | null
          category_id?: string | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          dimensions?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_perishable?: boolean | null
          is_serialized?: boolean | null
          max_stock?: number | null
          min_stock?: number | null
          name: string
          qr_code?: string | null
          reorder_point?: number | null
          selling_price?: number | null
          shelf_life_days?: number | null
          sku: string
          storage_location?: string | null
          unit_id?: string | null
          updated_at?: string
          user_id?: string | null
          weight?: number | null
        }
        Update: {
          barcode?: string | null
          category_id?: string | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          dimensions?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_perishable?: boolean | null
          is_serialized?: boolean | null
          max_stock?: number | null
          min_stock?: number | null
          name?: string
          qr_code?: string | null
          reorder_point?: number | null
          selling_price?: number | null
          shelf_life_days?: number | null
          sku?: string
          storage_location?: string | null
          unit_id?: string | null
          updated_at?: string
          user_id?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lre_inventory_products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "lre_inventory_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lre_inventory_products_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "lre_inventory_units"
            referencedColumns: ["id"]
          },
        ]
      }
      lre_inventory_stock: {
        Row: {
          available_quantity: number | null
          avg_cost: number | null
          id: string
          last_movement_date: string | null
          location_id: string
          product_id: string
          quantity: number
          reserved_quantity: number
          total_value: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          available_quantity?: number | null
          avg_cost?: number | null
          id?: string
          last_movement_date?: string | null
          location_id: string
          product_id: string
          quantity?: number
          reserved_quantity?: number
          total_value?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          available_quantity?: number | null
          avg_cost?: number | null
          id?: string
          last_movement_date?: string | null
          location_id?: string
          product_id?: string
          quantity?: number
          reserved_quantity?: number
          total_value?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_stock_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "inventory_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lre_inventory_stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "lre_inventory_products"
            referencedColumns: ["id"]
          },
        ]
      }
      lre_inventory_suppliers: {
        Row: {
          address: string | null
          bank: string | null
          city: string | null
          code: string | null
          contact_person: string | null
          country: string | null
          created_at: string
          cui: string | null
          email: string | null
          iban: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          nr_reg_com: string | null
          payment_terms: number | null
          phone: string | null
          postal_code: string | null
          rating: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          bank?: string | null
          city?: string | null
          code?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          cui?: string | null
          email?: string | null
          iban?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          nr_reg_com?: string | null
          payment_terms?: number | null
          phone?: string | null
          postal_code?: string | null
          rating?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          bank?: string | null
          city?: string | null
          code?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          cui?: string | null
          email?: string | null
          iban?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          nr_reg_com?: string | null
          payment_terms?: number | null
          phone?: string | null
          postal_code?: string | null
          rating?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      lre_inventory_units: {
        Row: {
          base_unit_id: string | null
          conversion_factor: number | null
          created_at: string
          id: string
          name: string
          symbol: string
          type: string
        }
        Insert: {
          base_unit_id?: string | null
          conversion_factor?: number | null
          created_at?: string
          id?: string
          name: string
          symbol: string
          type?: string
        }
        Update: {
          base_unit_id?: string | null
          conversion_factor?: number | null
          created_at?: string
          id?: string
          name?: string
          symbol?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_units_base_unit_id_fkey"
            columns: ["base_unit_id"]
            isOneToOne: false
            referencedRelation: "lre_inventory_units"
            referencedColumns: ["id"]
          },
        ]
      }
      lre_lucrari: {
        Row: {
          client_id: string | null
          created_at: string
          data_finalizare_efectiva: string | null
          data_finalizare_planificata: string | null
          data_inceput: string | null
          descriere: string | null
          factura_id: string | null
          id: string
          nume_lucrare: string
          observatii: string | null
          oferta_id: string | null
          procent_finalizare: number | null
          status: string | null
          updated_at: string
          valoare_estimata: number | null
          valoare_finala: number | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          data_finalizare_efectiva?: string | null
          data_finalizare_planificata?: string | null
          data_inceput?: string | null
          descriere?: string | null
          factura_id?: string | null
          id?: string
          nume_lucrare: string
          observatii?: string | null
          oferta_id?: string | null
          procent_finalizare?: number | null
          status?: string | null
          updated_at?: string
          valoare_estimata?: number | null
          valoare_finala?: number | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          data_finalizare_efectiva?: string | null
          data_finalizare_planificata?: string | null
          data_inceput?: string | null
          descriere?: string | null
          factura_id?: string | null
          id?: string
          nume_lucrare?: string
          observatii?: string | null
          oferta_id?: string | null
          procent_finalizare?: number | null
          status?: string | null
          updated_at?: string
          valoare_estimata?: number | null
          valoare_finala?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lre_lucrari_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "lre_clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lre_lucrari_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "lre_facturi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lre_lucrari_oferta_id_fkey"
            columns: ["oferta_id"]
            isOneToOne: false
            referencedRelation: "lre_oferte"
            referencedColumns: ["id"]
          },
        ]
      }
      lre_oferta_items: {
        Row: {
          cantitate: number | null
          created_at: string
          id: string
          nume_serviciu: string
          oferta_id: string | null
          pret_unitar: number
          serviciu_id: string | null
          total_cu_tva: number
          total_fara_tva: number
          total_tva: number
          tva_procent: number | null
        }
        Insert: {
          cantitate?: number | null
          created_at?: string
          id?: string
          nume_serviciu: string
          oferta_id?: string | null
          pret_unitar: number
          serviciu_id?: string | null
          total_cu_tva: number
          total_fara_tva: number
          total_tva: number
          tva_procent?: number | null
        }
        Update: {
          cantitate?: number | null
          created_at?: string
          id?: string
          nume_serviciu?: string
          oferta_id?: string | null
          pret_unitar?: number
          serviciu_id?: string | null
          total_cu_tva?: number
          total_fara_tva?: number
          total_tva?: number
          tva_procent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lre_oferta_items_oferta_id_fkey"
            columns: ["oferta_id"]
            isOneToOne: false
            referencedRelation: "lre_oferte"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lre_oferta_items_serviciu_id_fkey"
            columns: ["serviciu_id"]
            isOneToOne: false
            referencedRelation: "lre_servicii"
            referencedColumns: ["id"]
          },
        ]
      }
      lre_oferte: {
        Row: {
          client_id: string | null
          created_at: string
          data_emitere: string | null
          data_expirare: string | null
          id: string
          include_tva: boolean | null
          numar_oferta: string
          observatii: string | null
          status: string | null
          status_oferta: string | null
          total_cu_tva: number
          total_fara_tva: number
          total_tva: number
          tva_procent: number | null
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          data_emitere?: string | null
          data_expirare?: string | null
          id?: string
          include_tva?: boolean | null
          numar_oferta: string
          observatii?: string | null
          status?: string | null
          status_oferta?: string | null
          total_cu_tva?: number
          total_fara_tva?: number
          total_tva?: number
          tva_procent?: number | null
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          data_emitere?: string | null
          data_expirare?: string | null
          id?: string
          include_tva?: boolean | null
          numar_oferta?: string
          observatii?: string | null
          status?: string | null
          status_oferta?: string | null
          total_cu_tva?: number
          total_fara_tva?: number
          total_tva?: number
          tva_procent?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lre_oferte_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "lre_clienti"
            referencedColumns: ["id"]
          },
        ]
      }
      lre_plati: {
        Row: {
          client_id: string | null
          created_at: string
          data_plata: string | null
          factura_id: string | null
          id: string
          mod_plata: string | null
          numar_tranzactie: string | null
          observatii: string | null
          suma: number
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          data_plata?: string | null
          factura_id?: string | null
          id?: string
          mod_plata?: string | null
          numar_tranzactie?: string | null
          observatii?: string | null
          suma: number
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          data_plata?: string | null
          factura_id?: string | null
          id?: string
          mod_plata?: string | null
          numar_tranzactie?: string | null
          observatii?: string | null
          suma?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lre_plati_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "lre_clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lre_plati_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "lre_facturi"
            referencedColumns: ["id"]
          },
        ]
      }
      lre_programari: {
        Row: {
          client_id: string | null
          created_at: string
          data_programare: string
          durata_minute: number | null
          id: string
          note_tehnice: string | null
          observatii: string | null
          pret_final: number | null
          serviciu_id: string | null
          status: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          data_programare: string
          durata_minute?: number | null
          id?: string
          note_tehnice?: string | null
          observatii?: string | null
          pret_final?: number | null
          serviciu_id?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          data_programare?: string
          durata_minute?: number | null
          id?: string
          note_tehnice?: string | null
          observatii?: string | null
          pret_final?: number | null
          serviciu_id?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lre_programari_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "lre_clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lre_programari_serviciu_id_fkey"
            columns: ["serviciu_id"]
            isOneToOne: false
            referencedRelation: "lre_servicii"
            referencedColumns: ["id"]
          },
        ]
      }
      lre_progres_lucrari: {
        Row: {
          created_at: string | null
          data_intrare: string
          descriere_progres: string
          id: string
          lucrare_id: string
          observatii: string | null
          ore_lucrate: number | null
          procent_completat: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data_intrare?: string
          descriere_progres: string
          id?: string
          lucrare_id: string
          observatii?: string | null
          ore_lucrate?: number | null
          procent_completat?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data_intrare?: string
          descriere_progres?: string
          id?: string
          lucrare_id?: string
          observatii?: string | null
          ore_lucrate?: number | null
          procent_completat?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lre_progres_lucrari_lucrare_id_fkey"
            columns: ["lucrare_id"]
            isOneToOne: false
            referencedRelation: "lre_lucrari"
            referencedColumns: ["id"]
          },
        ]
      }
      lre_purchase_orders: {
        Row: {
          created_at: string
          currency: string | null
          delivery_date: string | null
          expected_date: string | null
          id: string
          location_id: string | null
          notes: string | null
          order_date: string | null
          order_number: string
          payment_terms: number | null
          status: string | null
          subtotal: number | null
          supplier_id: string
          tax_amount: number | null
          total_amount: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          currency?: string | null
          delivery_date?: string | null
          expected_date?: string | null
          id?: string
          location_id?: string | null
          notes?: string | null
          order_date?: string | null
          order_number: string
          payment_terms?: number | null
          status?: string | null
          subtotal?: number | null
          supplier_id: string
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          currency?: string | null
          delivery_date?: string | null
          expected_date?: string | null
          id?: string
          location_id?: string | null
          notes?: string | null
          order_date?: string | null
          order_number?: string
          payment_terms?: number | null
          status?: string | null
          subtotal?: number | null
          supplier_id?: string
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "inventory_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "lre_inventory_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      lre_servicii: {
        Row: {
          activ: boolean | null
          categorie: string | null
          created_at: string
          descriere: string | null
          durata_estimata: number | null
          id: string
          nume: string
          pret_standard: number
          updated_at: string
        }
        Insert: {
          activ?: boolean | null
          categorie?: string | null
          created_at?: string
          descriere?: string | null
          durata_estimata?: number | null
          id?: string
          nume: string
          pret_standard?: number
          updated_at?: string
        }
        Update: {
          activ?: boolean | null
          categorie?: string | null
          created_at?: string
          descriere?: string | null
          durata_estimata?: number | null
          id?: string
          nume?: string
          pret_standard?: number
          updated_at?: string
        }
        Relationships: []
      }
      lre_venituri: {
        Row: {
          categorie: string
          created_at: string | null
          data_tranzactie: string
          descriere: string | null
          id: string
          suma: number
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          categorie: string
          created_at?: string | null
          data_tranzactie?: string
          descriere?: string | null
          id?: string
          suma: number
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          categorie?: string
          created_at?: string | null
          data_tranzactie?: string
          descriere?: string | null
          id?: string
          suma?: number
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
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
      paleti_entries: {
        Row: {
          created_at: string
          created_by_user: string | null
          data_operatie: string
          id: string
          numar_inmatriculare: string | null
          numar_paleti: number
          nume_firma: string
          nume_sofer: string | null
          observatii: string | null
          ora_operatie: string
          tip_operatie: string
          tip_paleti_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_user?: string | null
          data_operatie?: string
          id?: string
          numar_inmatriculare?: string | null
          numar_paleti: number
          nume_firma: string
          nume_sofer?: string | null
          observatii?: string | null
          ora_operatie?: string
          tip_operatie: string
          tip_paleti_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user?: string | null
          data_operatie?: string
          id?: string
          numar_inmatriculare?: string | null
          numar_paleti?: number
          nume_firma?: string
          nume_sofer?: string | null
          observatii?: string | null
          ora_operatie?: string
          tip_operatie?: string
          tip_paleti_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "paleti_entries_tip_paleti_id_fkey"
            columns: ["tip_paleti_id"]
            isOneToOne: false
            referencedRelation: "tip_paleti"
            referencedColumns: ["id"]
          },
        ]
      }
      picking_produse: {
        Row: {
          cantitate_comandata: number
          cantitate_lipsa: number | null
          cantitate_numarata: number | null
          created_at: string
          id: string
          nume_produs: string
          observatii: string | null
          produs_id: string
          sesiune_id: string
          sesiune_lucru_id: string
          status: string
          unitate_masura: string
          updated_at: string
        }
        Insert: {
          cantitate_comandata: number
          cantitate_lipsa?: number | null
          cantitate_numarata?: number | null
          created_at?: string
          id?: string
          nume_produs: string
          observatii?: string | null
          produs_id: string
          sesiune_id: string
          sesiune_lucru_id: string
          status?: string
          unitate_masura: string
          updated_at?: string
        }
        Update: {
          cantitate_comandata?: number
          cantitate_lipsa?: number | null
          cantitate_numarata?: number | null
          created_at?: string
          id?: string
          nume_produs?: string
          observatii?: string | null
          produs_id?: string
          sesiune_id?: string
          sesiune_lucru_id?: string
          status?: string
          unitate_masura?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "picking_produse_sesiune_id_fkey"
            columns: ["sesiune_id"]
            isOneToOne: false
            referencedRelation: "picking_sesiuni"
            referencedColumns: ["id"]
          },
        ]
      }
      picking_sesiuni: {
        Row: {
          created_at: string
          data_sesiune: string
          id: string
          magazin: string
          operator_nume: string
          punct_livrare: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_sesiune?: string
          id?: string
          magazin: string
          operator_nume: string
          punct_livrare: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_sesiune?: string
          id?: string
          magazin?: string
          operator_nume?: string
          punct_livrare?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      pontaj_leave_conflicts: {
        Row: {
          actiune_luata: string
          angajat_id: string | null
          concediu_id: string | null
          created_at: string | null
          data_conflict: string
          id: string
          pontaj_id: string | null
          tip_concediu: string
        }
        Insert: {
          actiune_luata: string
          angajat_id?: string | null
          concediu_id?: string | null
          created_at?: string | null
          data_conflict: string
          id?: string
          pontaj_id?: string | null
          tip_concediu: string
        }
        Update: {
          actiune_luata?: string
          angajat_id?: string | null
          concediu_id?: string | null
          created_at?: string | null
          data_conflict?: string
          id?: string
          pontaj_id?: string | null
          tip_concediu?: string
        }
        Relationships: [
          {
            foreignKeyName: "pontaj_leave_conflicts_angajat_id_fkey"
            columns: ["angajat_id"]
            isOneToOne: false
            referencedRelation: "angajati_sistem_pontaj"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontaj_leave_conflicts_pontaj_id_fkey"
            columns: ["pontaj_id"]
            isOneToOne: false
            referencedRelation: "pontaje"
            referencedColumns: ["id"]
          },
        ]
      }
      pontaje: {
        Row: {
          angajat_id: string
          created_at: string
          data: string
          dispozitiv: string | null
          id: string
          nume: string | null
          ora_inregistrare: string
          tip: string
        }
        Insert: {
          angajat_id: string
          created_at?: string
          data?: string
          dispozitiv?: string | null
          id?: string
          nume?: string | null
          ora_inregistrare?: string
          tip: string
        }
        Update: {
          angajat_id?: string
          created_at?: string
          data?: string
          dispozitiv?: string | null
          id?: string
          nume?: string | null
          ora_inregistrare?: string
          tip?: string
        }
        Relationships: [
          {
            foreignKeyName: "pontaje_angajat_id_fkey"
            columns: ["angajat_id"]
            isOneToOne: false
            referencedRelation: "angajati_sistem_pontaj"
            referencedColumns: ["id"]
          },
        ]
      }
      portari_accounts: {
        Row: {
          activ: boolean
          created_at: string
          id: string
          nume_complet: string
          password_hash: string
          updated_at: string
          username: string
        }
        Insert: {
          activ?: boolean
          created_at?: string
          id?: string
          nume_complet: string
          password_hash: string
          updated_at?: string
          username: string
        }
        Update: {
          activ?: boolean
          created_at?: string
          id?: string
          nume_complet?: string
          password_hash?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      product_order_settings: {
        Row: {
          created_at: string
          id: string
          lead_time_days: number
          min_order_quantity: number
          product_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_time_days?: number
          min_order_quantity?: number
          product_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_time_days?: number
          min_order_quantity?: number
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_order_settings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      productie_clienti: {
        Row: {
          adresa: string | null
          created_at: string
          email: string | null
          id: string
          nume_magazin: string
          punct_livrare: string
          telefon: string | null
          updated_at: string
          zona_livrare_id: string | null
        }
        Insert: {
          adresa?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nume_magazin: string
          punct_livrare: string
          telefon?: string | null
          updated_at?: string
          zona_livrare_id?: string | null
        }
        Update: {
          adresa?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nume_magazin?: string
          punct_livrare?: string
          telefon?: string | null
          updated_at?: string
          zona_livrare_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "productie_clienti_zona_livrare_id_fkey"
            columns: ["zona_livrare_id"]
            isOneToOne: false
            referencedRelation: "productie_zone_livrare"
            referencedColumns: ["id"]
          },
        ]
      }
      productie_comenzi: {
        Row: {
          baxare: string | null
          cantitate: number
          cantitate_din_restock: number | null
          cantitate_reala_produsa: number | null
          created_at: string
          id: string
          linie_id: string | null
          magazin: string
          numar_comanda: string
          produs_id: string | null
          punct_livrare: string
          status: string
          tip_comanda: string | null
          updated_at: string
        }
        Insert: {
          baxare?: string | null
          cantitate: number
          cantitate_din_restock?: number | null
          cantitate_reala_produsa?: number | null
          created_at?: string
          id?: string
          linie_id?: string | null
          magazin: string
          numar_comanda: string
          produs_id?: string | null
          punct_livrare: string
          status?: string
          tip_comanda?: string | null
          updated_at?: string
        }
        Update: {
          baxare?: string | null
          cantitate?: number
          cantitate_din_restock?: number | null
          cantitate_reala_produsa?: number | null
          created_at?: string
          id?: string
          linie_id?: string | null
          magazin?: string
          numar_comanda?: string
          produs_id?: string | null
          punct_livrare?: string
          status?: string
          tip_comanda?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "productie_comenzi_linie_id_fkey"
            columns: ["linie_id"]
            isOneToOne: false
            referencedRelation: "productie_linii"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productie_comenzi_produs_id_fkey"
            columns: ["produs_id"]
            isOneToOne: false
            referencedRelation: "productie_produse"
            referencedColumns: ["id"]
          },
        ]
      }
      productie_comenzi_ingrediente: {
        Row: {
          cantitate_necesara: number
          comanda_id: string
          created_at: string
          id: string
          ingredient_custom_nume: string | null
          ingredient_id: string | null
          observatii: string | null
          unitate_masura: string
          updated_at: string
        }
        Insert: {
          cantitate_necesara?: number
          comanda_id: string
          created_at?: string
          id?: string
          ingredient_custom_nume?: string | null
          ingredient_id?: string | null
          observatii?: string | null
          unitate_masura?: string
          updated_at?: string
        }
        Update: {
          cantitate_necesara?: number
          comanda_id?: string
          created_at?: string
          id?: string
          ingredient_custom_nume?: string | null
          ingredient_id?: string | null
          observatii?: string | null
          unitate_masura?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "productie_comenzi_ingrediente_comanda_id_fkey"
            columns: ["comanda_id"]
            isOneToOne: false
            referencedRelation: "productie_comenzi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productie_comenzi_ingrediente_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "productie_ingrediente"
            referencedColumns: ["id"]
          },
        ]
      }
      productie_ingrediente: {
        Row: {
          created_at: string
          descriere: string | null
          id: string
          nume: string
          unitate_masura: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descriere?: string | null
          id?: string
          nume: string
          unitate_masura?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descriere?: string | null
          id?: string
          nume?: string
          unitate_masura?: string
          updated_at?: string
        }
        Relationships: []
      }
      productie_linii: {
        Row: {
          capacitate_ora: number
          created_at: string
          id: string
          nume: string
          status: string
          updated_at: string
        }
        Insert: {
          capacitate_ora?: number
          created_at?: string
          id?: string
          nume: string
          status?: string
          updated_at?: string
        }
        Update: {
          capacitate_ora?: number
          created_at?: string
          id?: string
          nume?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      productie_picking_alocari: {
        Row: {
          cantitate_alocata: number
          comanda_id: string
          created_at: string
          id: string
          numar_paleti: number | null
          observatii: string | null
          operator_nume: string
          sesiune_lucru_id: string
          status: string
          updated_at: string
        }
        Insert: {
          cantitate_alocata: number
          comanda_id: string
          created_at?: string
          id?: string
          numar_paleti?: number | null
          observatii?: string | null
          operator_nume: string
          sesiune_lucru_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          cantitate_alocata?: number
          comanda_id?: string
          created_at?: string
          id?: string
          numar_paleti?: number | null
          observatii?: string | null
          operator_nume?: string
          sesiune_lucru_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "productie_picking_alocari_comanda_id_fkey"
            columns: ["comanda_id"]
            isOneToOne: false
            referencedRelation: "productie_comenzi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productie_picking_alocari_sesiune_lucru_id_fkey"
            columns: ["sesiune_lucru_id"]
            isOneToOne: false
            referencedRelation: "productie_sesiuni_lucru"
            referencedColumns: ["id"]
          },
        ]
      }
      productie_picking_daily_records: {
        Row: {
          created_at: string
          data_record: string
          id: string
          observatii: string | null
          operator_nume: string
          ora_inceput: string | null
          ora_sfarsit: string | null
          total_cantitate_ambalata: number
          total_cantitate_preluata: number
          total_cantitate_restocata: number
          total_comenzi_procesate: number
          total_paleti_creati: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_record?: string
          id?: string
          observatii?: string | null
          operator_nume: string
          ora_inceput?: string | null
          ora_sfarsit?: string | null
          total_cantitate_ambalata?: number
          total_cantitate_preluata?: number
          total_cantitate_restocata?: number
          total_comenzi_procesate?: number
          total_paleti_creati?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_record?: string
          id?: string
          observatii?: string | null
          operator_nume?: string
          ora_inceput?: string | null
          ora_sfarsit?: string | null
          total_cantitate_ambalata?: number
          total_cantitate_preluata?: number
          total_cantitate_restocata?: number
          total_comenzi_procesate?: number
          total_paleti_creati?: number
          updated_at?: string
        }
        Relationships: []
      }
      productie_picking_orders: {
        Row: {
          cantitate_ambalata: number
          cantitate_preluata: number
          cantitate_restocata: number
          comanda_id: string
          created_at: string
          id: string
          numar_paleti: number
          observatii: string | null
          picking_session_id: string
          status: string
          updated_at: string
        }
        Insert: {
          cantitate_ambalata?: number
          cantitate_preluata?: number
          cantitate_restocata?: number
          comanda_id: string
          created_at?: string
          id?: string
          numar_paleti?: number
          observatii?: string | null
          picking_session_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          cantitate_ambalata?: number
          cantitate_preluata?: number
          cantitate_restocata?: number
          comanda_id?: string
          created_at?: string
          id?: string
          numar_paleti?: number
          observatii?: string | null
          picking_session_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "productie_picking_orders_comanda_id_fkey"
            columns: ["comanda_id"]
            isOneToOne: false
            referencedRelation: "productie_comenzi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productie_picking_orders_picking_session_id_fkey"
            columns: ["picking_session_id"]
            isOneToOne: false
            referencedRelation: "productie_picking_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      productie_picking_pallets: {
        Row: {
          cantitate_pe_palet: number
          created_at: string
          destinatie: string | null
          id: string
          numar_palet: string
          observatii: string | null
          picking_order_id: string
          status: string
          tip_ambalare: string | null
          updated_at: string
        }
        Insert: {
          cantitate_pe_palet?: number
          created_at?: string
          destinatie?: string | null
          id?: string
          numar_palet: string
          observatii?: string | null
          picking_order_id: string
          status?: string
          tip_ambalare?: string | null
          updated_at?: string
        }
        Update: {
          cantitate_pe_palet?: number
          created_at?: string
          destinatie?: string | null
          id?: string
          numar_palet?: string
          observatii?: string | null
          picking_order_id?: string
          status?: string
          tip_ambalare?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "productie_picking_pallets_picking_order_id_fkey"
            columns: ["picking_order_id"]
            isOneToOne: false
            referencedRelation: "productie_picking_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      productie_picking_sessions: {
        Row: {
          created_at: string
          data_picking: string
          id: string
          observatii: string | null
          operator_nume: string
          ora_inceput: string
          ora_sfarsit: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_picking?: string
          id?: string
          observatii?: string | null
          operator_nume: string
          ora_inceput?: string
          ora_sfarsit?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_picking?: string
          id?: string
          observatii?: string | null
          operator_nume?: string
          ora_inceput?: string
          ora_sfarsit?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      productie_productivitate: {
        Row: {
          cantitate_produsa: number
          created_at: string
          data_lucru: string
          id: string
          linie_id: string | null
          nume_operator: string
          productivitate_bucati_minut: number | null
          productivitate_bucati_ora: number | null
          produs_id: string | null
          sesiune_id: string | null
          timp_lucru_minute: number
        }
        Insert: {
          cantitate_produsa: number
          created_at?: string
          data_lucru?: string
          id?: string
          linie_id?: string | null
          nume_operator: string
          productivitate_bucati_minut?: number | null
          productivitate_bucati_ora?: number | null
          produs_id?: string | null
          sesiune_id?: string | null
          timp_lucru_minute: number
        }
        Update: {
          cantitate_produsa?: number
          created_at?: string
          data_lucru?: string
          id?: string
          linie_id?: string | null
          nume_operator?: string
          productivitate_bucati_minut?: number | null
          productivitate_bucati_ora?: number | null
          produs_id?: string | null
          sesiune_id?: string | null
          timp_lucru_minute?: number
        }
        Relationships: [
          {
            foreignKeyName: "productie_productivitate_linie_id_fkey"
            columns: ["linie_id"]
            isOneToOne: false
            referencedRelation: "productie_linii"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productie_productivitate_produs_id_fkey"
            columns: ["produs_id"]
            isOneToOne: false
            referencedRelation: "productie_produse"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productie_productivitate_sesiune_id_fkey"
            columns: ["sesiune_id"]
            isOneToOne: false
            referencedRelation: "productie_sesiuni_lucru"
            referencedColumns: ["id"]
          },
        ]
      }
      productie_produse: {
        Row: {
          created_at: string
          descriere: string | null
          id: string
          nume: string
          unitate_masura: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descriere?: string | null
          id?: string
          nume: string
          unitate_masura?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descriere?: string | null
          id?: string
          nume?: string
          unitate_masura?: string
          updated_at?: string
        }
        Relationships: []
      }
      productie_profiles: {
        Row: {
          aprobat: boolean
          aprobat_de: string | null
          created_at: string
          data_aprobare: string | null
          id: string
          nume: string
          observatii_aprobare: string | null
          rol: string
          updated_at: string
        }
        Insert: {
          aprobat?: boolean
          aprobat_de?: string | null
          created_at?: string
          data_aprobare?: string | null
          id: string
          nume: string
          observatii_aprobare?: string | null
          rol?: string
          updated_at?: string
        }
        Update: {
          aprobat?: boolean
          aprobat_de?: string | null
          created_at?: string
          data_aprobare?: string | null
          id?: string
          nume?: string
          observatii_aprobare?: string | null
          rol?: string
          updated_at?: string
        }
        Relationships: []
      }
      productie_reguli_distribuire: {
        Row: {
          created_at: string
          id: string
          linie_preferata_id: string | null
          prioritate: number
          produs_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          linie_preferata_id?: string | null
          prioritate?: number
          produs_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          linie_preferata_id?: string | null
          prioritate?: number
          produs_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "productie_reguli_distribuire_linie_preferata_id_fkey"
            columns: ["linie_preferata_id"]
            isOneToOne: false
            referencedRelation: "productie_linii"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productie_reguli_distribuire_produs_id_fkey"
            columns: ["produs_id"]
            isOneToOne: false
            referencedRelation: "productie_produse"
            referencedColumns: ["id"]
          },
        ]
      }
      productie_restocari: {
        Row: {
          cantitate_surplus: number
          comanda_originala_id: string | null
          created_at: string
          data_productie: string
          id: string
          produs_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          cantitate_surplus?: number
          comanda_originala_id?: string | null
          created_at?: string
          data_productie?: string
          id?: string
          produs_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          cantitate_surplus?: number
          comanda_originala_id?: string | null
          created_at?: string
          data_productie?: string
          id?: string
          produs_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "productie_restocari_comanda_originala_id_fkey"
            columns: ["comanda_originala_id"]
            isOneToOne: false
            referencedRelation: "productie_comenzi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productie_restocari_produs_id_fkey"
            columns: ["produs_id"]
            isOneToOne: false
            referencedRelation: "productie_produse"
            referencedColumns: ["id"]
          },
        ]
      }
      productie_restocking: {
        Row: {
          cantitate_restocata: number
          comanda_noua_id: string | null
          comanda_originala_id: string
          created_at: string
          data_restocking: string
          id: string
          motiv: string
          observatii: string | null
          operator_nume: string
          produs_id: string
          status: string
          updated_at: string
        }
        Insert: {
          cantitate_restocata?: number
          comanda_noua_id?: string | null
          comanda_originala_id: string
          created_at?: string
          data_restocking?: string
          id?: string
          motiv: string
          observatii?: string | null
          operator_nume: string
          produs_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          cantitate_restocata?: number
          comanda_noua_id?: string | null
          comanda_originala_id?: string
          created_at?: string
          data_restocking?: string
          id?: string
          motiv?: string
          observatii?: string | null
          operator_nume?: string
          produs_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "productie_restocking_comanda_noua_id_fkey"
            columns: ["comanda_noua_id"]
            isOneToOne: false
            referencedRelation: "productie_comenzi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productie_restocking_comanda_originala_id_fkey"
            columns: ["comanda_originala_id"]
            isOneToOne: false
            referencedRelation: "productie_comenzi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productie_restocking_produs_id_fkey"
            columns: ["produs_id"]
            isOneToOne: false
            referencedRelation: "productie_produse"
            referencedColumns: ["id"]
          },
        ]
      }
      productie_retete: {
        Row: {
          activa: boolean
          created_at: string
          descriere: string | null
          id: string
          nume_reteta: string
          produs_id: string
          updated_at: string
          versiune: number
        }
        Insert: {
          activa?: boolean
          created_at?: string
          descriere?: string | null
          id?: string
          nume_reteta: string
          produs_id: string
          updated_at?: string
          versiune?: number
        }
        Update: {
          activa?: boolean
          created_at?: string
          descriere?: string | null
          id?: string
          nume_reteta?: string
          produs_id?: string
          updated_at?: string
          versiune?: number
        }
        Relationships: [
          {
            foreignKeyName: "productie_retete_produs_id_fkey"
            columns: ["produs_id"]
            isOneToOne: false
            referencedRelation: "productie_produse"
            referencedColumns: ["id"]
          },
        ]
      }
      productie_retete_ingrediente: {
        Row: {
          cantitate_necesara: number
          created_at: string
          id: string
          ingredient_id: string
          observatii: string | null
          reteta_id: string
          unitate_masura: string
        }
        Insert: {
          cantitate_necesara: number
          created_at?: string
          id?: string
          ingredient_id: string
          observatii?: string | null
          reteta_id: string
          unitate_masura?: string
        }
        Update: {
          cantitate_necesara?: number
          created_at?: string
          id?: string
          ingredient_id?: string
          observatii?: string | null
          reteta_id?: string
          unitate_masura?: string
        }
        Relationships: [
          {
            foreignKeyName: "productie_retete_ingrediente_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "productie_ingrediente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productie_retete_ingrediente_reteta_id_fkey"
            columns: ["reteta_id"]
            isOneToOne: false
            referencedRelation: "productie_retete"
            referencedColumns: ["id"]
          },
        ]
      }
      productie_schimburi: {
        Row: {
          created_at: string
          id: string
          nume: string
          ora_sfarsit: string
          ora_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          nume: string
          ora_sfarsit: string
          ora_start: string
        }
        Update: {
          created_at?: string
          id?: string
          nume?: string
          ora_sfarsit?: string
          ora_start?: string
        }
        Relationships: []
      }
      productie_sesiuni_lucru: {
        Row: {
          cantitate_produsa: number | null
          comanda_id: string | null
          created_at: string
          id: string
          linie_id: string | null
          numar_angajati: number
          nume_operator: string
          ora_sfarsit: string | null
          ora_start: string
          status: string
          updated_at: string
        }
        Insert: {
          cantitate_produsa?: number | null
          comanda_id?: string | null
          created_at?: string
          id?: string
          linie_id?: string | null
          numar_angajati?: number
          nume_operator: string
          ora_sfarsit?: string | null
          ora_start?: string
          status?: string
          updated_at?: string
        }
        Update: {
          cantitate_produsa?: number | null
          comanda_id?: string | null
          created_at?: string
          id?: string
          linie_id?: string | null
          numar_angajati?: number
          nume_operator?: string
          ora_sfarsit?: string | null
          ora_start?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "productie_sesiuni_lucru_comanda_id_fkey"
            columns: ["comanda_id"]
            isOneToOne: false
            referencedRelation: "productie_comenzi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productie_sesiuni_lucru_linie_id_fkey"
            columns: ["linie_id"]
            isOneToOne: false
            referencedRelation: "productie_linii"
            referencedColumns: ["id"]
          },
        ]
      }
      productie_zone_livrare: {
        Row: {
          created_at: string
          culoare: string | null
          descriere: string | null
          id: string
          nume_zona: string
          ora_limita_plecare: string | null
          prioritate: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          culoare?: string | null
          descriere?: string | null
          id?: string
          nume_zona: string
          ora_limita_plecare?: string | null
          prioritate?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          culoare?: string | null
          descriere?: string | null
          id?: string
          nume_zona?: string
          ora_limita_plecare?: string | null
          prioritate?: number
          updated_at?: string
        }
        Relationships: []
      }
      production_stock: {
        Row: {
          created_at: string
          document_number: string | null
          id: string
          inventory_item_id: string | null
          lot_number: string | null
          manufacturer_id: string | null
          name: string
          product_id: string | null
          quantity: number
          supplier_id: string | null
          transfer_date: string
          transfer_id: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          document_number?: string | null
          id?: string
          inventory_item_id?: string | null
          lot_number?: string | null
          manufacturer_id?: string | null
          name: string
          product_id?: string | null
          quantity?: number
          supplier_id?: string | null
          transfer_date?: string
          transfer_id?: string | null
          unit: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          document_number?: string | null
          id?: string
          inventory_item_id?: string | null
          lot_number?: string | null
          manufacturer_id?: string | null
          name?: string
          product_id?: string | null
          quantity?: number
          supplier_id?: string | null
          transfer_date?: string
          transfer_id?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_stock_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_stock_manufacturer_id_fkey"
            columns: ["manufacturer_id"]
            isOneToOne: false
            referencedRelation: "manufacturers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_stock_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_stock_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "stock_transfer_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_stock_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "stock_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      production_stock_history: {
        Row: {
          action: string
          created_at: string
          id: string
          notes: string | null
          previous_quantity: number | null
          production_stock_id: string | null
          quantity: number
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          notes?: string | null
          previous_quantity?: number | null
          production_stock_id?: string | null
          quantity: number
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          notes?: string | null
          previous_quantity?: number | null
          production_stock_id?: string | null
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "production_stock_history_production_stock_id_fkey"
            columns: ["production_stock_id"]
            isOneToOne: false
            referencedRelation: "production_stock"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          cod_produs: string | null
          created_at: string
          default_unit: string
          description: string | null
          id: string
          name: string
          pt_percent: number
          updated_at: string
        }
        Insert: {
          cod_produs?: string | null
          created_at?: string
          default_unit?: string
          description?: string | null
          id?: string
          name: string
          pt_percent?: number
          updated_at?: string
        }
        Update: {
          cod_produs?: string | null
          created_at?: string
          default_unit?: string
          description?: string | null
          id?: string
          name?: string
          pt_percent?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          nume: string | null
          rol: string
        }
        Insert: {
          created_at?: string
          id: string
          nume?: string | null
          rol?: string
        }
        Update: {
          created_at?: string
          id?: string
          nume?: string | null
          rol?: string
        }
        Relationships: []
      }
      purchase_order_items: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          product_id: string
          purchase_order_id: string | null
          quantity: number
          received_quantity: number | null
          total_price: number | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          product_id: string
          purchase_order_id?: string | null
          quantity: number
          received_quantity?: number | null
          total_price?: number | null
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          product_id?: string
          purchase_order_id?: string | null
          quantity?: number
          received_quantity?: number | null
          total_price?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "lre_inventory_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "lre_purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      reception_records: {
        Row: {
          consider_quantity: number | null
          crate_count: number | null
          crate_type_id: string | null
          crate_weight: number | null
          created_at: string
          document_number: string | null
          entry_number: number
          gross_quantity: number | null
          id: string
          lot_number: string | null
          manufacturer_id: string | null
          name: string
          net_quantity: number | null
          nonconform_percent: number | null
          obs: string | null
          original_quantity: number
          product_id: string | null
          receipt_date: string
          supplier_id: string | null
          supplier_name: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          consider_quantity?: number | null
          crate_count?: number | null
          crate_type_id?: string | null
          crate_weight?: number | null
          created_at?: string
          document_number?: string | null
          entry_number?: number
          gross_quantity?: number | null
          id?: string
          lot_number?: string | null
          manufacturer_id?: string | null
          name: string
          net_quantity?: number | null
          nonconform_percent?: number | null
          obs?: string | null
          original_quantity?: number
          product_id?: string | null
          receipt_date?: string
          supplier_id?: string | null
          supplier_name?: string | null
          unit: string
          updated_at?: string
        }
        Update: {
          consider_quantity?: number | null
          crate_count?: number | null
          crate_type_id?: string | null
          crate_weight?: number | null
          created_at?: string
          document_number?: string | null
          entry_number?: number
          gross_quantity?: number | null
          id?: string
          lot_number?: string | null
          manufacturer_id?: string | null
          name?: string
          net_quantity?: number | null
          nonconform_percent?: number | null
          obs?: string | null
          original_quantity?: number
          product_id?: string | null
          receipt_date?: string
          supplier_id?: string | null
          supplier_name?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reception_records_crate_type_id_fkey"
            columns: ["crate_type_id"]
            isOneToOne: false
            referencedRelation: "crate_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reception_records_manufacturer_id_fkey"
            columns: ["manufacturer_id"]
            isOneToOne: false
            referencedRelation: "manufacturers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reception_records_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reception_records_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      receptions: {
        Row: {
          crate_count: number | null
          crate_type_id: string | null
          crate_weight: number | null
          created_at: string
          document_number: string | null
          entry_number: number
          gross_quantity: number | null
          id: string
          lot_number: string | null
          manufacturer_id: string | null
          name: string
          net_quantity: number | null
          product_id: string | null
          quantity: number
          receipt_date: string
          supplier_id: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          crate_count?: number | null
          crate_type_id?: string | null
          crate_weight?: number | null
          created_at?: string
          document_number?: string | null
          entry_number: number
          gross_quantity?: number | null
          id?: string
          lot_number?: string | null
          manufacturer_id?: string | null
          name: string
          net_quantity?: number | null
          product_id?: string | null
          quantity?: number
          receipt_date?: string
          supplier_id?: string | null
          unit: string
          updated_at?: string
        }
        Update: {
          crate_count?: number | null
          crate_type_id?: string | null
          crate_weight?: number | null
          created_at?: string
          document_number?: string | null
          entry_number?: number
          gross_quantity?: number | null
          id?: string
          lot_number?: string | null
          manufacturer_id?: string | null
          name?: string
          net_quantity?: number | null
          product_id?: string | null
          quantity?: number
          receipt_date?: string
          supplier_id?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receptions_crate_type_id_fkey"
            columns: ["crate_type_id"]
            isOneToOne: false
            referencedRelation: "crate_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receptions_manufacturer_id_fkey"
            columns: ["manufacturer_id"]
            isOneToOne: false
            referencedRelation: "manufacturers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receptions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receptions_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_items: {
        Row: {
          created_at: string
          delivered_quantity: number | null
          id: string
          notes: string | null
          product_id: string
          quantity: number
          sales_order_id: string | null
          total_price: number | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          delivered_quantity?: number | null
          id?: string
          notes?: string | null
          product_id: string
          quantity: number
          sales_order_id?: string | null
          total_price?: number | null
          unit_price: number
        }
        Update: {
          created_at?: string
          delivered_quantity?: number | null
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          sales_order_id?: string | null
          total_price?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "lre_inventory_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_items_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          created_at: string
          currency: string | null
          customer_address: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          delivery_date: string | null
          id: string
          location_id: string | null
          notes: string | null
          order_date: string | null
          order_number: string
          payment_status: string | null
          shipping_cost: number | null
          status: string | null
          subtotal: number | null
          tax_amount: number | null
          total_amount: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          currency?: string | null
          customer_address?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          delivery_date?: string | null
          id?: string
          location_id?: string | null
          notes?: string | null
          order_date?: string | null
          order_number: string
          payment_status?: string | null
          shipping_cost?: number | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          currency?: string | null
          customer_address?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          delivery_date?: string | null
          id?: string
          location_id?: string | null
          notes?: string | null
          order_date?: string | null
          order_number?: string
          payment_status?: string | null
          shipping_cost?: number | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "inventory_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      simlash_categorii_cheltuieli: {
        Row: {
          activ: boolean
          created_at: string
          descriere: string | null
          id: string
          nume: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          activ?: boolean
          created_at?: string
          descriere?: string | null
          id?: string
          nume: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          activ?: boolean
          created_at?: string
          descriere?: string | null
          id?: string
          nume?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      simlash_cheltuieli: {
        Row: {
          categorie: string
          created_at: string
          data_cheltuiala: string
          factura_url: string | null
          id: string
          nume: string
          observatii: string | null
          suma: number
          updated_at: string
          user_id: string
        }
        Insert: {
          categorie: string
          created_at?: string
          data_cheltuiala?: string
          factura_url?: string | null
          id?: string
          nume: string
          observatii?: string | null
          suma: number
          updated_at?: string
          user_id: string
        }
        Update: {
          categorie?: string
          created_at?: string
          data_cheltuiala?: string
          factura_url?: string | null
          id?: string
          nume?: string
          observatii?: string | null
          suma?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      simlash_clienti: {
        Row: {
          created_at: string
          data_nasterii: string | null
          email: string | null
          id: string
          nume: string
          observatii: string | null
          programari_anulate: number
          telefon: string | null
          total_programari: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data_nasterii?: string | null
          email?: string | null
          id?: string
          nume: string
          observatii?: string | null
          programari_anulate?: number
          telefon?: string | null
          total_programari?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data_nasterii?: string | null
          email?: string | null
          id?: string
          nume?: string
          observatii?: string | null
          programari_anulate?: number
          telefon?: string | null
          total_programari?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      simlash_profiles: {
        Row: {
          adresa: string | null
          created_at: string
          email: string | null
          id: string
          nume_proprietar: string
          nume_salon: string
          specializari: string[] | null
          telefon: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          adresa?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nume_proprietar: string
          nume_salon: string
          specializari?: string[] | null
          telefon?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          adresa?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nume_proprietar?: string
          nume_salon?: string
          specializari?: string[] | null
          telefon?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      simlash_programari: {
        Row: {
          client_id: string
          created_at: string
          data_programare: string
          durata_minute: number
          id: string
          note_tehnician: string | null
          observatii: string | null
          observatii_tehnice: string | null
          pret: number
          produse_folosite: string | null
          recomandari: string | null
          serviciu_id: string
          starea_genelor: string | null
          status: string
          updated_at: string
          urmatoarea_intretinere: string | null
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          data_programare: string
          durata_minute: number
          id?: string
          note_tehnician?: string | null
          observatii?: string | null
          observatii_tehnice?: string | null
          pret: number
          produse_folosite?: string | null
          recomandari?: string | null
          serviciu_id: string
          starea_genelor?: string | null
          status?: string
          updated_at?: string
          urmatoarea_intretinere?: string | null
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          data_programare?: string
          durata_minute?: number
          id?: string
          note_tehnician?: string | null
          observatii?: string | null
          observatii_tehnice?: string | null
          pret?: number
          produse_folosite?: string | null
          recomandari?: string | null
          serviciu_id?: string
          starea_genelor?: string | null
          status?: string
          updated_at?: string
          urmatoarea_intretinere?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simlash_programari_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "simlash_clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simlash_programari_serviciu_id_fkey"
            columns: ["serviciu_id"]
            isOneToOne: false
            referencedRelation: "simlash_servicii"
            referencedColumns: ["id"]
          },
        ]
      }
      simlash_servicii: {
        Row: {
          activ: boolean
          categorie: string
          created_at: string
          descriere: string | null
          durata_minute: number
          id: string
          nume: string
          pret_standard: number
          updated_at: string
        }
        Insert: {
          activ?: boolean
          categorie: string
          created_at?: string
          descriere?: string | null
          durata_minute?: number
          id?: string
          nume: string
          pret_standard: number
          updated_at?: string
        }
        Update: {
          activ?: boolean
          categorie?: string
          created_at?: string
          descriere?: string | null
          durata_minute?: number
          id?: string
          nume?: string
          pret_standard?: number
          updated_at?: string
        }
        Relationships: []
      }
      simple_inventory_stock: {
        Row: {
          avg_purchase_price: number | null
          category: string
          created_at: string
          current_quantity: number
          id: string
          min_stock: number
          product_name: string
          purchase_price: number | null
          sale_price: number | null
          unit: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          avg_purchase_price?: number | null
          category: string
          created_at?: string
          current_quantity?: number
          id?: string
          min_stock?: number
          product_name: string
          purchase_price?: number | null
          sale_price?: number | null
          unit?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          avg_purchase_price?: number | null
          category?: string
          created_at?: string
          current_quantity?: number
          id?: string
          min_stock?: number
          product_name?: string
          purchase_price?: number | null
          sale_price?: number | null
          unit?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      simple_stock_consumption: {
        Row: {
          client_name: string
          consumption_date: string
          created_at: string
          id: string
          notes: string | null
          product_id: string | null
          product_name: string
          quantity_consumed: number
          unit: string
          user_id: string | null
        }
        Insert: {
          client_name: string
          consumption_date?: string
          created_at?: string
          id?: string
          notes?: string | null
          product_id?: string | null
          product_name: string
          quantity_consumed: number
          unit: string
          user_id?: string | null
        }
        Update: {
          client_name?: string
          consumption_date?: string
          created_at?: string
          id?: string
          notes?: string | null
          product_id?: string | null
          product_name?: string
          quantity_consumed?: number
          unit?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "simple_stock_consumption_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "simple_inventory_stock"
            referencedColumns: ["id"]
          },
        ]
      }
      simple_stock_receipts: {
        Row: {
          created_at: string
          document_number: string | null
          id: string
          notes: string | null
          product_id: string | null
          product_name: string
          purchase_price: number | null
          quantity_received: number
          receipt_date: string
          supplier: string | null
          total_value: number | null
          unit: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          document_number?: string | null
          id?: string
          notes?: string | null
          product_id?: string | null
          product_name: string
          purchase_price?: number | null
          quantity_received: number
          receipt_date?: string
          supplier?: string | null
          total_value?: number | null
          unit: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          document_number?: string | null
          id?: string
          notes?: string | null
          product_id?: string | null
          product_name?: string
          purchase_price?: number | null
          quantity_received?: number
          receipt_date?: string
          supplier?: string | null
          total_value?: number | null
          unit?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "simple_stock_receipts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "simple_inventory_stock"
            referencedColumns: ["id"]
          },
        ]
      }
      stoc_paleti: {
        Row: {
          id: string
          tip_paleti_id: string
          total_paleti: number
          updated_at: string
        }
        Insert: {
          id?: string
          tip_paleti_id: string
          total_paleti?: number
          updated_at?: string
        }
        Update: {
          id?: string
          tip_paleti_id?: string
          total_paleti?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stoc_paleti_tip_paleti_id_fkey"
            columns: ["tip_paleti_id"]
            isOneToOne: false
            referencedRelation: "tip_paleti"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "stock_transfer_items_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "stock_transfer_view"
            referencedColumns: ["id"]
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
          supplier_code: string | null
          updated_at: string
        }
        Insert: {
          contact?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          supplier_code?: string | null
          updated_at?: string
        }
        Update: {
          contact?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          supplier_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      taskkid_achievements: {
        Row: {
          conditie_valoare: number | null
          created_at: string | null
          culoare: string | null
          descriere: string
          icon: string
          id: string
          nume: string
          tip: string
        }
        Insert: {
          conditie_valoare?: number | null
          created_at?: string | null
          culoare?: string | null
          descriere: string
          icon: string
          id?: string
          nume: string
          tip: string
        }
        Update: {
          conditie_valoare?: number | null
          created_at?: string | null
          culoare?: string | null
          descriere?: string
          icon?: string
          id?: string
          nume?: string
          tip?: string
        }
        Relationships: []
      }
      taskkid_categories: {
        Row: {
          created_at: string | null
          culoare: string | null
          descriere: string | null
          id: string
          nume: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          culoare?: string | null
          descriere?: string | null
          id?: string
          nume: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          culoare?: string | null
          descriere?: string | null
          id?: string
          nume?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      taskkid_child_achievements: {
        Row: {
          achievement_id: string
          child_id: string
          data_obtinere: string | null
          id: string
        }
        Insert: {
          achievement_id: string
          child_id: string
          data_obtinere?: string | null
          id?: string
        }
        Update: {
          achievement_id?: string
          child_id?: string
          data_obtinere?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "taskkid_child_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "taskkid_achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      taskkid_children: {
        Row: {
          avatar_url: string | null
          bani_total: number | null
          child_email: string | null
          child_password_hash: string | null
          created_at: string | null
          culoare_favorita: string | null
          experienta: number | null
          id: string
          nivel: number | null
          nume_copil: string
          puncte_totale: number | null
          sold_disponibil_bani: number | null
          sold_disponibil_puncte: number | null
          streak_zilnic: number | null
          updated_at: string | null
          user_id: string
          varsta: number
        }
        Insert: {
          avatar_url?: string | null
          bani_total?: number | null
          child_email?: string | null
          child_password_hash?: string | null
          created_at?: string | null
          culoare_favorita?: string | null
          experienta?: number | null
          id?: string
          nivel?: number | null
          nume_copil: string
          puncte_totale?: number | null
          sold_disponibil_bani?: number | null
          sold_disponibil_puncte?: number | null
          streak_zilnic?: number | null
          updated_at?: string | null
          user_id: string
          varsta: number
        }
        Update: {
          avatar_url?: string | null
          bani_total?: number | null
          child_email?: string | null
          child_password_hash?: string | null
          created_at?: string | null
          culoare_favorita?: string | null
          experienta?: number | null
          id?: string
          nivel?: number | null
          nume_copil?: string
          puncte_totale?: number | null
          sold_disponibil_bani?: number | null
          sold_disponibil_puncte?: number | null
          streak_zilnic?: number | null
          updated_at?: string | null
          user_id?: string
          varsta?: number
        }
        Relationships: []
      }
      taskkid_family_settings: {
        Row: {
          created_at: string | null
          id: string
          limba: string | null
          mod_privat: boolean | null
          moneda: string | null
          notificari_email: boolean | null
          notificari_push: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          limba?: string | null
          mod_privat?: boolean | null
          moneda?: string | null
          notificari_email?: boolean | null
          notificari_push?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          limba?: string | null
          mod_privat?: boolean | null
          moneda?: string | null
          notificari_email?: boolean | null
          notificari_push?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "taskkid_family_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "taskkid_users"
            referencedColumns: ["id"]
          },
        ]
      }
      taskkid_history: {
        Row: {
          bani_castigati: number | null
          child_id: string
          confirmat_de_parinte: boolean | null
          data_completare: string | null
          id: string
          observatii: string | null
          puncte_castigate: number | null
          task_id: string
        }
        Insert: {
          bani_castigati?: number | null
          child_id: string
          confirmat_de_parinte?: boolean | null
          data_completare?: string | null
          id?: string
          observatii?: string | null
          puncte_castigate?: number | null
          task_id: string
        }
        Update: {
          bani_castigati?: number | null
          child_id?: string
          confirmat_de_parinte?: boolean | null
          data_completare?: string | null
          id?: string
          observatii?: string | null
          puncte_castigate?: number | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "taskkid_history_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "taskkid_children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "taskkid_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "taskkid_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      taskkid_notifications: {
        Row: {
          child_id: string | null
          citit: boolean | null
          created_at: string | null
          id: string
          mesaj: string
          task_id: string | null
          tip: string
          titlu: string
          user_id: string | null
        }
        Insert: {
          child_id?: string | null
          citit?: boolean | null
          created_at?: string | null
          id?: string
          mesaj: string
          task_id?: string | null
          tip: string
          titlu: string
          user_id?: string | null
        }
        Update: {
          child_id?: string | null
          citit?: boolean | null
          created_at?: string | null
          id?: string
          mesaj?: string
          task_id?: string | null
          tip?: string
          titlu?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "taskkid_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "taskkid_users"
            referencedColumns: ["id"]
          },
        ]
      }
      taskkid_payments: {
        Row: {
          child_id: string
          created_at: string
          data_plata: string
          id: string
          observatii: string | null
          suma_platita: number
          tip_plata: string
        }
        Insert: {
          child_id: string
          created_at?: string
          data_plata?: string
          id?: string
          observatii?: string | null
          suma_platita?: number
          tip_plata?: string
        }
        Update: {
          child_id?: string
          created_at?: string
          data_plata?: string
          id?: string
          observatii?: string | null
          suma_platita?: number
          tip_plata?: string
        }
        Relationships: [
          {
            foreignKeyName: "taskkid_payments_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "taskkid_children"
            referencedColumns: ["id"]
          },
        ]
      }
      taskkid_rewards: {
        Row: {
          child_id: string | null
          cost_bani: number | null
          cost_puncte: number | null
          created_at: string | null
          data_revendicare: string | null
          denumire: string
          descriere: string | null
          icon: string | null
          id: string
          status: string | null
          tip: string | null
          user_id: string | null
        }
        Insert: {
          child_id?: string | null
          cost_bani?: number | null
          cost_puncte?: number | null
          created_at?: string | null
          data_revendicare?: string | null
          denumire: string
          descriere?: string | null
          icon?: string | null
          id?: string
          status?: string | null
          tip?: string | null
          user_id?: string | null
        }
        Update: {
          child_id?: string | null
          cost_bani?: number | null
          cost_puncte?: number | null
          created_at?: string | null
          data_revendicare?: string | null
          denumire?: string
          descriere?: string | null
          icon?: string | null
          id?: string
          status?: string | null
          tip?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "taskkid_rewards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "taskkid_users"
            referencedColumns: ["id"]
          },
        ]
      }
      taskkid_tasks: {
        Row: {
          bani: number | null
          category_id: string | null
          child_id: string
          created_at: string | null
          deadline: string | null
          descriere: string | null
          dificultate: number | null
          id: string
          puncte: number | null
          recurring: string | null
          status: string | null
          timp_estimat: number | null
          titlu: string
          updated_at: string | null
        }
        Insert: {
          bani?: number | null
          category_id?: string | null
          child_id: string
          created_at?: string | null
          deadline?: string | null
          descriere?: string | null
          dificultate?: number | null
          id?: string
          puncte?: number | null
          recurring?: string | null
          status?: string | null
          timp_estimat?: number | null
          titlu: string
          updated_at?: string | null
        }
        Update: {
          bani?: number | null
          category_id?: string | null
          child_id?: string
          created_at?: string | null
          deadline?: string | null
          descriere?: string | null
          dificultate?: number | null
          id?: string
          puncte?: number | null
          recurring?: string | null
          status?: string | null
          timp_estimat?: number | null
          titlu?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "taskkid_tasks_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "taskkid_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "taskkid_tasks_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "taskkid_children"
            referencedColumns: ["id"]
          },
        ]
      }
      taskkid_users: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          id: string
          nume_parinte: string
          password_hash: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          id?: string
          nume_parinte: string
          password_hash: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          id?: string
          nume_parinte?: string
          password_hash?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      tip_paleti: {
        Row: {
          created_at: string
          descriere: string | null
          id: string
          nume: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descriere?: string | null
          id?: string
          nume: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descriere?: string | null
          id?: string
          nume?: string
          updated_at?: string
        }
        Relationships: []
      }
      vehicle_entries: {
        Row: {
          created_at: string
          created_by_user: string | null
          data_iesirii: string | null
          data_intrarii: string
          id: string
          numar_inmatriculare: string
          nume_persoana: string
          observatii: string | null
          ora_iesirii: string | null
          ora_intrarii: string
          tip_masina: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_user?: string | null
          data_iesirii?: string | null
          data_intrarii: string
          id?: string
          numar_inmatriculare: string
          nume_persoana: string
          observatii?: string | null
          ora_iesirii?: string | null
          ora_intrarii: string
          tip_masina: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user?: string | null
          data_iesirii?: string | null
          data_intrarii?: string
          id?: string
          numar_inmatriculare?: string
          nume_persoana?: string
          observatii?: string | null
          ora_iesirii?: string | null
          ora_intrarii?: string
          tip_masina?: string
          updated_at?: string
        }
        Relationships: []
      }
      wiremind_calendar_events: {
        Row: {
          client_id: string | null
          created_at: string
          data_inceput: string
          data_sfarsit: string
          descriere: string | null
          id: string
          notificare_minutes: number | null
          project_id: string | null
          status: string
          tip_eveniment: string
          titlu: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          data_inceput: string
          data_sfarsit: string
          descriere?: string | null
          id?: string
          notificare_minutes?: number | null
          project_id?: string | null
          status?: string
          tip_eveniment?: string
          titlu: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          data_inceput?: string
          data_sfarsit?: string
          descriere?: string | null
          id?: string
          notificare_minutes?: number | null
          project_id?: string | null
          status?: string
          tip_eveniment?: string
          titlu?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wiremind_calendar_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "wiremind_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wiremind_calendar_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "wiremind_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      wiremind_clienti: {
        Row: {
          adresa: string | null
          cod_postal: string | null
          created_at: string
          cui: string | null
          email: string | null
          id: string
          judet: string | null
          nr_reg_com: string | null
          nume_firma: string
          observatii: string | null
          oras: string | null
          persoana_contact: string | null
          telefon: string | null
          tip_client: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          adresa?: string | null
          cod_postal?: string | null
          created_at?: string
          cui?: string | null
          email?: string | null
          id?: string
          judet?: string | null
          nr_reg_com?: string | null
          nume_firma: string
          observatii?: string | null
          oras?: string | null
          persoana_contact?: string | null
          telefon?: string | null
          tip_client?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          adresa?: string | null
          cod_postal?: string | null
          created_at?: string
          cui?: string | null
          email?: string | null
          id?: string
          judet?: string | null
          nr_reg_com?: string | null
          nume_firma?: string
          observatii?: string | null
          oras?: string | null
          persoana_contact?: string | null
          telefon?: string | null
          tip_client?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wiremind_clients: {
        Row: {
          adresa_completa: string | null
          created_at: string
          cui: string | null
          email: string | null
          id: string
          nume: string
          observatii: string | null
          poze_urls: string[] | null
          telefon: string | null
          tip_client: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          adresa_completa?: string | null
          created_at?: string
          cui?: string | null
          email?: string | null
          id?: string
          nume: string
          observatii?: string | null
          poze_urls?: string[] | null
          telefon?: string | null
          tip_client?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          adresa_completa?: string | null
          created_at?: string
          cui?: string | null
          email?: string | null
          id?: string
          nume?: string
          observatii?: string | null
          poze_urls?: string[] | null
          telefon?: string | null
          tip_client?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      wiremind_deviz_pozitii: {
        Row: {
          cantitate: number
          created_at: string
          descriere: string
          deviz_id: string
          id: string
          pozitie_nr: number
          pret_unitar: number
          tip_pozitie: string | null
          unitate_masura: string | null
          valoare_totala: number
        }
        Insert: {
          cantitate: number
          created_at?: string
          descriere: string
          deviz_id: string
          id?: string
          pozitie_nr: number
          pret_unitar: number
          tip_pozitie?: string | null
          unitate_masura?: string | null
          valoare_totala: number
        }
        Update: {
          cantitate?: number
          created_at?: string
          descriere?: string
          deviz_id?: string
          id?: string
          pozitie_nr?: number
          pret_unitar?: number
          tip_pozitie?: string | null
          unitate_masura?: string | null
          valoare_totala?: number
        }
        Relationships: [
          {
            foreignKeyName: "wiremind_deviz_pozitii_deviz_id_fkey"
            columns: ["deviz_id"]
            isOneToOne: false
            referencedRelation: "wiremind_devize"
            referencedColumns: ["id"]
          },
        ]
      }
      wiremind_devize: {
        Row: {
          client_id: string | null
          created_at: string
          data_creare: string | null
          data_expirare: string | null
          denumire: string
          descriere: string | null
          id: string
          numar_deviz: string
          observatii: string | null
          proiect_id: string | null
          status: string | null
          tva_procent: number | null
          updated_at: string
          user_id: string
          valoare_finala: number | null
          valoare_manopera: number | null
          valoare_materiale: number | null
          valoare_totala: number | null
          valoare_transport: number | null
          valoare_tva: number | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          data_creare?: string | null
          data_expirare?: string | null
          denumire: string
          descriere?: string | null
          id?: string
          numar_deviz: string
          observatii?: string | null
          proiect_id?: string | null
          status?: string | null
          tva_procent?: number | null
          updated_at?: string
          user_id: string
          valoare_finala?: number | null
          valoare_manopera?: number | null
          valoare_materiale?: number | null
          valoare_totala?: number | null
          valoare_transport?: number | null
          valoare_tva?: number | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          data_creare?: string | null
          data_expirare?: string | null
          denumire?: string
          descriere?: string | null
          id?: string
          numar_deviz?: string
          observatii?: string | null
          proiect_id?: string | null
          status?: string | null
          tva_procent?: number | null
          updated_at?: string
          user_id?: string
          valoare_finala?: number | null
          valoare_manopera?: number | null
          valoare_materiale?: number | null
          valoare_totala?: number | null
          valoare_transport?: number | null
          valoare_tva?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wiremind_devize_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "wiremind_clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wiremind_devize_proiect_id_fkey"
            columns: ["proiect_id"]
            isOneToOne: false
            referencedRelation: "wiremind_proiecte"
            referencedColumns: ["id"]
          },
        ]
      }
      wiremind_invoices: {
        Row: {
          client_id: string | null
          created_at: string
          data_emitere: string
          data_scadenta: string | null
          id: string
          numar_factura: string
          observatii: string | null
          pdf_url: string | null
          project_id: string | null
          quote_id: string | null
          seria: string | null
          status_plata: string
          updated_at: string
          user_id: string | null
          valoare_neta: number
          valoare_totala: number
          valoare_tva: number
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          data_emitere?: string
          data_scadenta?: string | null
          id?: string
          numar_factura: string
          observatii?: string | null
          pdf_url?: string | null
          project_id?: string | null
          quote_id?: string | null
          seria?: string | null
          status_plata?: string
          updated_at?: string
          user_id?: string | null
          valoare_neta: number
          valoare_totala: number
          valoare_tva?: number
        }
        Update: {
          client_id?: string | null
          created_at?: string
          data_emitere?: string
          data_scadenta?: string | null
          id?: string
          numar_factura?: string
          observatii?: string | null
          pdf_url?: string | null
          project_id?: string | null
          quote_id?: string | null
          seria?: string | null
          status_plata?: string
          updated_at?: string
          user_id?: string | null
          valoare_neta?: number
          valoare_totala?: number
          valoare_tva?: number
        }
        Relationships: [
          {
            foreignKeyName: "wiremind_invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "wiremind_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wiremind_invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "wiremind_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wiremind_invoices_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "wiremind_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      wiremind_material_order_items: {
        Row: {
          cantitate: number
          created_at: string
          id: string
          material_id: string | null
          order_id: string | null
          pret_total: number
          pret_unitar: number
        }
        Insert: {
          cantitate: number
          created_at?: string
          id?: string
          material_id?: string | null
          order_id?: string | null
          pret_total: number
          pret_unitar: number
        }
        Update: {
          cantitate?: number
          created_at?: string
          id?: string
          material_id?: string | null
          order_id?: string | null
          pret_total?: number
          pret_unitar?: number
        }
        Relationships: [
          {
            foreignKeyName: "wiremind_material_order_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "wiremind_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wiremind_material_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "wiremind_material_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      wiremind_material_orders: {
        Row: {
          created_at: string
          data_comanda: string
          data_livrare_estimata: string | null
          id: string
          numar_comanda: string
          observatii: string | null
          status: string
          supplier_id: string | null
          updated_at: string
          user_id: string | null
          valoare_totala: number | null
        }
        Insert: {
          created_at?: string
          data_comanda?: string
          data_livrare_estimata?: string | null
          id?: string
          numar_comanda: string
          observatii?: string | null
          status?: string
          supplier_id?: string | null
          updated_at?: string
          user_id?: string | null
          valoare_totala?: number | null
        }
        Update: {
          created_at?: string
          data_comanda?: string
          data_livrare_estimata?: string | null
          id?: string
          numar_comanda?: string
          observatii?: string | null
          status?: string
          supplier_id?: string | null
          updated_at?: string
          user_id?: string | null
          valoare_totala?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wiremind_material_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "wiremind_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      wiremind_materiale: {
        Row: {
          activ: boolean | null
          categoria: string | null
          cod_material: string | null
          created_at: string
          denumire: string
          furnizor: string | null
          id: string
          observatii: string | null
          pret_unitar: number
          unitate_masura: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activ?: boolean | null
          categoria?: string | null
          cod_material?: string | null
          created_at?: string
          denumire: string
          furnizor?: string | null
          id?: string
          observatii?: string | null
          pret_unitar: number
          unitate_masura?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activ?: boolean | null
          categoria?: string | null
          cod_material?: string | null
          created_at?: string
          denumire?: string
          furnizor?: string | null
          id?: string
          observatii?: string | null
          pret_unitar?: number
          unitate_masura?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wiremind_materials: {
        Row: {
          activ: boolean | null
          categorie: string | null
          cod_produs: string | null
          created_at: string
          id: string
          nume_material: string
          observatii: string | null
          poza_url: string | null
          pret_achizitie: number | null
          pret_vanzare: number | null
          stoc_curent: number | null
          stoc_minim: number | null
          supplier_id: string | null
          unitate_masura: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          activ?: boolean | null
          categorie?: string | null
          cod_produs?: string | null
          created_at?: string
          id?: string
          nume_material: string
          observatii?: string | null
          poza_url?: string | null
          pret_achizitie?: number | null
          pret_vanzare?: number | null
          stoc_curent?: number | null
          stoc_minim?: number | null
          supplier_id?: string | null
          unitate_masura?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          activ?: boolean | null
          categorie?: string | null
          cod_produs?: string | null
          created_at?: string
          id?: string
          nume_material?: string
          observatii?: string | null
          poza_url?: string | null
          pret_achizitie?: number | null
          pret_vanzare?: number | null
          stoc_curent?: number | null
          stoc_minim?: number | null
          supplier_id?: string | null
          unitate_masura?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wiremind_materials_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "wiremind_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      wiremind_proiecte: {
        Row: {
          adresa_lucrare: string | null
          client_id: string
          created_at: string
          data_finalizare_estimata: string | null
          data_finalizare_reala: string | null
          data_inceput: string | null
          descriere: string | null
          id: string
          nume_proiect: string
          observatii: string | null
          status: string | null
          tip_lucrare: string | null
          updated_at: string
          user_id: string
          valoare_estimata: number | null
          valoare_finala: number | null
        }
        Insert: {
          adresa_lucrare?: string | null
          client_id: string
          created_at?: string
          data_finalizare_estimata?: string | null
          data_finalizare_reala?: string | null
          data_inceput?: string | null
          descriere?: string | null
          id?: string
          nume_proiect: string
          observatii?: string | null
          status?: string | null
          tip_lucrare?: string | null
          updated_at?: string
          user_id: string
          valoare_estimata?: number | null
          valoare_finala?: number | null
        }
        Update: {
          adresa_lucrare?: string | null
          client_id?: string
          created_at?: string
          data_finalizare_estimata?: string | null
          data_finalizare_reala?: string | null
          data_inceput?: string | null
          descriere?: string | null
          id?: string
          nume_proiect?: string
          observatii?: string | null
          status?: string | null
          tip_lucrare?: string | null
          updated_at?: string
          user_id?: string
          valoare_estimata?: number | null
          valoare_finala?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wiremind_proiecte_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "wiremind_clienti"
            referencedColumns: ["id"]
          },
        ]
      }
      wiremind_projects: {
        Row: {
          client_id: string | null
          created_at: string
          data_finalizare_estimata: string | null
          data_finalizare_reala: string | null
          data_inceput: string | null
          descriere: string | null
          id: string
          locatie: string | null
          nume_proiect: string
          observatii: string | null
          poze_urls: string[] | null
          pret_total: number | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          data_finalizare_estimata?: string | null
          data_finalizare_reala?: string | null
          data_inceput?: string | null
          descriere?: string | null
          id?: string
          locatie?: string | null
          nume_proiect: string
          observatii?: string | null
          poze_urls?: string[] | null
          pret_total?: number | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          data_finalizare_estimata?: string | null
          data_finalizare_reala?: string | null
          data_inceput?: string | null
          descriere?: string | null
          id?: string
          locatie?: string | null
          nume_proiect?: string
          observatii?: string | null
          poze_urls?: string[] | null
          pret_total?: number | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wiremind_projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "wiremind_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      wiremind_quote_items: {
        Row: {
          cantitate: number
          created_at: string
          descriere: string
          id: string
          pret_total: number
          pret_unitar: number
          quote_id: string | null
          unitate_masura: string
        }
        Insert: {
          cantitate: number
          created_at?: string
          descriere: string
          id?: string
          pret_total: number
          pret_unitar: number
          quote_id?: string | null
          unitate_masura?: string
        }
        Update: {
          cantitate?: number
          created_at?: string
          descriere?: string
          id?: string
          pret_total?: number
          pret_unitar?: number
          quote_id?: string | null
          unitate_masura?: string
        }
        Relationships: [
          {
            foreignKeyName: "wiremind_quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "wiremind_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      wiremind_quotes: {
        Row: {
          client_id: string | null
          created_at: string
          descriere: string | null
          id: string
          numar_deviz: string
          observatii: string | null
          pdf_url: string | null
          project_id: string | null
          status: string
          updated_at: string
          user_id: string | null
          valabilitate_zile: number | null
          valoare_totala: number
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          descriere?: string | null
          id?: string
          numar_deviz: string
          observatii?: string | null
          pdf_url?: string | null
          project_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          valabilitate_zile?: number | null
          valoare_totala?: number
        }
        Update: {
          client_id?: string | null
          created_at?: string
          descriere?: string | null
          id?: string
          numar_deviz?: string
          observatii?: string | null
          pdf_url?: string | null
          project_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          valabilitate_zile?: number | null
          valoare_totala?: number
        }
        Relationships: [
          {
            foreignKeyName: "wiremind_quotes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "wiremind_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wiremind_quotes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "wiremind_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      wiremind_suppliers: {
        Row: {
          activ: boolean | null
          adresa: string | null
          created_at: string
          email: string | null
          id: string
          nume_firma: string
          observatii: string | null
          persoana_contact: string | null
          telefon: string | null
          updated_at: string
          user_id: string | null
          website: string | null
        }
        Insert: {
          activ?: boolean | null
          adresa?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nume_firma: string
          observatii?: string | null
          persoana_contact?: string | null
          telefon?: string | null
          updated_at?: string
          user_id?: string | null
          website?: string | null
        }
        Update: {
          activ?: boolean | null
          adresa?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nume_firma?: string
          observatii?: string | null
          persoana_contact?: string | null
          telefon?: string | null
          updated_at?: string
          user_id?: string | null
          website?: string | null
        }
        Relationships: []
      }
      wiremind_users: {
        Row: {
          adresa: string | null
          cod_fiscal: string | null
          created_at: string
          email: string | null
          id: string
          logo_url: string | null
          numar_registru_comert: string | null
          nume_complet: string
          specializare: string
          telefon: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          adresa?: string | null
          cod_fiscal?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          numar_registru_comert?: string | null
          nume_complet: string
          specializare: string
          telefon?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          adresa?: string | null
          cod_fiscal?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          numar_registru_comert?: string | null
          nume_complet?: string
          specializare?: string
          telefon?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      pending_user_approvals: {
        Row: {
          created_at: string | null
          id: string | null
          nume: string | null
          observatii_aprobare: string | null
          rol: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          nume?: string | null
          observatii_aprobare?: string | null
          rol?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          nume?: string | null
          observatii_aprobare?: string | null
          rol?: string | null
        }
        Relationships: []
      }
      stock_transfer_view: {
        Row: {
          created_at: string | null
          destination: string | null
          document_number: string | null
          entry_number: number | null
          id: string | null
          inventory_item_id: string | null
          lot_number: string | null
          manufacturer_name: string | null
          name: string | null
          net_quantity: number | null
          notes: string | null
          product_code: string | null
          product_name: string | null
          quantity: number | null
          supplier: string | null
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
            foreignKeyName: "stock_transfer_items_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "stock_transfer_view"
            referencedColumns: ["id"]
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
    }
    Functions: {
      approve_user: {
        Args: { approver_notes?: string; user_id_to_approve: string }
        Returns: boolean
      }
      authenticate_child: {
        Args: { email_input: string; password_input: string }
        Returns: {
          bani_total: number
          child_id: string
          culoare_favorita: string
          experienta: number
          nivel: number
          nume_copil: string
          puncte_totale: number
          streak_zilnic: number
          user_id: string
          varsta: number
        }[]
      }
      authenticate_coral_user: {
        Args: { email_input: string; password_input: string }
        Returns: {
          active: boolean
          name: string
          role: string
          user_id: string
        }[]
      }
      calculate_next_occurrence: {
        Args: { base_date?: string; pattern: Json }
        Returns: string
      }
      calculate_streak: { Args: { child_uuid: string }; Returns: number }
      create_child_account: {
        Args: {
          culoare_favorita_input: string
          email_input: string
          nume_copil_input: string
          parent_user_id: string
          password_input: string
          varsta_input: number
        }
        Returns: string
      }
      create_coral_user: {
        Args: {
          email_input: string
          name_input: string
          password_input: string
          role_input: string
        }
        Returns: string
      }
      create_portar_account: {
        Args: {
          nume_input: string
          password_input: string
          username_input: string
        }
        Returns: string
      }
      create_task_notification: {
        Args: {
          custom_message?: string
          notification_type: string
          task_assignment_id: string
        }
        Returns: undefined
      }
      creeaza_cont: {
        Args: {
          email_input: string
          nume_input: string
          parola_input: string
          rol_input?: string
        }
        Returns: string
      }
      determine_attendance_type: {
        Args: { employee_id: string }
        Returns: string
      }
      generate_deviz_number: { Args: never; Returns: string }
      generate_invoice_number: { Args: never; Returns: string }
      generate_lot_number: { Args: never; Returns: string }
      generate_missing_snapshots: {
        Args: { end_date?: string; start_date?: string }
        Returns: {
          items_count: number
          snapshot_date: string
          status: string
        }[]
      }
      generate_order_number: { Args: never; Returns: string }
      generate_quote_number: { Args: never; Returns: string }
      get_all_users_for_admin: {
        Args: never
        Returns: {
          aprobat: boolean
          aprobat_de: string
          created_at: string
          data_aprobare: string
          id: string
          nume: string
          observatii_aprobare: string
          rol: string
          updated_at: string
        }[]
      }
      get_current_production_user_role: { Args: never; Returns: string }
      get_current_user_approval_status: { Args: never; Returns: boolean }
      get_current_user_role: { Args: never; Returns: string }
      get_next_inventory_entry: { Args: never; Returns: number }
      has_app_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_user: { Args: never; Returns: boolean }
      is_production_destination: {
        Args: { p_destination: string }
        Returns: boolean
      }
      is_user_approved: { Args: { _user_id: string }; Returns: boolean }
      reject_user: {
        Args: { rejection_reason?: string; user_id_to_reject: string }
        Returns: boolean
      }
      update_child_password: {
        Args: { child_id_input: string; new_password_input: string }
        Returns: boolean
      }
      verifica_parola: {
        Args: { email_input: string; parola_input: string }
        Returns: {
          activ: boolean
          nume: string
          rol: string
          user_id: string
        }[]
      }
      verify_portar_password: {
        Args: { password_input: string; username_input: string }
        Returns: {
          activ: boolean
          nume_complet: string
          user_id: string
          username: string
        }[]
      }
    }
    Enums: {
      app_user_role: "admin" | "user"
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
    Enums: {
      app_user_role: ["admin", "user"],
    },
  },
} as const
