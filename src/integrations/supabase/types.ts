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
      account_deletion_codes: {
        Row: {
          attempts: number
          code: string
          created_at: string
          expires_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          code: string
          created_at?: string
          expires_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          code?: string
          created_at?: string
          expires_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      activity_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          changes: Json
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          seller_id: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          changes?: Json
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          seller_id?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          changes?: Json
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          seller_id?: string | null
        }
        Relationships: []
      }
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
      admin_campaign_products: {
        Row: {
          campaign_id: string
          product_id: string
          sort_order: number
        }
        Insert: {
          campaign_id: string
          product_id: string
          sort_order?: number
        }
        Update: {
          campaign_id?: string
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "admin_campaign_products_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "admin_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_campaign_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_campaign_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_products"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_campaign_recipients: {
        Row: {
          attempts: number
          campaign_id: string
          channel: string
          dispatch_started_at: string | null
          error_code: string | null
          id: string
          retry_after: string | null
          sent_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          campaign_id: string
          channel: string
          dispatch_started_at?: string | null
          error_code?: string | null
          id?: string
          retry_after?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          campaign_id?: string
          channel?: string
          dispatch_started_at?: string | null
          error_code?: string | null
          id?: string
          retry_after?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "admin_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_campaign_worker_key: {
        Row: {
          id: number
          token: string
        }
        Insert: {
          id?: number
          token?: string
        }
        Update: {
          id?: number
          token?: string
        }
        Relationships: []
      }
      admin_campaigns: {
        Row: {
          audience_filters: Json
          audience_type: string
          body: string
          channels: Json
          completed_at: string | null
          created_at: string
          created_by: string
          cta_label: string | null
          cta_url: string
          eligible_total: number
          estimated_email: number
          estimated_push: number
          failed_email: number
          failed_push: number
          id: string
          image_url: string | null
          name: string
          queued_email: number
          queued_push: number
          recipient_limit: number
          sent_email: number
          sent_push: number
          started_at: string | null
          status: string
          title: string
          type: string
        }
        Insert: {
          audience_filters?: Json
          audience_type: string
          body: string
          channels?: Json
          completed_at?: string | null
          created_at?: string
          created_by: string
          cta_label?: string | null
          cta_url?: string
          eligible_total?: number
          estimated_email?: number
          estimated_push?: number
          failed_email?: number
          failed_push?: number
          id?: string
          image_url?: string | null
          name: string
          queued_email?: number
          queued_push?: number
          recipient_limit?: number
          sent_email?: number
          sent_push?: number
          started_at?: string | null
          status?: string
          title: string
          type: string
        }
        Update: {
          audience_filters?: Json
          audience_type?: string
          body?: string
          channels?: Json
          completed_at?: string | null
          created_at?: string
          created_by?: string
          cta_label?: string | null
          cta_url?: string
          eligible_total?: number
          estimated_email?: number
          estimated_push?: number
          failed_email?: number
          failed_push?: number
          id?: string
          image_url?: string | null
          name?: string
          queued_email?: number
          queued_push?: number
          recipient_limit?: number
          sent_email?: number
          sent_push?: number
          started_at?: string | null
          status?: string
          title?: string
          type?: string
        }
        Relationships: []
      }
      admin_recovery_codes: {
        Row: {
          code_hash: string
          created_at: string
          id: string
          revoked_at: string | null
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          id?: string
          revoked_at?: string | null
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          id?: string
          revoked_at?: string | null
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      admin_verified_sessions: {
        Row: {
          auth_method: string
          expires_at: string
          id: string
          last_seen_at: string | null
          revoked_at: string | null
          session_nonce_hash: string
          user_id: string
          verified_at: string
        }
        Insert: {
          auth_method: string
          expires_at?: string
          id?: string
          last_seen_at?: string | null
          revoked_at?: string | null
          session_nonce_hash: string
          user_id: string
          verified_at?: string
        }
        Update: {
          auth_method?: string
          expires_at?: string
          id?: string
          last_seen_at?: string | null
          revoked_at?: string | null
          session_nonce_hash?: string
          user_id?: string
          verified_at?: string
        }
        Relationships: []
      }
      admin_webauthn_challenges: {
        Row: {
          challenge: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          origin: string
          purpose: string
          rp_id: string
          user_id: string
        }
        Insert: {
          challenge: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          origin: string
          purpose: string
          rp_id: string
          user_id: string
        }
        Update: {
          challenge?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          origin?: string
          purpose?: string
          rp_id?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_webauthn_credentials: {
        Row: {
          counter: number
          created_at: string
          credential_id: string
          device_name: string | null
          id: string
          last_used_at: string | null
          public_key: string
          revoked_at: string | null
          transports: Json
          user_id: string
        }
        Insert: {
          counter?: number
          created_at?: string
          credential_id: string
          device_name?: string | null
          id?: string
          last_used_at?: string | null
          public_key: string
          revoked_at?: string | null
          transports?: Json
          user_id: string
        }
        Update: {
          counter?: number
          created_at?: string
          credential_id?: string
          device_name?: string | null
          id?: string
          last_used_at?: string | null
          public_key?: string
          revoked_at?: string | null
          transports?: Json
          user_id?: string
        }
        Relationships: []
      }
      ai_generation_logs: {
        Row: {
          created_at: string
          error: string | null
          id: string
          images_count: number
          model: string
          product_id: string | null
          result: Json | null
          seller_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          images_count?: number
          model: string
          product_id?: string | null
          result?: Json | null
          seller_id: string
          status: string
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          images_count?: number
          model?: string
          product_id?: string | null
          result?: Json | null
          seller_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_generation_logs_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
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
      categories: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          label: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          label: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          label?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      collaborator_roles: {
        Row: {
          created_at: string
          default_permissions: string[]
          description: string | null
          label: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          default_permissions?: string[]
          description?: string | null
          label: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          default_permissions?: string[]
          description?: string | null
          label?: string
          slug?: string
          sort_order?: number
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
          order_id: string | null
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
          order_id?: string | null
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
          order_id?: string | null
          product_id?: string | null
          seller_id?: string
          seller_unread?: number
          seller_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_products"
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
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
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
          {
            foreignKeyName: "favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_products"
            referencedColumns: ["id"]
          },
        ]
      }
      featured_collection_products: {
        Row: {
          collection_id: string
          created_at: string
          product_id: string
          seller_id: string | null
          sort_order: number
          status: string
          submitted_by: string | null
        }
        Insert: {
          collection_id: string
          created_at?: string
          product_id: string
          seller_id?: string | null
          sort_order?: number
          status?: string
          submitted_by?: string | null
        }
        Update: {
          collection_id?: string
          created_at?: string
          product_id?: string
          seller_id?: string | null
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
          {
            foreignKeyName: "featured_collection_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "featured_collection_products_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      featured_collections: {
        Row: {
          auto_approve: boolean
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
          auto_approve?: boolean
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
          auto_approve?: boolean
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
      home_banners: {
        Row: {
          alt: string | null
          created_at: string
          cta_label: string | null
          id: string
          image_url: string
          is_active: boolean
          link_url: string | null
          sort_order: number
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          alt?: string | null
          created_at?: string
          cta_label?: string | null
          id?: string
          image_url: string
          is_active?: boolean
          link_url?: string | null
          sort_order?: number
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          alt?: string | null
          created_at?: string
          cta_label?: string | null
          id?: string
          image_url?: string
          is_active?: boolean
          link_url?: string | null
          sort_order?: number
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          read: boolean
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          read?: boolean
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
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
          image_snapshot: string | null
          order_id: string
          price: number
          price_before_roleta: number | null
          product_id: string | null
          quantity: number
          roleta_discount: number | null
          roleta_percent: number | null
          roleta_spin_id: string | null
          seller_id: string | null
          title_snapshot: string | null
          variation_id: string | null
        }
        Insert: {
          id?: string
          image_snapshot?: string | null
          order_id: string
          price: number
          price_before_roleta?: number | null
          product_id?: string | null
          quantity?: number
          roleta_discount?: number | null
          roleta_percent?: number | null
          roleta_spin_id?: string | null
          seller_id?: string | null
          title_snapshot?: string | null
          variation_id?: string | null
        }
        Update: {
          id?: string
          image_snapshot?: string | null
          order_id?: string
          price?: number
          price_before_roleta?: number | null
          product_id?: string | null
          quantity?: number
          roleta_discount?: number | null
          roleta_percent?: number | null
          roleta_spin_id?: string | null
          seller_id?: string | null
          title_snapshot?: string | null
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
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_roleta_spin_id_fkey"
            columns: ["roleta_spin_id"]
            isOneToOne: false
            referencedRelation: "roleta_spins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
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
          stock_finalized_at: string | null
          subtotal: number
          total: number
          updated_at: string
          user_id: string | null
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
          stock_finalized_at?: string | null
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string | null
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
          stock_finalized_at?: string | null
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string | null
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
          {
            foreignKeyName: "product_variations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_products"
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
          meta_color: string | null
          meta_gender: string | null
          meta_size: string | null
          original_price: number | null
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
          meta_color?: string | null
          meta_gender?: string | null
          meta_size?: string | null
          original_price?: number | null
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
          meta_color?: string | null
          meta_gender?: string | null
          meta_size?: string | null
          original_price?: number | null
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
      profile_completion_reminders: {
        Row: {
          accepted_at: string | null
          attempts: number
          channel: string
          cycle_id: string
          dispatch_started_at: string | null
          due_at: string
          error_code: string | null
          id: string
          provider_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          attempts?: number
          channel: string
          cycle_id: string
          dispatch_started_at?: string | null
          due_at: string
          error_code?: string | null
          id?: string
          provider_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          attempts?: number
          channel?: string
          cycle_id?: string
          dispatch_started_at?: string | null
          due_at?: string
          error_code?: string | null
          id?: string
          provider_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_completion_reminders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          notification_preferences: Json
          phone: string | null
          profile_completion_dismissed_at: string | null
          profile_completion_reminder_sent_at: string | null
          province: string | null
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
          notification_preferences?: Json
          phone?: string | null
          profile_completion_dismissed_at?: string | null
          profile_completion_reminder_sent_at?: string | null
          province?: string | null
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
          notification_preferences?: Json
          phone?: string | null
          profile_completion_dismissed_at?: string | null
          profile_completion_reminder_sent_at?: string | null
          province?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          keys: Json
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          keys: Json
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          keys?: Json
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          admin_notes: string | null
          created_at: string
          details: string | null
          id: string
          reason: string
          reporter_id: string
          status: string
          target_id: string
          target_type: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reporter_id: string
          status?: string
          target_id: string
          target_type: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          status?: string
          target_id?: string
          target_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      roleta_campaigns: {
        Row: {
          created_at: string
          ends_at: string | null
          id: string
          is_active: boolean
          max_discount_mt: number
          name: string
          prizes: Json
          starts_at: string | null
          top_prize_limit: number
          top_prize_percent: number
          updated_at: string
          validity_days: number
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          max_discount_mt?: number
          name: string
          prizes?: Json
          starts_at?: string | null
          top_prize_limit?: number
          top_prize_percent?: number
          updated_at?: string
          validity_days?: number
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          max_discount_mt?: number
          name?: string
          prizes?: Json
          starts_at?: string | null
          top_prize_limit?: number
          top_prize_percent?: number
          updated_at?: string
          validity_days?: number
        }
        Relationships: []
      }
      roleta_codes: {
        Row: {
          campaign_id: string
          code: string
          created_at: string
          created_by: string | null
          id: string
          origin: string
          owner_user_id: string | null
          redeemed_at: string | null
          redeemed_by: string | null
          status: string
        }
        Insert: {
          campaign_id: string
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          origin: string
          owner_user_id?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          status?: string
        }
        Update: {
          campaign_id?: string
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          origin?: string
          owner_user_id?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "roleta_codes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "roleta_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      roleta_popup_state: {
        Row: {
          dismissed_until: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          dismissed_until?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          dismissed_until?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      roleta_product_participation: {
        Row: {
          campaign_id: string
          created_at: string
          created_by: string | null
          product_id: string
          seller_id: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          created_by?: string | null
          product_id: string
          seller_id?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          created_by?: string | null
          product_id?: string
          seller_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roleta_product_participation_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "roleta_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roleta_product_participation_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roleta_product_participation_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roleta_product_participation_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      roleta_referral_links: {
        Row: {
          created_at: string
          ref_code: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ref_code: string
          user_id: string
        }
        Update: {
          created_at?: string
          ref_code?: string
          user_id?: string
        }
        Relationships: []
      }
      roleta_referrals: {
        Row: {
          campaign_id: string | null
          created_at: string
          id: string
          referred_id: string
          referrer_id: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          id?: string
          referred_id: string
          referrer_id: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          id?: string
          referred_id?: string
          referrer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roleta_referrals_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "roleta_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      roleta_spin_attempts: {
        Row: {
          fails: number
          locked_until: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          fails?: number
          locked_until?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          fails?: number
          locked_until?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      roleta_spins: {
        Row: {
          campaign_id: string
          code_id: string
          created_at: string
          expires_at: string | null
          id: string
          max_discount_mt: number
          order_id: string | null
          percent: number
          redeemed_at: string | null
          reserved_at: string | null
          status: string
          user_id: string
          won_at: string
        }
        Insert: {
          campaign_id: string
          code_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          max_discount_mt: number
          order_id?: string | null
          percent: number
          redeemed_at?: string | null
          reserved_at?: string | null
          status: string
          user_id: string
          won_at?: string
        }
        Update: {
          campaign_id?: string
          code_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          max_discount_mt?: number
          order_id?: string | null
          percent?: number
          redeemed_at?: string | null
          reserved_at?: string | null
          status?: string
          user_id?: string
          won_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roleta_spins_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "roleta_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roleta_spins_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: true
            referencedRelation: "roleta_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roleta_spins_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_collaborators: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          permissions: string[]
          role_slug: string
          seller_id: string
          status: Database["public"]["Enums"]["collaborator_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          permissions?: string[]
          role_slug: string
          seller_id: string
          status?: Database["public"]["Enums"]["collaborator_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          permissions?: string[]
          role_slug?: string
          seller_id?: string
          status?: Database["public"]["Enums"]["collaborator_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_collaborators_role_slug_fkey"
            columns: ["role_slug"]
            isOneToOne: false
            referencedRelation: "collaborator_roles"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "seller_collaborators_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
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
          ai_generator_enabled: boolean
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
          user_id: string | null
          verified_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          ai_generator_enabled?: boolean
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
          user_id?: string | null
          verified_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          ai_generator_enabled?: boolean
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
          user_id?: string | null
          verified_at?: string | null
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          body: string | null
          created_at: string
          id: string
          image_url: string | null
          is_admin: boolean
          read: boolean
          sender_id: string | null
          thread_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_admin?: boolean
          read?: boolean
          sender_id?: string | null
          thread_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_admin?: boolean
          read?: boolean
          sender_id?: string | null
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "support_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      support_threads: {
        Row: {
          admin_unread: number
          created_at: string
          id: string
          last_message: string | null
          last_message_at: string | null
          resolved: boolean
          updated_at: string
          user_id: string
          user_unread: number
          welcomed: boolean
        }
        Insert: {
          admin_unread?: number
          created_at?: string
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          resolved?: boolean
          updated_at?: string
          user_id: string
          user_unread?: number
          welcomed?: boolean
        }
        Update: {
          admin_unread?: number
          created_at?: string
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          resolved?: boolean
          updated_at?: string
          user_id?: string
          user_unread?: number
          welcomed?: boolean
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
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
          {
            foreignKeyName: "waiting_list_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_products: {
        Row: {
          approval_status: string | null
          base_price: number | null
          category: string | null
          city: string | null
          created_at: string | null
          description: string | null
          featured: boolean | null
          id: string | null
          images: Json | null
          is_unique: boolean | null
          original_price: number | null
          reserved_until: string | null
          seller_id: string | null
          shipping_fee: number | null
          status: Database["public"]["Enums"]["product_status"] | null
          stock: number | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          approval_status?: string | null
          base_price?: number | null
          category?: string | null
          city?: string | null
          created_at?: string | null
          description?: string | null
          featured?: boolean | null
          id?: string | null
          images?: Json | null
          is_unique?: boolean | null
          original_price?: number | null
          reserved_until?: string | null
          seller_id?: string | null
          shipping_fee?: number | null
          status?: Database["public"]["Enums"]["product_status"] | null
          stock?: number | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          approval_status?: string | null
          base_price?: number | null
          category?: string | null
          city?: string | null
          created_at?: string | null
          description?: string | null
          featured?: boolean | null
          id?: string | null
          images?: Json | null
          is_unique?: boolean | null
          original_price?: number | null
          reserved_until?: string | null
          seller_id?: string | null
          shipping_fee?: number | null
          status?: Database["public"]["Enums"]["product_status"] | null
          stock?: number | null
          title?: string | null
          updated_at?: string | null
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
    }
    Functions: {
      add_seller_collaborator: {
        Args: {
          _email: string
          _permissions?: string[]
          _role_slug: string
          _seller_id: string
        }
        Returns: Json
      }
      admin_campaign_audience: {
        Args: { _filters: Json; _segment: string }
        Returns: {
          has_email: boolean
          has_push: boolean
          user_id: string
        }[]
      }
      admin_campaign_claim: {
        Args: { _limit: number }
        Returns: {
          attempts: number
          campaign_id: string
          channel: string
          id: string
          user_id: string
        }[]
      }
      admin_campaign_email_eligible: {
        Args: { _user_id: string }
        Returns: boolean
      }
      admin_campaign_enqueue: {
        Args: { _campaign_id: string }
        Returns: number
      }
      admin_campaign_estimate: {
        Args: { _filters: Json; _segment: string }
        Returns: Json
      }
      admin_campaign_push_eligible: {
        Args: { _user_id: string }
        Returns: boolean
      }
      admin_campaign_refresh: {
        Args: { _campaign_id: string }
        Returns: undefined
      }
      admin_campaign_tick: { Args: never; Returns: undefined }
      can_feature_for_seller: { Args: { _seller_id: string }; Returns: boolean }
      can_use_ai_generator: { Args: { _seller_id: string }; Returns: boolean }
      create_order_secure: {
        Args: {
          _customer_name: string
          _customer_phone: string
          _items: Json
          _notes?: string
          _payment_method: string
          _payment_phone?: string
          _payment_reference?: string
          _shipping_address: Json
        }
        Returns: Json
      }
      current_seller_id: { Args: never; Returns: string }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      delete_message: { Args: { _message_id: string }; Returns: undefined }
      dismiss_profile_completion: { Args: never; Returns: string }
      edit_message: {
        Args: { _body: string; _message_id: string }
        Returns: undefined
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      explore_products: {
        Args: {
          _available?: boolean
          _categories?: string[]
          _city?: string
          _colors?: string[]
          _cursor_created?: string
          _cursor_id?: string
          _discount?: boolean
          _gender?: string
          _limit?: number
          _max?: number
          _min?: number
          _q?: string
          _seller?: string
          _sizes?: string[]
          _unique?: boolean
        }
        Returns: {
          base_price: number
          category: string
          created_at: string
          id: string
          images: Json
          is_unique: boolean
          original_price: number
          status: Database["public"]["Enums"]["product_status"]
          title: string
        }[]
      }
      explore_products_count: {
        Args: {
          _available?: boolean
          _categories?: string[]
          _city?: string
          _colors?: string[]
          _discount?: boolean
          _gender?: string
          _max?: number
          _min?: number
          _q?: string
          _seller?: string
          _sizes?: string[]
          _unique?: boolean
        }
        Returns: number
      }
      finalize_order_items: { Args: { _order_id: string }; Returns: undefined }
      get_admin_dashboard_stats: { Args: never; Returns: Json }
      get_admin_sellers_dashboard: { Args: never; Returns: Json }
      get_admin_support_threads: { Args: never; Returns: Json }
      get_available_cities: {
        Args: never
        Returns: {
          city: string
          product_count: number
        }[]
      }
      get_explore_facets: { Args: never; Returns: Json }
      get_managed_products: {
        Args: { _seller_id?: string }
        Returns: {
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
          meta_color: string | null
          meta_gender: string | null
          meta_size: string | null
          original_price: number | null
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
        }[]
        SetofOptions: {
          from: "*"
          to: "products"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_my_conversations: { Args: never; Returns: Json }
      get_my_order_history: { Args: never; Returns: Json }
      get_my_product_reservations: {
        Args: { _product_ids: string[] }
        Returns: {
          product_id: string
          reserved_by_me: boolean
        }[]
      }
      get_my_roleta: { Args: never; Returns: Json }
      get_my_team: { Args: never; Returns: Json }
      get_my_team_activity: {
        Args: { _limit?: number; _user_id: string }
        Returns: Json
      }
      get_or_create_order_conversation: {
        Args: { _order_id: string; _seller_id: string }
        Returns: string
      }
      get_products_pending_orders: {
        Args: never
        Returns: {
          pending_qty: number
          product_id: string
        }[]
      }
      get_public_campaign: { Args: { _id: string }; Returns: Json }
      get_public_seller: { Args: { _id: string }; Returns: Json }
      get_roleta_public: { Args: never; Returns: Json }
      get_seller_audit_logs: {
        Args: { _limit?: number; _seller_id: string }
        Returns: Json
      }
      get_seller_collaborators: { Args: { _seller_id?: string }; Returns: Json }
      get_seller_dashboard: { Args: never; Returns: Json }
      get_seller_featured_collections: {
        Args: { _seller_id?: string }
        Returns: Json
      }
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
      has_seller_permission: {
        Args: { _perm: string; _seller_id: string }
        Returns: boolean
      }
      is_active_collaborator: { Args: never; Returns: boolean }
      is_conversation_participant: {
        Args: { _conversation_id: string }
        Returns: boolean
      }
      mark_conversation_read: {
        Args: { _conversation_id: string }
        Returns: undefined
      }
      mark_support_read: {
        Args: { _side: string; _thread_id: string }
        Returns: undefined
      }
      move_product_featured_collection: {
        Args: {
          _from_collection_id: string
          _product_id: string
          _seller_id: string
          _to_collection_id: string
        }
        Returns: undefined
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      my_collaborations: { Args: never; Returns: Json }
      notify_email: {
        Args: {
          _body: string
          _link: string
          _title: string
          _type: string
          _user_id: string
        }
        Returns: undefined
      }
      notify_push: {
        Args: {
          _body: string
          _tag: string
          _title: string
          _url: string
          _user_id: string
        }
        Returns: undefined
      }
      open_support_thread: { Args: never; Returns: string }
      product_meta_field: {
        Args: { _description: string; _key: string }
        Returns: string
      }
      profile_is_complete: {
        Args: {
          _city: string
          _name: string
          _phone: string
          _province: string
        }
        Returns: boolean
      }
      profile_reminder_claim: {
        Args: never
        Returns: {
          accepted_at: string | null
          attempts: number
          channel: string
          cycle_id: string
          dispatch_started_at: string | null
          due_at: string
          error_code: string | null
          id: string
          provider_id: string | null
          status: string
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "profile_completion_reminders"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      profile_reminder_pause_if_drained: { Args: never; Returns: undefined }
      promote_next_in_queue: {
        Args: { _product_id: string }
        Returns: undefined
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      recalc_order_totals: { Args: { _order_id: string }; Returns: undefined }
      refresh_conversation_preview: {
        Args: { _conversation_id: string }
        Returns: undefined
      }
      release_expired_reservations: { Args: never; Returns: number }
      release_product: { Args: { _product_id: string }; Returns: undefined }
      reserve_product: { Args: { _product_id: string }; Returns: Json }
      revoke_admin_by_email: { Args: { _email: string }; Returns: undefined }
      roleta_admin_codes: { Args: { _campaign_id: string }; Returns: Json }
      roleta_admin_generate_codes: {
        Args: { _campaign_id: string; _qty: number }
        Returns: string[]
      }
      roleta_admin_referrals: { Args: { _campaign_id: string }; Returns: Json }
      roleta_admin_stats: { Args: { _campaign_id: string }; Returns: Json }
      roleta_apply_to_order: { Args: { _order_id: string }; Returns: Json }
      roleta_calc_order_discount: {
        Args: { _order_id: string; _spin_id: string }
        Returns: number
      }
      roleta_claim_referral: { Args: { _ref: string }; Returns: Json }
      roleta_current_campaign: { Args: never; Returns: string }
      roleta_dismiss_popup: { Args: never; Returns: undefined }
      roleta_expire_mine: { Args: { _uid: string }; Returns: undefined }
      roleta_generate_referral_code: { Args: never; Returns: string }
      roleta_random_code: { Args: never; Returns: string }
      roleta_set_product_participation: {
        Args: { _participate: boolean; _product_id: string }
        Returns: undefined
      }
      roleta_spin: { Args: { _code: string }; Returns: Json }
      seller_set_collaborator_status: {
        Args: {
          _id: string
          _status: Database["public"]["Enums"]["collaborator_status"]
        }
        Returns: undefined
      }
      set_collaborator_role: {
        Args: { _id: string; _permissions?: string[]; _role_slug: string }
        Returns: undefined
      }
      set_collaborator_status: {
        Args: {
          _id: string
          _status: Database["public"]["Enums"]["collaborator_status"]
        }
        Returns: undefined
      }
      set_order_seller_status: {
        Args: {
          _notes?: string
          _order_id: string
          _status: string
          _tracking?: string
        }
        Returns: undefined
      }
      set_seller_ai_generator: {
        Args: { _enabled: boolean; _seller_id: string }
        Returns: boolean
      }
      start_conversation: {
        Args: { _product_id?: string; _seller_id: string }
        Returns: string
      }
      start_order_conversation: {
        Args: { _order_id: string; _seller_id: string }
        Returns: string
      }
      submit_products_to_collection: {
        Args: {
          _collection_id: string
          _product_ids: string[]
          _seller_id: string
        }
        Returns: undefined
      }
      withdraw_product_from_collection: {
        Args: {
          _collection_id: string
          _product_id: string
          _seller_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "client"
      collaborator_status: "active" | "suspended" | "removed"
      order_status:
        | "pending"
        | "paid"
        | "processing"
        | "sent"
        | "delivered"
        | "cancelled"
      payment_method: "e-mpesa" | "e-mola" | "entrega"
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
    Enums: {
      app_role: ["admin", "client"],
      collaborator_status: ["active", "suspended", "removed"],
      order_status: [
        "pending",
        "paid",
        "processing",
        "sent",
        "delivered",
        "cancelled",
      ],
      payment_method: ["e-mpesa", "e-mola", "entrega"],
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
