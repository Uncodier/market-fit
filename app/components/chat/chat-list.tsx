"use client"

import React, { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/app/components/ui/button"
import { ScrollArea } from "@/app/components/ui/scroll-area"
import { Search, PlusCircle, MessageSquare, Trash2 } from "@/app/components/ui/icons"
import { cn } from "@/lib/utils"
import { Input } from "@/app/components/ui/input"
import { useTheme } from "@/app/context/ThemeContext"
import { ConversationListItem } from "@/app/types/chat"
import { getConversations } from "../../services/chat-service"
import { formatDistanceToNow, format } from "date-fns"
import { Skeleton } from "@/app/components/ui/skeleton"
import { createClient } from "@/lib/supabase/client"
import * as Icons from "@/app/components/ui/icons"

// Componente para renderizar esqueletos de carga
function ConversationSkeleton() {
  return (
    <div className="py-3 px-4 border-b border-border/30" style={{ width: '320px', boxSizing: 'border-box' }}>
      <div className="flex items-center justify-between mb-1">
        <Skeleton className="h-4 w-[70%]" />
        <Skeleton className="h-3 w-[15%]" />
      </div>
      <Skeleton className="h-3 w-[90%] mt-2" />
      <Skeleton className="h-3 w-[40%] mt-2" />
    </div>
  )
}

// Componente personalizado para estado vacío 
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center max-w-[260px] text-center">
      <div className="mb-6">
        <MessageSquare className="h-12 w-12 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium mb-2">No conversations</h3>
      <p className="text-sm text-muted-foreground">
        Start a new conversation with an agent
      </p>
    </div>
  )
}

interface ChatListProps {
  siteId: string
  selectedConversationId?: string
  onSelectConversation: (conversationId: string, agentName: string, agentId: string) => void
  className?: string
  onLoadConversations?: (loadFunction: () => Promise<void>) => void
  onDeleteConversation?: (conversationId: string) => Promise<void>
}

// Función auxiliar para formatear la fecha
function formatMessageDate(date: Date) {
  const now = new Date();
  const isToday = date.getDate() === now.getDate() && 
                  date.getMonth() === now.getMonth() && 
                  date.getFullYear() === now.getFullYear();
  
  // Si es hoy, mostrar la hora (ej: "14:30")
  if (isToday) {
    return format(date, "HH:mm");
  }
  
  // Si es este año pero no hoy, mostrar el día y mes (ej: "24 Jun")
  if (date.getFullYear() === now.getFullYear()) {
    return format(date, "d MMM");
  }
  
  // Si es de otro año, mostrar día, mes y año (ej: "24 Jun 2022")
  return format(date, "d MMM yyyy");
}

