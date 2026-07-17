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
      conversations: {
        Row: {
          buyer_id: string
          buyer_unread: number
          created_at: string
          id: string
          last_message: string | null
          last_message_at: string | null
          product_id: string | null
          seller_id: string
          seller_unread: number
          seller_user_id: string
          updated_at: string
        }
        Insert: {
          buyer_id: string
          buyer_unread?: number
          created_at?: string
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          product_id?: string | null
          seller_id: string
          seller_unread?: number
          seller_user_id: string
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          buyer_unread?: number
          created_at?: string
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          product_id?: string | null
          seller_id?: string
          seller_unread?: number
          seller_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
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
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          read: boolean
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          read?: boolean
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read?: boolean
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json
          id: string
          link: string | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json
          id?: string
          link?: string | null
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json
          id?: string
          link?: string | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
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
      order_sellers: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          order_id: string
          seller_id: string
          status: string
          subtotal: number
          tracking_code: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          order_id: string
          seller_id: string
          status?: string
          subtotal?: number
          tracking_code?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          order_id?: string
          seller_id?: string
          status?: string
          subtotal?: number
          tracking_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_sellers_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_sellers_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
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
          shipping_fee: number
          status: Database["public"]["Enums"]["product_status"]
          stock: number
          stock_alert: number
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
          shipping_fee?: number
          status?: Database["public"]["Enums"]["product_status"]
          stock?: number
          stock_alert?: number
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
          shipping_fee?: number
          status?: Database["public"]["Enums"]["product_status"]
          stock?: number
          stock_alert?: number
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
          order_id: string | null
          rating: number
          rating_delivery: number | null
          rating_quality: number | null
          rating_service: number | null
          seller_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          order_id?: string | null
          rating: number
          rating_delivery?: number | null
          rating_quality?: number | null
          rating_service?: number | null
          seller_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          order_id?: string | null
          rating?: number
          rating_delivery?: number | null
          rating_quality?: number | null
          rating_service?: number | null
          seller_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
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
          bank_account: string | null
          bank_name: string | null
          city: string | null
          created_at: string
          description: string | null
          document_back_url: string | null
          document_front_url: string | null
          document_number: string | null
          document_selfie_url: string | null
          document_type: string | null
          email: string | null
          emola_number: string | null
          face_photo_url: string | null
          full_name: string
          id: string
          is_blocked: boolean
          logo_url: string | null
          mpesa_number: string | null
          phone: string
          province: string
          rating: number
          status: string
          store_name: string
          total_reviews: number
          updated_at: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          approved_at?: string | null
          bank_account?: string | null
          bank_name?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          document_back_url?: string | null
          document_front_url?: string | null
          document_number?: string | null
          document_selfie_url?: string | null
          document_type?: string | null
          email?: string | null
          emola_number?: string | null
          face_photo_url?: string | null
          full_name: string
          id?: string
          is_blocked?: boolean
          logo_url?: string | null
          mpesa_number?: string | null
          phone: string
          province: string
          rating?: number
          status?: string
          store_name: string
          total_reviews?: number
          updated_at?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          approved_at?: string | null
          bank_account?: string | null
          bank_name?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          document_back_url?: string | null
          document_front_url?: string | null
          document_number?: string | null
          document_selfie_url?: string | null
          document_type?: string | null
          email?: string | null
          emola_number?: string | null
          face_photo_url?: string | null
          full_name?: string
          id?: string
          is_blocked?: boolean
          logo_url?: string | null
          mpesa_number?: string | null
          phone?: string
          province?: string
          rating?: number
          status?: string
          store_name?: string
          total_reviews?: number
          updated_at?: string
          user_id?: string
          verified_at?: string | null
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
      get_admin_sellers_dashboard: { Args: never; Returns: Json }
      get_available_cities: {
        Args: never
        Returns: {
          city: string
          product_count: number
        }[]
      }
      get_my_conversations: { Args: never; Returns: Json }
      get_public_seller: { Args: { _id: string }; Returns: Json }
      get_seller_dashboard: { Args: never; Returns: Json }
      get_seller_featured_collections: { Args: never; Returns: Json }
      get_seller_orders: { Args: never; Returns: Json }
      get_seller_rating_breakdown: {
        Args: { _seller_id: string }
        Returns: Json
      }
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
      mark_conversation_read: {
        Args: { _conversation_id: string }
        Returns: undefined
      }
      promote_next_in_queue: {
        Args: { _product_id: string }
        Returns: undefined
      }
      release_expired_reservations: { Args: never; Returns: number }
      release_product: { Args: { _product_id: string }; Returns: undefined }
      reserve_product: { Args: { _product_id: string }; Returns: Json }
      revoke_admin_by_email: { Args: { _email: string }; Returns: undefined }
      set_order_seller_status: {
        Args: {
          _notes?: string
          _order_id: string
          _status: string
          _tracking?: string
        }
        Returns: undefined
      }
      start_conversation: {
        Args: { _product_id?: string; _seller_id: string }
        Returns: string
      }
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
      product_status:
        | "available"
        | "reserved"
        | "sold"
        | "out_of_stock"
        | "inactive"
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
      product_status: [
        "available",
        "reserved",
        "sold",
        "out_of_stock",
        "inactive",
      ],
      waiting_status: ["waiting", "notified", "expired"],
    },
  },
} as const
