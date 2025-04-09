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
      admin_audit_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: []
      }
      admin_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      craftsman_statistics: {
        Row: {
          craftsman_id: string | null
          created_at: string | null
          event_type: string
          id: string
        }
        Insert: {
          craftsman_id?: string | null
          created_at?: string | null
          event_type: string
          id?: string
        }
        Update: {
          craftsman_id?: string | null
          created_at?: string | null
          event_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "craftsman_statistics_craftsman_id_fkey"
            columns: ["craftsman_id"]
            isOneToOne: false
            referencedRelation: "craftsman_profile_statistics"
            referencedColumns: ["craftsman_id"]
          },
          {
            foreignKeyName: "craftsman_statistics_craftsman_id_fkey"
            columns: ["craftsman_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "craftsman_statistics_craftsman_id_fkey"
            columns: ["craftsman_id"]
            isOneToOne: false
            referencedRelation: "user_profiles_with_email"
            referencedColumns: ["id"]
          },
        ]
      }
      job_listings: {
        Row: {
          budget: number | null
          city: string
          client_id: string | null
          country: string
          county: string
          created_at: string
          description: string
          estimated_time: string
          id: string
          images: Json | null
          start_date: string | null
          status: string | null
          title: string
          trade_id: string | null
        }
        Insert: {
          budget?: number | null
          city: string
          client_id?: string | null
          country?: string
          county: string
          created_at?: string
          description: string
          estimated_time?: string
          id?: string
          images?: Json | null
          start_date?: string | null
          status?: string | null
          title: string
          trade_id?: string | null
        }
        Update: {
          budget?: number | null
          city?: string
          client_id?: string | null
          country?: string
          county?: string
          created_at?: string
          description?: string
          estimated_time?: string
          id?: string
          images?: Json | null
          start_date?: string | null
          status?: string | null
          title?: string
          trade_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_listings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "craftsman_profile_statistics"
            referencedColumns: ["craftsman_id"]
          },
          {
            foreignKeyName: "job_listings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_listings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "user_profiles_with_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_listings_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachments: Json | null
          content: string
          created_at: string | null
          id: string
          read: boolean | null
          receiver_id: string | null
          sender_id: string | null
          updated_at: string | null
        }
        Insert: {
          attachments?: Json | null
          content: string
          created_at?: string | null
          id?: string
          read?: boolean | null
          receiver_id?: string | null
          sender_id?: string | null
          updated_at?: string | null
        }
        Update: {
          attachments?: Json | null
          content?: string
          created_at?: string | null
          id?: string
          read?: boolean | null
          receiver_id?: string | null
          sender_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "craftsman_profile_statistics"
            referencedColumns: ["craftsman_id"]
          },
          {
            foreignKeyName: "messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "user_profiles_with_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "craftsman_profile_statistics"
            referencedColumns: ["craftsman_id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "user_profiles_with_email"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          message: string
          read: boolean | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          read?: boolean | null
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          read?: boolean | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "craftsman_profile_statistics"
            referencedColumns: ["craftsman_id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles_with_email"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          craftsman_id: string
          created_at: string
          currency: string
          id: string
          status: Database["public"]["Enums"]["payment_status"]
          stripe_customer_id: string | null
          stripe_payment_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          craftsman_id: string
          created_at?: string
          currency?: string
          id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_customer_id?: string | null
          stripe_payment_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          craftsman_id?: string
          created_at?: string
          currency?: string
          id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_customer_id?: string | null
          stripe_payment_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_craftsman_id_fkey"
            columns: ["craftsman_id"]
            isOneToOne: false
            referencedRelation: "craftsman_profile_statistics"
            referencedColumns: ["craftsman_id"]
          },
          {
            foreignKeyName: "payments_craftsman_id_fkey"
            columns: ["craftsman_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_craftsman_id_fkey"
            columns: ["craftsman_id"]
            isOneToOne: false
            referencedRelation: "user_profiles_with_email"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_images: {
        Row: {
          created_at: string
          id: string
          image_url: string
          portfolio_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          portfolio_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          portfolio_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_images_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolios: {
        Row: {
          craftsman_id: string | null
          created_at: string
          description: string | null
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          craftsman_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          craftsman_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolios_craftsman_id_fkey"
            columns: ["craftsman_id"]
            isOneToOne: false
            referencedRelation: "craftsman_profile_statistics"
            referencedColumns: ["craftsman_id"]
          },
          {
            foreignKeyName: "portfolios_craftsman_id_fkey"
            columns: ["craftsman_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolios_craftsman_id_fkey"
            columns: ["craftsman_id"]
            isOneToOne: false
            referencedRelation: "user_profiles_with_email"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_interactions: {
        Row: {
          craftsman_id: string | null
          created_at: string | null
          id: string
          interaction_type: string
          metadata: Json | null
          visitor_id: string | null
        }
        Insert: {
          craftsman_id?: string | null
          created_at?: string | null
          id?: string
          interaction_type: string
          metadata?: Json | null
          visitor_id?: string | null
        }
        Update: {
          craftsman_id?: string | null
          created_at?: string | null
          id?: string
          interaction_type?: string
          metadata?: Json | null
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_interactions_craftsman_id_fkey"
            columns: ["craftsman_id"]
            isOneToOne: false
            referencedRelation: "craftsman_profile_statistics"
            referencedColumns: ["craftsman_id"]
          },
          {
            foreignKeyName: "profile_interactions_craftsman_id_fkey"
            columns: ["craftsman_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_interactions_craftsman_id_fkey"
            columns: ["craftsman_id"]
            isOneToOne: false
            referencedRelation: "user_profiles_with_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_interactions_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "craftsman_profile_statistics"
            referencedColumns: ["craftsman_id"]
          },
          {
            foreignKeyName: "profile_interactions_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_interactions_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "user_profiles_with_email"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string
          avatar_url: string | null
          city: string
          country: string
          county: string
          craftsman_type: string | null
          created_at: string
          first_name: string
          id: string
          last_location_update: string | null
          last_name: string
          latitude: number | null
          longitude: number | null
          phone: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          address: string
          avatar_url?: string | null
          city: string
          country: string
          county: string
          craftsman_type?: string | null
          created_at?: string
          first_name: string
          id: string
          last_location_update?: string | null
          last_name: string
          latitude?: number | null
          longitude?: number | null
          phone: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          address?: string
          avatar_url?: string | null
          city?: string
          country?: string
          county?: string
          craftsman_type?: string | null
          created_at?: string
          first_name?: string
          id?: string
          last_location_update?: string | null
          last_name?: string
          latitude?: number | null
          longitude?: number | null
          phone?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_craftsman_type_fkey"
            columns: ["craftsman_type"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      qualifications: {
        Row: {
          craftsman_id: string | null
          created_at: string
          document_url: string
          id: string
          issue_date: string | null
          title: string
        }
        Insert: {
          craftsman_id?: string | null
          created_at?: string
          document_url: string
          id?: string
          issue_date?: string | null
          title: string
        }
        Update: {
          craftsman_id?: string | null
          created_at?: string
          document_url?: string
          id?: string
          issue_date?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "qualifications_craftsman_id_fkey"
            columns: ["craftsman_id"]
            isOneToOne: false
            referencedRelation: "craftsman_profile_statistics"
            referencedColumns: ["craftsman_id"]
          },
          {
            foreignKeyName: "qualifications_craftsman_id_fkey"
            columns: ["craftsman_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qualifications_craftsman_id_fkey"
            columns: ["craftsman_id"]
            isOneToOne: false
            referencedRelation: "user_profiles_with_email"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          client_id: string | null
          comment: string
          craftsman_id: string | null
          craftsman_response: string | null
          created_at: string
          id: string
          rating: number
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          comment: string
          craftsman_id?: string | null
          craftsman_response?: string | null
          created_at?: string
          id?: string
          rating: number
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          comment?: string
          craftsman_id?: string | null
          craftsman_response?: string | null
          created_at?: string
          id?: string
          rating?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "craftsman_profile_statistics"
            referencedColumns: ["craftsman_id"]
          },
          {
            foreignKeyName: "reviews_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "user_profiles_with_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_craftsman_id_fkey"
            columns: ["craftsman_id"]
            isOneToOne: false
            referencedRelation: "craftsman_profile_statistics"
            referencedColumns: ["craftsman_id"]
          },
          {
            foreignKeyName: "reviews_craftsman_id_fkey"
            columns: ["craftsman_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_craftsman_id_fkey"
            columns: ["craftsman_id"]
            isOneToOne: false
            referencedRelation: "user_profiles_with_email"
            referencedColumns: ["id"]
          },
        ]
      }
      specializations: {
        Row: {
          craftsman_id: string | null
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          craftsman_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          craftsman_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "specializations_craftsman_id_fkey"
            columns: ["craftsman_id"]
            isOneToOne: false
            referencedRelation: "craftsman_profile_statistics"
            referencedColumns: ["craftsman_id"]
          },
          {
            foreignKeyName: "specializations_craftsman_id_fkey"
            columns: ["craftsman_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "specializations_craftsman_id_fkey"
            columns: ["craftsman_id"]
            isOneToOne: false
            referencedRelation: "user_profiles_with_email"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          craftsman_id: string | null
          created_at: string | null
          end_date: string | null
          id: string
          payment_id: string | null
          plan: Database["public"]["Enums"]["subscription_plan"]
          start_date: string | null
          status: Database["public"]["Enums"]["subscription_status"] | null
          stripe_subscription_id: string | null
          updated_at: string | null
        }
        Insert: {
          craftsman_id?: string | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          payment_id?: string | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          start_date?: string | null
          status?: Database["public"]["Enums"]["subscription_status"] | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
        }
        Update: {
          craftsman_id?: string | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          payment_id?: string | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          start_date?: string | null
          status?: Database["public"]["Enums"]["subscription_status"] | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_craftsman_id_fkey"
            columns: ["craftsman_id"]
            isOneToOne: false
            referencedRelation: "craftsman_profile_statistics"
            referencedColumns: ["craftsman_id"]
          },
          {
            foreignKeyName: "subscriptions_craftsman_id_fkey"
            columns: ["craftsman_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_craftsman_id_fkey"
            columns: ["craftsman_id"]
            isOneToOne: false
            referencedRelation: "user_profiles_with_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      trades: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      craftsman_profile_statistics: {
        Row: {
          average_rating: number | null
          craftsman_id: string | null
          positive_reviews: number | null
          total_clients: number | null
          total_messages: number | null
          total_projects: number | null
        }
        Relationships: []
      }
      craftsman_subscription_status_latest: {
        Row: {
          craftsman_id: string | null
          email: string | null
          first_name: string | null
          is_subscription_active: boolean | null
          last_name: string | null
          subscription_end_date: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_craftsman_id_fkey"
            columns: ["craftsman_id"]
            isOneToOne: false
            referencedRelation: "craftsman_profile_statistics"
            referencedColumns: ["craftsman_id"]
          },
          {
            foreignKeyName: "subscriptions_craftsman_id_fkey"
            columns: ["craftsman_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_craftsman_id_fkey"
            columns: ["craftsman_id"]
            isOneToOne: false
            referencedRelation: "user_profiles_with_email"
            referencedColumns: ["id"]
          },
        ]
      }
      messages_statistics: {
        Row: {
          messages_from_clients: number | null
          messages_from_craftsmen: number | null
          month: string | null
          total_messages: number | null
          unique_receivers: number | null
          unique_senders: number | null
        }
        Relationships: []
      }
      platform_statistics: {
        Row: {
          avg_rating: number | null
          total_clients: number | null
          total_craftsmen: number | null
        }
        Relationships: []
      }
      subscription_statistics: {
        Row: {
          active_subscriptions: number | null
          expired_subscriptions: number | null
          inactive_subscriptions: number | null
          total_subscribers: number | null
          valid_subscriptions: number | null
        }
        Relationships: []
      }
      user_profiles_with_email: {
        Row: {
          address: string | null
          avatar_url: string | null
          city: string | null
          country: string | null
          county: string | null
          craftsman_type: string | null
          created_at: string | null
          email: string | null
          first_name: string | null
          id: string | null
          last_location_update: string | null
          last_name: string | null
          latitude: number | null
          longitude: number | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_craftsman_type_fkey"
            columns: ["craftsman_type"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      calculate_distance: {
        Args: { lat1: number; lon1: number; lat2: number; lon2: number }
        Returns: number
      }
      can_access_craftsman_features: {
        Args: { user_uuid: string }
        Returns: boolean
      }
      delete_user: {
        Args: { user_id: string }
        Returns: undefined
      }
      get_craftsman_statistics: {
        Args: {
          craftsman_id_param: string
          start_date?: string
          end_date?: string
        }
        Returns: {
          craftsman_id: string
          total_clients: number
          average_rating: number
          total_projects: number
          total_messages: number
          positive_reviews: number
          profile_views: number
          map_clicks: number
          phone_clicks: number
          unique_visitors: number
        }[]
      }
      get_subscription_statistics: {
        Args: Record<PropertyKey, never>
        Returns: {
          active_subscriptions: number
          expired_subscriptions: number
          total_subscribers: number
        }[]
      }
      has_active_subscription: {
        Args: { craftsman_uuid: string }
        Returns: boolean
      }
      is_admin: {
        Args: { user_id: string }
        Returns: boolean
      }
      update_craftsman_subscription_status: {
        Args: {
          p_craftsman_id: string
          p_is_active: boolean
          p_end_date: string
        }
        Returns: undefined
      }
    }
    Enums: {
      craftsman_type:
        | "carpenter"
        | "plumber"
        | "electrician"
        | "painter"
        | "mason"
        | "welder"
        | "locksmith"
        | "roofer"
        | "hvac_technician"
        | "general_contractor"
      payment_status: "pending" | "completed" | "failed" | "refunded"
      subscription_plan: "lunar" | "anual"
      subscription_status: "active" | "inactive" | "canceled"
      user_role: "client" | "professional" | "admin"
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
    Enums: {
      craftsman_type: [
        "carpenter",
        "plumber",
        "electrician",
        "painter",
        "mason",
        "welder",
        "locksmith",
        "roofer",
        "hvac_technician",
        "general_contractor",
      ],
      payment_status: ["pending", "completed", "failed", "refunded"],
      subscription_plan: ["lunar", "anual"],
      subscription_status: ["active", "inactive", "canceled"],
      user_role: ["client", "professional", "admin"],
    },
  },
} as const
