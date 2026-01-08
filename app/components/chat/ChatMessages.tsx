"use client"

import React, { RefObject, useState, useEffect, useMemo } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar"
import { Badge } from "@/app/components/ui/badge"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTheme } from "@/app/context/ThemeContext"
import { ChatMessage } from "@/app/types/chat"
import { EmptyConversation } from "./EmptyConversation"
import * as Icons from "@/app/components/ui/icons"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import ReactMarkdown from "react-markdown"
import { EmptyState } from "@/app/components/ui/empty-state"
import { MessageSquare } from "@/app/components/ui/icons"
import { DelayTimer } from "./DelayTimer"
import { EditMessageModal } from "./EditMessageModal"
import { MessageActions } from "./MessageActions"
import { formatEmailForChat, isMimeMultipartMessage } from "@/app/utils/email-formatter"
import { extractCleanText } from "@/app/utils/text-cleaning"
import { EmailViewer } from "@/app/components/email/EmailViewer"
import { useSite } from "@/app/context/SiteContext"
import { useRef } from "react"
import { getConversationMessages } from "../../services/getConversationMessages.client"
import { truncateAgentName, truncateLeadName } from "@/app/utils/name-utils"
import { useAuthContext } from "@/app/components/auth/auth-provider"
import { getUserData } from "@/app/services/user-service"

// Helper function to format date as "Month Day, Year"
const formatDate = (date: Date) => {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
};

// Function to aggressively remove ALL HTML tags - ULTRA AGGRESSIVE VERSION
const removeAllHtmlTags = (text: string): string => {
  console.log('🔧 [removeAllHtmlTags] Input:', text.substring(0, 100) + '...')
  
  let cleaned = text
  
  // Method 1: Remove everything from < to > (including multiline)
  cleaned = cleaned.replace(/<[^>]*>/g, '')
  
  // Method 2: If that fails, try character by character approach
  if (cleaned.includes('<')) {
    console.log('🔧 [removeAllHtmlTags] First method failed, trying character approach...')
    let result = ''
    let inTag = false
    
    for (let i = 0; i < cleaned.length; i++) {
      const char = cleaned[i]
      if (char === '<') {
        inTag = true
      } else if (char === '>') {
        inTag = false
      } else if (!inTag) {
        result += char
      }
    }
    cleaned = result
  }
  
  // Clean up multiple spaces and normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim()
  
  console.log('🔧 [removeAllHtmlTags] Output:', cleaned.substring(0, 100) + '...')
  return cleaned
}

// Helper function to check if content is an email
const isEmailContent = (text: string): boolean => {
  // Only detect as email if it's clearly a MIME multipart message
  return isMimeMultipartMessage(text)
}

// Helper function to format message content
const formatMessageContent = (text: string, metadata?: any): string => {
  console.log('🔍 [formatMessageContent] RAW MESSAGE:', text)
  console.log('🔍 [formatMessageContent] METADATA:', metadata)
  console.log('🔍 [formatMessageContent] Text type:', typeof text)
  console.log('🔍 [formatMessageContent] Text length:', text?.length)
  
  // If it's an email, return a special marker that we'll handle in the render
  if (isEmailContent(text)) {
    console.log('✅ [formatMessageContent] Email content detected')
    return 'email-content-token'
  }
  
  // Only clean HTML if it's clearly HTML content (not markdown)
  if (text && text.includes('<') && /<[^>]+>/.test(text) && !text.includes('**') && !text.includes('##')) {
    console.log('🧽 [formatMessageContent] HTML cleanup for HTML content...')
    const cleaned = removeAllHtmlTags(text)
    console.log('✨ [formatMessageContent] Cleaned HTML result:', cleaned.substring(0, 100) + '...')
    return cleaned
  }
  
  console.log('⚠️ [formatMessageContent] Returning original text for markdown/plain text')
  return text
};

// Helper function to check if two dates are the same day
const isSameDay = (date1: Date, date2: Date) => {
  return date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate();
};

// Helper function to render message content with email detection
const renderMessageContent = (msg: ChatMessage, markdownComponents: any) => {
  const formattedContent = formatMessageContent(msg.text, msg.metadata);
  console.log('🔍 [renderMessageContent] Message text length:', msg.text?.length);
  console.log('🔍 [renderMessageContent] Formatted content:', formattedContent);
  console.log('🔍 [renderMessageContent] Is email content?', formattedContent === 'email-content-token');
  
  return formattedContent === 'email-content-token' ? (
    <EmailViewer 
      emailContent={msg.text}
      className="w-full"
    />
  ) : (
    <div className="text-sm leading-relaxed prose prose-sm max-w-none dark:prose-invert prose-headings:font-medium prose-p:leading-relaxed prose-pre:bg-muted w-full overflow-hidden break-words word-wrap hyphens-auto" style={{ wordWrap: 'break-word', overflowWrap: 'break-word', wordBreak: 'break-word' }}>
      <ReactMarkdown components={markdownComponents}>{formattedContent}</ReactMarkdown>
    </div>
  );
};

interface ChatMessagesProps {
  chatMessages: ChatMessage[]
  isLoadingMessages: boolean
  isAgentResponding: boolean
  isTransitioningConversation?: boolean
  messagesEndRef: RefObject<HTMLDivElement | null>
  agentId: string
  agentName: string
  isAgentOnlyConversation: boolean
  isLead: boolean
  leadData: any
  conversationId?: string
  onRetryMessage?: (failedMessage: ChatMessage) => Promise<void>
  onMessagesUpdate?: (messages: ChatMessage[]) => void
}

// Message feedback widget component
interface MessageFeedbackProps {
  messageId: string;
  commandId?: string;
  agentId: string;
}

