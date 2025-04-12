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
          size: string | null
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
          size?: string | null
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
          size?: string | null
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
      commands: {
        Row: {
          id: string
          uuid: string
          task: string
          status: "pending" | "running" | "completed" | "failed" | "cancelled"
          user_id: string
          description: string | null
          results: Json | null
          targets: Json | null
          tools: Json | null
          context: string | null
          supervisor: Json | null
          created_at: string
          updated_at: string
          completion_date: string | null
          duration: number | null
          model: string | null
          agent_id: string | null
          output_tokens: number | null
          input_tokens: number | null
        }
        Insert: {
          id?: string
          uuid: string
          task: string
          status?: "pending" | "running" | "completed" | "failed" | "cancelled"
          user_id: string
          description?: string | null
          results?: Json | null
          targets?: Json | null
          tools?: Json | null
          context?: string | null
          supervisor?: Json | null
          created_at?: string
          updated_at?: string
          completion_date?: string | null
          duration?: number | null
          model?: string | null
          agent_id?: string | null
          output_tokens?: number | null
          input_tokens?: number | null
        }
        Update: {
          id?: string
          uuid?: string
          task?: string
          status?: "pending" | "running" | "completed" | "failed" | "cancelled"
          user_id?: string
          description?: string | null
          results?: Json | null
          targets?: Json | null
          tools?: Json | null
          context?: string | null
          supervisor?: Json | null
          created_at?: string
          updated_at?: string
          completion_date?: string | null
          duration?: number | null
          model?: string | null
          agent_id?: string | null
          output_tokens?: number | null
          input_tokens?: number | null
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