export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      catalog_items: {
        Row: {
          id: string
          site_id: string
          kind: 'product' | 'service'
          name: string
          description: string | null
          sku: string | null
          cost: number | null
          lowest_sale_price: number | null
          target_sale_price: number | null
          track_inventory: boolean
          availability_mode: 'manual' | 'inventory' | 'always'
          availability_status: 'available' | 'unavailable' | 'sold_out'
          status: 'active' | 'archived'
          metadata: Json | null
          created_at: string
          updated_at: string
        }
        Insert: any
        Update: any
      }
      locations: {
        Row: {
          id: string
          site_id: string
          name: string
          code: string | null
          is_default: boolean
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: any
        Update: any
      }
      inventory_levels: {
        Row: {
          id: string
          site_id: string
          catalog_item_id: string
          location_id: string
          quantity: number
          updated_at: string
        }
        Insert: any
        Update: any
      }
      price_lists: {
        Row: {
          id: string
          site_id: string
          name: string
          code: string | null
          currency: string
          is_default: boolean
          is_active: boolean
          channels: string[]
          created_at: string
          updated_at: string
        }
        Insert: any
        Update: any
      }
      price_list_items: {
        Row: {
          id: string
          site_id: string
          price_list_id: string
          catalog_item_id: string
          unit_price: number
          updated_at: string
        }
        Insert: any
        Update: any
      }
      sale_order_items: {
        Row: {
          id: string
          sale_order_id: string
          site_id: string
          catalog_item_id: string | null
          location_id: string | null
          name: string
          description: string | null
          quantity: number
          unit_price: number
          subtotal: number
          created_at: string
        }
        Insert: any
        Update: any
      }
      shipments: {
        Row: {
          id: string
          site_id: string
          sale_order_id: string
          sale_id: string | null
          lead_id: string | null
          origin_location_id: string
          status: 'pending' | 'preparing' | 'shipped' | 'in_transit' | 'delivered' | 'cancelled' | 'failed'
          carrier: string | null
          tracking_number: string | null
          shipping_address: Json | null
          stock_decremented: boolean
          estimated_delivery_at: string | null
          shipped_at: string | null
          delivered_at: string | null
          notes: string | null
          user_id: string
          assigned_to: string | null
          last_lat: number | null
          last_lng: number | null
          last_located_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: any
        Update: any
      }
      shipment_location_pings: {
        Row: {
          id: string
          site_id: string
          shipment_id: string
          user_id: string
          lat: number
          lng: number
          accuracy: number | null
          recorded_at: string
        }
        Insert: any
        Update: any
      }
      pos_client_mutations: {
        Row: {
          id: string
          site_id: string
          client_mutation_id: string
          kind: 'checkout' | 'check_in' | 'create_lead'
          sale_id: string | null
          order_id: string | null
          lead_id: string | null
          result: Record<string, any>
          created_at: string
        }
        Insert: any
        Update: any
      }
      promotions: {
        Row: {
          id: string
          site_id: string
          campaign_id: string
          name: string
          description: string | null
          code: string | null
          discount_type: 'percent' | 'fixed' | 'bogo'
          discount_value: number
          bogo_buy_qty: number
          bogo_get_qty: number
          applies_to: 'all' | 'selected_items'
          channels: ('marketplace' | 'shop' | 'pos')[]
          location_ids: string[]
          min_order_amount: number | null
          usage_limit: number | null
          usage_limit_per_user: number | null
          usage_count: number
          status: 'draft' | 'active' | 'paused' | 'expired'
          starts_at: string | null
          ends_at: string | null
          active_weekdays: number[]
          required_items_mode: 'all' | 'any'
          image_url: string | null
          show_on_shop: boolean
          show_on_marketplace: boolean
          currency: string | null
          user_id: string
          created_at: string
          updated_at: string
        }
        Insert: any
        Update: any
      }
      promotion_required_items: {
        Row: {
          id: string
          promotion_id: string
          catalog_item_id: string
          site_id: string
          min_quantity: number
        }
        Insert: any
        Update: any
      }
      promotion_required_categories: {
        Row: {
          id: string
          promotion_id: string
          catalog_category_id: string
          site_id: string
          min_quantity: number
        }
        Insert: any
        Update: any
      }
      promotion_catalog_items: {
        Row: {
          id: string
          promotion_id: string
          catalog_item_id: string
          site_id: string
        }
        Insert: any
        Update: any
      }
      promotion_catalog_categories: {
        Row: {
          id: string
          promotion_id: string
          catalog_category_id: string
          site_id: string
        }
        Insert: any
        Update: any
      }

      sites: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          name: string
          url: string | null
          user_id: string
          description: string | null
          logo_url: string | null
          resource_urls: ResourceUrl[] | null
          competitors: CompetitorUrl[] | null
          focus_mode: number | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          name: string
          url?: string | null
          user_id: string
          description?: string | null
          logo_url?: string | null
          resource_urls?: ResourceUrl[] | null
          competitors?: CompetitorUrl[] | null
          focus_mode?: number | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          name?: string
          url?: string | null
          user_id?: string
          description?: string | null
          logo_url?: string | null
          resource_urls?: ResourceUrl[] | null
          competitors?: CompetitorUrl[] | null
          focus_mode?: number | null
        }
      }
      settings: {
        Row: {
          id: string
          site_id: string
          about: string | null
          company_size: string | null
          industry: string | null
          products: Json | null
          services: Json | null
          swot: Json | null
          locations: Json | null
          marketing_budget: Json | null
          marketing_channels: Json | null
          social_media: Json | null
          tracking: Json | null
          tracking_code: string | null
          analytics_provider: string | null
          analytics_id: string | null
          team_members: Json | null
          team_roles: Json | null
          org_structure: Json | null
          calendars: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          site_id: string
          about?: string | null
          company_size?: string | null
          industry?: string | null
          products?: Json | null
          services?: Json | null
          swot?: Json | null
          locations?: Json | null
          marketing_budget?: Json | null
          marketing_channels?: Json | null
          social_media?: Json | null
          tracking?: Json | null
          tracking_code?: string | null
          analytics_provider?: string | null
          analytics_id?: string | null
          team_members?: Json | null
          team_roles?: Json | null
          org_structure?: Json | null
          calendars?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          site_id?: string
          about?: string | null
          company_size?: string | null
          industry?: string | null
          products?: Json | null
          services?: Json | null
          swot?: Json | null
          locations?: Json | null
          marketing_budget?: Json | null
          marketing_channels?: Json | null
          social_media?: Json | null
          tracking?: Json | null
          tracking_code?: string | null
          analytics_provider?: string | null
          analytics_id?: string | null
          team_members?: Json | null
          team_roles?: Json | null
          org_structure?: Json | null
          calendars?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      billing: {
        Row: {
          id: string
          site_id: string
          plan: 'commission' | 'startup' | 'enterprise'
          masked_card_number: string | null
          card_name: string | null
          card_expiry: string | null
          stripe_customer_id: string | null
          stripe_payment_method_id: string | null
          card_address: string | null
          card_city: string | null
          card_postal_code: string | null
          card_country: string | null
          tax_id: string | null
          billing_address: string | null
          billing_city: string | null
          billing_postal_code: string | null
          billing_country: string | null
          auto_renew: boolean
          credits_available: number
          credits_used: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          site_id: string
          plan?: 'commission' | 'startup' | 'enterprise'
          masked_card_number?: string | null
          card_name?: string | null
          card_expiry?: string | null
          stripe_customer_id?: string | null
          stripe_payment_method_id?: string | null
          card_address?: string | null
          card_city?: string | null
          card_postal_code?: string | null
          card_country?: string | null
          tax_id?: string | null
          billing_address?: string | null
          billing_city?: string | null
          billing_postal_code?: string | null
          billing_country?: string | null
          auto_renew?: boolean
          credits_available?: number
          credits_used?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          site_id?: string
          plan?: 'commission' | 'startup' | 'enterprise'
          masked_card_number?: string | null
          card_name?: string | null
          card_expiry?: string | null
          stripe_customer_id?: string | null
          stripe_payment_method_id?: string | null
          card_address?: string | null
          card_city?: string | null
          card_postal_code?: string | null
          card_country?: string | null
          tax_id?: string | null
          billing_address?: string | null
          billing_city?: string | null
          billing_postal_code?: string | null
          billing_country?: string | null
          auto_renew?: boolean
          credits_available?: number
          credits_used?: number
          created_at?: string
          updated_at?: string
        }
      }
      users: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          email: string
          name: string | null
          avatar_url: string | null
        }
        Insert: {
          id: string
          created_at?: string
          updated_at?: string
          email: string
          name?: string | null
          avatar_url?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          email?: string
          name?: string | null
          avatar_url?: string | null
        }
      }
    }
    Views: {}
    Functions: {
      current_user_site_role: {
        Args: { p_site_id: string }
        Returns: string | null
      }
      user_can: {
        Args: { p_site_id: string; p_command: string }
        Returns: boolean
      }
      get_my_site_capabilities: {
        Args: { p_site_id: string }
        Returns: {
          role: string | null
          is_owner: boolean
          select: boolean
          insert: boolean
          update: boolean
          delete: boolean
        }
      }
    }
    Enums: {}
  }
}

