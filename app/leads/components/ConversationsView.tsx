import React, { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/app/components/ui/table"
import { MessageSquare, Mail, Globe } from "@/app/components/ui/icons"
import { WhatsAppIcon } from "@/app/components/ui/social-icons"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Button } from "@/app/components/ui/button"
import { format } from "date-fns"
import { toast } from "sonner"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useRouter } from "next/navigation"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { getLeadConversations } from "@/app/leads/actions"
import { safeReload } from "@/app/utils/safe-reload"
import {
  DocumentListHead,
  DocumentListRow,
  EntityCell,
  StatusDot,
  documentListShellClassName,
} from "@/app/components/documents/document-list"

interface DatabaseConversation {
  id: string
  channel: "web" | "email" | "whatsapp"
  subject: string
  message: string
  date: string
  status: "pending" | "active" | "closed" | "archived"
}

interface Conversation {
  id: string
  channel: "web" | "email" | "whatsapp"
  subject: string
  message: string
  date: string
  status: "pending" | "active" | "closed" | "archived"
  agentId?: string
  agentName?: string
}

const CHANNEL_ICONS = {
  web: <Globe className="h-3.5 w-3.5 text-muted-foreground" />,
  email: <Mail className="h-3.5 w-3.5 text-muted-foreground" />,
  whatsapp: <WhatsAppIcon size={14} className="h-3.5 w-3.5" />,
}

interface ConversationsViewProps {
  leadId: string
}

function formatDate(dateString: string) {
  try {
    return format(new Date(dateString), "MMM d, yyyy")
  } catch {
    return dateString
  }
}

function truncateText(text: string, maxLength = 60) {
  if (!text) return ""
  if (text.length <= maxLength) return text
  return `${text.substring(0, maxLength)}...`
}

function conversationAccent(status: string): "due" | "cancelled" | "none" {
  if (status === "archived" || status === "closed") return "cancelled"
  if (status === "pending") return "due"
  return "none"
}

export function ConversationsView({ leadId }: ConversationsViewProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const router = useRouter()
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    let isMounted = true

    const loadConversations = async () => {
      if (!currentSite?.id || !leadId) return

      setLoading(true)
      try {
        const result = await getLeadConversations(currentSite.id, leadId)

        if (result.error) {
          console.error("Error fetching conversations:", result.error)
          toast.error("Failed to load conversations")
          setConversations([])
        } else if (result.conversations && result.conversations.length > 0) {
          setConversations(
            result.conversations.map((conv: DatabaseConversation) => ({
              ...conv,
              channel: conv.channel as "web" | "email" | "whatsapp",
              status: conv.status as "pending" | "active" | "closed" | "archived",
              agentId: (conv as any).agent_id || undefined,
              agentName: (conv as any).agent_name || undefined,
            }))
          )
        } else {
          setConversations([])
        }
      } catch (error) {
        console.error("Error loading conversations:", error)
        if (isMounted) {
          toast.error("Failed to load conversations")
          setHasError(true)
          setConversations([])
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadConversations()

    return () => {
      isMounted = false
    }
  }, [leadId, currentSite?.id])

  const handleViewConversation = (conversation: Conversation) => {
    const agentName = conversation.agentName || "Agent"
    const agentId = conversation.agentId || "478d3106-7391-4d9a-a5c1-8466202b45a9"
    router.push(
      `/chat?conversationId=${conversation.id}&agentId=${agentId}&agentName=${encodeURIComponent(agentName)}`
    )
  }

  const channelLabel = (channel: Conversation["channel"]) =>
    t(`leads.conversations.channel.${channel}`) || channel

  const statusLabel = (status: Conversation["status"]) =>
    t(`leads.conversations.status.${status}`) || status

  if (hasError) {
    return (
      <div className="w-full">
        <EmptyCard
          title={t("leads.conversations.error.title") || "Error loading conversations"}
          description={
            t("leads.conversations.error.desc") ||
            "There was a problem loading conversations. Please try again later."
          }
          icon={<MessageSquare className="h-12 w-12 text-muted-foreground" />}
        />
        <div className="flex justify-center mt-4">
          <Button onClick={() => safeReload(false, "Retry conversations")}>
            {t("leads.conversations.retry") || "Retry"}
          </Button>
        </div>
      </div>
    )
  }

  if (!loading && conversations.length === 0) {
    return (
      <EmptyCard
        title={t("leads.conversations.empty.title") || "No conversations found"}
        description={t("leads.conversations.empty.desc") || "This lead doesn't have any conversations yet."}
        icon={<MessageSquare className="h-12 w-12 text-muted-foreground" />}
      />
    )
  }

  return (
    <div className={documentListShellClassName()}>
      <Table className="min-w-[680px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <DocumentListHead className="w-[46%]">{t("leads.conversations.subject") || "Subject"}</DocumentListHead>
            <DocumentListHead className="w-[18%]">{t("leads.conversations.status") || "Status"}</DocumentListHead>
            <DocumentListHead className="w-[36%]" align="right">{t("leads.conversations.date") || "Date"}</DocumentListHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading
            ? Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index} className="hover:bg-transparent">
                  <TableCell className="py-3.5">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-9 w-9 rounded-full" />
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-3.5"><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell className="py-3.5"><Skeleton className="ml-auto h-4 w-20" /></TableCell>
                </TableRow>
              ))
            : conversations.map((conversation) => (
                <DocumentListRow
                  key={conversation.id}
                  onClick={() => handleViewConversation(conversation)}
                  accent={conversationAccent(conversation.status)}
                >
                  <TableCell className="py-3.5">
                    <EntityCell
                      name={conversation.subject || "—"}
                      secondary={channelLabel(conversation.channel)}
                      secondaryMono={false}
                      meta={truncateText(conversation.message) || null}
                    />
                  </TableCell>
                  <TableCell className="py-3.5">
                    <StatusDot status={conversation.status} label={statusLabel(conversation.status)} />
                  </TableCell>
                  <TableCell className="py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground whitespace-nowrap">
                      {CHANNEL_ICONS[conversation.channel]}
                      {formatDate(conversation.date)}
                    </div>
                  </TableCell>
                </DocumentListRow>
              ))}
        </TableBody>
      </Table>
    </div>
  )
}
