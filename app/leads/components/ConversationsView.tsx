import React, { useState, useEffect } from "react"
import { Card } from "@/app/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { MessageSquare, Mail, Phone } from "@/app/components/ui/icons"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Button } from "@/app/components/ui/button"
import { format } from "date-fns"
import { toast } from "sonner"
import { useSite } from "@/app/context/SiteContext"
import { useRouter } from "next/navigation"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { getLeadConversations } from "@/app/leads/actions"

// Types for conversations from the database
interface DatabaseConversation {
  id: string
  type: 'email' | 'call' | 'chat'
  subject: string
  message: string
  date: string
  status: 'sent' | 'received' | 'scheduled'
}

// Types for conversations displayed in the UI
interface Conversation {
  id: string
  type: 'email' | 'call' | 'chat'
  subject: string
  message: string
  date: string
  status: 'sent' | 'received' | 'scheduled'
  agentId?: string
  agentName?: string
}

// Type icons for conversations
const TYPE_ICONS = {
  email: <Mail className="h-4 w-4" />,
  call: <Phone className="h-4 w-4" />,
  chat: <MessageSquare className="h-4 w-4" />,
}

interface ConversationsViewProps {
  leadId: string
}

export function ConversationsView({ leadId }: ConversationsViewProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const { currentSite } = useSite()
  const router = useRouter()
  const [hasError, setHasError] = useState(false)

  // Load conversations
  useEffect(() => {
    let isMounted = true;
    
    const loadConversations = async () => {
      if (!currentSite?.id || !leadId) return
      
      setLoading(true)
      try {
        console.log(`Loading conversations for lead ${leadId} in site ${currentSite.id}`)
        
        // Usar la acción del servidor para obtener las conversaciones
        const result = await getLeadConversations(currentSite.id, leadId)
        
        if (result.error) {
          console.error("Error fetching conversations:", result.error)
          toast.error("Failed to load conversations")
          setConversations([])
        } else if (result.conversations && result.conversations.length > 0) {
          console.log(`Found ${result.conversations.length} conversations for lead ${leadId}`)
          
          // La acción ya devuelve los datos en el formato correcto que necesitamos
          setConversations(result.conversations.map((conv: DatabaseConversation) => ({
            ...conv,
            // Asegurar que los tipos se ajusten a la interfaz esperada
            type: conv.type as 'email' | 'call' | 'chat',
            status: conv.status as 'sent' | 'received' | 'scheduled',
            // Guardar el agent_id y agent_name si están disponibles
            agentId: (conv as any).agent_id || undefined,
            agentName: (conv as any).agent_name || undefined
          })))
        } else {
          console.log(`No conversations found for lead ${leadId}`)
          setConversations([])
        }
      } catch (error) {
        console.error("Error loading conversations:", error)
        if (isMounted) {
          toast.error("Failed to load conversations");
          setHasError(true);
          setConversations([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadConversations();
    
    return () => {
      isMounted = false;
    };
  }, [leadId, currentSite?.id])

  // Function to format date
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return format(date, 'MMM d, yyyy')
    } catch (error) {
      return dateString
    }
  }

  // Function to truncate text
  const truncateText = (text: string, maxLength: number = 60) => {
    if (text.length <= maxLength) return text
    return `${text.substring(0, maxLength)}...`
  }

  // View conversation handler - Navigate to conversation page with correct URL format
  const handleViewConversation = (conversation: Conversation) => {
    // Usar valores de agente de la conversación o valores por defecto
    const agentName = conversation.agentName || "Agent"; 
    const agentId = conversation.agentId || "478d3106-7391-4d9a-a5c1-8466202b45a9"; // ID de agente por defecto
    
    // Construir la URL con el formato correcto
    const url = `/chat?conversationId=${conversation.id}&agentId=${agentId}&agentName=${encodeURIComponent(agentName)}`;
    
    console.log(`Navigating to chat conversation: ${url}`);
    router.push(url);
  }

  // Show error state
  if (hasError) {
    return (
      <div className="w-full">
        <EmptyCard
          title="Error Loading Conversations"
          description="There was a problem loading conversations. Please try again later."
          icon={<MessageSquare className="h-12 w-12 text-muted-foreground" />}
        />
        <div className="flex justify-center mt-4">
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    )
  }

  // Show empty state if no conversations and not loading
  if (!loading && conversations.length === 0) {
    return (
      <EmptyCard
        title="No Conversations Found"
        description="This lead doesn't have any conversations yet."
        icon={<MessageSquare className="h-12 w-12 text-muted-foreground" />}
      />
    )
  }

  return (
    <div className="w-full">
      {/* Conversations table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Date</TableHead>
              <TableHead className="w-[100px]">Type</TableHead>
              <TableHead className="w-[200px]">Subject</TableHead>
              <TableHead>Message</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              // Skeleton loader
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                </TableRow>
              ))
            ) : conversations.length > 0 ? (
              // Conversations data
              conversations.map((conversation) => (
                <TableRow 
                  key={conversation.id}
                  className="group hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => handleViewConversation(conversation)}
                >
                  <TableCell className="font-medium">
                    {formatDate(conversation.date)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {TYPE_ICONS[conversation.type]}
                      <span className="capitalize">{conversation.type}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {conversation.subject}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {truncateText(conversation.message)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              // This should never show as we use EmptyCard above, but keeping as fallback
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  No conversations found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
} 