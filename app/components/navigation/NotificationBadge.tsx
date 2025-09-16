"use client"

import { Badge } from "@/app/components/ui/badge"
import { useNotifications } from "@/app/notifications/context/NotificationsContext"

export function NotificationBadge({ isActive = false }: { isActive?: boolean }) {
  const { notifications } = useNotifications()
  
  // Count unread notifications using the correct field name
  const unreadCount = notifications.filter(notification => !notification.is_read).length
  
  // Don't show badge if there are no unread notifications
  if (unreadCount === 0) {
    return null
  }
  
  return (
    <Badge 
      className="h-5 min-w-[20px] px-1.5 text-xs font-semibold border-transparent text-black badge-gradient-green"
    >
      {unreadCount > 99 ? "99+" : unreadCount}
    </Badge>
  )
} 