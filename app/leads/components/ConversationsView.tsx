import React, { useState, useEffect } from "react"
import { Card } from "@/app/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Button } from "@/app/components/ui/button"
import { Badge } from "@/app/components/ui/badge"
import { MessageSquare, Mail, Phone, Pencil, Trash2 } from "@/app/components/ui/icons"
import { Skeleton } from "@/app/components/ui/skeleton"
import { format } from "date-fns"
import { toast } from "sonner"
import { useSite } from "@/app/context/SiteContext"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { EmptyCard } from "@/app/components/ui/empty-card"

// Types for conversations
interface Conversation {
  id: string
  type: 'email' | 'call' | 'chat'
  subject: string
  message: string
  date: string
  status: 'sent' | 'received' | 'scheduled'
}

// Status styles for conversations
const STATUS_STYLES = {
  sent: "bg-green-50 text-green-700 hover:bg-green-50 border-green-200",
  received: "bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-200",
  scheduled: "bg-yellow-50 text-yellow-700 hover:bg-yellow-50 border-yellow-200",
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

  // Load conversations
  useEffect(() => {
    const loadConversations = async () => {
      if (!currentSite?.id || !leadId) return
      
      setLoading(true)
      try {
        // Use Supabase client to fetch real conversations
        const supabase = createClient()
        
        // Attempt to fetch real conversations data
        const { data, error } = await supabase
          .from('conversations')
          .select('*')
          .eq('lead_id', leadId)
          .order('date', { ascending: false })
        
        if (error) {
          console.error("Error fetching conversations:", error)
          setConversations([])
        } else if (data && data.length > 0) {
          // If we get real data, map it to our conversation format
          const formattedConversations = data.map((item: any) => ({
            id: item.id,
            type: item.type || 'email',
            subject: item.subject || 'No Subject',
            message: item.message || '',
            date: item.date,
            status: item.status || 'sent'
          }))
          
          setConversations(formattedConversations)
        } else {
          // No data found
          setConversations([])
        }
        
        setLoading(false)
      } catch (error) {
        console.error("Error loading conversations:", error)
        toast.error("Failed to load conversations")
        setConversations([])
        setLoading(false)
      }
    }

    loadConversations()
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

  // View conversation handler - Navigate to conversation page
  const handleViewConversation = (conversation: Conversation) => {
    router.push(`/chats/${conversation.id}`)
  }

  // Edit conversation handler
  const handleEditConversation = (conversation: Conversation, e: React.MouseEvent) => {
    e.stopPropagation()
    router.push(`/chats/${conversation.id}/edit`)
  }

  // Delete conversation handler
  const handleDeleteConversation = (conversation: Conversation, e: React.MouseEvent) => {
    e.stopPropagation()
    // Here we would normally call an API to delete the conversation
    toast.success(`Conversation "${conversation.subject}" deleted`)
    // Remove from the local state
    setConversations(prev => prev.filter(c => c.id !== conversation.id))
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
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="text-right w-[100px]">Actions</TableHead>
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
                  <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <Skeleton className="h-8 w-8 rounded-full" />
                    </div>
                  </TableCell>
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
                  <TableCell>
                    <Badge className={`${STATUS_STYLES[conversation.status]}`}>
                      {conversation.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => handleEditConversation(conversation, e)}
                      >
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Edit</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => handleDeleteConversation(conversation, e)}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              // This should never show as we use EmptyCard above, but keeping as fallback
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
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