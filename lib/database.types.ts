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
      experiments: {
        Row: {
          id: string
          name: string
          description: string
          preview_url: string
          status: "draft" | "active" | "completed"
          user_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description: string
          preview_url: string
          status: "draft" | "active" | "completed"
          user_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string
          preview_url?: string
          status?: "draft" | "active" | "completed"
          user_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      experiment_segments: {
        Row: {
          experiment_id: string
          segment_id: string
          created_at: string
        }
        Insert: {
          experiment_id: string
          segment_id: string
          created_at?: string
        }
        Update: {
          experiment_id?: string
          segment_id?: string
          created_at?: string
        }
      }
      segments: {
        Row: {
          id: string
          name: string
          description: string
          user_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description: string
          user_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string
          user_id?: string
          created_at?: string
          updated_at?: string
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