import type { Json } from "./supabase"
import type { Agent } from "@/app/types/agents"

export type SegmentsTable = {
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
      Relationships: []
}

export type AgentsTable = {
        Row: {
          id: string
          name: string
          description: string | null
          type: Agent["type"]
          status: Agent["status"]
          icon: string | null
          prompt: string
          conversations: number
          success_rate: number
          configuration: Json
          role: string | null
          tools: Agent["tools"]
          activities: Agent["activities"]
          integrations: Agent["integrations"]
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
          type: Agent["type"]
          status?: Agent["status"]
          icon?: string | null
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
          type?: Agent["type"]
          status?: Agent["status"]
          icon?: string | null
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
      Relationships: []
}

export type AgentAssetsTable = {
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
      Relationships: []
}

export type ContentAssetsTable = {
        Row: {
          content_id: string
          asset_id: string
          position: number
          is_primary: boolean
          created_at: string
        }
        Insert: {
          content_id: string
          asset_id: string
          position?: number
          is_primary?: boolean
          created_at?: string
        }
        Update: {
          content_id?: string
          asset_id?: string
          position?: number
          is_primary?: boolean
          created_at?: string
        }
      Relationships: []
}

export type AssetsTable = {
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
      Relationships: []
}

export type CommandsTable = {
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
      Relationships: []
}

