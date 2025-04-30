"use client"

import React, { RefObject, useState, useEffect } from "react"
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

// Helper function to format date as "Month Day, Year"
const formatDate = (date: Date) => {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
};

// Helper function to check if two dates are the same day
const isSameDay = (date1: Date, date2: Date) => {
  return date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate();
};

interface ChatMessagesProps {
  chatMessages: ChatMessage[]
  isLoadingMessages: boolean
  isAgentResponding: boolean
  messagesEndRef: RefObject<HTMLDivElement | null>
  agentId: string
  agentName: string
  isAgentOnlyConversation: boolean
  leadData: any
  conversationId?: string
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
        console.error('Error fetching performance status:', error);
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
      console.error('Error in fetchPerformanceStatus:', error);
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
        console.error('Error setting like:', error);
        toast.error("Failed to save like");
      } else {
        // Actualizar el estado local
        setPerformance((prev) => {
          if (prev === null) return 1;
          return (prev & ~2) | 1; // Eliminar dislike si existe y establecer like
        });
        toast.success("Like saved successfully");
      }
    } catch (error) {
      console.error('Error in handleLike:', error);
      toast.error("Failed to save like");
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
        console.error('Error setting dislike:', error);
        toast.error("Failed to save dislike");
      } else {
        // Actualizar el estado local
        setPerformance((prev) => {
          if (prev === null) return 2;
          return (prev & ~1) | 2; // Eliminar like si existe y establecer dislike
        });
        toast.success("Dislike saved successfully");
      }
    } catch (error) {
      console.error('Error in handleDislike:', error);
      toast.error("Failed to save dislike");
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
        console.error('Error toggling flag:', error);
        toast.error("Failed to save flag");
      } else {
        // Actualizar el estado local
        setPerformance((prev) => {
          if (prev === null) return 4;
          return prev ^ 4; // Alternar el bit del flag
        });
        toast.success("Flag saved successfully");
      }
    } catch (error) {
      console.error('Error in handleFlag:', error);
      toast.error("Failed to save flag");
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
  messagesEndRef,
  agentId,
  agentName,
  isAgentOnlyConversation,
  leadData,
  conversationId
}: ChatMessagesProps) {
  // Use theme context for dark mode detection
  const { isDarkMode } = useTheme()

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
        style={{ whiteSpace: 'pre-wrap', overflowX: 'auto' }} 
        {...props} 
      />
    ),
    code: ({ node, ...props }: any) => (
      <code 
        style={{ wordBreak: 'break-word' }} 
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
      <div className="flex-1 overflow-auto py-6 bg-muted/30 transition-colors duration-300 ease-in-out pt-[91px] pb-[200px]">
        <div className="max-w-[calc(100%-240px)] mx-auto flex items-center justify-center h-full">
          <div className="text-center p-8 rounded-lg">
            <Icons.MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground/60" />
            <h3 className="text-lg font-medium mb-2">No conversation selected</h3>
            <p className="text-muted-foreground max-w-md">
              Select a conversation from the list or start a new one to begin chatting.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto py-6 bg-muted/30 transition-colors duration-300 ease-in-out pt-[91px]">
      <div className="max-w-[calc(100%-240px)] mx-auto">
        {isLoadingMessages ? (
          <div className="space-y-6 w-full">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"} animate-pulse`}>
                {i % 2 === 0 ? (
                  <div className="flex items-start gap-3 max-w-[calc(100%-240px)]">
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
                  <div className="flex items-start justify-end gap-3 max-w-[calc(100%-240px)]">
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
              chatMessages.map((msg, index) => {
                // Check if we need to show a date separator
                const showDateSeparator = index > 0 && 
                  !isSameDay(
                    new Date(chatMessages[index-1].timestamp), 
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
                        msg.role === "team_member" 
                        ? (isAgentOnlyConversation ? "justify-end" : "justify-start")
                        : (msg.role === "user" || msg.role === "visitor") ? "justify-end" : "justify-start"
                      } animate-fade-in`}
                    >
                      {msg.role === "team_member" && !isAgentOnlyConversation ? (
                        <div className="flex flex-col max-w-[calc(100%-240px)]">
                          <div className="flex items-center mb-1 gap-2">
                            <Avatar className="h-7 w-7 border border-primary/10">
                              <AvatarImage src={msg.sender_avatar || `/avatars/user-default.png`} alt={msg.sender_name || "Team Member"} style={{ objectFit: 'cover' }} />
                              <AvatarFallback className="text-xs bg-primary/10" style={{
                                backgroundColor: msg.sender_id 
                                  ? `hsl(${parseInt(msg.sender_id.replace(/[^a-f0-9]/gi, '').substring(0, 6), 16) % 360}, 70%, 65%)`
                                  : undefined
                              }}>
                                {msg.sender_name ? msg.sender_name.charAt(0).toUpperCase() : (msg.sender_id ? msg.sender_id.charAt(0).toUpperCase() : "T")}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium text-blue-600 dark:text-blue-400">{msg.sender_name || `Team Member (${msg.sender_id ? msg.sender_id.substring(0, 6) + '...' : 'Unknown'})`}</span>
                          </div>
                          <div className="rounded-lg p-4 transition-all duration-300 ease-in-out text-foreground ml-9"
                            style={{ 
                              backgroundColor: isDarkMode ? '#2d2d3d' : '#f0f0f5',
                              border: 'none', 
                              boxShadow: 'none', 
                              outline: 'none',
                              filter: 'none' 
                            }}
                          >
                            <div className="text-sm leading-relaxed prose prose-sm max-w-none dark:prose-invert prose-headings:font-medium prose-p:leading-relaxed prose-pre:bg-muted w-full overflow-hidden break-words">
                              <ReactMarkdown components={markdownComponents}>{msg.text}</ReactMarkdown>
                            </div>
                            <div className="flex items-center justify-between mt-1.5">
                              <div>
                                {msg.metadata?.command_status === "failed" && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="inline-flex items-center text-xs text-red-500 mr-2">
                                          <Icons.AlertCircle className="h-3 w-3 mr-1" />
                                          Failed to send
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>{msg.metadata?.error_message || "Message failed to reach the server"}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                              <p className="text-xs opacity-70">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : msg.role === "team_member" && isAgentOnlyConversation ? (
                        <div className="flex flex-col max-w-[calc(100%-240px)] items-end">
                          <div className="flex items-center mb-1 gap-2 flex-row-reverse">
                            <Avatar className="h-7 w-7 border border-primary/10">
                              <AvatarImage src={msg.sender_avatar || `/avatars/user-default.png`} alt={msg.sender_name || "Team Member"} style={{ objectFit: 'cover' }} />
                              <AvatarFallback className="text-xs bg-primary/10" style={{
                                backgroundColor: msg.sender_id 
                                  ? `hsl(${parseInt(msg.sender_id.replace(/[^a-f0-9]/gi, '').substring(0, 6), 16) % 360}, 70%, 65%)`
                                  : undefined
                              }}>
                                {msg.sender_name ? msg.sender_name.charAt(0).toUpperCase() : (msg.sender_id ? msg.sender_id.charAt(0).toUpperCase() : "T")}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium text-blue-600 dark:text-blue-400">{msg.sender_name || `Team Member (${msg.sender_id ? msg.sender_id.substring(0, 6) + '...' : 'Unknown'})`}</span>
                          </div>
                          <div className="rounded-lg p-4 transition-all duration-300 ease-in-out text-foreground mr-9"
                            style={{ 
                              backgroundColor: isDarkMode ? '#2d2d3d' : '#f0f0f5',
                              border: 'none', 
                              boxShadow: 'none', 
                              outline: 'none',
                              filter: 'none' 
                            }}
                          >
                            <div className="text-sm leading-relaxed prose prose-sm max-w-none dark:prose-invert prose-headings:font-medium prose-p:leading-relaxed prose-pre:bg-muted w-full overflow-hidden break-words">
                              <ReactMarkdown components={markdownComponents}>{msg.text}</ReactMarkdown>
                            </div>
                            <div className="flex items-center justify-between mt-1.5">
                              <div>
                                {msg.metadata?.command_status === "failed" && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="inline-flex items-center text-xs text-red-500 mr-2">
                                          <Icons.AlertCircle className="h-3 w-3 mr-1" />
                                          Failed to send
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>{msg.metadata?.error_message || "Message failed to reach the server"}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                              <p className="text-xs opacity-70 text-right">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (msg.role === "agent" || msg.role === "assistant") ? (
                        <div className="max-w-[calc(100%-240px)] group">
                          <div className="flex items-center mb-1 gap-2">
                            <Avatar className="h-7 w-7 border border-primary/10">
                              <AvatarImage src={`/avatars/agent-${agentId}.png`} alt={agentName} />
                              <AvatarFallback className="bg-primary/10">
                                {agentName.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium text-primary">{agentName}</span>
                          </div>
                          <div className="ml-9">
                            <div className="text-sm leading-relaxed prose prose-sm max-w-none dark:prose-invert prose-headings:font-medium prose-p:leading-relaxed prose-pre:bg-muted w-full overflow-hidden break-words">
                              <ReactMarkdown components={markdownComponents}>{msg.text}</ReactMarkdown>
                            </div>
                            
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
                      ) : (msg.role === "user" || msg.role === "visitor") ? (
                        <div className="flex flex-col max-w-[calc(100%-240px)] items-end">
                          <div className="flex items-center mb-1 gap-2 flex-row-reverse">
                            <Avatar className="h-7 w-7 border border-amber-500/20">
                              <AvatarImage src={leadData?.avatarUrl || "/avatars/visitor-default.png"} alt={leadData?.name || "Visitor"} />
                              <AvatarFallback className="bg-amber-500/10 text-amber-600">
                                {leadData?.name ? leadData.name.split(' ').map((n: string) => n[0]).join('') : "V"}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium text-amber-600 dark:text-amber-500">{leadData?.name || "Visitor"}</span>
                          </div>
                          <div className="rounded-lg p-4 transition-all duration-300 ease-in-out text-foreground mr-9"
                            style={{ 
                              backgroundColor: isDarkMode ? '#2d2d3d' : '#f0f0f5',
                              border: 'none', 
                              boxShadow: 'none', 
                              outline: 'none',
                              filter: 'none' 
                            }}
                          >
                            <div className="text-sm leading-relaxed prose prose-sm max-w-none dark:prose-invert prose-headings:font-medium prose-p:leading-relaxed prose-pre:bg-muted w-full overflow-hidden break-words">
                              <ReactMarkdown components={markdownComponents}>{msg.text}</ReactMarkdown>
                            </div>
                            <div className="flex items-center justify-between mt-1.5">
                              <div>
                                {msg.metadata?.command_status === "failed" && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="inline-flex items-center text-xs text-red-500 mr-2">
                                          <Icons.AlertCircle className="h-3 w-3 mr-1" />
                                          Failed to send
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>{msg.metadata?.error_message || "Message failed to reach the server"}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                              <p className="text-xs opacity-70 text-right">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div 
                          className="max-w-[calc(100%-240px)] rounded-lg p-4 transition-all duration-300 ease-in-out text-foreground"
                          style={{ 
                            backgroundColor: isDarkMode ? '#2d2d3d' : '#f0f0f5',
                            border: 'none', 
                            boxShadow: 'none', 
                            outline: 'none',
                            filter: 'none' 
                          }}
                        >
                          <div className="text-sm leading-relaxed prose prose-sm max-w-none dark:prose-invert prose-headings:font-medium prose-p:leading-relaxed prose-pre:bg-muted w-full overflow-hidden break-words">
                            <ReactMarkdown components={markdownComponents}>{msg.text}</ReactMarkdown>
                          </div>
                          <div className="flex items-center justify-between mt-1.5">
                            <div>
                              {msg.metadata?.command_status === "failed" && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="inline-flex items-center text-xs text-red-500 mr-2">
                                        <Icons.AlertCircle className="h-3 w-3 mr-1" />
                                        Failed to send
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{msg.metadata?.error_message || "Message failed to reach the server"}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                            <p className="text-xs opacity-70">
                              {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </p>
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
              <div className="flex justify-start animate-fade-in mt-6 mb-8">
                <div className="max-w-[calc(100%-240px)] flex items-center space-x-2 p-4 ml-9 bg-muted/20 rounded-md">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            )}
            
            {/* Agregar espacio adicional después de los mensajes para evitar que la animación quede pegada al área de texto */}
            <div className="h-40"></div>
          </div>
        )}
        {/* Elemento de referencia para el scroll automático - desplazado del fondo para mejor visualización */}
        <div ref={messagesEndRef} className="pt-16 pb-32"></div>
      </div>
    </div>
  )
} 