const MessageFeedback: React.FC<MessageFeedbackProps> = ({ messageId, commandId, agentId }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [performance, setPerformance] = useState<number | null>(null);
  const supabase = createClient();
  const router = useRouter();

  // Debug logs to check if component is mounting with correct props
  useEffect(() => {
    console.log(`MessageFeedback mounted for message: ${messageId}, command: ${commandId}`);
    if (commandId) {
      fetchPerformanceStatus();
    }
  }, [commandId, messageId]);

  // Función para obtener el estado actual del performance
  const fetchPerformanceStatus = async () => {
    if (!commandId) return;
    
    try {
      console.log(`Fetching performance status for command: ${commandId}`);
      const { data, error } = await supabase
        .rpc('get_performance_status', { command_id: commandId });
      
      if (error) {
        // Debug: Log the actual error structure to understand it better
        console.debug('Performance status error details:', {
          error,
          errorKeys: Object.keys(error),
          errorType: typeof error,
          hasMessage: !!error.message,
          hasCode: !!error.code,
          errorString: JSON.stringify(error)
        });
        
        // Check if it's a function not found error (common when RPC doesn't exist)
        if (error.message?.includes('function') || 
            error.code === '42883' || 
            error.code === 'PGRST202' ||
            Object.keys(error).length === 0 ||
            (typeof error === 'object' && !error.message && !error.code)) {
          console.warn('Performance tracking RPC function not available - feature disabled');
          return;
        }
        console.warn('Error fetching performance status:', error);
        return;
      }
      
      if (data && data.length > 0) {
        // Convertir el resultado a un número de bitmask
        let bitmask = 0;
        if (data[0].has_like) bitmask |= 1;
        if (data[0].has_dislike) bitmask |= 2;
        if (data[0].has_flag) bitmask |= 4;
        
        console.log(`Performance status loaded: ${bitmask}`);
        setPerformance(bitmask);
      }
    } catch (error) {
      // Improve error logging with more context
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorDetails = error && typeof error === 'object' ? JSON.stringify(error) : String(error);
      console.warn(`Performance tracking unavailable for command ${commandId}: ${errorMessage}`, errorDetails);
    }
  };

  const handleLike = async (e: React.MouseEvent<HTMLButtonElement>) => {
    // Prevent event bubbling
    e.preventDefault();
    e.stopPropagation();
    
    if (!commandId || isLoading) return;
    
    console.log(`Liking command: ${commandId}`);
    setIsLoading(true);
    try {
      const { error } = await supabase
        .rpc('set_like', { command_id: commandId });
      
      if (error) {
        // Check if it's a function not found error
        if (error.message?.includes('function') || error.code === '42883') {
          console.warn('Performance tracking not available - like feature disabled');
          toast.error("Like feature temporarily unavailable");
        } else {
          console.error('Error setting like:', error);
          toast.error("Failed to save like");
        }
      } else {
        // Actualizar el estado local
        setPerformance((prev) => {
          if (prev === null) return 1;
          return (prev & ~2) | 1; // Eliminar dislike si existe y establecer like
        });
        toast.success("Like saved successfully");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`Like feature unavailable: ${errorMessage}`);
      toast.error("Like feature temporarily unavailable");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDislike = async (e: React.MouseEvent<HTMLButtonElement>) => {
    // Prevent event bubbling
    e.preventDefault();
    e.stopPropagation();
    
    if (!commandId || isLoading) return;
    
    console.log(`Disliking command: ${commandId}`);
    setIsLoading(true);
    try {
      const { error } = await supabase
        .rpc('set_dislike', { command_id: commandId });
      
      if (error) {
        // Check if it's a function not found error
        if (error.message?.includes('function') || error.code === '42883') {
          console.warn('Performance tracking not available - dislike feature disabled');
          toast.error("Dislike feature temporarily unavailable");
        } else {
          console.error('Error setting dislike:', error);
          toast.error("Failed to save dislike");
        }
      } else {
        // Actualizar el estado local
        setPerformance((prev) => {
          if (prev === null) return 2;
          return (prev & ~1) | 2; // Eliminar like si existe y establecer dislike
        });
        toast.success("Dislike saved successfully");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`Dislike feature unavailable: ${errorMessage}`);
      toast.error("Dislike feature temporarily unavailable");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFlag = async (e: React.MouseEvent<HTMLButtonElement>) => {
    // Prevent event bubbling
    e.preventDefault();
    e.stopPropagation();
    
    if (!commandId || isLoading) return;
    
    console.log(`Toggling flag for command: ${commandId}`);
    setIsLoading(true);
    try {
      const { error } = await supabase
        .rpc('toggle_flag', { command_id: commandId });
      
      if (error) {
        // Check if it's a function not found error
        if (error.message?.includes('function') || error.code === '42883') {
          console.warn('Performance tracking not available - flag feature disabled');
          toast.error("Flag feature temporarily unavailable");
        } else {
          console.error('Error toggling flag:', error);
          toast.error("Failed to save flag");
        }
      } else {
        // Actualizar el estado local
        setPerformance((prev) => {
          if (prev === null) return 4;
          return prev ^ 4; // Alternar el bit del flag
        });
        toast.success("Flag saved successfully");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`Flag feature unavailable: ${errorMessage}`);
      toast.error("Flag feature temporarily unavailable");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInspect = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Prevent event bubbling
    e.preventDefault();
    e.stopPropagation();
    
    if (!commandId) return;
    
    // Use Next.js router for client-side navigation instead of window.location.href
    console.log(`Inspecting command: ${commandId} for agent: ${agentId}`);
    router.push(`/agents/${agentId}/${commandId}`);
  };

  return (
    <div className="flex items-center gap-3 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button 
              onClick={handleLike} 
              disabled={isLoading}
              className={`w-8 h-8 flex items-center justify-center rounded hover:bg-green-100 dark:hover:bg-green-900/30 ${
                performance !== null && (performance & 1) === 1 
                  ? 'text-green-500 bg-green-100 dark:bg-green-900/30' 
                  : 'text-green-500'
              }`}
              aria-label="Like"
              type="button"
            >
              {/* Thumbs Up Icon */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 10v12" />
                <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z" />
              </svg>
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Like</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button 
              onClick={handleDislike} 
              disabled={isLoading}
              className={`w-8 h-8 flex items-center justify-center rounded hover:bg-red-100 dark:hover:bg-red-900/30 ${
                performance !== null && (performance & 2) === 2 
                  ? 'text-red-500 bg-red-100 dark:bg-red-900/30' 
                  : 'text-red-500'
              }`}
              aria-label="Dislike"
              type="button"
            >
              {/* Thumbs Down Icon */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 14V2" />
                <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z" />
              </svg>
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Dislike</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button 
              onClick={handleInspect} 
              disabled={isLoading || !commandId}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-500"
              aria-label="Inspect"
              type="button"
            >
              <Icons.Eye size={16} />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Inspect</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button 
              onClick={handleFlag} 
              disabled={isLoading}
              className={`w-8 h-8 flex items-center justify-center rounded hover:bg-amber-100 dark:hover:bg-amber-900/30 ${
                performance !== null && (performance & 4) === 4 
                  ? 'text-amber-500 bg-amber-100 dark:bg-amber-900/30' 
                  : 'text-amber-500'
              }`}
              aria-label="Report Issue"
              type="button"
            >
              {/* Flag Icon */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
                <line x1="4" y1="22" x2="4" y2="15"></line>
              </svg>
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Report Issue</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

export function ChatMessages({
  chatMessages,
  isLoadingMessages,
  isAgentResponding,
  isTransitioningConversation = false,
  messagesEndRef,
  agentId,
  agentName,
  isAgentOnlyConversation,
  isLead,
  leadData,
  conversationId,
  onRetryMessage,
  onMessagesUpdate
}: ChatMessagesProps) {
  // Determine if we should show assignee instead of agent (same logic as ChatHeader)
  // Prefer prop for immediate rendering to avoid layout jumps; fallback to leadData if available
  const hasLead = isLead || !!(leadData && (leadData.id || leadData.lead_id))
  const hasAssignee = !!(hasLead && leadData?.assignee)

  // Use theme context for dark mode detection
  const { isDarkMode } = useTheme()
  // Current user context for reliable team member name/avatar
  const { user } = useAuthContext()
  // Router for navigation
  const router = useRouter()

  const currentUserId = user?.id
  const currentUserName = user?.user_metadata?.name 
    || user?.user_metadata?.full_name 
    || (user?.email ? user.email.split('@')[0] : undefined)
  const currentUserAvatar = (user?.user_metadata?.avatar_url as string | undefined)
    || (user?.user_metadata?.picture as string | undefined)
    || (user?.identities?.[0]?.identity_data as any)?.avatar_url
  
  // Pre-process messages to determine user types before rendering
  const processedMessages = useMemo(() => {
    if (!chatMessages.length) return []
    
    // Debug logging to help identify ordering issues
    console.log(`🔍 [ChatMessages] Rendering ${chatMessages.length} messages:`)
    console.log(`📝 Message order:`, chatMessages.map((msg, index) => `${index + 1}. ${msg.role} at ${msg.timestamp.toISOString()}`).slice(0, 5))
    
    return chatMessages.map((msg) => {
      // CORRECTIVE LOGIC: Fix incorrect roles based on context FIRST
      let correctedRole = msg.role
      
      // Apply corrective logic for roles
      if (msg.role === "user" && msg.sender_id && msg.sender_id !== currentUserId) {
        // This is a lead/visitor message (correct)
        correctedRole = "user"
      } else if (msg.role === "team_member") {
        // This is a team member message (correct)
        correctedRole = "team_member"
      } else if (msg.role === "visitor") {
        // This is a visitor message (correct)
        correctedRole = "visitor"
      } else if (msg.role === "user" && msg.sender_id === "541396e1-a904-4a81-8cbf-0ca4e3b8b2b4") {
        // Special case: System user ID with "user" role should be treated as visitor/lead
        correctedRole = "visitor"
      }
      
      // Determine alignment and ownership flags per business rules
      // - agent/assistant/system => left
      // - team_member => left if there is a lead present, right when there's no lead (team/private) or agent-only mode
      // - user/visitor => always right
      const isTeamMemberRight = correctedRole === "team_member" && (!hasLead || isAgentOnlyConversation)
      const isRightAligned = (correctedRole === "user" || correctedRole === "visitor") || isTeamMemberRight
      const isCurrentUserMessage = msg.sender_id === currentUserId
      
      // Debug logging for user identification
      // Note: "user" role = lead/visitor, "team_member" role = team member
      if (msg.role === "user" || msg.role === "team_member") {
        console.log(`🔍 [User Identification] Message ${msg.id}:`, {
          originalRole: msg.role,
          correctedRole: correctedRole,
          sender_id: msg.sender_id,
          currentUserId: currentUserId,
          sender_name: msg.sender_name,
          currentUserName: currentUserName,
          isCurrentUserMessage: isCurrentUserMessage
        })
      }
      
      return {
        ...msg,
        role: correctedRole, // Use corrected role
        isCurrentUserMessage,
        isRightAligned
      }
    })
  }, [chatMessages, currentUserId, currentUserName, isAgentOnlyConversation, hasLead])
  
  // State for edit message modal
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null)
  
  // State for delete/accept operations
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null)
  const [acceptingMessageId, setAcceptingMessageId] = useState<string | null>(null)
  // State to track which messages have accepted actions (without changing message status)
  const [acceptedActionsMessageIds, setAcceptedActionsMessageIds] = useState<Set<string>>(new Set())
  
  // State for user data cache
  const [userDataCache, setUserDataCache] = useState<Record<string, { name: string, avatar_url: string | null }>>({})
  
  // State for agent data cache
  const [agentDataCache, setAgentDataCache] = useState<Record<string, { name: string, avatar_url?: string | null }>>({})

  // Effect to fetch user data for messages with user_id that are not current user
  useEffect(() => {
    const fetchUserData = async () => {
      const userIdsToFetch: string[] = []
      
      // Find all unique user IDs that are not current user and not in cache
      chatMessages.forEach(msg => {
        if (msg.sender_id && 
            msg.sender_id !== currentUserId && 
            !userDataCache[msg.sender_id] &&
            (msg.role === "user" || msg.role === "team_member")) {
          userIdsToFetch.push(msg.sender_id)
        }
      })
      
      // Fetch user data for each unique ID
      for (const userId of userIdsToFetch) {
        try {
          const userData = await getUserData(userId)
          if (userData) {
            setUserDataCache(prev => ({
              ...prev,
              [userId]: userData
            }))
          }
        } catch (error) {
          console.error(`Error fetching user data for ${userId}:`, error)
        }
      }
    }
    
    if (chatMessages.length > 0) {
      fetchUserData()
    }
  }, [chatMessages, currentUserId, userDataCache])
  
  // Effect to fetch agent data for messages with agent_id (for assistant role)
  useEffect(() => {
    const fetchAgentData = async () => {
      const agentIdsToFetch: string[] = []
      
      // Find all unique agent IDs that are not in cache
      chatMessages.forEach(msg => {
        const msgAgentId = msg.agent_id
        if (msgAgentId && 
            !agentDataCache[msgAgentId] &&
            (msg.role === "assistant" || msg.role === "agent")) {
          agentIdsToFetch.push(msgAgentId)
        }
      })
      
      // Fetch agent data for each unique ID
      for (const agentId of agentIdsToFetch) {
        try {
          const { getAgentForConversation } = await import("@/app/services/chat-service.client")
          const agentData = await getAgentForConversation(agentId)
          if (agentData) {
            setAgentDataCache(prev => ({
              ...prev,
              [agentId]: {
                name: agentData.name,
                avatar_url: null // Agents typically don't have avatars
              }
            }))
          }
        } catch (error) {
          console.error(`Error fetching agent data for ${agentId}:`, error)
        }
      }
    }
    
    if (chatMessages.length > 0) {
      fetchAgentData()
    }
  }, [chatMessages, agentDataCache])

  // Function to handle editing a message
  const handleEditMessage = (message: ChatMessage) => {
    setEditingMessage(message)
    setEditModalOpen(true)
  }

  // Function to save edited message
  const handleSaveEditedMessage = async (messageId: string, newText: string) => {
    if (!messageId || !newText.trim()) {
      toast.error("Message content cannot be empty")
      return
    }

    try {
      const supabase = createClient()
      
      // Update the message in the database
      const { error } = await supabase
        .from("messages")
        .update({ 
          content: newText.trim(),
          updated_at: new Date().toISOString()
        })
        .eq("id", messageId)

      if (error) {
        console.error("Error updating message:", error)
        toast.error("Failed to update message")
        return
      }

      console.log("Successfully updated message:", messageId)

      // Update local state immediately for better UX
      const updatedMessages = chatMessages.map(msg => 
        msg.id === messageId 
          ? { ...msg, text: newText.trim() }
          : msg
      )

      // If onMessagesUpdate callback is provided, use it to update parent state
      if (onMessagesUpdate) {
        onMessagesUpdate(updatedMessages)
      }

      // If we have a conversationId, also refresh from database to ensure consistency
      if (conversationId && !conversationId.startsWith("new-")) {
        try {
          const refreshedMessages = await getConversationMessages(conversationId)
          if (onMessagesUpdate && refreshedMessages.length > 0) {
            onMessagesUpdate(refreshedMessages)
          }
        } catch (refreshError) {
          console.error("Error refreshing messages:", refreshError)
          // Don't show error to user for refresh, local update was successful
        }
      }

      toast.success("Message updated successfully")
      
      // Close the edit modal
      setEditModalOpen(false)
      setEditingMessage(null)
      
    } catch (error) {
      console.error("Unexpected error updating message:", error)
      toast.error("An unexpected error occurred")
    }
  }

  // Function to handle deleting a message
  const handleDeleteMessage = async (message: ChatMessage) => {
    if (!message.id) {
      toast.error("Cannot delete message: missing ID")
      return
    }

    setDeletingMessageId(message.id)

    try {
      const supabase = createClient()

      // Check if this is the only message in the conversation
      const { data: allMessages, error: fetchError } = await supabase
        .from("messages")
        .select("id")
        .eq("conversation_id", conversationId || "")

      if (fetchError) {
        console.error("Error fetching messages:", fetchError)
        toast.error("Failed to check conversation messages")
        setDeletingMessageId(null)
        return
      }

      const isOnlyMessage = allMessages && allMessages.length === 1

      // Delete the message
      const { error: deleteError } = await supabase
        .from("messages")
        .delete()
        .eq("id", message.id)

      if (deleteError) {
        console.error("Error deleting message:", deleteError)
        toast.error("Failed to delete message")
        setDeletingMessageId(null)
        return
      }

      // If it's the only message, delete the conversation as well
      if (isOnlyMessage && conversationId && !conversationId.startsWith("new-")) {
        // First delete any remaining messages (should be none, but just in case)
        await supabase
          .from("messages")
          .delete()
          .eq("conversation_id", conversationId)

        // Then delete the conversation
        const { error: conversationError } = await supabase
          .from("conversations")
          .delete()
          .eq("id", conversationId)

        if (conversationError) {
          console.error("Error deleting conversation:", conversationError)
          // Don't show error, message was deleted successfully
        } else {
          // Emit custom event to notify ChatList to refresh
          window.dispatchEvent(new CustomEvent('conversation:deleted', {
            detail: { conversationId }
          }))
        }

        // Redirect to chat list
        router.push("/chat")
        toast.success("Message and conversation deleted")
      } else {
        // Update local state
        const updatedMessages = chatMessages.filter(msg => msg.id !== message.id)
        if (onMessagesUpdate) {
          onMessagesUpdate(updatedMessages)
        }
        toast.success("Message deleted")
      }

    } catch (error) {
      console.error("Unexpected error deleting message:", error)
      toast.error("An unexpected error occurred")
    } finally {
      setDeletingMessageId(null)
    }
  }

  // Function to handle accepting a message
  const handleAcceptMessage = async (message: ChatMessage) => {
    if (!message.id) {
      toast.error("Cannot accept message: missing ID")
      return
    }

    setAcceptingMessageId(message.id)

    try {
      const supabase = createClient()

      // Get current custom_data to preserve other metadata
      const { data: currentMessage, error: fetchError } = await supabase
        .from("messages")
        .select("custom_data")
        .eq("id", message.id)
        .single()

      if (fetchError) {
        console.error("Error fetching message:", fetchError)
        toast.error("Failed to fetch message data")
        setAcceptingMessageId(null)
        return
      }

      // Update custom_data with accepted status
      const currentCustomData = (currentMessage?.custom_data as Record<string, any>) || {}
      const updatedCustomData = {
        ...currentCustomData,
        status: "accepted"
      }

      const { error: updateError } = await supabase
        .from("messages")
        .update({
          custom_data: updatedCustomData,
          updated_at: new Date().toISOString()
        })
        .eq("id", message.id)

      if (updateError) {
        console.error("Error updating message status:", updateError)
        toast.error("Failed to accept message")
        setAcceptingMessageId(null)
        return
      }

      // Update local state
      // 1. Add to accepted actions set (for immediate UI feedback)
      setAcceptedActionsMessageIds(prev => new Set(prev).add(message.id!))
      
      // 2. Update message in local list with the updated custom_data from DB
      const updatedMessages = chatMessages.map(msg =>
        msg.id === message.id
          ? {
              ...msg,
              metadata: updatedCustomData
            }
          : msg
      )

      if (onMessagesUpdate) {
        onMessagesUpdate(updatedMessages)
      }
      
      toast.success("Message accepted")

    } catch (error) {
      console.error("Unexpected error accepting message:", error)
      toast.error("An unexpected error occurred")
    } finally {
      setAcceptingMessageId(null)
    }
  }

  // Function to undo accepting a message (return to pending actions)
  const handleUndoAcceptMessage = async (message: ChatMessage) => {
    if (!message.id) return

    try {
      const supabase = createClient()

      // Update message status to pending in database
      const { data: currentMessage, error: fetchError } = await supabase
        .from("messages")
        .select("custom_data")
        .eq("id", message.id)
        .single()

      if (fetchError) {
        console.error("Error fetching message:", fetchError)
        toast.error("Failed to update message status")
        return
      }

      const currentCustomData = (currentMessage?.custom_data as Record<string, any>) || {}
      const updatedCustomData = {
        ...currentCustomData,
        status: "pending"
      }

      const { error: updateError } = await supabase
        .from("messages")
        .update({
          custom_data: updatedCustomData,
          updated_at: new Date().toISOString()
        })
        .eq("id", message.id)

      if (updateError) {
        console.error("Error updating message status:", updateError)
        toast.error("Failed to return message to pending")
        return
      }

      // Update local state to remove from accepted actions set
      setAcceptedActionsMessageIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(message.id!)
        return newSet
      })

      // Update message in local list with the updated custom_data from DB
      const updatedMessages = chatMessages.map(msg =>
        msg.id === message.id
          ? {
              ...msg,
              metadata: updatedCustomData
            }
          : msg
      )

      if (onMessagesUpdate) {
        onMessagesUpdate(updatedMessages)
      }

      toast.success("Message returned to pending")
    } catch (error) {
      console.error("Unexpected error undoing accept:", error)
      toast.error("An unexpected error occurred")
    }
  }

  // Function to get estimated send time
  const getEstimatedSendTime = (message: ChatMessage) => {
    if (!message.metadata?.delay_timer) return null
    
    const delayTimer = message.metadata.delay_timer
    const endTime = typeof delayTimer === 'string' ? new Date(delayTimer).getTime() : delayTimer
    
    return new Date(endTime).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  // Check if a conversation is selected
  const hasSelectedConversation = conversationId && conversationId !== "" && !conversationId.startsWith("new-");

  // Componentes personalizados para ReactMarkdown
  const markdownComponents = {
    img: ({ node, ...props }: any) => (
      <img 
        style={{ maxWidth: '100%', height: 'auto', borderRadius: '4px' }} 
        {...props} 
      />
    ),
    pre: ({ node, ...props }: any) => (
      <pre 
        style={{ 
          whiteSpace: 'pre-wrap', 
          overflowX: 'auto',
          wordBreak: 'break-word',
          overflowWrap: 'break-word',
          maxWidth: '100%'
        }} 
        {...props} 
      />
    ),
    code: ({ node, ...props }: any) => (
      <code 
        style={{ 
          wordBreak: 'break-word',
          overflowWrap: 'break-word',
          whiteSpace: 'pre-wrap'
        }} 
        {...props} 
      />
    ),
    table: ({ node, ...props }: any) => (
      <div style={{ overflowX: 'auto', width: '100%' }}>
        <table {...props} />
      </div>
    )
  }

  if (!hasSelectedConversation) {
    return (
      <div className="flex-1 overflow-visible py-6 transition-colors duration-300 ease-in-out pt-[91px] pb-44">
        <EmptyState
          icon={<MessageSquare className="h-12 w-12" />}
          title="No conversation selected"
          description="Select a conversation from the list or start a new one to begin chatting."
          className="min-h-0 h-full flex items-center justify-center"
        />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-visible py-6 transition-colors duration-300 ease-in-out pt-[91px] pb-44 min-w-0">
      <div className="max-w-[calc(100%-240px)] mx-auto min-w-0">
        {(isLoadingMessages || isTransitioningConversation) ? (
          <div className="space-y-6 w-full">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"} animate-pulse`}>
                {i % 2 === 0 ? (
                  <div className="flex items-start gap-3 max-w-[calc(100%-240px)] min-w-0">
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-8 h-8 rounded-full bg-primary/20"></div>
                    </div>
                    <div className="space-y-2 w-[350px]">
                      <div className="h-4 bg-primary/10 rounded w-24"></div>
                      <div className="rounded-lg p-4" style={{ 
                        backgroundColor: 'var(--muted)', 
                        border: 'none', 
                        boxShadow: 'none', 
                        outline: 'none',
                        filter: 'none'
                      }}>
                        <div className="h-4 bg-muted-foreground/20 rounded w-[90%]"></div>
                        <div className="h-4 bg-muted-foreground/20 rounded w-[75%] mt-2"></div>
                        <div className="h-4 bg-muted-foreground/20 rounded w-[85%] mt-2"></div>
                        <div className="h-3 bg-muted-foreground/15 rounded w-14 mt-2"></div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-end gap-3 max-w-[calc(100%-240px)] min-w-0">
                    <div className="space-y-2 w-[350px]">
                      <div className="rounded-lg p-4 bg-background" style={{ 
                        boxShadow: 'var(--shadow-sm)',
                        border: '1px solid var(--border)'
                      }}>
                        <div className="h-4 bg-muted-foreground/10 rounded w-[90%]"></div>
                        <div className="h-4 bg-muted-foreground/10 rounded w-[70%] mt-2"></div>
                        <div className="h-4 bg-muted-foreground/10 rounded w-[80%] mt-2"></div>
                        <div className="h-3 bg-muted-foreground/10 rounded w-14 mt-2 ml-auto"></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {chatMessages.length === 0 ? (
              <EmptyConversation 
                agentId={agentId}
                agentName={agentName}
              />
            ) : (
              processedMessages.map((msg, index) => {
                // Check if we need to show a date separator
                const showDateSeparator = index > 0 && 
                  !isSameDay(
                    new Date(processedMessages[index-1].timestamp), 
                    new Date(msg.timestamp)
                  );
                
                return (
                  <React.Fragment key={msg.id || index}>
                    {showDateSeparator && (
                      <div className="flex justify-center my-8">
                        <Badge variant="outline" className="px-3 py-1 text-xs bg-background/80 backdrop-blur">
                          {formatDate(new Date(msg.timestamp))}
                        </Badge>
                      </div>
                    )}
                    <div
                      className={`flex ${
                        msg.isRightAligned 
                        ? "justify-end" 
                        : "justify-start"
                      } animate-slide-in-fade`}
                    >
                      {/* Team Member Messages - Left aligned when there is a lead */}
                      {msg.role === "team_member" && hasLead ? (
                        <div className="flex flex-col max-w-[calc(100%-240px)] min-w-0">
                          <div className="flex flex-col min-w-0 group">
                          <div className="flex items-center mb-1 gap-2">
                            <Avatar className="h-7 w-7 border border-primary/10">
                              <AvatarImage src={msg.sender_avatar || (hasAssignee ? leadData.assignee.avatar_url : currentUserAvatar) || undefined} alt={msg.sender_name || (hasAssignee ? leadData.assignee.name : currentUserName) || "Team Member"} style={{ objectFit: 'cover' }} />
                              <AvatarFallback className="text-xs bg-primary/10" style={{
                                backgroundColor: (hasAssignee ? leadData.assignee.id : (msg.sender_id || currentUserId))
                                  ? `hsl(${parseInt((hasAssignee ? leadData.assignee.id : (msg.sender_id || currentUserId)).replace(/[^a-f0-9]/gi, '').substring(0, 6), 16) % 360}, 70%, 65%)`
                                  : undefined
                              }}>
                                {(hasAssignee ? leadData.assignee.name : (msg.sender_name || currentUserName)) ? (hasAssignee ? leadData.assignee.name : (msg.sender_name || currentUserName)).split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : (msg.sender_id ? msg.sender_id.substring(0, 2).toUpperCase() : "T")}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium text-blue-600 dark:text-blue-400">{msg.sender_name || (hasAssignee ? leadData.assignee.name : currentUserName) || `Team Member (${msg.sender_id ? msg.sender_id.substring(0, 6) + '...' : 'Unknown'})`}</span>
                          </div>
                          <div className={`rounded-lg p-4 transition-all duration-300 ease-in-out text-foreground ml-9 min-w-0 overflow-hidden ${
                            msg.metadata?.status === "pending" ? "opacity-60" : ""
                          }`}
                            style={{ 
                              backgroundColor: msg.metadata?.status === "pending" 
                                ? (isDarkMode ? '#2a2a3a' : '#f8f8f8')
                                : (isDarkMode ? '#2d2d3d' : '#f0f0f5'),
                              border: 'none', 
                              boxShadow: 'none', 
                              outline: 'none',
                              filter: 'none' 
                            }}
                          >
                            {renderMessageContent(msg, markdownComponents)}
                            <div className="flex items-center justify-between mt-1.5">
                              <div className="flex items-center gap-2">
                                {msg.metadata?.status === "pending" && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="inline-flex items-center text-xs text-amber-500">
                                            <Icons.Clock className="h-3 w-3 mr-1" />
                                            {getEstimatedSendTime(msg) ? `Sending at ${getEstimatedSendTime(msg)}` : "Sending..."}
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Message is being sent</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                  {msg.metadata?.status === "accepted" && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="inline-flex items-center text-xs text-green-500">
                                            <Icons.Check className="h-3 w-3 mr-1" />
                                            {getEstimatedSendTime(msg) ? `Sending at ${getEstimatedSendTime(msg)}` : "Accepted"}
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Message accepted and scheduled</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                )}
                                {msg.metadata?.command_status === "failed" && (
                                  <>
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="inline-flex items-center text-xs text-red-500">
                                            <Icons.AlertCircle className="h-3 w-3 mr-1" />
                                            Failed to send
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>{msg.metadata?.error_message || "Message failed to reach the server"}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                    {onRetryMessage && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <button
                                              onClick={() => onRetryMessage(msg)}
                                              className="inline-flex items-center text-xs text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded px-1 py-0.5 transition-colors"
                                              type="button"
                                            >
                                              <Icons.RotateCcw className="h-3 w-3 mr-1" />
                                              Retry
                                            </button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>Retry sending this message</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                  </>
                                )}
                              </div>
                              <p className="text-xs opacity-70">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                          </div>
                          </div>
                          <div className="flex justify-center w-full">
                            <MessageActions
                              message={msg}
                              onEdit={handleEditMessage}
                              onDelete={handleDeleteMessage}
                              onAccept={handleAcceptMessage}
                              onUndoAccept={handleUndoAcceptMessage}
                              isDeleting={deletingMessageId === msg.id}
                              isAccepting={acceptingMessageId === msg.id}
                              isActionsAccepted={acceptedActionsMessageIds.has(msg.id || "")}
                            />
                          </div>
                        </div>
                      ) : msg.role === "team_member" && !hasLead && !msg.isCurrentUserMessage ? (
                        <div className="flex flex-col max-w-[calc(100%-240px)] min-w-0 items-end">
                          <div className="flex flex-col min-w-0 items-end group">
                          <div className="flex items-center mb-1 gap-2 flex-row-reverse">
                            <Avatar className="h-7 w-7 border border-primary/10">
                              <AvatarImage src={msg.sender_avatar || (hasAssignee ? leadData.assignee.avatar_url : currentUserAvatar) || undefined} alt={msg.sender_name || (hasAssignee ? leadData.assignee.name : currentUserName) || "Team Member"} style={{ objectFit: 'cover' }} />
                              <AvatarFallback className="text-xs bg-primary/10" style={{
                                backgroundColor: (hasAssignee ? leadData.assignee.id : (msg.sender_id || currentUserId))
                                  ? `hsl(${parseInt((hasAssignee ? leadData.assignee.id : (msg.sender_id || currentUserId)).replace(/[^a-f0-9]/gi, '').substring(0, 6), 16) % 360}, 70%, 65%)`
                                  : undefined
                              }}>
                                {(hasAssignee ? leadData.assignee.name : (msg.sender_name || currentUserName)) ? (hasAssignee ? leadData.assignee.name : (msg.sender_name || currentUserName)).split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : (msg.sender_id ? msg.sender_id.substring(0, 2).toUpperCase() : "T")}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium text-blue-600 dark:text-blue-400">{msg.sender_name || (hasAssignee ? leadData.assignee.name : currentUserName) || `Team Member (${msg.sender_id ? msg.sender_id.substring(0, 6) + '...' : 'Unknown'})`}</span>
                          </div>
                          <div className={`rounded-lg p-4 transition-all duration-300 ease-in-out text-foreground mr-9 min-w-0 overflow-hidden ${
                              msg.metadata?.status === "pending" ? "opacity-60" : msg.metadata?.status === "accepted" ? "border-2 border-green-500/30 bg-green-50/50 dark:bg-green-900/10" : ""
                          }`}
                            style={{ 
                              backgroundColor: msg.metadata?.status === "pending" 
                                ? (isDarkMode ? '#2a2a3a' : '#f8f8f8')
                                  : msg.metadata?.status === "accepted"
                                  ? (isDarkMode ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.05)')
                                : (isDarkMode ? '#2d2d3d' : '#f0f0f5'),
                                border: msg.metadata?.status === "accepted" ? '2px solid rgba(34, 197, 94, 0.3)' : 'none', 
                              boxShadow: 'none', 
                              outline: 'none',
                              filter: 'none' 
                            }}
                          >
                            {renderMessageContent(msg, markdownComponents)}
                            <div className="flex items-center justify-between mt-1.5">
                              <div className="flex items-center gap-2">
                                {msg.metadata?.status === "pending" && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="inline-flex items-center text-xs text-amber-500">
                                            <Icons.Clock className="h-3 w-3 mr-1" />
                                            {getEstimatedSendTime(msg) ? `Sending at ${getEstimatedSendTime(msg)}` : "Sending..."}
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Message is being sent</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                  {msg.metadata?.status === "accepted" && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                        <span className="inline-flex items-center text-xs text-green-500">
                                          <Icons.Check className="h-3 w-3 mr-1" />
                                          Accepted
                                        </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                        <p>Message has been accepted</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                )}
                                {msg.metadata?.command_status === "failed" && (
                                  <>
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="inline-flex items-center text-xs text-red-500">
                                            <Icons.AlertCircle className="h-3 w-3 mr-1" />
                                            Failed to send
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>{msg.metadata?.error_message || "Message failed to reach the server"}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                    {onRetryMessage && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <button
                                              onClick={() => onRetryMessage(msg)}
                                              className="inline-flex items-center text-xs text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded px-1 py-0.5 transition-colors"
                                              type="button"
                                            >
                                              <Icons.RotateCcw className="h-3 w-3 mr-1" />
                                              Retry
                                            </button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>Retry sending this message</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                  </>
                                )}
                              </div>
                              <p className="text-xs opacity-70 text-right">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                            </div>
                          </div>
                          <div className="flex justify-center w-full">
                            <MessageActions
                              message={msg}
                              onEdit={handleEditMessage}
                              onDelete={handleDeleteMessage}
                              onAccept={handleAcceptMessage}
                              onUndoAccept={handleUndoAcceptMessage}
                              isDeleting={deletingMessageId === msg.id}
                              isAccepting={acceptingMessageId === msg.id}
                              isActionsAccepted={acceptedActionsMessageIds.has(msg.id || "")}
                            />
                          </div>
                        </div>
                      ) : /* Lead/Visitor Messages - Amber avatar, right aligned */ msg.role === "user" ? (
                        <div className="flex flex-col max-w-[calc(100%-240px)] min-w-0 items-end">
                          <div className="flex flex-col min-w-0 items-end group">
                          <div className="flex items-center mb-1 gap-2 flex-row-reverse">
                            <Avatar className="h-7 w-7 border border-amber-500/20">
                              <AvatarImage 
                                src={leadData?.avatarUrl || undefined} 
                                alt={leadData?.name || "Visitor"} 
                                style={{ objectFit: 'cover' }} 
                              />
                              <AvatarFallback className="text-xs bg-amber-500/10 text-amber-600" style={{
                                backgroundColor: msg.sender_id
                                  ? `hsl(${parseInt(msg.sender_id.replace(/[^a-f0-9]/gi, '').substring(0, 6), 16) % 360}, 70%, 65%)`
                                  : undefined
                              }}>
                                {leadData?.name 
                                  ? leadData.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() 
                                  : (msg.sender_id ? msg.sender_id.substring(0, 2).toUpperCase() : "V")}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium text-amber-600 dark:text-amber-500">
                              {truncateLeadName(leadData?.name || "Visitor")}
                            </span>
                          </div>
                          <div className={`rounded-lg p-4 transition-all duration-300 ease-in-out text-foreground mr-9 min-w-0 overflow-hidden ${
                            msg.metadata?.status === "pending" ? "opacity-60" : ""
                          }`}
                            style={{ 
                              backgroundColor: msg.metadata?.status === "pending" 
                                ? (isDarkMode ? '#2a2a3a' : '#f8f8f8')
                                : (isDarkMode ? '#2d2d3d' : '#f0f0f5'),
                              border: 'none', 
                              boxShadow: 'none', 
                              outline: 'none',
                              filter: 'none' 
                            }}
                          >
                            {renderMessageContent(msg, markdownComponents)}
                            <div className="flex items-center justify-between mt-1.5">
                              <div className="flex items-center gap-2">
                                {msg.metadata?.status === "pending" && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="inline-flex items-center text-xs text-amber-500">
                                            <Icons.Clock className="h-3 w-3 mr-1" />
                                            {getEstimatedSendTime(msg) ? `Sending at ${getEstimatedSendTime(msg)}` : "Sending..."}
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Message is being sent</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                )}
                                {msg.metadata?.status === "accepted" && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                        <span className="inline-flex items-center text-xs text-green-500">
                                          <Icons.Check className="h-3 w-3 mr-1" />
                                          {getEstimatedSendTime(msg) ? `Sending at ${getEstimatedSendTime(msg)}` : "Accepted"}
                                        </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                        <p>Message accepted and scheduled</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                )}
                                {msg.metadata?.command_status === "failed" && (
                                  <>
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="inline-flex items-center text-xs text-red-500">
                                            <Icons.AlertCircle className="h-3 w-3 mr-1" />
                                            Failed to send
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>{msg.metadata?.error_message || "Message failed to reach the server"}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                    {onRetryMessage && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <button
                                              onClick={() => onRetryMessage(msg)}
                                              className="inline-flex items-center text-xs text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded px-1 py-0.5 transition-colors"
                                              type="button"
                                            >
                                              <Icons.RotateCcw className="h-3 w-3 mr-1" />
                                              Retry
                                            </button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>Retry sending this message</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                  </>
                                )}
                              </div>
                              <p className="text-xs opacity-70">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                          </div>
                          </div>
                          <div className="flex justify-center w-full">
                            <MessageActions
                              message={msg}
                              onEdit={handleEditMessage}
                              onDelete={handleDeleteMessage}
                              onAccept={handleAcceptMessage}
                              onUndoAccept={handleUndoAcceptMessage}
                              isDeleting={deletingMessageId === msg.id}
                              isAccepting={acceptingMessageId === msg.id}
                              isActionsAccepted={acceptedActionsMessageIds.has(msg.id || "")}
                            />
                          </div>
                        </div>
                      ) : (msg.role === "agent" || msg.role === "assistant") ? (
                        <div className="max-w-[calc(100%-240px)] min-w-0 group">
                          <div className="flex items-center mb-1 gap-2">
                            <div className="relative">
                              <Avatar className={`h-7 w-7 border ${(hasAssignee && msg.sender_id === leadData?.assignee?.id) ? 'border-blue-500/20' : 'border-primary/10'}`}>
                              <AvatarImage 
                                  src={(hasAssignee && msg.sender_id === leadData?.assignee?.id) 
                                    ? (leadData.assignee.avatar_url || undefined)
                                    : undefined
                                  } 
                                  alt={(hasAssignee && msg.sender_id === leadData?.assignee?.id) 
                                    ? leadData.assignee.name 
                                    : (msg.agent_id && agentDataCache[msg.agent_id]?.name) || agentName
                                  } 
                                />
                                <AvatarFallback className={(hasAssignee && msg.sender_id === leadData?.assignee?.id) ? "bg-blue-500/10 text-blue-600" : "bg-primary/10"}>
                                  {((hasAssignee && msg.sender_id === leadData?.assignee?.id) 
                                    ? leadData.assignee.name 
                                    : (msg.agent_id && agentDataCache[msg.agent_id]?.name) || agentName
                                  ).split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              {/* Timer circular para mensajes pendientes */}
                              {msg.metadata?.status === "pending" && (msg.metadata?.delay_timer || msg.metadata?.custom_data?.delay_timer) && (
                                <DelayTimer 
                                  delayTimer={msg.metadata.delay_timer || msg.metadata.custom_data.delay_timer}
                                  className="absolute -inset-0.5"
                                  size={32}
                                />
                              )}
                            </div>
                            <span className={`text-sm font-medium ${(hasAssignee && msg.sender_id === leadData?.assignee?.id) ? 'text-blue-600 dark:text-blue-400' : 'text-primary'}`}>
                              {(hasAssignee && msg.sender_id === leadData?.assignee?.id) 
                                ? truncateAgentName(leadData.assignee.name)
                                : truncateAgentName((msg.agent_id && agentDataCache[msg.agent_id]?.name) || agentName)
                              }
                            </span>
                          </div>
                          <div className="ml-9">
                            {renderMessageContent(msg, markdownComponents)}
                            
                            {/* Debug the command_id */}
                            {msg.command_id && (
                              <div className="text-xs text-muted-foreground mt-1 hidden">
                                Command ID: {msg.command_id}
                              </div>
                            )}
                            
                            {/* Message feedback widget */}
                            {msg.command_id && (
                              <MessageFeedback 
                                messageId={String(msg.id || index)} 
                                commandId={msg.command_id} 
                                agentId={agentId} 
                              />
                            )}
                            
                            {/* Show placeholder message feedback widget if no command_id is available */}
                            {!msg.command_id && (
                              <div className="flex items-center gap-3 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                <p className="text-xs text-muted-foreground">No command ID available for this message</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (msg.role === "team_member" && !hasLead && msg.isCurrentUserMessage) ? (
                        <div className="flex flex-col max-w-[calc(100%-240px)] min-w-0 items-end">
                          <div className="flex flex-col min-w-0 items-end group">
                          <div className="flex items-center mb-1 gap-2 flex-row-reverse">
                            <Avatar className="h-7 w-7 border border-primary/20">
                              <AvatarImage src={currentUserAvatar || undefined} alt={currentUserName || "You"} />
                              <AvatarFallback className="bg-primary/10 text-primary">
                                {currentUserName ? currentUserName.split(' ').map((n: string) => n[0]).join('').substring(0, 2) : "Y"}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium text-primary">{currentUserName || "You"}</span>
                          </div>
                          <div className={`rounded-lg p-4 transition-all duration-300 ease-in-out text-foreground mr-9 min-w-0 overflow-hidden ${
                            msg.metadata?.status === "pending" ? "opacity-60" : ""
                          }`}
                            style={{ 
                              backgroundColor: msg.metadata?.status === "pending" 
                                ? (isDarkMode ? '#2a2a3a' : '#f8f8f8')
                                : (isDarkMode ? '#2d2d3d' : '#f0f0f5'),
                              border: 'none', 
                              boxShadow: 'none', 
                              outline: 'none',
                              filter: 'none' 
                            }}
                          >
                            {renderMessageContent(msg, markdownComponents)}
                            <div className="flex items-center justify-between mt-1.5">
                              <div className="flex items-center gap-2">
                                {msg.metadata?.status === "pending" && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="inline-flex items-center text-xs text-amber-500">
                                            <Icons.Clock className="h-3 w-3 mr-1" />
                                            {getEstimatedSendTime(msg) ? `Sending at ${getEstimatedSendTime(msg)}` : "Sending..."}
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Message is being sent</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                )}
                                {msg.metadata?.status === "accepted" && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                        <span className="inline-flex items-center text-xs text-green-500">
                                          <Icons.Check className="h-3 w-3 mr-1" />
                                          {getEstimatedSendTime(msg) ? `Sending at ${getEstimatedSendTime(msg)}` : "Accepted"}
                                        </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                        <p>Message accepted and scheduled</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                )}
                                {msg.metadata?.command_status === "failed" && (
                                  <>
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="inline-flex items-center text-xs text-red-500">
                                            <Icons.AlertCircle className="h-3 w-3 mr-1" />
                                            Failed to send
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>{msg.metadata?.error_message || "Message failed to reach the server"}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                    {onRetryMessage && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <button
                                              onClick={() => onRetryMessage(msg)}
                                              className="inline-flex items-center text-xs text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded px-1 py-0.5 transition-colors"
                                              type="button"
                                            >
                                              <Icons.RotateCcw className="h-3 w-3 mr-1" />
                                              Retry
                                            </button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>Retry sending this message</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                  </>
                                )}
                              </div>
                              <p className="text-xs opacity-70 text-right">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                          </div>
                          </div>
                          <div className="flex justify-center w-full">
                            <MessageActions
                              message={msg}
                              onEdit={handleEditMessage}
                              onDelete={handleDeleteMessage}
                              onAccept={handleAcceptMessage}
                              onUndoAccept={handleUndoAcceptMessage}
                              isDeleting={deletingMessageId === msg.id}
                              isAccepting={acceptingMessageId === msg.id}
                              isActionsAccepted={acceptedActionsMessageIds.has(msg.id || "")}
                            />
                          </div>
                        </div>
                      ) : /* Visitor Messages - Amber avatar, right aligned */ (msg.role === "visitor") ? (
                        <div className="flex flex-col max-w-[calc(100%-240px)] min-w-0 items-end">
                          <div className="flex flex-col min-w-0 items-end group">
                          <div className="flex items-center mb-1 gap-2 flex-row-reverse">
                            <Avatar className="h-7 w-7 border border-amber-500/20">
                              <AvatarImage src={leadData?.avatarUrl || undefined} alt={leadData?.name || "Visitor"} />
                              <AvatarFallback className="bg-amber-500/10 text-amber-600">
                                {leadData?.name ? leadData.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2) : "V"}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium text-amber-600 dark:text-amber-500">{truncateLeadName(leadData?.name || "Visitor")}</span>
                          </div>
                          <div className={`rounded-lg p-4 transition-all duration-300 ease-in-out text-foreground mr-9 min-w-0 overflow-hidden ${
                            msg.metadata?.status === "pending" ? "opacity-60" : ""
                          }`}
                            style={{ 
                              backgroundColor: msg.metadata?.status === "pending" 
                                ? (isDarkMode ? '#2a2a3a' : '#f8f8f8')
                                : (isDarkMode ? '#2d2d3d' : '#f0f0f5'),
                              border: 'none', 
                              boxShadow: 'none', 
                              outline: 'none',
                              filter: 'none' 
                            }}
                          >
                            {renderMessageContent(msg, markdownComponents)}
                            <div className="flex items-center justify-between mt-1.5">
                              <div className="flex items-center gap-2">
                                {msg.metadata?.status === "pending" && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="inline-flex items-center text-xs text-amber-500">
                                            <Icons.Clock className="h-3 w-3 mr-1" />
                                            {getEstimatedSendTime(msg) ? `Sending at ${getEstimatedSendTime(msg)}` : "Sending..."}
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Message is being sent</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                )}
                                {msg.metadata?.status === "accepted" && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                        <span className="inline-flex items-center text-xs text-green-500">
                                          <Icons.Check className="h-3 w-3 mr-1" />
                                          {getEstimatedSendTime(msg) ? `Sending at ${getEstimatedSendTime(msg)}` : "Accepted"}
                                        </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                        <p>Message accepted and scheduled</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                )}
                                {msg.metadata?.command_status === "failed" && (
                                  <>
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="inline-flex items-center text-xs text-red-500">
                                            <Icons.AlertCircle className="h-3 w-3 mr-1" />
                                            Failed to send
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>{msg.metadata?.error_message || "Message failed to reach the server"}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                    {onRetryMessage && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <button
                                              onClick={() => onRetryMessage(msg)}
                                              className="inline-flex items-center text-xs text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded px-1 py-0.5 transition-colors"
                                              type="button"
                                            >
                                              <Icons.RotateCcw className="h-3 w-3 mr-1" />
                                              Retry
                                            </button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>Retry sending this message</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                  </>
                                )}
                              </div>
                              <p className="text-xs opacity-70 text-right">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                          </div>
                          </div>
                          <div className="flex justify-center w-full">
                            <MessageActions
                              message={msg}
                              onEdit={handleEditMessage}
                              onDelete={handleDeleteMessage}
                              onAccept={handleAcceptMessage}
                              onUndoAccept={handleUndoAcceptMessage}
                              isDeleting={deletingMessageId === msg.id}
                              isAccepting={acceptingMessageId === msg.id}
                              isActionsAccepted={acceptedActionsMessageIds.has(msg.id || "")}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col max-w-[calc(100%-240px)] min-w-0">
                        <div 
                            className={`rounded-lg px-4 pt-4 pb-2 transition-all duration-300 ease-in-out text-foreground group overflow-hidden ${
                            msg.metadata?.status === "pending" ? "opacity-60" : ""
                          }`}
                          style={{ 
                            backgroundColor: msg.metadata?.status === "pending" 
                              ? (isDarkMode ? '#2a2a3a' : '#f8f8f8')
                              : (isDarkMode ? '#2d2d3d' : '#f0f0f5'),
                            border: 'none', 
                            boxShadow: 'none', 
                            outline: 'none',
                            filter: 'none' 
                          }}
                        >
                          {renderMessageContent(msg, markdownComponents)}
                          <div className="flex items-center mt-2">
                            <div className="flex items-center gap-2 flex-1">
                              {msg.metadata?.status === "pending" && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="inline-flex items-center text-xs text-amber-500">
                                          <Icons.Clock className="h-3 w-3 mr-1" />
                                          {getEstimatedSendTime(msg) ? `Sending at ${getEstimatedSendTime(msg)}` : "Sending..."}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Message is being sent</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                              )}
                              {msg.metadata?.status === "accepted" && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                      <span className="inline-flex items-center text-xs text-green-500">
                                        <Icons.Check className="h-3 w-3 mr-1" />
                                        {getEstimatedSendTime(msg) ? `Sending at ${getEstimatedSendTime(msg)}` : "Accepted"}
                                      </span>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                      <p>Message accepted and scheduled</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                              )}
                              {msg.metadata?.command_status === "failed" && (
                                <>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="inline-flex items-center text-xs text-red-500">
                                          <Icons.AlertCircle className="h-3 w-3 mr-1" />
                                          Failed to send
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>{msg.metadata?.error_message || "Message failed to reach the server"}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  {onRetryMessage && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <button
                                            onClick={() => onRetryMessage(msg)}
                                            className="inline-flex items-center text-xs text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded px-1 py-0.5 transition-colors"
                                            type="button"
                                          >
                                            <Icons.RotateCcw className="h-3 w-3 mr-1" />
                                            Retry
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Retry sending this message</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                </>
                              )}
                            </div>
                            
                            {/* Message feedback widget - center */}
                            <div className="flex items-center justify-center flex-1">
                              {msg.command_id && (
                                <MessageFeedback 
                                  messageId={String(msg.id || index)} 
                                  commandId={msg.command_id} 
                                  agentId={agentId} 
                                />
                              )}
                            </div>
                            
                            <div className="flex items-center justify-end flex-1">
                              <p className="text-xs opacity-70">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                          </div>
                          </div>
                          <div className="flex justify-center w-full">
                            <MessageActions
                              message={msg}
                              onEdit={handleEditMessage}
                              onDelete={handleDeleteMessage}
                              onAccept={handleAcceptMessage}
                              onUndoAccept={handleUndoAcceptMessage}
                              isDeleting={deletingMessageId === msg.id}
                              isAccepting={acceptingMessageId === msg.id}
                              isActionsAccepted={acceptedActionsMessageIds.has(msg.id || "")}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </React.Fragment>
                );
              })
            )}
            
            {/* Animación de espera mientras el agente responde */}
            {isAgentResponding && (
              <div className="flex justify-start animate-slide-in-fade mt-6 mb-8">
                <div className="inline-flex items-center gap-2 ml-9 w-auto">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            )}
            
            {/* Agregar espacio adicional después de los mensajes para evitar que la animación quede pegada al área de texto */}
            <div className="h-8"></div>
          </div>
        )}
        {/* Elemento de referencia para el scroll automático - desplazado del fondo para mejor visualización */}
        <div ref={messagesEndRef} className="pt-4 pb-8"></div>
      </div>
      
      {/* Edit Message Modal */}
      <EditMessageModal
        isOpen={editModalOpen}
        onOpenChange={setEditModalOpen}
        message={editingMessage}
        onSave={handleSaveEditedMessage}
      />
    </div>
  )
} 