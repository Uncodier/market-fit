"use client"

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/app/components/ui/button"
import { ScrollArea } from "@/app/components/ui/scroll-area"
import { Search, MessageSquare } from "@/app/components/ui/icons"
import { cn } from "@/lib/utils"
import { Input } from "@/app/components/ui/input"
import { useTheme } from "@/app/context/ThemeContext"
import { useAuthContext } from "@/app/components/auth/auth-provider"
import { ConversationListItem } from "@/app/types/chat"
import { format } from "date-fns"
import { Skeleton } from "@/app/components/ui/skeleton"
import { createClient } from "@/lib/supabase/client"
import { RenameConversationModal } from "./RenameConversationModal"
import { DeleteConfirmationModal } from "./DeleteConfirmationModal"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { ConversationItem } from "./ConversationItem"
import { ChannelFilter } from "./ChannelFilter"

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

interface ChatListProps {
  siteId: string
  selectedConversationId?: string
  onSelectConversation: (conversationId: string, agentName: string, agentId: string, conversationTitle?: string) => void
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
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const [conversations, setConversations] = useState<ConversationListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [hasEmptyResult, setHasEmptyResult] = useState(false)
  const [combinedFilter, setCombinedFilter] = useState<'all' | 'web' | 'email' | 'whatsapp' | 'assigned' | 'ai' | 'inbound' | 'outbound' | 'tasks'>('all')
  const { isDarkMode } = useTheme()
  const { user } = useAuthContext()
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null)
  
  // Load user avatar
  useEffect(() => {
    const fetchUserAvatar = async () => {
      if (!user) return
      
      try {
        const supabase = createClient()
        
        // First try to get the user's profile from the database using email
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('email', user.email)
          .single()
          
        if (!error && profile && profile.avatar_url) {
          setUserAvatarUrl(profile.avatar_url)
          return
        }
        
        // If no avatar in profile, try with user_metadata
        if (user.user_metadata?.avatar_url) {
          setUserAvatarUrl(user.user_metadata.avatar_url)
          return
        }
        
        // Try with identities if available
        if (user.identities?.[0]?.identity_data?.avatar_url) {
          setUserAvatarUrl(user.identities[0].identity_data.avatar_url)
          return
        }
        
        // If no avatar anywhere, use null (will show initials)
        setUserAvatarUrl(null)
      } catch (error) {
        console.error("Error fetching user avatar:", error)
        setUserAvatarUrl(null)
      }
    }
    
    fetchUserAvatar()
  }, [user])

  // Debounce search query to avoid excessive API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 300) // 300ms delay

    return () => clearTimeout(timer)
  }, [searchQuery])
  
  // Pagination states - similar to commands-panel.tsx
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  
  // Reference for the subscription
  const subscriptionRef = useRef<any>(null);
  // Reference to store the current selected conversation ID
  const selectedConversationIdRef = useRef<string | undefined>(selectedConversationId);
  // Reference to store the loadConversations function
  const loadConversationsRef = useRef<(() => Promise<void>) | null>(null);
  
  // Estado para el modal de renombrar
  const [renameModalOpen, setRenameModalOpen] = useState(false)
  const [currentConversation, setCurrentConversation] = useState<ConversationListItem | null>(null)
  
  // Estado para el modal de confirmación de eliminación
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [conversationToDelete, setConversationToDelete] = useState<ConversationListItem | null>(null)
  
  // New ref to track initial load state
  const isFirstLoadRef = useRef(true);

  // Update the ref when selectedConversationId changes
  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  // Load conversations with pagination - similar to commands-panel.tsx
  const loadConversations = useCallback(async (page: number = 1, append: boolean = false, searchQuery?: string) => {
    if (!siteId) {
      console.log('🔍 DEBUG: Cannot load conversations - no siteId provided');
      return;
    }
    
    console.log(`🔍 DEBUG: loadConversations called for site: ${siteId}, page: ${page}, append: ${append}, filter: ${combinedFilter}, search: ${searchQuery || 'none'}`);
    
    // Solo mostrar el esqueleto en la primera carga
    const isFirstLoad = isFirstLoadRef.current && page === 1;
    if (isFirstLoad) {
      console.log('🔍 DEBUG: First load - showing skeleton');
      setIsLoading(true);
      // Establecer que ya no es la primera carga
      isFirstLoadRef.current = false;
    } else if (page > 1) {
      console.log('🔍 DEBUG: Loading more - showing loading more state');
      setIsLoadingMore(true);
    }
    
    try {
      // Request conversations from server with pagination and channel filter
      // Separate combined filter into channel, assignee, initiatedBy, and tasks filters
      const channelFilter = ['web', 'email', 'whatsapp'].includes(combinedFilter) ? combinedFilter as 'web' | 'email' | 'whatsapp' : 'all'
      const assigneeFilter = ['assigned', 'ai'].includes(combinedFilter) ? combinedFilter as 'assigned' | 'ai' : 'all'
      const initiatedByFilter = combinedFilter === 'inbound' ? 'visitor' : combinedFilter === 'outbound' ? 'agent' : 'all'
      const tasksOnly = combinedFilter === 'tasks'
      
      const { getConversations } = await import('@/app/services/getConversations.client')
      const result = await getConversations(
        siteId,
        page,
        20,
        channelFilter,
        assigneeFilter,
        user?.id,
        searchQuery,
        initiatedByFilter,
        tasksOnly
      ) // 20 conversations per page
      console.log(`🔍 DEBUG: getConversations returned ${result.length} conversations for page ${page}`);
      
      if (result.length > 0) {
        if (append) {
          setConversations(prev => {
            // Filter out any conversations that already exist to avoid duplicates
            const existingIds = new Set(prev.map(conv => conv.id));
            const newConversations = result.filter(conv => !existingIds.has(conv.id));
            return [...prev, ...newConversations];
          })
        } else {
          setConversations(result)
        }
        
        // If we got less than 20 items, we've reached the end
        setHasMore(result.length === 20)
        setHasEmptyResult(false)
        setIsInitialLoad(false)
      } else {
        if (!append) {
          setConversations([])
          setHasEmptyResult(true)
        }
        setHasMore(false)
        setIsInitialLoad(false)
      }
      
      // Solo aplicar el retraso para la primera carga
      if (isFirstLoad) {
        // Pequeño retraso antes de ocultar el esqueleto para evitar parpadeos
        setTimeout(() => {
          setIsLoading(false)
        }, 300)
      }
    } catch (error) {
      console.error("Error loading conversations:", error)
      if (!append) {
        setHasEmptyResult(true)
        setIsInitialLoad(false)
      }
      setIsLoading(false)
      setHasMore(false)
    } finally {
      if (!isFirstLoad) {
        setIsLoadingMore(false)
      }
      console.log('🔍 DEBUG: loadConversations completed');
    }
  }, [siteId, combinedFilter])

  // Handle load more - similar to commands-panel.tsx
  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore) return;
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    await loadConversations(nextPage, true, debouncedSearchQuery);
  };

  useEffect(() => {
    let active = true
    
    // Reset pagination state when siteId changes
    setCurrentPage(1)
    setHasMore(true)
    
    const loadInitialConversations = () => loadConversations(1, false)
    
    loadInitialConversations()
    
    // Store the loadConversations function in the ref
    loadConversationsRef.current = loadInitialConversations;
    
    // Solo ejecutar onLoadConversations si la prop existe, evitando ejecutarlo si no es necesario
    if (onLoadConversations) {
      onLoadConversations(loadInitialConversations);
    }
    
    // Set up real-time subscription for conversations
    if (siteId && !subscriptionRef.current) {
      try {
        const supabase = createClient();
        
        console.log(`🔍 Setting up real-time subscription for site: ${siteId}`);
        
        // Limpieza de cualquier suscripción existente
        if (subscriptionRef.current) {
          subscriptionRef.current.unsubscribe();
        }
        
        // Crear una suscripción simple y directa usando el enfoque clásico de Supabase
        console.log('🔍 Setting up subscription using classic approach with enhanced conversation details');
        
        // Función auxiliar para obtener detalles completos de una conversación
        const getConversationDetails = async (conversationData: any) => {
          const supabase = createClient();
          
          // Obtener información del agente si existe agent_id
          let agentName = "Unknown Agent";
          if (conversationData.agent_id) {
            const { data: agent, error: agentError } = await supabase
              .from("agents")
              .select("name")
              .eq("id", conversationData.agent_id)
              .single();
            
            if (!agentError && agent) {
              agentName = agent.name;
            }
          }
          
          // Obtener información del lead si existe lead_id
          let leadName = undefined;
          let assigneeName = null;
          if (conversationData.lead_id) {
            const { data: lead, error: leadError } = await supabase
              .from("leads")
              .select("name, company, assignee_id")
              .eq("id", conversationData.lead_id)
              .single();
            
            if (!leadError && lead) {
              const companyName = lead.company && typeof lead.company === 'object' && lead.company.name 
                ? lead.company.name 
                : (typeof lead.company === 'string' ? lead.company : '');
              
              leadName = lead.name + (companyName ? ` (${companyName})` : '');
              
              // Si el lead tiene assignee_id, obtener información del assignee
              if (lead.assignee_id) {
                try {
                  // Import getUserData dynamically to avoid circular dependencies
                  const { getUserData } = await import('@/app/services/user-service');
                  const assigneeData = await getUserData(lead.assignee_id);
                  if (assigneeData) {
                    assigneeName = assigneeData.name;
                  }
                } catch (error) {
                  console.error("Error fetching assignee data for conversation list:", error);
                }
              }
            }
          }
          
          // Extract channel from custom_data or default to 'web'
          const customData = conversationData.custom_data || {};
          const channel = customData.channel || 'web';
          
          // Use assignee name if available, otherwise use agent name
          const finalAgentName = assigneeName || agentName;
          
          return { agentName: finalAgentName, leadName, channel };
        };
        
        // Un canal por tipo de evento, enfoque más tradicional
        const channel = supabase.channel(`conversations-${siteId}`, {
          config: {
            broadcast: { self: false }
          }
        })
          .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'conversations',
            filter: `site_id=eq.${siteId}`
          }, async (payload: any) => {
            console.log('🔍 UPDATE event received:', payload);
            
            if (payload.new) {
              // Asegurar que isLoading sea false antes de actualizar
              setIsLoading(false);
              
              try {
                // Obtener detalles actualizados si es necesario
                const details = await getConversationDetails(payload.new);
                
                // Compute resilient title using lead or agent name if needed
                let title = payload.new.title as string | null;
                if (!title || title.trim() === "") {
                  if (details.leadName) {
                    title = `Chat with ${details.leadName}`;
                  } else if (details.agentName) {
                    title = `Chat with ${details.agentName}`;
                  } else {
                    title = "Untitled Conversation";
                  }
                }
                
                // Actualizar sólo la conversación modificada en el estado
                setConversations(prevConversations => 
                  prevConversations.map(conv => 
                    conv.id === payload.new.id 
                      ? { 
                          ...conv, 
                          title: title,
                          timestamp: new Date(payload.new.updated_at || new Date()),
                          lastMessage: payload.new.last_message || conv.lastMessage,
                          agentId: payload.new.agent_id || conv.agentId,
                          agentName: details.agentName,
                          leadName: details.leadName,
                          channel: (details.channel as 'web' | 'email' | 'whatsapp') || 'web',
                          status: payload.new.status || conv.status || 'active'
                        } 
                      : conv
                  )
                );
                
                console.log(`🔍 Conversation ${payload.new.id} updated with agent: ${details.agentName}, channel: ${details.channel}`);
              } catch (error) {
                console.error('🔍 Error fetching conversation details for UPDATE:', error);
                
                // Fallback: actualizar solo con los datos disponibles
                setConversations(prevConversations => 
                  prevConversations.map(conv => 
                    conv.id === payload.new.id 
                      ? { 
                          ...conv, 
                          title: (payload.new.title && String(payload.new.title).trim() !== "") ? payload.new.title : conv.title,
                          timestamp: new Date(payload.new.updated_at || new Date()),
                          lastMessage: payload.new.last_message || conv.lastMessage,
                          status: payload.new.status || conv.status || 'active'
                        } 
                      : conv
                  )
                );
                
                console.log(`🔍 Conversation ${payload.new.id} updated with limited data due to error`);
              }
            }
          })
        
        // Crear una suscripción para eventos de INSERT
        channel.on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'conversations',
          filter: `site_id=eq.${siteId}`
        }, async (payload: any) => {
          console.log('🔍 INSERT event received:', payload);
          
          // Asegurar que isLoading sea false antes de actualizar
          setIsLoading(false);
          
          // Obtener información completa de la nueva conversación
          if (payload.new && payload.new.id) {
            try {
              // Usar la función auxiliar para obtener detalles
              const details = await getConversationDetails(payload.new);
              
              // Compute resilient title using lead or agent name if needed
              let title = payload.new.title as string | null;
              if (!title || title.trim() === "") {
                if (details.leadName) {
                  title = `Chat with ${details.leadName}`;
                } else if (details.agentName) {
                  title = `Chat with ${details.agentName}`;
                } else {
                  title = "Untitled Conversation";
                }
              }
              
              const newConversation: ConversationListItem = {
                id: payload.new.id,
                title: title,
                agentId: payload.new.agent_id || "",
                agentName: details.agentName,
                leadName: details.leadName,
                lastMessage: payload.new.last_message || "",
                timestamp: new Date(payload.new.updated_at || payload.new.created_at || new Date()),
                unreadCount: 0,
                messageCount: 0,
                channel: (details.channel as 'web' | 'email' | 'whatsapp') || 'web',
                status: payload.new.status || 'active'
              };
              
              // Añadir la nueva conversación al principio de la lista, evitando duplicados
              setConversations(prev => {
                // Check if conversation already exists
                const exists = prev.some(conv => conv.id === newConversation.id);
                if (exists) {
                  console.log(`🔍 Conversation ${newConversation.id} already exists, skipping duplicate`);
                  return prev;
                }
                return [newConversation, ...prev];
              });
              console.log(`🔍 New conversation ${newConversation.id} added with agent: ${details.agentName}, channel: ${details.channel}`);
              console.log(`🔍 DEBUG: Full conversation object:`, newConversation);

              // If payload came without a title, fetch the latest row to correct it
              if (!payload.new.title || String(payload.new.title).trim() === "") {
                try {
                  const supabase = createClient();
                  const { data: convRow, error: convErr } = await supabase
                    .from('conversations')
                    .select('id, title')
                    .eq('id', payload.new.id)
                    .single();
                  if (!convErr && convRow && convRow.title && String(convRow.title).trim() !== "" && convRow.title !== newConversation.title) {
                    setConversations(prev => prev.map(c => c.id === convRow.id ? { ...c, title: convRow.title } : c));
                    console.log(`🔍 Title corrected from DB for conversation ${convRow.id}: ${convRow.title}`);
                  }
                } catch (fetchErr) {
                  console.warn('⚠️ Failed to fetch conversation title after INSERT:', fetchErr);
                }
              }
              
            } catch (error) {
              console.error('🔍 Error fetching conversation details:', error);
              
              // Fallback: recargar toda la lista si no podemos obtener los detalles
              if (loadConversationsRef.current) {
                const wasFirstLoad = isFirstLoadRef.current;
                isFirstLoadRef.current = false; // Forzar a falso para evitar el esqueleto
                
                loadConversationsRef.current().then(() => {
                  console.log(`🔍 List reloaded for INSERT due to error fetching details`);
                });
                
                console.log(`🔍 Error fetching conversation details, reloading without skeleton`);
              }
            }
          } else {
            // Solo si no tenemos información básica, recargamos la lista completa
            if (loadConversationsRef.current) {
              const wasFirstLoad = isFirstLoadRef.current;
              isFirstLoadRef.current = false; // Forzar a falso para evitar el esqueleto
              
              loadConversationsRef.current().then(() => {
                console.log(`🔍 List reloaded for INSERT without conversation ID`);
              });
              
              console.log(`🔍 No conversation ID in INSERT payload, reloading without skeleton`);
            }
          }
        });
        
        // Crear una suscripción para eventos de DELETE
        channel.on('postgres_changes', {
          event: 'DELETE',
          schema: 'public',
          table: 'conversations',
          filter: `site_id=eq.${siteId}`
        }, (payload: any) => {
          console.log('🔍 DELETE event received:', payload);
          
          // Asegurar que isLoading sea false antes de actualizar
          setIsLoading(false);
          
          if (payload.old && payload.old.id) {
            // Eliminar la conversación del estado directamente
            setConversations(prevConversations => 
              prevConversations.filter(conv => conv.id !== payload.old.id)
            );
            
            console.log(`🔍 Conversation ${payload.old.id} removed from state without reloading`);
            
            // Si la conversación eliminada era la seleccionada, redirigir a la lista de chat
            if (selectedConversationIdRef.current === payload.old.id) {
              router.push('/chat');
            }
          }
        });
        
        // Suscribir al canal con mejor manejo de errores
        channel.subscribe((status: string) => {
          console.log(`🔍 Channel subscription status: ${status}`);
          
          switch (status) {
            case 'SUBSCRIBED':
              console.log('✅ Successfully subscribed to real-time updates');
              break;
            case 'CHANNEL_ERROR':
              console.warn('⚠️ Real-time subscription error - continuing without live updates');
              console.log('🔍 This may be due to network issues or server configuration');
              console.log('🔍 The app will continue to work but may not show real-time updates');
              break;
            case 'TIMED_OUT':
              console.warn('⚠️ Real-time subscription timed out - will retry automatically');
              break;
            case 'CLOSED':
              console.log('🔍 Real-time subscription closed');
              break;
            default:
              console.log(`🔍 Real-time status: ${status}`);
          }
        });
        
        // Guardar la referencia
        subscriptionRef.current = channel;
        
      } catch (error) {
        console.warn('⚠️ Failed to set up real-time subscription:', error);
        console.log('🔍 The app will work normally but without real-time updates');
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

  // Listen for custom conversation deleted event
  useEffect(() => {
    const handleConversationDeleted = (event: CustomEvent) => {
      const { conversationId: deletedId } = event.detail
      console.log('🔍 Custom conversation:deleted event received:', deletedId)
      
      // Remove the conversation from the list immediately
      setConversations(prevConversations => 
        prevConversations.filter(conv => conv.id !== deletedId)
      )
      
      // If the deleted conversation was selected, redirect to chat list
      if (selectedConversationId === deletedId) {
        router.push('/chat')
      }
    }

    window.addEventListener('conversation:deleted', handleConversationDeleted as EventListener)
    
    return () => {
      window.removeEventListener('conversation:deleted', handleConversationDeleted as EventListener)
    }
  }, [selectedConversationId, router])

  // Listen for message accepted event to update conversation icon
  useEffect(() => {
    const handleMessageAccepted = (event: CustomEvent) => {
      const { conversationId: acceptedConvId } = event.detail
      console.log('🔍 Custom conversation:message-accepted event received:', acceptedConvId)
      
      // Update the conversation to mark it has an accepted message
      setConversations(prevConversations => 
        prevConversations.map(conv => 
          conv.id === acceptedConvId 
            ? { ...conv, hasAcceptedMessage: true }
            : conv
        )
      )
    }

    window.addEventListener('conversation:message-accepted', handleMessageAccepted as EventListener)
    
    return () => {
      window.removeEventListener('conversation:message-accepted', handleMessageAccepted as EventListener)
    }
  }, [])

  // Reset conversations and reload when channel filter changes
  useEffect(() => {
    if (siteId) {
      console.log(`🔍 DEBUG: Filter changed to: ${combinedFilter}, reloading conversations`);
      // Reset pagination state
      setCurrentPage(1)
      setHasMore(true)
      // Reset isFirstLoadRef so skeleton shows on filter change
      isFirstLoadRef.current = true
      // Load conversations with new filter
      loadConversations(1, false)
    }
  }, [combinedFilter, siteId, loadConversations])

  // Handle search query changes
  useEffect(() => {
    if (siteId) {
      console.log(`🔍 DEBUG: Search query changed to: "${debouncedSearchQuery}", reloading conversations`);
      // Reset pagination state
      setCurrentPage(1)
      setHasMore(true)
      // Reset isFirstLoadRef so skeleton shows on search
      isFirstLoadRef.current = true
      // Load conversations with search query
      loadConversations(1, false, debouncedSearchQuery)
    }
  }, [debouncedSearchQuery, siteId, loadConversations])

  // Listen for conversation deletion event
  useEffect(() => {
    const handleConversationDeleted = (event: CustomEvent) => {
      console.log('🗑️ Conversation deleted, reloading list:', event.detail?.conversationId)
      
      // Reload conversations list
      if (siteId) {
        loadConversations(1, false, debouncedSearchQuery)
      }
    }
    
    window.addEventListener('conversation:deleted' as any, handleConversationDeleted)
    
    return () => {
      window.removeEventListener('conversation:deleted' as any, handleConversationDeleted)
    }
  }, [siteId, loadConversations, debouncedSearchQuery])

  // No need for client-side filtering since search is done at database level
  const filteredConversations = conversations

  // Separar conversaciones pendientes del resto
  const pendingConversations = filteredConversations.filter(conv => conv.status === 'pending')
  const otherConversations = filteredConversations.filter(conv => conv.status !== 'pending')

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
    onSelectConversation(conversation.id, conversation.agentName, conversation.agentId, conversation.title);
  }
  
  const deleteConversation = async (conversationId: string) => {
    try {
      // Asegurar que no se muestre el esqueleto
      setIsLoading(false);
      
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
      
      // Eliminar directamente del estado en lugar de recargar
      setConversations(prevConversations => 
        prevConversations.filter(conv => conv.id !== conversationId)
      );
      console.log(`🔍 DEBUG: Conversation ${conversationId} removed from state directly`);
      
      // If the deleted conversation was selected, redirect to the chat list
      if (selectedConversationIdRef.current === conversationId) {
        router.push('/chat');
      }
    } catch (error) {
      console.error("Error in deleteConversation:", error);
    } finally {
      // Asegurar que isLoading permanezca en false
      setIsLoading(false);
    }
  };

  // Función para archivar una conversación
  const archiveConversation = async (conversationId: string) => {
    try {
      // Asegurar que no se muestre el esqueleto
      setIsLoading(false);
      
      const supabase = createClient();
      
      // Actualizar is_archived a true
      const { error } = await supabase
        .from('conversations')
        .update({ is_archived: true })
        .eq('id', conversationId);
        
      if (error) {
        console.error("Error archiving conversation:", error);
        return;
      }
      
      // Actualizar directamente en el estado en lugar de recargar
      setConversations(prevConversations => 
        prevConversations.filter(conv => conv.id !== conversationId)
      );
      console.log(`🔍 DEBUG: Archived conversation ${conversationId} removed from state directly`);
      
      // If the archived conversation was selected, redirect to the chat list
      if (selectedConversationIdRef.current === conversationId) {
        router.push('/chat');
      }
    } catch (error) {
      console.error("Error in archiveConversation:", error);
    } finally {
      // Asegurar que isLoading permanezca en false
      setIsLoading(false);
    }
  };

  // Función para abrir el modal de renombrar
  const openRenameModal = (conversation: ConversationListItem) => {
    setCurrentConversation(conversation);
    setRenameModalOpen(true);
  };
  
  // Función para actualizar directamente el título de una conversación en el estado
  const handleDirectTitleUpdate = (conversationId: string, newTitle: string) => {
    // Asegurar que no se muestre el esqueleto
    setIsLoading(false);
    
    setConversations(prevConversations => 
      prevConversations.map(conv => 
        conv.id === conversationId 
          ? { ...conv, title: newTitle } 
          : conv
      )
    );
    console.log(`🔍 DEBUG: Conversation ${conversationId} title updated directly in state to "${newTitle}"`);
  };
  
  // Función para abrir el modal de confirmación de eliminación
  const openDeleteModal = (conversation: ConversationListItem) => {
    setConversationToDelete(conversation);
    setDeleteModalOpen(true);
  };

  return (
    <div className={cn("flex flex-col h-full fixed", className)} style={{ width: '320px', maxWidth: '320px', overflow: 'hidden' }}>
      {/* Top bar with search input - adaptable to dark mode */}
      <div className={cn(
        "flex items-center justify-center h-[71px] border-b transition-colors duration-300 flex-shrink-0",
        "bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/80",
        "fixed w-[319px] z-[999]"
      )} style={{ WebkitBackdropFilter: 'blur(10px)' }}>
        <div className="relative w-[80%]">
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              "h-12 w-full rounded-md",
              isDarkMode ? "bg-background border-input" : "bg-white"
            )}
            data-command-k-input="true"
            icon={<Search className="h-4 w-4 text-muted-foreground" />}
          />
          <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
            <span className="text-xs">⌘</span>K
          </kbd>
        </div>
      </div>
      
      <div className="h-[calc(100vh-71px)] overflow-hidden flex-grow">
        <div className="h-full overflow-auto pt-[71px]">
          <div className="w-[320px]">
            {/* Combined Filter - always visible */}
            <ChannelFilter
              selectedFilter={combinedFilter}
              onFilterChange={setCombinedFilter}
              userAvatarUrl={userAvatarUrl}
              userName={user?.user_metadata?.name || user?.email}
            />
            
            {isLoading ? (
              <div className="pb-[200px]">
                {Array(5).fill(0).map((_, index) => (
                  <ConversationSkeleton key={index} />
                ))}
              </div>
            ) : showEmptyState ? (
              <div className="flex items-center justify-center h-[calc(100vh-200px)]">
                <div className="w-full max-w-[280px] px-4">
                  <EmptyCard
                    icon={<MessageSquare className="h-10 w-10 text-muted-foreground" />}
                    title="No conversations"
                    description="Start a new conversation with an agent to see it here."
                    variant="fancy"
                    showShadow={false}
                    contentClassName="py-8"
                  />
                </div>
              </div>
            ) : (
              <div className="pb-[200px]">
              
              {/* Pending Conversations Section */}
              {pendingConversations.length > 0 && (
                <div className="mb-2">
                  <div className={cn(
                    "px-4 py-2 text-xs font-medium uppercase tracking-wide sticky top-[56px] z-10",
                    "bg-background/80 text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-background/80"
                  )} style={{ WebkitBackdropFilter: 'blur(10px)' }}>
                    Pending ({pendingConversations.length})
                  </div>
                  {pendingConversations.map(conversation => (
                    <ConversationItem
                      key={conversation.id}
                      conversation={conversation}
                      isSelected={selectedConversationId === conversation.id}
                      onSelect={() => handleSelectConversation(conversation)}
                      onRename={() => openRenameModal(conversation)}
                      onArchive={() => archiveConversation(conversation.id)}
                      onDelete={() => openDeleteModal(conversation)}
                    />
                  ))}
                </div>
              )}
              
              {/* Other Conversations Section */}
              {otherConversations.length > 0 && (
                <div>
                  {pendingConversations.length > 0 && (
                    <div className={cn(
                      "px-4 py-2 text-xs font-medium uppercase tracking-wide sticky top-[56px] z-10",
                      "bg-background/80 text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-background/80"
                    )} style={{ WebkitBackdropFilter: 'blur(10px)' }}>
                      Active Conversations
                    </div>
                  )}
                  {otherConversations.map(conversation => (
                    <ConversationItem
                      key={conversation.id}
                      conversation={conversation}
                      isSelected={selectedConversationId === conversation.id}
                      onSelect={() => handleSelectConversation(conversation)}
                      onRename={() => openRenameModal(conversation)}
                      onArchive={() => archiveConversation(conversation.id)}
                      onDelete={() => openDeleteModal(conversation)}
                    />
                  ))}
                </div>
              )}
              
              {/* Load More Button - similar to commands-table.tsx */}
              {hasMore && (
                <div className="flex justify-center py-4 px-4">
                  <Button
                    variant="outline"
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    className="w-full max-w-[280px]"
                  >
                    {isLoadingMore ? (
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 animate-pulse bg-muted rounded" />
                        <span>Loading</span>
                      </div>
                    ) : "Load More"}
                  </Button>
                </div>
              )}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Modal para renombrar conversación */}
      {currentConversation && (
        <RenameConversationModal
          open={renameModalOpen}
          onOpenChange={setRenameModalOpen}
          conversationId={currentConversation.id}
          currentTitle={currentConversation.title}
          onRename={loadConversationsRef.current || (() => Promise.resolve())}
          onDirectUpdate={handleDirectTitleUpdate}
        />
      )}
      
      {/* Modal de confirmación para eliminar conversación */}
      {conversationToDelete && (
        <DeleteConfirmationModal
          open={deleteModalOpen}
          onOpenChange={setDeleteModalOpen}
          conversationId={conversationToDelete.id}
          conversationTitle={conversationToDelete.title}
          onDelete={deleteConversation}
        />
      )}
    </div>
  )
} 