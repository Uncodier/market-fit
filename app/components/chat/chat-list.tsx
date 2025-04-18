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
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator 
} from "@/app/components/ui/dropdown-menu"
import { RenameConversationModal } from "./RenameConversationModal"
import { DeleteConfirmationModal } from "./DeleteConfirmationModal"

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

  useEffect(() => {
    let active = true
    
    const loadConversations = async () => {
      if (!siteId) {
        console.log('🔍 DEBUG: Cannot load conversations - no siteId provided');
        return;
      }
      
      console.log(`🔍 DEBUG: loadConversations called for site: ${siteId}`);
      
      // Solo mostrar el esqueleto en la primera carga
      const isFirstLoad = isFirstLoadRef.current;
      if (isFirstLoad) {
        console.log('🔍 DEBUG: First load - showing skeleton');
        setIsLoading(true);
        // Establecer que ya no es la primera carga
        isFirstLoadRef.current = false;
      } else {
        console.log('🔍 DEBUG: Not first load - skipping skeleton');
      }
      
      try {
        // Request conversations from server
        const result = await getConversations(siteId)
        console.log(`🔍 DEBUG: getConversations returned ${result.length} conversations`);
        
        if (active) {
          setConversations(result)
          setHasEmptyResult(result.length === 0)
          setIsInitialLoad(false)
          
          // Solo aplicar el retraso para la primera carga
          if (isFirstLoad) {
            // Pequeño retraso antes de ocultar el esqueleto para evitar parpadeos
            setTimeout(() => {
              if (active) {
                setIsLoading(false)
              }
            }, 300)
          }
        }
      } catch (error) {
        console.error("Error loading conversations:", error)
        if (active) {
          setHasEmptyResult(true)
          setIsInitialLoad(false)
          setIsLoading(false)
        }
      } finally {
        if (active && !isFirstLoad) {
          // Si no es la primera carga, asegurarse de que isLoading sea false
          setIsLoading(false)
        }
        console.log('🔍 DEBUG: loadConversations completed');
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
        
        console.log(`🛑 DEBUG: Setting up real-time subscription for site: ${siteId}`);
        
        // Limpieza de cualquier suscripción existente
        if (subscriptionRef.current) {
          subscriptionRef.current.unsubscribe();
        }
        
        // Crear una suscripción simple y directa usando el enfoque clásico de Supabase
        console.log('🛑 DEBUG: Setting up subscription using classic approach');
        
        // Un canal por tipo de evento, enfoque más tradicional
        const channel = supabase.channel('public:conversations')
          .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'conversations',
            filter: `site_id=eq.${siteId}`
          }, (payload: any) => {
            console.log('🛑 DEBUG: UPDATE event received:', payload);
            
            if (payload.new) {
              // Asegurar que isLoading sea false antes de actualizar
              setIsLoading(false);
              
              // Actualizar sólo la conversación modificada en el estado
              setConversations(prevConversations => 
                prevConversations.map(conv => 
                  conv.id === payload.new.id 
                    ? { 
                        ...conv, 
                        title: payload.new.title || conv.title,
                        timestamp: new Date(payload.new.updated_at || new Date()),
                        lastMessage: payload.new.last_message || conv.lastMessage,
                        agentId: conv.agentId,
                        agentName: conv.agentName,
                        unreadCount: conv.unreadCount,
                        messageCount: conv.messageCount,
                        leadName: conv.leadName
                      } 
                    : conv
                )
              );
              
              console.log(`🛑 DEBUG: Conversation ${payload.new.id} updated directly in state without reloading`);
            }
          })
        
        // Crear una suscripción para eventos de INSERT
        channel.on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'conversations',
          filter: `site_id=eq.${siteId}`
        }, (payload: any) => {
          console.log('🛑 DEBUG: INSERT event received:', payload);
          
          // Asegurar que isLoading sea false antes de actualizar
          setIsLoading(false);
          
          // En lugar de recargar toda la lista, añadir sólo la nueva conversación
          // Comprobar si tenemos suficiente información para crear un objeto de conversación
          if (payload.new && payload.new.id && payload.new.title) {
            const newConversation: ConversationListItem = {
              id: payload.new.id,
              title: payload.new.title || "New Conversation",
              agentId: payload.new.agent_id || "",
              agentName: payload.new.agent_name || "Unknown Agent",
              lastMessage: payload.new.last_message || "",
              timestamp: new Date(payload.new.updated_at || payload.new.created_at || new Date()),
              unreadCount: 0,
              messageCount: 0
            };
            
            // Añadir la nueva conversación al principio de la lista
            setConversations(prev => [newConversation, ...prev]);
            console.log(`🛑 DEBUG: New conversation ${newConversation.id} added directly to state`);
          } else {
            // Solo si no tenemos suficiente información, recargamos la lista completa
            // pero sin activar el estado de carga
            if (loadConversationsRef.current) {
              // Guardar el estado original de isFirstLoadRef para restaurarlo después
              const wasFirstLoad = isFirstLoadRef.current;
              isFirstLoadRef.current = false; // Forzar a falso para evitar el esqueleto
              
              loadConversationsRef.current().then(() => {
                console.log(`🛑 DEBUG: List reloaded for INSERT without showing skeleton`);
              });
              
              console.log(`🛑 DEBUG: Insufficient data for new conversation, reloading without skeleton`);
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
          console.log('🛑 DEBUG: DELETE event received:', payload);
          
          // Asegurar que isLoading sea false antes de actualizar
          setIsLoading(false);
          
          if (payload.old && payload.old.id) {
            // Eliminar la conversación del estado directamente
            setConversations(prevConversations => 
              prevConversations.filter(conv => conv.id !== payload.old.id)
            );
            
            console.log(`🛑 DEBUG: Conversation ${payload.old.id} removed from state without reloading`);
            
            // Si la conversación eliminada era la seleccionada, redirigir a la lista de chat
            if (selectedConversationIdRef.current === payload.old.id) {
              router.push('/chat');
            }
          }
        });
        
        // Suscribir al canal
        channel.subscribe((status: string) => {
          console.log(`🛑 DEBUG: Channel subscription status: ${status}`);
          
          // Log adicional para depuración
          if (status === 'CHANNEL_ERROR') {
            console.error('🛑 DEBUG: ¡ERROR DE CANAL! Verifica configuración de CSP para WebSockets');
            console.error('🛑 DEBUG: Si acabas de modificar next.config.js, necesitas reiniciar el servidor');
            console.log('🛑 DEBUG: URL de Supabase:', process.env.NEXT_PUBLIC_SUPABASE_URL);
          }
        });
        
        // Guardar la referencia
        subscriptionRef.current = channel;
        
        // Opcional: monitorea los INSERT y DELETE por separado si es necesario
      } catch (error) {
        console.error('🛑 DEBUG: Error setting up Realtime:', error);
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
                <div
                  key={conversation.id}
                  className={cn(
                    "w-full text-left py-3 px-4 rounded-none transition-colors border-b border-border/30",
                    "hover:bg-accent/20 group",
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
                    position: 'relative',
                    cursor: 'pointer'
                  }}
                  onClick={() => handleSelectConversation(conversation)}
                >
                  <div
                    className="w-full text-left"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      display: 'block'
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={cn(
                        "font-medium text-sm truncate",
                        "max-w-[90%]",
                        selectedConversationId === conversation.id && "text-primary"
                      )}>
                        {truncateText(conversation.title || "Untitled Conversation", 35)}
                      </span>
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
                  </div>
                  
                  {/* Dropdown Menu */}
                  <div 
                    className="absolute right-2 top-2 transition-opacity duration-150 ease-in-out opacity-0 group-hover:opacity-100 z-10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-7 w-7 p-0" aria-label="More options">
                          <Icons.MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={() => openRenameModal(conversation)}
                          className="cursor-pointer"
                        >
                          <Icons.Pencil className="mr-2 h-4 w-4" />
                          <span>Rename</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => archiveConversation(conversation.id)}
                          className="cursor-pointer"
                        >
                          <Icons.Archive className="mr-2 h-4 w-4" />
                          <span>Archive</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => openDeleteModal(conversation)}
                          className="cursor-pointer text-destructive focus:text-destructive"
                        >
                          <Icons.Trash2 className="mr-2 h-4 w-4" />
                          <span>Delete</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
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