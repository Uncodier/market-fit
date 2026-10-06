"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo, useRef } from "react"
import { useSite } from "@/app/context/SiteContext"
import { useAuth } from "@/app/hooks/use-auth"
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
  loading: boolean
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

const NotificationsContext = createContext<NotificationsContextType>({
  notifications: [],
  loading: false,
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
})

export const useNotifications = () => useContext(NotificationsContext)

interface NotificationsProviderProps {
  children: ReactNode
}

export function NotificationsProvider({ children }: NotificationsProviderProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<NotificationsFilters>({})
  const [searchQuery, setSearchQuery] = useState("")
  const { currentSite } = useSite()
  const { user } = useAuth()
  const activeRead = useRef<AbortController | null>(null)
  
  // Function to load notifications from database - wrapped in useCallback
  const refreshNotifications = useCallback(async () => {
    if (!currentSite?.id || !user?.id) return
    activeRead.current?.abort()
    const controller = new AbortController()
    activeRead.current = controller
    setLoading(true)
    try {
      const result = await getNotifications(currentSite.id, user.id, controller.signal)
      if (controller.signal.aborted || result.cancelled) return
      
      if (result.error) {
        console.warn("Background notification fetch failed:", result.error)
        return
      }
      
      setNotifications(result.notifications || [])
    } catch (error) {
      if (!controller.signal.aborted) console.error("Error loading notifications:", error)
    } finally {
      if (activeRead.current === controller) {
        activeRead.current = null
        if (!controller.signal.aborted) setLoading(false)
      }
    }
  }, [currentSite?.id, user?.id])
  
  // Load notifications when currentSite or user changes
  useEffect(() => {
    let isMounted = true;
    // Discard the previous site's data immediately, not after a new request returns.
    activeRead.current?.abort()
    setNotifications([])
    setLoading(Boolean(currentSite?.id && user?.id))
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
    
    const fetchData = async () => {
      if (isMounted) {
        await refreshNotifications();
      }
    };
    
    if (currentSite?.id && user?.id) {
      const idle = (window as Window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
      }).requestIdleCallback
      if (typeof idle === "function") {
        const id = idle(() => { void fetchData() }, { timeout: 2500 })
        return () => {
          cleanup()
          ;(window as Window & { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback?.(id)
        }
      }
      const timer = window.setTimeout(() => { void fetchData() }, 1200)
      return () => {
        cleanup()
        window.clearTimeout(timer)
      }
    }
    
    return () => {
      cleanup();
    };
  }, [currentSite?.id, user?.id, refreshNotifications]);
  
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
    if (!currentSite?.id || !user?.id) {
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
  }, [currentSite?.id, user?.id])
  
  // Function to mark all notifications as read - wrapped in useCallback
  const markAllNotificationsAsRead = useCallback(async () => {
    if (!currentSite?.id || !user?.id) {
      toast.error("No site or user selected")
      return
    }
    
    try {
      const result = await markAllAsRead(currentSite.id, user.id)
      
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
  }, [currentSite?.id, user?.id])
  
  // Function to delete a notification - wrapped in useCallback
  const deleteOneNotification = useCallback(async (id: string) => {
    if (!currentSite?.id || !user?.id) {
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
  }, [currentSite?.id, user?.id])
  
  // Function to delete all notifications - wrapped in useCallback
  const deleteAllUserNotifications = useCallback(async () => {
    if (!currentSite?.id || !user?.id) {
      toast.error("No site or user selected")
      return
    }
    
    try {
      const result = await deleteAllNotifications(currentSite.id, user.id)
      
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
  }, [currentSite?.id, user?.id])
  
  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    notifications,
    loading,
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
    loading,
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
  
  return (
    <NotificationsContext.Provider value={contextValue}>
      {children}
    </NotificationsContext.Provider>
  )
} 