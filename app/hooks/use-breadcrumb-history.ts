"use client"

import { useEffect, useState, useCallback, useRef } from 'react'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { reduceBreadcrumb, enforceInvariants, getScreenKey, HistoryItem } from '@/lib/navigation/breadcrumb-engine'
import { markUINavigation } from '@/lib/navigation/navigation-helpers'

const NAVIGATION_HISTORY_RESET_EVENT = 'navigation-history:reset'

export type { HistoryItem } from '@/lib/navigation/breadcrumb-engine'

interface NavigationHistory {
  items: HistoryItem[]
}

const STORAGE_KEY = 'navigationHistory'
const MAX_VISIBLE_ITEMS = 5

// Route titles mapping
const routeTitles: Record<string, string> = {
  'dashboard': 'Dashboard',
  'agents': 'Agents',
  'segments': 'Segments',
  'experiments': 'Experiments',
  'requirements': 'Requirements',
  'leads': 'Leads',
  'assets': 'Assets',
  'content': 'Content',
  'settings': 'Settings',
  'profile': 'Profile',
  'help': 'Help',
  'chat': 'Chat',
  'campaigns': 'Campaigns',
  'control-center': 'Control Center',
  'billing': 'Billing',
  'robots': 'Agents',
  'sales': 'Sales',
  'deals': 'Deals',
  'people': 'People',
  'integrations': 'Integrations',
  'context': 'Context',
  'applications': 'Applications',
  'pos': 'POS',
  'catalog': 'Catalog',
  'promotions': 'Promotions',
  'orders': 'Orders',
  'price-lists': 'Price Lists',
  'inventory': 'Inventory',
  'shipments': 'Shipments',
  'subscriptions': 'Subscriptions',
  'reservations': 'Reservations',
  'visits': 'Visits',
}

/**
 * Check if this is a direct browser navigation (refresh or URL bar)
 * Prioritizes timestamp over Performance API for reliability in Next.js
 */
function isDirectNavigation(): boolean {
  if (typeof window === 'undefined') return true
  
  // Method 1: PRIORITY - Check for UI navigation timestamp first
  const navTimestamp = sessionStorage.getItem('uiNavTimestamp')
  
  if (navTimestamp) {
    const timestamp = parseInt(navTimestamp, 10)
    const now = Date.now()
    const timeDiff = now - timestamp
    
    // Consider it UI navigation if timestamp is recent (< 2000ms to account for Fast Refresh)
    const isUINav = timeDiff < 2000
    
    if (isUINav) {
      // DON'T clean up yet - let the navigation handler clean it up
      // This prevents issues with Fast Refresh re-renders
      return false // UI navigation
    } else {
      // Timestamp expired, continue to other checks
      sessionStorage.removeItem('uiNavTimestamp')
    }
  }
  
  // Method 2: Check Performance Navigation API
  // Note: In Next.js dev mode with Fast Refresh, this can be unreliable
  try {
    const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
    if (navEntries.length > 0) {
      const navEntry = navEntries[0]
      const navType = navEntry.type
      
      // 'reload' = user refreshed the page (but can be false positive in dev)
      const isReload = navType === 'reload'
      
      // Check referrer to disambiguate
      const hasSameOriginReferrer = document.referrer && document.referrer.includes(window.location.origin)
      
      // Only trust reload if there's no same-origin referrer
      // (protects against Next.js Fast Refresh false positives)
      if (isReload && !hasSameOriginReferrer) {
        return true // True reload without navigation context
      }
      
      // Direct navigation from external source
      if (navType === 'navigate' && !hasSameOriginReferrer) {
        return true
      }
    }
  } catch (e) {
    console.warn('Performance API not available:', e)
  }
  
  // If referrer is from same origin, assume UI navigation
  return !document.referrer.includes(window.location.origin)
}

/**
 * Generate a label for a route based on path and query params
 */
function generateLabel(pathname: string, searchParams: URLSearchParams | null): string {
  const pathSegments = pathname.split('/').filter(Boolean)
  
  if (pathSegments.length === 0) return 'Dashboard'
  
  // Special case for applications/database
  if (pathSegments[0] === 'applications' && pathSegments[1] === 'database') {
    let label = 'Database'
    if (pathSegments.length > 2) {
      const customTitle = searchParams?.get('title')
      if (customTitle) {
        const decodedTitle = decodeURIComponent(customTitle)
        label = decodedTitle.length > 40 ? decodedTitle.substring(0, 40) + '...' : decodedTitle
      } else {
        const name = searchParams?.get('name')
        if (name) {
          const decodedName = decodeURIComponent(name)
          label = decodedName.length > 40 ? decodedName.substring(0, 40) + '...' : decodedName
        } else {
          label = 'Database Details'
        }
      }
    }
    return label
  }
  
  // Get the main route segment
  const mainSegment = pathSegments[0]
  let label = routeTitles[mainSegment] || mainSegment.charAt(0).toUpperCase() + mainSegment.slice(1)
  
  // For detail pages with additional path segments (e.g., /control-center/abc-123)
  if (pathSegments.length > 1) {
    // Check if there's a custom title in query params first
    const customTitle = searchParams?.get('title')
    if (customTitle) {
      const decodedTitle = decodeURIComponent(customTitle)
      // Trim long titles to keep breadcrumb readable
      label = decodedTitle.length > 40 
        ? decodedTitle.substring(0, 40) + '...' 
        : decodedTitle
    } else {
      // Check for name in query params
      const name = searchParams?.get('name')
      if (name) {
        const decodedName = decodeURIComponent(name)
        // Trim long names to keep breadcrumb readable
        label = decodedName.length > 40 
          ? decodedName.substring(0, 40) + '...' 
          : decodedName
      } else {
        // Use base route name for detail pages
        // E.g., "Control Center Item" instead of showing UUID
        label = `${label} Details`
      }
    }
  }
  
  // For chat pages with conversation title or agent info
  if (mainSegment === 'chat') {
    // Prioritize conversation title over agent name
    const conversationTitle = searchParams?.get('title')
    if (conversationTitle) {
      const decodedTitle = decodeURIComponent(conversationTitle)
      // Trim the title to 30 characters max
      label = decodedTitle.length > 30 
        ? decodedTitle.substring(0, 30) + '...' 
        : decodedTitle
    } else {
      const agentName = searchParams?.get('agentName')
      if (agentName) {
        label = `Chat: ${decodeURIComponent(agentName)}`
      }
    }
  }
  
  // For robots pages with instance name
  if (mainSegment === 'robots') {
    // Check if there's an instance name in query params
    const instanceName = searchParams?.get('name')
    if (instanceName) {
      const decodedName = decodeURIComponent(instanceName)
      // Trim long names to keep breadcrumb readable
      label = decodedName.length > 40 
        ? decodedName.substring(0, 40) + '...' 
        : decodedName
    }
    // If no name but has instance param, it will show "Agents" (from routeTitles)
  }
  
  return label
}

