import { Database } from "@/types/supabase"

export type Conversation = Database["public"]["Tables"]["conversations"]["Row"]
export type Message = Database["public"]["Tables"]["messages"]["Row"]

export interface ConversationWithMessages extends Conversation {
  messages: Message[]
}

export interface MessageWithSender extends Message {
  sender_name?: string
  sender_avatar?: string
}

export interface ConversationListItem {
  id: string
  title: string
  agentId: string
  agentName: string
  lastMessage?: string
  timestamp: Date
  unreadCount?: number
  messageCount?: number
  leadName?: string
  leadStatus?: string
  channel?: 'web' | 'email' | 'whatsapp'
  status?: 'pending' | 'active' | 'closed' | 'archived'
  hasAcceptedMessage?: boolean
}

export interface ChatMessage {
  id?: string
  role: "user" | "agent" | "assistant" | "team_member" | "visitor" | "system"
  text: string
  timestamp: Date
  metadata?: {
    command_status?: "failed" | "pending" | "success"
    error_message?: string
    status?: "pending" | "sent" | "delivered" | "failed"
    [key: string]: any
  }
  // Información del remitente (para retrocompatibilidad en la UI)
  sender_id?: string
  sender_name?: string
  sender_avatar?: string
  // ID del comando asociado al mensaje (para feedback)
  command_id?: string
  // ID del agente que envió el mensaje (para mensajes de tipo "assistant")
  agent_id?: string
} 