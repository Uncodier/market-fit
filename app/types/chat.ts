import { Database } from "@/types/supabase"
import type { SocialCommentReplyContext } from "@/lib/chat/social-comment-context"

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
  /** Display-only external contact label; does not imply a linked lead. */
  participantName?: string
  /** Post reference for comment conversations; custom subjects remain in title. */
  subtitle?: string
  leadStatus?: string
  channel?: 'web' | 'email' | 'whatsapp' | 'instagram' | 'messenger' | 'sms' | 'telegram' | 'voice' | 'website_chat' | string
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
    status?: "pending" | "sent" | "delivered" | "failed" | "accepted"
    [key: string]: any
  }
  /** Read-only exact parent preview; never serialized into message custom_data. */
  replyContext?: SocialCommentReplyContext
  // Sender information retained for UI compatibility.
  sender_id?: string
  sender_name?: string
  sender_avatar?: string
  // Command associated with the message, used for feedback.
  command_id?: string
  // Agent that sent an assistant message.
  agent_id?: string
} 