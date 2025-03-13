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
      segments: {
        Row: {
          id: string
          name: string
          description: string | null
          audience: string | null
          language: string | null
          size: number | null
          engagement: number | null
          created_at: string
          keywords: Json | null
          hot_topics: Json | null
          analysis: Json | null
          topics: Json | null
          icp: Json | null
          user_id: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          audience?: string | null
          language?: string | null
          size?: number | null
          engagement?: number | null
          created_at?: string
          keywords?: Json | null
          hot_topics?: Json | null
          analysis?: Json | null
          topics?: Json | null
          icp?: Json | null
          user_id: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          audience?: string | null
          language?: string | null
          size?: number | null
          engagement?: number | null
          created_at?: string
          keywords?: Json | null
          hot_topics?: Json | null
          analysis?: Json | null
          topics?: Json | null
          icp?: Json | null
          user_id?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
} 