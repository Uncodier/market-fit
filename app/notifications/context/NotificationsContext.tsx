"use client"

import React, { createContext, useContext, useState, useEffect, useLayoutEffect, ReactNode, useCallback, useMemo, useRef } from "react"
import { useNotificationScope } from '@/app/notifications/use-notification-scope'
import { 
  getNotifications, 
  updateNotification, 
  markAllAsRead, 
  deleteNotification, 
  deleteAllNotifications 
} from "@/app/notifications/actions"
import { Notification, NotificationsFilters } from "@/app/notifications/types"
import { toast } from "sonner"

interface NotificationsContextType {
  notifications: Notification[]
  status: ReturnType<typeof useNotificationScope>['status'] | 'inactive' | 'loading' | 'failed'
  retryVerification?: () => void
  filters: NotificationsFilters
  searchQuery: string
  updateFilters: (filters: NotificationsFilters) => void
  updateSearchQuery: (query: string) => void
  clearFilters: () => void
  markAsRead: (id: string) => Promise<void>
  markAllNotificationsAsRead: () => Promise<void>
  deleteOneNotification: (id: string) => Promise<void>
  deleteAllUserNotifications: () => Promise<void>
  refreshNotifications: () => Promise<void>
}

const emptyInbox: NotificationsContextType = {
  notifications: [],
  status: 'inactive',
  filters: {},
  searchQuery: "",
  updateFilters: () => {},
  updateSearchQuery: () => {},
  clearFilters: () => {},
  markAsRead: async () => {},
  markAllNotificationsAsRead: async () => {},
  deleteOneNotification: async () => {},
  deleteAllUserNotifications: async () => {},
  refreshNotifications: async () => {}
}
const pendingInbox: NotificationsContextType = { ...emptyInbox, status: 'loading' }
const NotificationsContext = createContext<NotificationsContextType>(emptyInbox)

export const useNotifications = () => useContext(NotificationsContext)

interface NotificationsProviderProps {
  children: ReactNode
}

export function NotificationsProvider({ children, active }: NotificationsProviderProps & { active: boolean }) {
  const verification = useNotificationScope()
  const target = active && verification.status === 'ready' ? verification.target : undefined
  const actor = target?.actorId
  const siteId = target?.siteId
  const scope = useMemo(() => actor && siteId ? { actor, siteId } : null, [actor, siteId])
  const [snapshot, setSnapshot] = useState<{ scope: NonNullable<typeof scope>; value: NotificationsContextType } | null>(null)
  const publish = useCallback((value: NotificationsContextType | null) => {
    if (!scope) return
    if (value) setSnapshot({ scope, value })
    else setSnapshot(previous => previous?.scope === scope ? null : previous)
  }, [scope])

  // Key the private reader, NOT the workspace layout: arriving at the inbox must
  // not restart the sidebar's queries, and leaving it must retire its rows.
  const value = !active ? emptyInbox : verification.status !== 'ready'
    ? { ...emptyInbox, status: verification.status, retryVerification: 'retry' in verification ? verification.retry : undefined }
    : scope && snapshot?.scope === scope ? snapshot.value : pendingInbox
  return <NotificationsContext.Provider value={value}>
    {scope && <InboxState key={JSON.stringify([scope.actor, scope.siteId])} siteId={scope.siteId} userId={scope.actor} publish={publish} />}
    {children}
  </NotificationsContext.Provider>
}

