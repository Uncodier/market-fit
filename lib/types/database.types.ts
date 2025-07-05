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
    Functions: {}
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
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'] 