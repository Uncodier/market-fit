import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

// Define the routes where automatic refresh should be prevented
const CREATE_EDIT_ROUTES = [
  '/settings',
  '/site/create',
  '/create-site',
  // Detail/edit pages (using regex patterns)
  /^\/campaigns\/[^\/]+$/,
  /^\/experiments\/[^\/]+$/,
  /^\/leads\/[^\/]+$/,
  /^\/content\/[^\/]+$/,
  /^\/segments\/[^\/]+$/,
  /^\/requirements\/[^\/]+$/,
  /^\/control-center\/[^\/]+$/,
  /^\/agents\/[^\/]+\/[^\/]+$/, // Agent command detail pages
]

// Define the routes where automatic refresh is allowed
const READ_ONLY_ROUTES = [
  '/dashboard',
  '/campaigns',
  '/experiments', 
  '/leads',
  '/content',
  '/segments',
  '/requirements',
  '/assets',
  '/chat',
  '/agents',
  '/control-center',
  '/costs',
  '/sales',
  '/notifications',
  '/profile',
  '/security',
  '/billing',
  '/auth',
  '/outsource',
]

/**
 * Hook to determine if the current route is a create/edit page where 
 * automatic refresh should be prevented to avoid losing work
 */
export function usePreventRefresh() {
  const pathname = usePathname()
  
  // Check if current route is a create/edit route
  const isCreateEditRoute = CREATE_EDIT_ROUTES.some(route => {
    if (typeof route === 'string') {
      return pathname === route
    } else {
      // RegExp pattern
      return route.test(pathname)
    }
  })
  
  // Check if current route is explicitly a read-only route
  const isReadOnlyRoute = READ_ONLY_ROUTES.some(route => pathname === route)
  
  // If it's explicitly a read-only route, allow refresh
  if (isReadOnlyRoute) {
    return { shouldPreventRefresh: false, isCreateEditRoute: false }
  }
  
  // If it's a create/edit route, prevent refresh
  if (isCreateEditRoute) {
    return { shouldPreventRefresh: true, isCreateEditRoute: true }
  }
  
  // For unknown routes, default to preventing refresh to be safe
  return { shouldPreventRefresh: true, isCreateEditRoute: false }
}

/**
 * Hook to set up page refresh prevention on create/edit pages
 */
export function usePageRefreshPrevention() {
  const { shouldPreventRefresh, isCreateEditRoute } = usePreventRefresh()
  const pathname = usePathname()
  
  useEffect(() => {
    if (shouldPreventRefresh) {
      // Store the prevention state in sessionStorage for other parts of the app to check
      sessionStorage.setItem('preventAutoRefresh', 'true')
      sessionStorage.setItem('preventAutoRefreshReason', isCreateEditRoute ? 'create-edit-page' : 'unknown-route')
      
      console.log(`🚫 Auto-refresh prevention enabled for: ${pathname}`)
    } else {
      // Remove prevention for read-only pages
      sessionStorage.removeItem('preventAutoRefresh')
      sessionStorage.removeItem('preventAutoRefreshReason')
      
      console.log(`✅ Auto-refresh allowed for: ${pathname}`)
    }
    
    return () => {
      // Cleanup on unmount - but don't remove if still on a create/edit page
      const currentPreventRefresh = sessionStorage.getItem('preventAutoRefresh')
      if (currentPreventRefresh && !shouldPreventRefresh) {
        sessionStorage.removeItem('preventAutoRefresh')
        sessionStorage.removeItem('preventAutoRefreshReason')
      }
    }
  }, [pathname, shouldPreventRefresh, isCreateEditRoute])
  
  return { shouldPreventRefresh, isCreateEditRoute }
}

/**
 * Utility function to check if auto-refresh should be prevented
 * Can be used by any component/service that wants to trigger a refresh
 */
export function shouldPreventAutoRefresh(): boolean {
  if (typeof window === 'undefined') return false
  
  const preventRefresh = sessionStorage.getItem('preventAutoRefresh')
  return preventRefresh === 'true'
}

/**
 * Utility function to get the reason why auto-refresh is prevented
 */
export function getAutoRefreshPreventionReason(): string | null {
  if (typeof window === 'undefined') return null
  
  return sessionStorage.getItem('preventAutoRefreshReason')
}

/**
 * Simple and robust refresh prevention hook
 */
export function useSimpleRefreshPrevention() {
  const { shouldPreventRefresh, isCreateEditRoute } = usePreventRefresh()
  const pathname = usePathname()
  
  useEffect(() => {
    if (!shouldPreventRefresh) return
    
    // Store the prevention state
    sessionStorage.setItem('preventAutoRefresh', 'true')
    sessionStorage.setItem('preventAutoRefreshReason', isCreateEditRoute ? 'create-edit-page' : 'unknown-route')
    
    console.log(`🚫 Simple refresh prevention enabled for: ${pathname}`)
    
    // Simple approach: just prevent the visibility change actions
    const handleVisibilityChange = (e: Event) => {
      if (document.visibilityState === 'visible') {
        console.log('🚫 Window became visible - settings form protected')
        // Set a flag to prevent any auto-refresh actions
        sessionStorage.setItem('JUST_BECAME_VISIBLE', 'true')
        
        // Clear the flag after a short delay
        setTimeout(() => {
          sessionStorage.removeItem('JUST_BECAME_VISIBLE')
        }, 1000)
      }
    }
    
    const handleWindowFocus = (e: Event) => {
      console.log('🚫 Window focus detected - settings form protected')
      sessionStorage.setItem('JUST_GAINED_FOCUS', 'true')
      
      // Clear the flag after a short delay
      setTimeout(() => {
        sessionStorage.removeItem('JUST_GAINED_FOCUS')
      }, 1000)
    }
    
    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange, { passive: true })
    window.addEventListener('focus', handleWindowFocus, { passive: true })
    
    return () => {
      // Cleanup
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleWindowFocus)
      
      // Clean up session storage
      sessionStorage.removeItem('preventAutoRefresh')
      sessionStorage.removeItem('preventAutoRefreshReason')
      sessionStorage.removeItem('JUST_BECAME_VISIBLE')
      sessionStorage.removeItem('JUST_GAINED_FOCUS')
    }
  }, [pathname, shouldPreventRefresh, isCreateEditRoute])
  
  return { shouldPreventRefresh, isCreateEditRoute }
} 