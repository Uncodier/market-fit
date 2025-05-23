"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from "react"
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
  
  // Function to load notifications from database - wrapped in useCallback
  const refreshNotifications = useCallback(async () => {
    if (!currentSite?.id || !user?.id) return
    
    setLoading(true)
    try {
      const result = await getNotifications(currentSite.id, user.id)
      
      if (result.error) {
        toast.error(result.error)
        return
      }
      
      setNotifications(result.notifications || [])
    } catch (error) {
      console.error("Error loading notifications:", error)
      toast.error("Error loading notifications")
    } finally {
      setLoading(false)
    }
  }, [currentSite?.id, user?.id])
  
  // Load notifications when currentSite or user changes
  useEffect(() => {
    let isMounted = true;
    
    const fetchData = async () => {
      if (isMounted) {
        await refreshNotifications();
      }
    };
    
    if (currentSite?.id && user?.id) {
      fetchData();
    }
    
    return () => {
      isMounted = false;
    };
  }, [currentSite?.id, user?.id]); // Only depend on the IDs, not the function
  
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