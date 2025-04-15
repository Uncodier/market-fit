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
}

export interface ChatMessage {
  id?: string
  role: "user" | "agent" | "assistant"
  text: string
  timestamp: Date
  metadata?: Record<string, any>
} 