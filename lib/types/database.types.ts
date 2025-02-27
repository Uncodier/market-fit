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

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'] 