// Función para truncar texto con longitud máxima
function truncateText(text: string, maxLength: number) {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

function getDefaultMessage(title: string): string {
  if (title.toLowerCase().includes("could not process")) {
    return "Could not process target due to unexpected error";
  }
  
  if (title.toLowerCase().includes("lamento mucho")) {
    return "Lamento mucho la espera y las molestias causadas";
  }
  
  return "No response generated";
}

export function ChatList({
  siteId,
  selectedConversationId,
  onSelectConversation,
  className,
  onLoadConversations,
  onDeleteConversation
}: ChatListProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [conversations, setConversations] = useState<ConversationListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [hasEmptyResult, setHasEmptyResult] = useState(false)
  const { isDarkMode } = useTheme()
  // Reference for the subscription
  const subscriptionRef = useRef<any>(null);
  // Reference to store the current selected conversation ID
  const selectedConversationIdRef = useRef<string | undefined>(selectedConversationId);
  // Reference to store the loadConversations function
  const loadConversationsRef = useRef<(() => Promise<void>) | null>(null);
  
  // Update the ref when selectedConversationId changes
  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  useEffect(() => {
    let active = true
    
    const loadConversations = async () => {
      if (!siteId) return;
      
      setIsLoading(true)
      try {
        const data = await getConversations(siteId)
        
        if (active) {
          setConversations(data)
          setHasEmptyResult(data.length === 0)
          setIsInitialLoad(false)
          
          // Pequeño retraso antes de ocultar el esqueleto para evitar parpadeos
          setTimeout(() => {
            if (active) {
              setIsLoading(false)
            }
          }, 300)
        }
      } catch (error) {
        console.error("Error loading conversations:", error)
        if (active) {
          setIsInitialLoad(false)
          setIsLoading(false)
        }
      }
    }

    loadConversations()
    
    // Store the loadConversations function in the ref
    loadConversationsRef.current = loadConversations;
    
    // Solo ejecutar onLoadConversations si la prop existe, evitando ejecutarlo si no es necesario
    if (onLoadConversations) {
      onLoadConversations(loadConversations);
    }
    
    // Set up real-time subscription for conversations
    if (siteId && !subscriptionRef.current) {
      try {
        const supabase = createClient();
        
        console.log(`Setting up real-time subscription for conversations in site: ${siteId}`);
        
        // Clean up previous subscription if exists
        if (subscriptionRef.current) {
          subscriptionRef.current.unsubscribe();
        }
        
        // Create subscription for INSERT events (new conversations)
        subscriptionRef.current = supabase
          .channel(`site-conversations-${siteId}`)
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'conversations',
            filter: `site_id=eq.${siteId}`
          }, async (payload: { 
            new: { 
              id: string; 
              title: string;
              agent_id: string;
              site_id: string;
              created_at: string;
            }
          }) => {
            console.log('New conversation created - INSERT event received:', payload);
            // Solo recargar si es una conversación nueva, no si estamos seleccionando una existente
            loadConversations();
          })
          // Subscribe to UPDATE events (conversations updates)
          .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'conversations',
            filter: `site_id=eq.${siteId}`
          }, (payload: { 
            new: { 
              id: string; 
              last_message_at: string;
            }
          }) => {
            console.log('Conversation updated:', payload);
            // Solo actualizar la conversación específica en lugar de recargar toda la lista
            if (payload.new.id) {
              // Actualizar solo la conversación modificada
              setConversations(prevConversations => 
                prevConversations.map(conv => 
                  conv.id === payload.new.id 
                    ? { ...conv, timestamp: new Date(payload.new.last_message_at) }
                    : conv
                )
              );
            }
          })
          // Subscribe to DELETE events (when conversations are deleted)
          .on('postgres_changes', {
            event: 'DELETE',
            schema: 'public',
            table: 'conversations',
            filter: `site_id=eq.${siteId}`
          }, async (payload: { 
            old: { 
              id: string;
            }
          }) => {
            console.log('Conversation deleted:', payload);
            // If this is the currently selected conversation, redirect to chat list
            if (payload.old.id === selectedConversationIdRef.current) {
              console.log('Currently selected conversation was deleted, redirecting to chat list');
              // This will be handled by the parent component when loading fails
            }
            // Refresh the conversation list
            loadConversations();
          })
          // También optimizar el manejo de nuevos mensajes
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages'
          }, (payload: any) => {
            console.log('New message inserted, updating conversation details');
            
            // Si tenemos el conversation_id, actualizar solo esa conversación
            if (payload.new && payload.new.conversation_id) {
              try {
                const supabase = createClient();
                
                // Obtener la conversación actualizada
                supabase
                  .from('conversations')
                  .select('id, last_message_at, last_message')
                  .eq('id', payload.new.conversation_id)
                  .single()
                  .then(({ data: updatedConversation, error }: { 
                    data: { 
                      id: string; 
                      last_message_at: string; 
                      last_message: string | null 
                    } | null; 
                    error: any 
                  }) => {
                    if (!error && updatedConversation) {
                      // Actualizar solo esta conversación en la lista
                      setConversations(prevConversations => 
                        prevConversations.map(conv => 
                          conv.id === updatedConversation.id 
                            ? { 
                                ...conv, 
                                timestamp: new Date(updatedConversation.last_message_at),
                                lastMessage: updatedConversation.last_message || conv.lastMessage 
                              }
                            : conv
                        )
                      );
                    }
                  });
              } catch (err) {
                console.error("Error updating conversation after new message:", err);
              }
            }
          })
          .subscribe();
      } catch (error) {
        console.error("Error setting up real-time subscription:", error);
      }
    }
    
    return () => {
      active = false;
      
      // Clean up subscription
      if (subscriptionRef.current) {
        console.log('Unsubscribing from conversations');
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    }
  }, [siteId, onLoadConversations])

  const filteredConversations = conversations.filter(conv => {
    const searchLower = searchQuery.toLowerCase()
    return (
      (conv.title && conv.title.toLowerCase().includes(searchLower)) ||
      (conv.agentName && conv.agentName.toLowerCase().includes(searchLower)) ||
      (conv.lastMessage && conv.lastMessage.toLowerCase().includes(searchLower))
    )
  })

  // Determinar si mostrar el estado vacío después de la búsqueda
  const showEmptyState = !isLoading && (
    (isInitialLoad === false && hasEmptyResult) || 
    (!isInitialLoad && filteredConversations.length === 0)
  );

  const handleSelectConversation = (conversation: ConversationListItem) => {
    // No hacer nada si ya está seleccionada la conversación
    if (selectedConversationId === conversation.id) {
      return;
    }
    
    // Solo notificar al componente padre, sin recargar la lista
    onSelectConversation(conversation.id, conversation.agentName, conversation.agentId);
  }
  
  const deleteConversation = async (conversationId: string) => {
    try {
      // Call the Supabase client to delete the conversation
      const supabase = createClient();
      
      // First delete related messages
      const { error: messagesError } = await supabase
        .from('messages')
        .delete()
        .eq('conversation_id', conversationId);
        
      if (messagesError) {
        console.error("Error deleting messages:", messagesError);
        return;
      }
      
      // Then delete the conversation
      const { error: conversationError } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId);
        
      if (conversationError) {
        console.error("Error deleting conversation:", conversationError);
        return;
      }
      
      // If the parent component provided a delete handler, call it
      if (onDeleteConversation) {
        await onDeleteConversation(conversationId);
      }
      
      // Reload the conversation list
      if (loadConversationsRef.current) {
        await loadConversationsRef.current();
      }
      
      // If the deleted conversation was selected, redirect to the chat list
      if (selectedConversationIdRef.current === conversationId) {
        router.push('/chat');
      }
    } catch (error) {
      console.error("Error in deleteConversation:", error);
    }
  };

  // Function to setup real-time subscription
  const setupRealtimeSubscription = (siteId: string) => {
    if (!siteId) return null;
    
    try {
      console.log(`Setting up real-time subscription for conversations in site: ${siteId}`);
      const supabase = createClient();
      
      // Clean up previous subscription if exists
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
      
      // Create new subscription
      const subscription = supabase
        .channel(`site-conversations-${siteId}`) // Removed timestamp to ensure consistent channel name
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'conversations',
          filter: `site_id=eq.${siteId}`
        }, (payload: { 
          new: { 
            id: string; 
            title: string;
            agent_id: string;
            site_id: string;
            created_at: string;
          }
        }) => {
          console.log('New conversation created - INSERT event received:', payload);
          if (loadConversationsRef.current) {
            loadConversationsRef.current();
          }
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
          filter: `site_id=eq.${siteId}`
        }, (payload: { 
          new: { 
            id: string; 
            last_message_at: string;
          }
        }) => {
          console.log('Conversation updated:', payload);
          if (loadConversationsRef.current) {
            loadConversationsRef.current();
          }
        })
        .on('postgres_changes', {
          event: 'DELETE',
          schema: 'public',
          table: 'conversations',
          filter: `site_id=eq.${siteId}`
        }, (payload: { 
          old: { 
            id: string;
          }
        }) => {
          console.log('Conversation deleted event received:', payload);
          
          // Update the UI immediately by filtering out the deleted conversation
          setConversations(prevConversations => 
            prevConversations.filter(conv => conv.id !== payload.old.id)
          );
          
          // If this is the currently selected conversation, redirect to chat list
          if (payload.old.id === selectedConversationIdRef.current) {
            console.log('Currently selected conversation was deleted, redirecting to chat list');
            router.push('/chat');
          }
          
          // Also refresh the full list to ensure consistency
          if (loadConversationsRef.current) {
            loadConversationsRef.current();
          }
        })
        // Also subscribe to messages table to catch last_message updates
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        }, () => {
          console.log('New message inserted, refreshing conversations');
          // Refresh conversations after a short delay
          setTimeout(() => {
            if (loadConversationsRef.current) {
              loadConversationsRef.current();
            }
          }, 300);
        })
        .subscribe((status: 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR') => {
          console.log(`Subscription status for conversations: ${status}`);
        });
      
      return subscription;
    } catch (error) {
      console.error("Error setting up real-time subscription:", error);
      return null;
    }
  };

  return (
    <div className={cn("flex flex-col h-full fixed", className)} style={{ width: '320px', maxWidth: '320px', overflow: 'hidden' }}>
      {/* Top bar with search input - adaptable to dark mode */}
      <div className={cn(
        "flex items-center justify-center h-[71px] border-b transition-colors duration-300 flex-shrink-0",
        isDarkMode ? "bg-background" : "bg-white",
        "fixed w-[319px] z-[999]"
      )} style={{ background: isDarkMode ? 'var(--background)' : '#ffffffed', backdropFilter: 'blur(10px)' }}>
        <div className="relative w-[80%]">
          <Input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              "pl-9 h-10 w-full rounded-md",
              isDarkMode ? "bg-background border-input" : "bg-white"
            )}
            data-command-k-input="true"
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
            <span className="text-xs">⌘</span>K
          </kbd>
        </div>
      </div>
      
      <div className="h-[calc(100vh-71px)] overflow-hidden flex-grow">
        {isLoading ? (
          <div className="h-full overflow-auto pt-[71px]">
            <div className="w-[320px]">
              {Array(5).fill(0).map((_, index) => (
                <ConversationSkeleton key={index} />
              ))}
            </div>
          </div>
        ) : showEmptyState ? (
          <div className="flex items-center justify-center h-full pt-[71px]">
            <EmptyState />
          </div>
        ) : (
          <div className="h-full overflow-auto pt-[71px]">
            <div className="w-[320px]">
              {filteredConversations.map(conversation => (
                <button
                  key={conversation.id}
                  onClick={() => handleSelectConversation(conversation)}
                  className={cn(
                    "w-full text-left py-3 px-4 rounded-none transition-colors border-b border-border/30",
                    "hover:bg-accent/20",
                    selectedConversationId === conversation.id && 
                      isDarkMode 
                        ? "bg-primary/15" 
                        : selectedConversationId === conversation.id && 
                          "bg-primary/10"
                  )}
                  style={{ 
                    width: '320px', 
                    maxWidth: '320px', 
                    boxSizing: 'border-box',
                    position: 'relative' 
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn(
                      "font-medium text-sm truncate max-w-[95%]",
                      selectedConversationId === conversation.id && "text-primary"
                    )}>
                      {truncateText(conversation.title || "Untitled Conversation", 35)}
                    </span>
                    <div
                      className="opacity-0 group-hover:opacity-100 hover:bg-accent/30 rounded-full p-1 absolute right-3 top-3"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversation(conversation.id);
                      }}
                    >
                      <Icons.Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                    </div>
                  </div>
                  <div className={cn(
                    "text-xs truncate",
                    selectedConversationId === conversation.id ? "text-muted-foreground" : "text-muted-foreground/80"
                  )}>
                    {truncateText(conversation.lastMessage || getDefaultMessage(conversation.title || ""), 50)}
                  </div>
                  <div className="flex justify-between items-center mt-0.5">
                    <div className={cn(
                      "text-[11px]",
                      selectedConversationId === conversation.id ? "text-primary/70" : "text-muted-foreground/70"
                    )}>
                      {conversation.agentName || "No Agent Name"} 
                      {!conversation.agentName && <span className="text-red-500">!</span>}
                      {conversation.leadName && <span> · {conversation.leadName}</span>}
                    </div>
                    <span className={cn(
                      "text-[11px] whitespace-nowrap flex-shrink-0",
                      selectedConversationId === conversation.id ? "text-primary/70" : "text-muted-foreground/70"
                    )}>
                      {conversation.timestamp ? formatMessageDate(conversation.timestamp) : ""}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 