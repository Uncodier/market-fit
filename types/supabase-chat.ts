import type { Json } from "./supabase"

export type ProfilesTable = {
  Row: { id: string; email: string | null; name: string | null; avatar_url: string | null; settings: Json }
  Insert: { id: string; email?: string | null; name?: string | null; avatar_url?: string | null }
  Update: { email?: string | null; name?: string | null; avatar_url?: string | null }
  Relationships: []
}

export type ConversationsTable = {
        Row: {
          id: string
          visitor_id: string | null
          agent_id: string | null
          user_id: string | null
          lead_id: string | null
          site_id: string | null
          status: string | null
          title: string | null
          custom_data: Json | null
          created_at: string
          updated_at: string
          last_message_at: string | null
          is_archived: boolean
          command_id: string | null
          flag: number | null
          delegate_id: string | null
          channel: string | null
        }
        Insert: {
          id?: string
          visitor_id?: string | null
          agent_id?: string | null
          user_id?: string | null
          lead_id?: string | null
          site_id?: string | null
          status?: string | null
          title?: string | null
          custom_data?: Json | null
          created_at?: string
          updated_at?: string
          last_message_at?: string | null
          is_archived?: boolean
          command_id?: string | null
          flag?: number | null
          delegate_id?: string | null
          channel?: string | null
        }
        Update: {
          id?: string
          visitor_id?: string | null
          agent_id?: string | null
          user_id?: string | null
          lead_id?: string | null
          site_id?: string | null
          status?: string | null
          title?: string | null
          custom_data?: Json | null
          created_at?: string
          updated_at?: string
          last_message_at?: string | null
          is_archived?: boolean
          command_id?: string | null
          flag?: number | null
          delegate_id?: string | null
          channel?: string | null
        }
      Relationships: []
}

export type MessagesTable = {
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
      Relationships: [{
        foreignKeyName: "messages_conversation_id_fkey"
        columns: ["conversation_id"]
        isOneToOne: false
        referencedRelation: "conversations"
        referencedColumns: ["id"]
      }]
}

