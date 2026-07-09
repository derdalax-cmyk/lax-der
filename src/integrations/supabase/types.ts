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
      addresses: {
        Row: {
          apartment: string | null
          building: string | null
          city: string
          created_at: string
          id: string
          is_default: boolean
          neighborhood: string | null
          number: string | null
          province: string | null
          reference: string | null
          street: string
          user_id: string
        }
        Insert: {
          apartment?: string | null
          building?: string | null
          city: string
          created_at?: string
          id?: string
          is_default?: boolean
          neighborhood?: string | null
          number?: string | null
          province?: string | null
          reference?: string | null
          street: string
          user_id: string
        }
        Update: {
          apartment?: string | null
          building?: string | null
          city?: string
          created_at?: string
          id?: string
          is_default?: boolean
          neighborhood?: string | null
          number?: string | null
          province?: string | null
          reference?: string | null
          street?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_allowlist: {
        Row: {
          created_at: string
          email: string
        }
        Insert: {
          created_at?: string
          email: string
        }
        Update: {
          created_at?: string
          email?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          updated_at: string
          user_id: string
          variation_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          updated_at?: string
          user_id: string
          variation_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          updated_at?: string
          user_id?: string
          variation_id?: string | null
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      featured_collection_products: {
        Row: {
          collection_id: string
          created_at: string
          product_id: string
          sort_order: number
          status: string
          submitted_by: string | null
        }
        Insert: {
          collection_id: string
          created_at?: string
          product_id: string
          sort_order?: number
          status?: string
          submitted_by?: string | null
        }
        Update: {
          collection_id?: string
          created_at?: string
          product_id?: string
          sort_order?: number
          status?: string
          submitted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "featured_collection_products_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "featured_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "featured_collection_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      featured_collections: {
        Row: {
          cover_image: string | null
          created_at: string
          ends_at: string | null
          hidden_sellers: string[]
          icon: string | null
          id: string
          is_active: boolean
          max_products_per_seller: number
          name: string
          slug: string
          sort_order: number
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          cover_image?: string | null
          created_at?: string
          ends_at?: string | null
          hidden_sellers?: string[]
          icon?: string | null
          id?: string
          is_active?: boolean
          max_products_per_seller?: number
          name: string
          slug: string
          sort_order?: number
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          cover_image?: string | null
          created_at?: string
          ends_at?: string | null
          hidden_sellers?: string[]
          icon?: string | null
          id?: string
          is_active?: boolean
          max_products_per_seller?: number
          name?: string
          slug?: string
          sort_order?: number
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          price: number
          product_id: string | null
          quantity: number
          variation_id: string | null
        }
        Insert: {
          id?: string
          order_id: string
          price: number
          product_id?: string | null
          quantity?: number
          variation_id?: string | null
        }
        Update: {
          id?: string
          order_id?: string
          price?: number
          product_id?: string | null
          quantity?: number
          variation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: false
            referencedRelation: "product_variations"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          id: string
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          payment_phone: string | null
          payment_provider_id: string | null
          payment_reference: string | null
          payment_status: string | null
          shipping: number
          shipping_address: Json | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_phone?: string | null
          payment_provider_id?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          shipping?: number
          shipping_address?: Json | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_phone?: string | null
          payment_provider_id?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          shipping?: number
          shipping_address?: Json | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      product_variations: {
        Row: {
          color: string | null
          created_at: string
          id: string
          is_active: boolean
          price: number | null
          product_id: string
          size: string | null
          stock: number
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          price?: number | null
          product_id: string
          size?: string | null
          stock?: number
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          price?: number | null
          product_id?: string
          size?: string | null
          stock?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_variations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          approval_status: string
          base_price: number
          category: string | null
          city: string | null
          created_at: string
          description: string | null
          featured: boolean
          id: string
          images: Json | null
          is_unique: boolean
          rejection_reason: string | null
          reserved_by: string | null
          reserved_until: string | null
          seller_id: string | null
          status: Database["public"]["Enums"]["product_status"]
          title: string
          updated_at: string
        }
        Insert: {
          approval_status?: string
          base_price?: number
          category?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          featured?: boolean
          id?: string
          images?: Json | null
          is_unique?: boolean
          rejection_reason?: string | null
          reserved_by?: string | null
          reserved_until?: string | null
          seller_id?: string | null
          status?: Database["public"]["Enums"]["product_status"]
          title: string
          updated_at?: string
        }
        Update: {
          approval_status?: string
          base_price?: number
          category?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          featured?: boolean
          id?: string
          images?: Json | null
          is_unique?: boolean
          rejection_reason?: string | null
          reserved_by?: string | null
          reserved_until?: string | null
          seller_id?: string | null
          status?: Database["public"]["Enums"]["product_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          admin_notes: string | null
          avatar_url: string | null
          blocked: boolean
          city: string | null
          created_at: string
          document: string | null
          email: string | null
          id: string
          is_vip: boolean
          name: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          avatar_url?: string | null
          blocked?: boolean
          city?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id: string
          is_vip?: boolean
          name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          avatar_url?: string | null
          blocked?: boolean
          city?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          is_vip?: boolean
          name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      seller_reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          rating: number
          seller_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          seller_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          seller_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_reviews_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      sellers: {
        Row: {
          admin_notes: string | null
          approved_at: string | null
          city: string | null
          created_at: string
          description: string | null
          email: string | null
          full_name: string
          id: string
          is_blocked: boolean
          logo_url: string | null
          phone: string
          province: string
          rating: number
          status: string
          store_name: string
          total_reviews: number
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          approved_at?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          full_name: string
          id?: string
          is_blocked?: boolean
          logo_url?: string | null
          phone: string
          province: string
          rating?: number
          status?: string
          store_name: string
          total_reviews?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          approved_at?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_blocked?: boolean
          logo_url?: string | null
          phone?: string
          province?: string
          rating?: number
          status?: string
          store_name?: string
          total_reviews?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      waiting_list: {
        Row: {
          created_at: string
          id: string
          notified_at: string | null
          position: number
          product_id: string
          reserved_until: string | null
          status: Database["public"]["Enums"]["waiting_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notified_at?: string | null
          position?: number
          product_id: string
          reserved_until?: string | null
          status?: Database["public"]["Enums"]["waiting_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notified_at?: string | null
          position?: number
          product_id?: string
          reserved_until?: string | null
          status?: Database["public"]["Enums"]["waiting_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waiting_list_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_seller_id: { Args: never; Returns: string }
      finalize_order_items: { Args: { _order_id: string }; Returns: undefined }
      get_available_cities: {
        Args: never
        Returns: {
          city: string
          product_count: number
        }[]
      }
      get_public_seller: { Args: { _id: string }; Returns: Json }
      get_seller_dashboard: { Args: never; Returns: Json }
      get_seller_featured_collections: { Args: never; Returns: Json }
      get_seller_orders: { Args: never; Returns: Json }
      get_seller_reviews: {
        Args: { _seller_id: string }
        Returns: {
          comment: string
          created_at: string
          id: string
          rating: number
          reviewer_avatar: string
          reviewer_name: string
        }[]
      }
      grant_admin_by_email: { Args: { _email: string }; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      promote_next_in_queue: {
        Args: { _product_id: string }
        Returns: undefined
      }
      release_expired_reservations: { Args: never; Returns: number }
      release_product: { Args: { _product_id: string }; Returns: undefined }
      reserve_product: { Args: { _product_id: string }; Returns: Json }
      revoke_admin_by_email: { Args: { _email: string }; Returns: undefined }
      submit_products_to_collection: {
        Args: { _collection_id: string; _product_ids: string[] }
        Returns: undefined
      }
      withdraw_product_from_collection: {
        Args: { _collection_id: string; _product_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "client"
      order_status:
        | "pending"
        | "paid"
        | "processing"
        | "sent"
        | "delivered"
        | "cancelled"
      payment_method: "e-mpesa" | "e-mola"
      product_status: "available" | "reserved" | "sold"
      waiting_status: "waiting" | "notified" | "expired"
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
      app_role: ["admin", "client"],
      order_status: [
        "pending",
        "paid",
        "processing",
        "sent",
        "delivered",
        "cancelled",
      ],
      payment_method: ["e-mpesa", "e-mola"],
      product_status: ["available", "reserved", "sold"],
      waiting_status: ["waiting", "notified", "expired"],
    },
  },
} as const
