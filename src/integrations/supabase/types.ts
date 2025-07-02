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
          lot_number: string | null
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
          lot_number?: string | null
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
          lot_number?: string | null
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
          net_quantity: number | null
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
          net_quantity?: number | null
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
          net_quantity?: number | null
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
          ora_inregistrare: string
          tip: string
        }
        Insert: {
          angajat_id: string
          created_at?: string
          data?: string
          dispozitiv?: string | null
          id?: string
          ora_inregistrare?: string
          tip: string
        }
        Update: {
          angajat_id?: string
          created_at?: string
          data?: string
          dispozitiv?: string | null
          id?: string
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
      products: {
        Row: {
          cod_produs: string | null
          created_at: string
          default_unit: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          cod_produs?: string | null
          created_at?: string
          default_unit?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          cod_produs?: string | null
          created_at?: string
          default_unit?: string
          description?: string | null
          id?: string
          name?: string
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
          crate_count: number | null
          created_at: string | null
          destination: string | null
          document_number: string | null
          entry_number: number | null
          inventory_item_id: string | null
          lot_number: string | null
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
      approve_user: {
        Args: { user_id_to_approve: string; approver_notes?: string }
        Returns: boolean
      }
      authenticate_child: {
        Args: { email_input: string; password_input: string }
        Returns: {
          child_id: string
          nume_copil: string
          user_id: string
          varsta: number
          culoare_favorita: string
          puncte_totale: number
          bani_total: number
          nivel: number
          streak_zilnic: number
          experienta: number
        }[]
      }
      calculate_streak: {
        Args: { child_uuid: string }
        Returns: number
      }
      create_child_account: {
        Args: {
          parent_user_id: string
          nume_copil_input: string
          varsta_input: number
          culoare_favorita_input: string
          email_input: string
          password_input: string
        }
        Returns: string
      }
      create_portar_account: {
        Args: {
          username_input: string
          password_input: string
          nume_input: string
        }
        Returns: string
      }
      creeaza_cont: {
        Args: {
          email_input: string
          parola_input: string
          nume_input: string
          rol_input?: string
        }
        Returns: string
      }
      determine_attendance_type: {
        Args: { employee_id: string }
        Returns: string
      }
      generate_lot_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_order_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_all_users_for_admin: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          nume: string
          rol: string
          aprobat: boolean
          created_at: string
          data_aprobare: string
          aprobat_de: string
          observatii_aprobare: string
          updated_at: string
        }[]
      }
      get_current_production_user_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_current_user_approval_status: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_next_inventory_entry: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      is_admin_user: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      reject_user: {
        Args: { user_id_to_reject: string; rejection_reason?: string }
        Returns: boolean
      }
      update_child_password: {
        Args: { child_id_input: string; new_password_input: string }
        Returns: boolean
      }
      verifica_parola: {
        Args: { email_input: string; parola_input: string }
        Returns: {
          user_id: string
          nume: string
          rol: string
          activ: boolean
        }[]
      }
      verify_portar_password: {
        Args: { username_input: string; password_input: string }
        Returns: {
          user_id: string
          username: string
          nume_complet: string
          activ: boolean
        }[]
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