export interface ResourceUrl {
  key: string
  url: string
}

export interface CompetitorUrl {
  url: string
  name?: string
}

// Create more specific types for the settings fields
export interface Location {
  name: string
  address?: string
  city?: string
  state?: string
  zip?: string
  country?: string
}

export interface SwotAnalysis {
  strengths: string
  weaknesses: string
  opportunities: string
  threats: string
}

export interface MarketingBudget {
  total: number
  available: number
}

export interface SocialMedia {
  platform: string
  url: string
  handle?: string
}

export interface MarketingChannel {
  name: string
  status: 'active' | 'inactive' | 'planned'
  budget?: number
  notes?: string
}

export interface TrackingSettings {
  track_visitors: boolean
  track_actions: boolean
  record_screen: boolean
}

export interface TeamMember {
  email: string
  role: 'view' | 'create' | 'delete' | 'admin'
  name?: string
  position?: string
}

export interface TeamRole {
  name: string
  permissions: string[]
  description?: string
}

export interface SiteMember {
  id: string
  site_id: string
  user_id: string | null
  role: 'owner' | 'admin' | 'marketing' | 'collaborator'
  added_by: string | null
  created_at: string
  updated_at: string
  email: string
  name: string | null
  position: string | null
  status: 'pending' | 'active' | 'rejected'
  blocked_screens?: string[]
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'] 