"use client"

import { useId, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { Bell, Check, Trash2, MessageSquare, ClipboardList, Loader2 } from "@/app/components/ui/icons"
import { cn } from "@/lib/utils"
import { Notification } from "../types"

interface NotificationCardProps {
  notification: Notification
  onMarkAsRead: (id: string) => void | Promise<void>
  onDelete: (id: string) => void | Promise<void>
  disabled?: boolean
}

const typeStyles: Record<string, string> = {
  info: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  warning: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  error: "bg-red-500/10 text-red-700 dark:text-red-300",
}

export function NotificationCard({ notification, onMarkAsRead, onDelete, disabled }: NotificationCardProps) {
  const router = useRouter()
  const messageId = useId()
  const titleId = useId()
  const [expanded, setExpanded] = useState(false)
  const [pending, setPending] = useState<"read" | "delete" | null>(null)
  const isLong = notification.message.length > 240
  const preview = isLong ? `${notification.message.slice(0, 240).trimEnd()}…` : notification.message
  const date = new Date(notification.created_at)
  const validDate = !Number.isNaN(date.getTime())
  const isConversation = notification.related_entity_type === "conversation" && notification.related_entity_id
  const isTask = notification.related_entity_type === "task" && notification.related_entity_id

  const runAction = async (action: "read" | "delete") => {
    if (pending || disabled) return
    setPending(action)
    try {
      await (action === "read" ? onMarkAsRead(notification.id) : onDelete(notification.id))
    } finally {
      setPending(null)
    }
  }

  const openRelatedItem = () => {
    if (!notification.is_read) void runAction("read")
    if (isConversation) {
      const query = new URLSearchParams({
        conversationId: notification.related_entity_id!,
        agentId: "478d3106-7391-4d9a-a5c1-8466202b45a9",
        agentName: "Agent",
      })
      router.push(`/chat?${query}`)
    } else if (isTask) {
      router.push(`/control-center/${encodeURIComponent(notification.related_entity_id!)}`)
    }
  }

  return (
    <article aria-labelledby={titleId}>
      <Card className={cn("relative overflow-hidden rounded-xl border bg-background shadow-none transition-colors hover:border-muted-foreground/30", !notification.is_read && "border-blue-500/25 before:absolute before:inset-y-4 before:left-0 before:w-0.5 before:rounded-full before:bg-blue-500")}>
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start gap-3 sm:gap-4">
            <div aria-hidden={true} className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", typeStyles[notification.type.toLowerCase()] || "bg-muted text-muted-foreground")}>
              {isConversation ? <MessageSquare className="h-5 w-5" /> : isTask ? <ClipboardList className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
            </div>
            <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
            <Badge variant="secondary" className={cn("border-0 px-2 py-0.5 font-medium capitalize", typeStyles[notification.type.toLowerCase()])}>
              {notification.type}
            </Badge>
            <span className={cn("inline-flex items-center gap-1.5", notification.is_read ? "text-muted-foreground" : "font-medium text-blue-700 dark:text-blue-300")}>
              {!notification.is_read && <span aria-hidden={true} className="h-1.5 w-1.5 rounded-full bg-blue-500" />}
              {notification.is_read ? "Read" : "Unread"}
            </span>
            <time dateTime={validDate ? date.toISOString() : undefined} title={validDate ? date.toLocaleString("en-US") : undefined} className="text-muted-foreground sm:ml-auto">
              {validDate ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date) : "Date unavailable"}
            </time>
          </div>
          <h3 id={titleId} className="break-words text-base font-semibold leading-snug text-foreground">
            {notification.title}
          </h3>
          <p id={messageId} className="mt-2 max-w-prose whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]">
            {expanded ? notification.message : preview}
          </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3" data-toolbar-icon-actions="off">
            {isLong && (
              <Button variant="ghost" size="sm" className="min-h-10" aria-expanded={expanded} aria-controls={messageId} onClick={() => setExpanded(!expanded)}>
                {expanded ? "Show less" : "Read more"}
              </Button>
            )}
            {(isConversation || isTask) && (
              <Button variant="outline" size="sm" className="min-h-10 gap-2" onClick={openRelatedItem} disabled={disabled || !!pending}>
                {isConversation ? <MessageSquare className="h-4 w-4" aria-hidden={true} /> : <ClipboardList className="h-4 w-4" aria-hidden={true} />}
                {isConversation ? "Go to chat" : "Go to task"}
              </Button>
            )}
            <div className="ml-auto flex items-center gap-1">
              {!notification.is_read && (
                <Button variant="secondary" size="sm" className="min-h-10 gap-2" onClick={() => void runAction("read")} disabled={disabled || !!pending}>
                  {pending === "read" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden={true} /> : <Check className="h-4 w-4" aria-hidden={true} />}
                  {pending === "read" ? "Marking as read…" : "Mark as read"}
                </Button>
              )}
              <Button variant="ghost" size="icon" aria-label="Delete notification" title="Delete notification" className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => void runAction("delete")} disabled={disabled || !!pending}>
                {pending === "delete" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden={true} /> : <Trash2 className="h-4 w-4" aria-hidden={true} />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </article>
  )
}
