import { Card, CardContent } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { Check, Trash2 } from "@/app/components/ui/icons"
import { Notification } from "../types"

interface NotificationCardProps {
  notification: Notification
  onMarkAsRead: (id: string) => void
  onDelete: (id: string) => void
}

export function NotificationCard({ notification, onMarkAsRead, onDelete }: NotificationCardProps) {
  const getTypeStyles = (type: Notification["type"]) => {
    switch (type) {
      case "info":
        return "border-l-blue-500"
      case "success":
        return "border-l-green-500"
      case "warning":
        return "border-l-yellow-500"
      case "error":
        return "border-l-red-500"
    }
  }

  const getBadgeStyles = (type: Notification["type"]) => {
    switch (type) {
      case "info":
        return "bg-blue-100 text-blue-800"
      case "success":
        return "bg-green-100 text-green-800"
      case "warning":
        return "bg-yellow-100 text-yellow-800"
      case "error":
        return "bg-red-100 text-red-800"
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

  return (
    <Card className={`group w-full border-l-4 ${notification.read ? 'border-l-gray-200' : getTypeStyles(notification.type)} hover:shadow-md transition-all duration-200`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className={getBadgeStyles(notification.type)}>
                {notification.type.charAt(0).toUpperCase() + notification.type.slice(1)}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {formatDate(notification.created_at)}
              </span>
            </div>
            <h3 className={`text-base font-medium ${notification.read ? 'text-foreground' : 'text-foreground font-semibold'}`}>
              {notification.title}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {notification.message}
            </p>
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-2">
            {!notification.read && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onMarkAsRead(notification.id)}
                title="Mark as read"
              >
                <Check className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(notification.id)}
              title="Delete notification"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 