function InboxState({ siteId, userId, publish }: { siteId: string; userId: string; publish: (value: NotificationsContextType | null) => void }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed' | 'denied'>('loading')
  const [filters, setFilters] = useState<NotificationsFilters>({})
  const [searchQuery, setSearchQuery] = useState("")
  const activeRead = useRef<AbortController | null>(null)
  
  const loadNotifications = useCallback(async () => {
    if (!siteId || !userId) return
    activeRead.current?.abort()
    const controller = new AbortController()
    activeRead.current = controller
    await getNotifications(siteId, userId, controller.signal).then(result => {
      if (controller.signal.aborted || result.cancelled) return
      
      if (result.denied || result.error || !Array.isArray(result.notifications)) {
        console.warn("Background notification fetch failed:", result.error)
        setStatus(result.denied ? 'denied' : 'failed'); setNotifications([])
        return
      }
      
      setNotifications(result.notifications)
      setStatus('ready')
    }).catch(() => {
      if (!controller.signal.aborted) { setStatus('failed'); setNotifications([]) }
    }).finally(() => {
      if (activeRead.current === controller) {
        activeRead.current = null
      }
    })
  }, [siteId, userId])

  const refreshNotifications = useCallback(() => {
    setStatus('loading')
    return loadNotifications()
  }, [loadNotifications])
  
  // Load notifications when currentSite or user changes
  useEffect(() => {
    let isMounted = true;
    const cancel = () => {
      isMounted = false
      activeRead.current?.abort()
    }
    // Full-document navigation may cancel fetch before React unmount cleanup runs.
    const suspend = () => { activeRead.current?.abort() }
    const resume = (event: PageTransitionEvent) => {
      if (event.persisted && isMounted) void refreshNotifications()
    }
    window.addEventListener('pagehide', suspend)
    window.addEventListener('pageshow', resume)
    const cleanup = () => {
      cancel()
      window.removeEventListener('pagehide', suspend)
      window.removeEventListener('pageshow', resume)
    }
    
    void loadNotifications()
    return cleanup
  }, [loadNotifications, refreshNotifications]);
  
  // Function to update filters - wrapped in useCallback
  const updateFilters = useCallback((newFilters: NotificationsFilters) => {
    setFilters(newFilters)
  }, [])
  
  // Function to update search query - wrapped in useCallback
  const updateSearchQuery = useCallback((query: string) => {
    setSearchQuery(query)
  }, [])
  
  // Function to clear filters - wrapped in useCallback
  const clearFilters = useCallback(() => {
    setFilters({})
    setSearchQuery("")
  }, [])
  
  // Function to mark notification as read - wrapped in useCallback
  const markAsRead = useCallback(async (id: string) => {
    if (!siteId || !userId) {
      toast.error("No site or user selected")
      return
    }
    
    try {
      const result = await updateNotification({ id, is_read: true })
      
      if (result.error) {
        toast.error(result.error)
        return
      }
      
      // Update notification in local state
      setNotifications(prevNotifications =>
        prevNotifications.map(n =>
          n.id === id ? { ...n, is_read: true } : n
        )
      )
      
      toast.success("Notification marked as read")
    } catch (error) {
      console.error("Error marking notification as read:", error)
      toast.error("Error marking notification as read")
    }
  }, [siteId, userId])
  
  // Function to mark all notifications as read - wrapped in useCallback
  const markAllNotificationsAsRead = useCallback(async () => {
    if (!siteId || !userId) {
      toast.error("No site or user selected")
      return
    }
    
    try {
      const result = await markAllAsRead(siteId, userId)
      
      if (result.error) {
        toast.error(result.error)
        return
      }
      
      // Update all notifications in local state
      setNotifications(prevNotifications =>
        prevNotifications.map(n => ({ ...n, is_read: true }))
      )
      
      toast.success("All notifications marked as read")
    } catch (error) {
      console.error("Error marking all notifications as read:", error)
      toast.error("Error marking all notifications as read")
    }
  }, [siteId, userId])
  
  // Function to delete a notification - wrapped in useCallback
  const deleteOneNotification = useCallback(async (id: string) => {
    if (!siteId || !userId) {
      toast.error("No site or user selected")
      return
    }
    
    try {
      const result = await deleteNotification(id)
      
      if (result.error) {
        toast.error(result.error)
        return
      }
      
      // Remove notification from local state
      setNotifications(prevNotifications =>
        prevNotifications.filter(n => n.id !== id)
      )
      
      toast.success("Notification deleted")
    } catch (error) {
      console.error("Error deleting notification:", error)
      toast.error("Error deleting notification")
    }
  }, [siteId, userId])
  
  // Function to delete all notifications - wrapped in useCallback
  const deleteAllUserNotifications = useCallback(async () => {
    if (!siteId || !userId) {
      toast.error("No site or user selected")
      return
    }
    
    try {
      const result = await deleteAllNotifications(siteId, userId)
      
      if (result.error) {
        toast.error(result.error)
        return
      }
      
      // Clear all notifications in local state
      setNotifications([])
      
      toast.success("All notifications deleted")
    } catch (error) {
      console.error("Error deleting all notifications:", error)
      toast.error("Error deleting all notifications")
    }
  }, [siteId, userId])
  
  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    notifications,
    status,
    filters,
    searchQuery,
    updateFilters,
    updateSearchQuery,
    clearFilters,
    markAsRead,
    markAllNotificationsAsRead,
    deleteOneNotification,
    deleteAllUserNotifications,
    refreshNotifications
  }), [
    notifications,
    status,
    filters,
    searchQuery,
    updateFilters,
    updateSearchQuery,
    clearFilters,
    markAsRead,
    markAllNotificationsAsRead,
    deleteOneNotification,
    deleteAllUserNotifications,
    refreshNotifications
  ])
  
  useLayoutEffect(() => { publish(contextValue) }, [contextValue, publish])
  useLayoutEffect(() => () => publish(null), [publish])
  return null
} 