/**
 * Load history from localStorage
 */
function loadHistory(): NavigationHistory {
  if (typeof window === 'undefined') return { items: [] }
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    console.error('Error loading navigation history:', error)
  }
  
  return { items: [] }
}

/**
 * Save history to localStorage
 */
function saveHistory(history: NavigationHistory): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
  } catch (error) {
    console.error('Error saving navigation history:', error)
  }
}

/**
 * Hook to manage navigation history for breadcrumb
 */
export function useNavigationHistory() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [history, setHistory] = useState<NavigationHistory>({ items: [] })
  const [isInitialized, setIsInitialized] = useState(false)
  const previousPathRef = useRef<string>('')
  
  // Build full path with query params
  const queryString = searchParams?.toString() || ''
  const fullPath = queryString ? `${pathname}?${queryString}` : pathname
  
  // Listen to breadcrumb:update to dynamically update the current history item's label
  // and ensure parent → detail trail is present when a parent is provided
  useEffect(() => {
    const handleBreadcrumbUpdate = (event: any) => {
      if (event.detail) {
        setHistory(prev => {
          const newItems = reduceBreadcrumb(prev.items, {
            type: 'update',
            title: event.detail.title,
            parent: event.detail.parent,
            path: event.detail.path,
            section: event.detail.section
          })
          
          if (newItems !== prev.items) {
            const newHistory = { items: newItems }
            saveHistory(newHistory)
            return newHistory
          }
          return prev
        });
      }
    };
    
    window.addEventListener('breadcrumb:update', handleBreadcrumbUpdate as EventListener);
    return () => {
      window.removeEventListener('breadcrumb:update', handleBreadcrumbUpdate as EventListener);
    };
  }, []); // fullPath dependency removed, reducer handles the logic

  // Initialize history from localStorage on mount
  useEffect(() => {
    const loadedHistory = loadHistory()
    setHistory({ items: enforceInvariants(loadedHistory.items || []) })
    setIsInitialized(true)
  }, [])
  
  // Handle route changes
  useEffect(() => {
    if (!isInitialized) return
    
    // Skip if path hasn't changed
    if (previousPathRef.current === fullPath) return
    
    const isDirect = isDirectNavigation()
    
    // Clean up UI navigation timestamp
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('uiNavTimestamp')
    }
    
    setHistory(prev => {
      const last = prev.items[prev.items.length - 1]
      if (isDirect && last && getScreenKey(last.path) === getScreenKey(fullPath)) {
        return prev
      }

      const newItems = reduceBreadcrumb(prev.items, {
        type: 'navigate',
        path: fullPath,
        label: generateLabel(pathname, searchParams)
      })

      const newHistory = { items: newItems }
      saveHistory(newHistory)
      return newHistory
    })
    
    previousPathRef.current = fullPath
  }, [pathname, searchParams, fullPath, isInitialized])
  
  /**
   * Navigate to a specific item in history
   */
  const navigateTo = useCallback((item: HistoryItem) => {
    // Mark as UI navigation using the proper function
    markUINavigation()
    
    // Extract pathname and query from path
    const [path, query] = item.path.split('?')
    if (query) {
      router.push(`${path}?${query}`)
    } else {
      router.push(path)
    }
  }, [router])
  
  /**
   * Reset history (for programmatic resets)
   */
  const reset = useCallback(() => {
    setHistory(prev => {
      const newItems = reduceBreadcrumb(prev.items, { type: 'reset' })
      const newHistory = { items: newItems }
      saveHistory(newHistory)
      return newHistory
    })
  }, [])

  useEffect(() => {
    const handler = () => reset()
    window.addEventListener(NAVIGATION_HISTORY_RESET_EVENT, handler)
    return () => window.removeEventListener(NAVIGATION_HISTORY_RESET_EVENT, handler)
  }, [reset])
  
  /**
   * Get visible items (last N items)
   */
  const visibleItems = history.items.slice(-MAX_VISIBLE_ITEMS)
  
  return {
    items: history.items,
    visibleItems,
    navigateTo,
    reset,
    hasHistory: history.items.length > 0
  }
}

