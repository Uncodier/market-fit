"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/app/components/ui/button"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Input } from "@/app/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Bell, Search } from "@/app/components/ui/icons"
import { EmptyState } from "@/app/components/ui/empty-state"
import { useNotifications } from "./context/NotificationsContext"
import { NotificationCard } from "./components/NotificationCard"
import { NotificationSkeleton } from "./components/NotificationSkeleton"

export default function NotificationsPage() {
  const {
    notifications,
    loading,
    searchQuery,
    updateFilters,
    updateSearchQuery,
    markAsRead,
    markAllNotificationsAsRead,
    deleteOneNotification,
    deleteAllUserNotifications
  } = useNotifications()
  
  const [activeTab, setActiveTab] = useState<"all" | "unread">("all")

  // Handle tab change with a callback to avoid dependency on updateFilters
  const handleTabChange = useCallback((value: string) => {
    const tab = value as "all" | "unread"
    setActiveTab(tab)
    updateFilters({ is_read: tab === "unread" ? false : undefined })
  }, [updateFilters])

  // Filter and search notifications
  const filteredNotifications = notifications
    .filter(notification => activeTab === "all" || !notification.is_read)
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
              <Tabs 
                defaultValue="all" 
                className="w-auto" 
                onValueChange={handleTabChange}
              >
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
                  onChange={(e) => updateSearchQuery(e.target.value)}
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
                  onClick={() => markAllNotificationsAsRead()}
                  disabled={!notifications.some(n => !n.is_read)}
                >
                  Mark all as read
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => deleteAllUserNotifications()}
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
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <NotificationSkeleton key={i} />
            ))}
          </div>
        ) : filteredNotifications.length > 0 ? (
          <div className="space-y-2">
            {filteredNotifications.map((notification) => (
              <NotificationCard 
                key={notification.id} 
                notification={notification} 
                onMarkAsRead={markAsRead}
                onDelete={deleteOneNotification}
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
                : activeTab === "unread"
                ? "You don't have any unread notifications"
                : "You don't have any notifications"
            }
          />
        )}
      </div>
    </>
  )
} 