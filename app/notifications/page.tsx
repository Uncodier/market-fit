"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Button } from "@/app/components/ui/button"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Input } from "@/app/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { Bell, Check, Search, Trash2, type LucideIcon } from "@/app/components/ui/icons"
import { Switch } from "@/app/components/ui/switch"
import { EmptyState } from "@/app/components/ui/empty-state"

interface Notification {
  id: string
  title: string
  message: string
  type: "info" | "success" | "warning" | "error"
  read: boolean
  created_at: string
}

function NotificationSkeleton() {
  return (
    <Card className="w-full hover:shadow-md transition-all duration-200">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="h-5 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </CardContent>
    </Card>
  )
}

function NotificationCard({ notification, onMarkAsRead, onDelete }: { 
  notification: Notification, 
  onMarkAsRead: (id: string) => void,
  onDelete: (id: string) => void
}) {
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

export default function NotificationsPage() {
  const [loading, setLoading] = useState(true)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [filter, setFilter] = useState<"all" | "unread">("all")
  const [searchQuery, setSearchQuery] = useState("")

  // Simulated notifications data - in a real app, this would come from an API
  useEffect(() => {
    // Simulate API call delay
    const timer = setTimeout(() => {
      const mockNotifications: Notification[] = [
        {
          id: "1",
          title: "New lead captured",
          message: "A new lead has been captured in your 'Marketing professionals' segment.",
          type: "success",
          read: false,
          created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 mins ago
        },
        {
          id: "2",
          title: "Experiment completed",
          message: "Your experiment 'Homepage A/B test' has been successfully completed.",
          type: "info",
          read: false,
          created_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), // 3 hours ago
        },
        {
          id: "3",
          title: "Data import error",
          message: "An error occurred while importing data for your 'Senior developers' segment.",
          type: "error",
          read: true,
          created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
        },
        {
          id: "4",
          title: "System update",
          message: "A system update has been scheduled for next Friday at 10:00 PM.",
          type: "warning",
          read: false,
          created_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 2 days ago
        },
        {
          id: "5",
          title: "Reminder: complete your profile",
          message: "Your profile is incomplete. Complete it to unlock all features.",
          type: "info",
          read: true,
          created_at: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(), // 3 days ago
        },
      ]
      
      setNotifications(mockNotifications)
      setLoading(false)
    }, 1000)
    
    return () => clearTimeout(timer)
  }, [])

  const handleMarkAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id ? { ...notification, read: true } : notification
      )
    )
    toast.success("Notification marked as read")
  }

  const handleDelete = (id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id))
    toast.success("Notification deleted")
  }

  const handleMarkAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notification => ({ ...notification, read: true }))
    )
    toast.success("All notifications marked as read")
  }

  const handleClearAll = () => {
    setNotifications([])
    toast.success("All notifications have been deleted")
  }

  // Filter and search notifications
  const filteredNotifications = notifications
    .filter(notification => filter === "all" || !notification.read)
    .filter(notification => 
      notification.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      notification.message.toLowerCase().includes(searchQuery.toLowerCase())
    )

  return (
    <>
      <StickyHeader>
        <div className="px-16 pt-0 w-full">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-8">
              <Tabs defaultValue="all" className="w-auto" onValueChange={(value) => setFilter(value as "all" | "unread")}>
                <TabsList>
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="unread">Unread</TabsTrigger>
                </TabsList>
              </Tabs>
              
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search notifications..."
                  className="w-full pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </div>
            </div>
            
            <div className="ml-auto">
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleMarkAllAsRead}
                  disabled={!notifications.some(n => !n.read)}
                >
                  Mark all as read
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleClearAll}
                  disabled={notifications.length === 0}
                >
                  Delete all
                </Button>
              </div>
            </div>
          </div>
        </div>
      </StickyHeader>

      <div className="px-16 py-8">
        {loading ? (
          <div className="space-y-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <NotificationSkeleton key={i} />
            ))}
          </div>
        ) : filteredNotifications.length > 0 ? (
          <div className="space-y-6">
            {filteredNotifications.map((notification) => (
              <NotificationCard 
                key={notification.id} 
                notification={notification} 
                onMarkAsRead={handleMarkAsRead}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Bell className="h-12 w-12 text-muted-foreground" />}
            title="No notifications"
            description={
              searchQuery
                ? "No notifications found matching your search"
                : filter === "unread"
                ? "You don't have any unread notifications"
                : "You don't have any notifications"
            }
          />
        )}
      </div>
    </>
  )
} 