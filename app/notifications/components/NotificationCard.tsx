import { Card, CardContent } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { Check, Trash2, MessageSquare, ChevronRight, ClipboardList } from "@/app/components/ui/icons"
import { Notification } from "../types"
import { useRouter } from "next/navigation"

interface NotificationCardProps {
  notification: Notification
  onMarkAsRead: (id: string) => void
  onDelete: (id: string) => void
}

export function NotificationCard({ notification, onMarkAsRead, onDelete }: NotificationCardProps) {
  const router = useRouter()
  
  const getTypeStyles = (type: string) => {
    const lowerType = type.toLowerCase()
    switch (lowerType) {
      case "info":
        return "border-l-blue-500"
      case "success":
        return "border-l-green-500"
      case "warning":
        return "border-l-yellow-500"
      case "error":
        return "border-l-red-500"
      default:
        return "border-l-gray-500"
    }
  }

  const getBadgeStyles = (type: string) => {
    const lowerType = type.toLowerCase()
    switch (lowerType) {
      case "info":
        return "bg-blue-100 text-blue-800"
      case "success":
        return "bg-green-100 text-green-800"
      case "warning":
        return "bg-yellow-100 text-yellow-800"
      case "error":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('en-US', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  // Check if this notification is for a conversation
  const isConversationNotification = notification.related_entity_type === "conversation" && notification.related_entity_id

  // Check if this notification is for a task
  const isTaskNotification = notification.related_entity_type === "task" && notification.related_entity_id

  // Handle navigation to chat
  const handleNavigateToChat = () => {
    if (isConversationNotification && notification.related_entity_id) {
      // Mark as read if not already read
      if (!notification.is_read) {
        onMarkAsRead(notification.id)
      }
      
      // Use default agent ID and name for navigation (following the leads pattern)
      const agentId = "478d3106-7391-4d9a-a5c1-8466202b45a9" // Default agent ID
      const agentName = "Agent"
      const conversationId = notification.related_entity_id
      
      const url = `/chat?conversationId=${conversationId}&agentId=${agentId}&agentName=${encodeURIComponent(agentName)}`
      router.push(url)
    }
  }

  // Handle navigation to task
  const handleNavigateToTask = () => {
    if (isTaskNotification && notification.related_entity_id) {
      // Mark as read if not already read
      if (!notification.is_read) {
        onMarkAsRead(notification.id)
      }
      
      const url = `/control-center/${notification.related_entity_id}`
      router.push(url)
    }
  }

  // Handle card click, but prevent if clicking on buttons
  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on buttons
    if ((e.target as HTMLElement).closest('button')) {
      return
    }
    
    if (isConversationNotification) {
      handleNavigateToChat()
    } else if (isTaskNotification) {
      handleNavigateToTask()
    }
  }

  return (
    <Card 
      className={`group w-full border border-border overflow-hidden transition-all duration-200 ${
        notification.is_read 
          ? 'hover:bg-muted/30' 
          : 'shadow-sm hover:shadow-md'
      } ${
        (isConversationNotification || isTaskNotification) ? 'cursor-pointer hover:bg-muted/50' : ''
      }`}
      onClick={handleCardClick}
    >
      <CardContent className="p-0">
        <div className={`flex items-center justify-between gap-6 p-6 ${
          !notification.is_read ? 'border-l-4 border-l-primary bg-primary/5' : ''
        }`}>
          <div className="flex-1 min-w-0 space-y-2">
            {/* Header with badges, timestamp and title */}
            <div className="flex items-center gap-3 min-w-0">
              <Badge 
                variant="outline" 
                className={`${getBadgeStyles(notification.type)} text-xs font-medium px-2.5 py-0.5 flex-shrink-0`}
              >
                {notification.type.charAt(0).toUpperCase() + notification.type.slice(1)}
              </Badge>
              {!notification.is_read && (
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse flex-shrink-0"></div>
              )}
              <span className="text-xs text-muted-foreground/60 font-medium tabular-nums flex-shrink-0">
                {formatDate(notification.created_at)}
              </span>
              <h3 className={`text-base leading-snug truncate ${
                notification.is_read 
                  ? 'text-foreground/90 font-medium' 
                  : 'text-foreground font-semibold'
              }`}>
                {notification.title}
              </h3>
            </div>
            
            {/* Message */}
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
              {notification.message}
            </p>
          </div>
          
          {/* Actions column - always centered vertically */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {isConversationNotification && (
              <div 
                className="flex items-center gap-2 text-xs font-medium bg-muted text-muted-foreground px-3 py-2 rounded-lg cursor-pointer hover:bg-accent hover:text-accent-foreground transition-all duration-200 shadow-sm border border-border/50 hover:border-border"
                onClick={(e) => {
                  e.stopPropagation()
                  handleNavigateToChat()
                }}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Go to chat</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </div>
            )}
            
            {isTaskNotification && (
              <div 
                className="flex items-center gap-2 text-xs font-medium bg-muted text-muted-foreground px-3 py-2 rounded-lg cursor-pointer hover:bg-accent hover:text-accent-foreground transition-all duration-200 shadow-sm border border-border/50 hover:border-border"
                onClick={(e) => {
                  e.stopPropagation()
                  handleNavigateToTask()
                }}
              >
                <ClipboardList className="h-3.5 w-3.5" />
                <span>Go to task</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </div>
            )}
            
            {/* Action buttons */}
            <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center gap-1">
              {!notification.is_read && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation()
                    onMarkAsRead(notification.id)
                  }}
                  title="Mark as read"
                  className="h-9 w-9 rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  <Check className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(notification.id)
                }}
                title="Delete notification"
                className="h-9 w-9 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}