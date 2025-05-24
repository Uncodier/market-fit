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
      agents: {
        Row: {
          id: string
          name: string
          description: string | null
          type: "sales" | "support" | "marketing"
          status: "active" | "inactive" | "training"
          prompt: string
          conversations: number
          success_rate: number
          configuration: Json
          role: string | null
          tools: Json
          activities: Json
          integrations: Json
          supervisor: string | null
          site_id: string
          user_id: string
          created_at: string
          updated_at: string
          last_active: string | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          type: "sales" | "support" | "marketing"
          status?: "active" | "inactive" | "training"
          prompt: string
          conversations?: number
          success_rate?: number
          configuration?: Json
          role?: string | null
          tools?: Json
          activities?: Json
          integrations?: Json
          supervisor?: string | null
          site_id: string
          user_id: string
          created_at?: string
          updated_at?: string
          last_active?: string | null
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          type?: "sales" | "support" | "marketing"
          status?: "active" | "inactive" | "training"
          prompt?: string
          conversations?: number
          success_rate?: number
          configuration?: Json
          role?: string | null
          tools?: Json
          activities?: Json
          integrations?: Json
          supervisor?: string | null
          site_id?: string
          user_id?: string
          created_at?: string
          updated_at?: string
          last_active?: string | null
        }
      }
      agent_assets: {
        Row: {
          agent_id: string
          asset_id: string
          created_at: string
        }
        Insert: {
          agent_id: string
          asset_id: string
          created_at?: string
        }
        Update: {
          agent_id?: string
          asset_id?: string
          created_at?: string
        }
      }
      assets: {
        Row: {
          id: string
          name: string
          description: string | null
          file_path: string
          file_type: string
          file_size: number | null
          metadata: Json | null
          is_public: boolean
          site_id: string
          user_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          file_path: string
          file_type: string
          file_size?: number | null
          metadata?: Json | null
          is_public?: boolean
          site_id: string
          user_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          file_path?: string
          file_type?: string
          file_size?: number | null
          metadata?: Json | null
          is_public?: boolean
          site_id?: string
          user_id?: string
          created_at?: string
          updated_at?: string
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
      conversations: {
        Row: {
          id: string
          title: string
          agent_id: string
          site_id: string
          user_id: string
          created_at: string
          updated_at: string
          last_message_at: string | null
          is_archived: boolean
        }
        Insert: {
          id?: string
          title: string
          agent_id: string
          site_id: string
          user_id: string
          created_at?: string
          updated_at?: string
          last_message_at?: string | null
          is_archived?: boolean
        }
        Update: {
          id?: string
          title?: string
          agent_id?: string
          site_id?: string
          user_id?: string
          created_at?: string
          updated_at?: string
          last_message_at?: string | null
          is_archived?: boolean
        }
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          visitor_id: string | null
          agent_id: string | null
          user_id: string | null
          lead_id: string | null
          role: string
          content: string
          read_at: string | null
          custom_data: Json | null
          created_at: string
          updated_at: string
          command_id: string | null
        }
        Insert: {
          id?: string
          conversation_id: string
          visitor_id?: string | null
          agent_id?: string | null
          user_id?: string | null
          lead_id?: string | null
          role: string
          content: string
          read_at?: string | null
          custom_data?: Json | null
          created_at?: string
          updated_at?: string
          command_id?: string | null
        }
        Update: {
          id?: string
          conversation_id?: string
          visitor_id?: string | null
          agent_id?: string | null
          user_id?: string | null
          lead_id?: string | null
          role?: string
          content?: string
          read_at?: string | null
          custom_data?: Json | null
          created_at?: string
          updated_at?: string
          command_id?: string | null
        }
      }
      referral_codes: {
        Row: {
          id: string
          code: string
          description: string | null
          is_active: boolean
          max_uses: number | null
          current_uses: number
          expires_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          description?: string | null
          is_active?: boolean
          max_uses?: number | null
          current_uses?: number
          expires_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          code?: string
          description?: string | null
          is_active?: boolean
          max_uses?: number | null
          current_uses?: number
          expires_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      waitlist: {
        Row: {
          id: string
          email: string
          name: string | null
          referral_code_attempted: string | null
          source: string
          status: "pending" | "approved" | "rejected" | "converted"
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          name?: string | null
          referral_code_attempted?: string | null
          source?: string
          status?: "pending" | "approved" | "rejected" | "converted"
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          referral_code_attempted?: string | null
          source?: string
          status?: "pending" | "approved" | "rejected" | "converted"
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      referral_code_uses: {
        Row: {
          id: string
          referral_code_id: string
          user_id: string
          used_at: string
        }
        Insert: {
          id?: string
          referral_code_id: string
          user_id: string
          used_at?: string
        }
        Update: {
          id?: string
          referral_code_id?: string
          user_id?: string
          used_at?: string
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