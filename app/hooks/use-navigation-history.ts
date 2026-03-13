"use client"

import { useEffect, useState, useCallback, useRef } from 'react'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'

export interface HistoryItem {
  path: string      // full path with query params
  label: string     // display name
  timestamp: number // for ordering
}

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
  'robots': 'Makina',
  'sales': 'Sales',
  'deals': 'Deals',
  'people': 'People',
  'integrations': 'Integrations',
  'context': 'Context'
}

/**
 * Check if a route is a root route (should reset breadcrumb)
 * Root routes are base routes without query params or additional path segments
 * Examples:
 *   - /content → TRUE (root)
 *   - /content?id=123 → FALSE (has query params)
 *   - /content/abc-123 → FALSE (has additional path segment)
 */
function isRootRoute(fullPath: string): boolean {
  // Split path and query
  const [pathname, queryString] = fullPath.split('?')
  
  // If there are query params, it's NOT a root route
  const hasParams = queryString && queryString.length > 0
  if (hasParams) {
    return false
  }
  
  // Count path segments (excluding empty strings)
  const segments = pathname.split('/').filter(Boolean)
  
  // Root route = only one segment (e.g., /content, /chat, /leads)
  // NOT root = multiple segments (e.g., /content/123, /control-center/abc)
  const isRoot = segments.length <= 1
  
  return isRoot
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
    // If no name but has instance param, it will show "Makina" (from routeTitles)
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
  useEffect(() => {
    const handleBreadcrumbUpdate = (event: any) => {
      if (event.detail && event.detail.title) {
        setHistory(prev => {
          if (prev.items.length === 0) return prev;
          
          const newItems = [...prev.items];
          const lastItem = newItems[newItems.length - 1];
          
          // Only update if the title actually changed to avoid unnecessary re-renders
          if (lastItem.label !== event.detail.title) {
            newItems[newItems.length - 1] = {
              ...lastItem,
              label: event.detail.title
            };
            const newHistory = { items: newItems };
            saveHistory(newHistory);
            return newHistory;
          }
          return prev;
        });
      }
    };
    
    window.addEventListener('breadcrumb:update', handleBreadcrumbUpdate as EventListener);
    return () => {
      window.removeEventListener('breadcrumb:update', handleBreadcrumbUpdate as EventListener);
    };
  }, []);

  // Initialize history from localStorage on mount
  useEffect(() => {
    const loadedHistory = loadHistory()
    setHistory(loadedHistory)
    setIsInitialized(true)
  }, [])
  
  // Handle route changes
  useEffect(() => {
    if (!isInitialized) return
    
    // Skip if path hasn't changed
    if (previousPathRef.current === fullPath) return
    
    const isDirect = isDirectNavigation()
    const isRoot = isRootRoute(fullPath)
    
    // Handle root routes (base routes without IDs like /leads, /content)
    if (isRoot) {
      // Find if we're already on this root route in history and just changing query params (like tab)
      const lastItem = history.items[history.items.length - 1]
      const lastPathname = lastItem ? lastItem.path.split('?')[0] : ''
      
      // Check if we're navigating within the same root route
      if (lastPathname === pathname) {
        // Just update the last item's path with new query params
        const label = generateLabel(pathname, searchParams)
        const updatedItem: HistoryItem = {
          path: fullPath,
          label,
          timestamp: Date.now()
        }
        
        const newHistory: NavigationHistory = {
          items: [...history.items.slice(0, -1), updatedItem]
        }
        setHistory(newHistory)
        saveHistory(newHistory)
        previousPathRef.current = fullPath
        return
      }

      // If it's UI navigation (coming from another page in the app)
      // Reset breadcrumb and start with this new base route
      if (!isDirect) {
        const label = generateLabel(pathname, searchParams)
        const newItem: HistoryItem = {
          path: fullPath,
          label,
          timestamp: Date.now()
        }
        const newHistory: NavigationHistory = { items: [newItem] }
        setHistory(newHistory)
        saveHistory(newHistory)
        previousPathRef.current = fullPath
        // Clean up timestamp
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('uiNavTimestamp')
        }
        return
      }
      
      // If it's direct navigation, reset only if no history
      if (isDirect && history.items.length === 0) {
        const newHistory: NavigationHistory = { items: [] }
        setHistory(newHistory)
        saveHistory(newHistory)
        previousPathRef.current = fullPath
        // Clean up timestamp
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('uiNavTimestamp')
        }
        return
      }
      
      // If direct navigation WITH history, keep the history (reload case handled above)
      previousPathRef.current = fullPath
      // Clean up timestamp
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('uiNavTimestamp')
      }
      return
    }
    
    // For routes WITH query params OR path segments: handle direct navigation
    if (isDirect) {
      const hasExistingHistory = history.items.length > 0
      
      // Check if it's just a query param change on a root route (e.g. /dashboard?tab=x)
      // This allows direct navigation to tabs/filters without wiping history if we're already in the app
      const isParamOnRoot = isRootRoute(currentPathname) && queryString.length > 0
      
      // If there's NO existing history, this is a fresh direct entry (typed URL or external link)
      // Reset breadcrumb to start fresh
      if (!hasExistingHistory && !isParamOnRoot) {
        const newHistory: NavigationHistory = { items: [] }
        setHistory(newHistory)
        saveHistory(newHistory)
        previousPathRef.current = fullPath
        // Clean up timestamp
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('uiNavTimestamp')
        }
        return
      }
      
      // If there IS existing history, this is a reload/refresh
      // Keep the history but update previousPathRef to track current location
      previousPathRef.current = fullPath
      // Clean up timestamp
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('uiNavTimestamp')
      }
      return
    }
    
    // If we get here, it's UI navigation - clean up the timestamp
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('uiNavTimestamp')
    }
    
    // FIRST: Check if this route already exists in history (navigation back to previous page)
    const existingIndex = history.items.findIndex(item => item.path === fullPath)
    
    // Check if this is just a query param change on the exact same base path
    const lastItem = history.items[history.items.length - 1]
    let isParamChangeOnSamePath = false
    
    if (lastItem) {
      const lastPathname = lastItem.path.split('?')[0]
      
      // If path is identical
      isParamChangeOnSamePath = pathname === lastPathname
    }
    
    if (isParamChangeOnSamePath) {
      // Just update the last item's path and label, don't grow history
      const label = generateLabel(pathname, searchParams)
      const updatedItem: HistoryItem = {
        path: fullPath,
        label,
        timestamp: Date.now()
      }
      
      const newHistory: NavigationHistory = {
        items: [...history.items.slice(0, -1), updatedItem]
      }
      setHistory(newHistory)
      saveHistory(newHistory)
      previousPathRef.current = fullPath
      return
    }
    
    if (existingIndex !== -1) {
      // Navigate back to existing item (remove items after it)
      
      const newHistory: NavigationHistory = {
        items: history.items.slice(0, existingIndex + 1)
      }
      setHistory(newHistory)
      saveHistory(newHistory)
      previousPathRef.current = fullPath
      return
    }
    
    // Check if only the ID changed (same base path, different ID in query or path)
    const currentPathname = fullPath.split('?')[0]
    
    if (lastItem) {
      const lastPathname = lastItem.path.split('?')[0]
      
      // Extract base path and check if path has ID segment
      // E.g., /control-center/abc-123 → { basePath: '/control-center', hasId: true, segments: 2 }
      const getPathInfo = (path: string) => {
        const segments = path.split('/').filter(Boolean)
        return {
          basePath: segments.length > 0 ? `/${segments[0]}` : path,
          hasId: segments.length > 1,
          segments: segments.length
        }
      }
      
      const currentPathInfo = getPathInfo(currentPathname)
      const lastPathInfo = getPathInfo(lastPathname)
      
      // If base path is the same, check if we should replace or add
      if (currentPathInfo.basePath === lastPathInfo.basePath) {
        // CASE 1: /leads → /leads/id (list to detail)
        // last has NO ID, current has ID = ADD new item
        if (!lastPathInfo.hasId && currentPathInfo.hasId) {
          
          // First, ensure the base route is in history
          const baseLabel = generateLabel(lastPathname, null)
          const baseExists = history.items.some(item => item.path === lastPathname)
          
          if (!baseExists) {
            // Add the base route first (e.g., "Leads")
            const baseItem: HistoryItem = {
              path: lastPathname,
              label: baseLabel,
              timestamp: Date.now() - 1 // Slightly older timestamp
            }
            
            const newHistory: NavigationHistory = {
              items: [...history.items, baseItem]
            }
            setHistory(newHistory)
            saveHistory(newHistory)
          }
          
          // Continue to add the detail item below
        }
        // CASE 2: /leads/id1 → /leads/id2 (detail to detail)
        // both have ID in path = REPLACE last item
        else if (lastPathInfo.hasId && currentPathInfo.hasId) {
          // Check query params
          const currentParams = new URLSearchParams(fullPath.split('?')[1] || '')
          const lastParams = new URLSearchParams(lastItem.path.split('?')[1] || '')
          
          // Check if only query params changed (for subpages)
          const paramChangedOnly = currentPathname === lastPathname;
                                 
          if (paramChangedOnly) {
            const label = generateLabel(pathname, searchParams)
            const updatedItem: HistoryItem = {
              path: fullPath,
              label,
              timestamp: Date.now()
            }
            
            const newHistory: NavigationHistory = {
              items: [...history.items.slice(0, -1), updatedItem]
            }
            setHistory(newHistory)
            saveHistory(newHistory)
            previousPathRef.current = fullPath
            return
          }
          
          // Common ID parameter names that indicate selection change
          const idParams = ['id', 'agentId', 'conversationId', 'leadId', 'segmentId', 'campaignId', 'experimentId', 'requirementId', 'contentId', 'saleId', 'robotId', 'instance']
          
          // Check if any ID parameter in query changed
          const queryIdChanged = idParams.some(param => {
            const currentId = currentParams.get(param)
            const lastId = lastParams.get(param)
            return currentId !== lastId && (currentId || lastId)
          })
          
          // Check if path segment (ID) changed
          const pathIdChanged = currentPathname !== lastPathname
          
          // If ID changed, replace the last item
          if (queryIdChanged || pathIdChanged) {
            const label = generateLabel(pathname, searchParams)
            const updatedItem: HistoryItem = {
              path: fullPath,
              label,
              timestamp: Date.now()
            }
            
            const newHistory: NavigationHistory = {
              items: [...history.items.slice(0, -1), updatedItem]
            }
            setHistory(newHistory)
            saveHistory(newHistory)
            previousPathRef.current = fullPath
            return
          }
        }
        // CASE 3: /chat?id=1 → /chat?id=2 (same depth, query param change)
        // same segments count, query param changed = REPLACE last item
        else if (currentPathInfo.segments === lastPathInfo.segments) {
          // Check query params
          const currentParams = new URLSearchParams(fullPath.split('?')[1] || '')
          const lastParams = new URLSearchParams(lastItem.path.split('?')[1] || '')
          
          // Check if only query param changed
          const paramChangedOnly = currentPathname === lastPathname;
                                 
          if (paramChangedOnly) {
            const label = generateLabel(pathname, searchParams)
            const updatedItem: HistoryItem = {
              path: fullPath,
              label,
              timestamp: Date.now()
            }
            
            const newHistory: NavigationHistory = {
              items: [...history.items.slice(0, -1), updatedItem]
            }
            setHistory(newHistory)
            saveHistory(newHistory)
            previousPathRef.current = fullPath
            return
          }
          
          // Common ID parameter names that indicate selection change
          const idParams = ['id', 'agentId', 'conversationId', 'leadId', 'segmentId', 'campaignId', 'experimentId', 'requirementId', 'contentId', 'saleId', 'robotId', 'instance']
          
          // Check if any ID parameter in query changed
          const queryIdChanged = idParams.some(param => {
            const currentId = currentParams.get(param)
            const lastId = lastParams.get(param)
            return currentId !== lastId && (currentId || lastId)
          })
          
          // CRITICAL: Prevent adding new history items when only the 'tab' parameter changes
          // e.g. dashboard?tab=overview -> dashboard?tab=traffic
          const tabChangedOnly = !queryIdChanged && 
                                currentParams.get('tab') !== lastParams.get('tab');
          
          // If only tab changed, just replace the last item to update URL without growing breadcrumb
          if (tabChangedOnly) {
            const label = generateLabel(pathname, searchParams)
            const updatedItem: HistoryItem = {
              path: fullPath,
              label,
              timestamp: Date.now()
            }
            
            const newHistory: NavigationHistory = {
              items: [...history.items.slice(0, -1), updatedItem]
            }
            setHistory(newHistory)
            saveHistory(newHistory)
            previousPathRef.current = fullPath
            return
          }
          
          // If query param changed, replace the last item
          if (queryIdChanged) {
            const label = generateLabel(pathname, searchParams)
            const updatedItem: HistoryItem = {
              path: fullPath,
              label,
              timestamp: Date.now()
            }
            
            const newHistory: NavigationHistory = {
              items: [...history.items.slice(0, -1), updatedItem]
            }
            setHistory(newHistory)
            saveHistory(newHistory)
            previousPathRef.current = fullPath
            return
          }
        }
      }
    }
    
    // If we get here, it's a new route - add it to history
    const label = generateLabel(pathname, searchParams)
    const newItem: HistoryItem = {
      path: fullPath,
      label,
      timestamp: Date.now()
    }
    
    const newHistory: NavigationHistory = {
      items: [...history.items, newItem]
    }
    setHistory(newHistory)
    saveHistory(newHistory)
    previousPathRef.current = fullPath
  }, [pathname, searchParams, fullPath, isInitialized, history])
  
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
    const newHistory: NavigationHistory = { items: [] }
    setHistory(newHistory)
    saveHistory(newHistory)
  }, [])
  
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

/**
 * Mark navigation as UI-initiated (call before programmatic navigation)
 * Uses timestamp for reliable detection across re-renders
 */
export function markUINavigation(): void {
  if (typeof window !== 'undefined') {
    const timestamp = Date.now().toString()
    sessionStorage.setItem('uiNavTimestamp', timestamp)
  }
}

/**
 * Navigation helpers - Centralized functions for consistent navigation across the app
 */

interface NavigateToTaskParams {
  taskId: string
  taskTitle: string
  router: any
}

interface NavigateToLeadParams {
  leadId: string
  leadName: string
  router: any
}

interface NavigateToChatParams {
  conversationId?: string
  agentId?: string
  conversationTitle?: string
  agentName?: string
  router: any
}

interface NavigateToControlCenterParams {
  router: any
}

interface NavigateToContentParams {
  contentId: string
  contentTitle: string
  router: any
}

interface NavigateToSegmentParams {
  segmentId: string
  segmentName: string
  router: any
}

interface NavigateToCampaignParams {
  campaignId: string
  campaignName: string
  router: any
}

interface NavigateToAgentParams {
  agentId: string
  agentName: string
  router: any
}

interface NavigateToRequirementParams {
  requirementId: string
  requirementTitle: string
  router: any
}

interface NavigateToExperimentParams {
  experimentId: string
  experimentName: string
  router: any
}

/**
 * Navigate to a task detail page
 * @example navigateToTask({ taskId: '123', taskTitle: 'My Task', router })
 */
export function navigateToTask({ taskId, taskTitle, router }: NavigateToTaskParams): void {
  markUINavigation()
  const encodedTitle = encodeURIComponent(taskTitle)
  router.push(`/control-center/${taskId}?title=${encodedTitle}`)
}

/**
 * Navigate to a lead detail page
 * @example navigateToLead({ leadId: '123', leadName: 'John Doe', router })
 */
export function navigateToLead({ leadId, leadName, router }: NavigateToLeadParams): void {
  markUINavigation()
  const encodedName = encodeURIComponent(leadName)
  router.push(`/leads/${leadId}?name=${encodedName}`)
}

/**
 * Navigate to a content detail page
 * @example navigateToContent({ contentId: '123', contentTitle: 'My Content', router })
 */
export function navigateToContent({ contentId, contentTitle, router }: NavigateToContentParams): void {
  markUINavigation()
  const encodedTitle = encodeURIComponent(contentTitle)
  router.push(`/content/${contentId}?title=${encodedTitle}`)
}

/**
 * Navigate to a segment detail page
 * @example navigateToSegment({ segmentId: '123', segmentName: 'My Segment', router })
 */
export function navigateToSegment({ segmentId, segmentName, router }: NavigateToSegmentParams): void {
  markUINavigation()
  const encodedName = encodeURIComponent(segmentName)
  router.push(`/segments/${segmentId}?name=${encodedName}`)
}

/**
 * Navigate to a campaign detail page
 * @example navigateToCampaign({ campaignId: '123', campaignName: 'My Campaign', router })
 */
export function navigateToCampaign({ campaignId, campaignName, router }: NavigateToCampaignParams): void {
  markUINavigation()
  const encodedName = encodeURIComponent(campaignName)
  router.push(`/campaigns/${campaignId}?name=${encodedName}`)
}

/**
 * Navigate to an agent detail page
 * @example navigateToAgent({ agentId: '123', agentName: 'My Agent', router })
 */
export function navigateToAgent({ agentId, agentName, router }: NavigateToAgentParams): void {
  markUINavigation()
  const encodedName = encodeURIComponent(agentName)
  router.push(`/agents/${agentId}?name=${encodedName}`)
}

/**
 * Navigate to a requirement detail page
 * @example navigateToRequirement({ requirementId: '123', requirementTitle: 'API Integration', router })
 */
export function navigateToRequirement({ requirementId, requirementTitle, router }: NavigateToRequirementParams): void {
  markUINavigation()
  const encodedTitle = encodeURIComponent(requirementTitle)
  router.push(`/requirements/${requirementId}?title=${encodedTitle}`)
}

/**
 * Navigate to an experiment detail page
 * @example navigateToExperiment({ experimentId: '123', experimentName: 'A/B Test', router })
 */
export function navigateToExperiment({ experimentId, experimentName, router }: NavigateToExperimentParams): void {
  markUINavigation()
  const encodedName = encodeURIComponent(experimentName)
  router.push(`/experiments/${experimentId}?name=${encodedName}`)
}

/**
 * Navigate to a chat page
 * @example navigateToChat({ conversationId: '123', conversationTitle: 'My Chat', router })
 */
export function navigateToChat({ conversationId, agentId, conversationTitle, agentName, router }: NavigateToChatParams): void {
  markUINavigation()
  const params = new URLSearchParams()
  
  if (conversationId) params.set('id', conversationId)
  if (agentId) params.set('agentId', agentId)
  if (conversationTitle) params.set('title', encodeURIComponent(conversationTitle))
  if (agentName) params.set('agentName', encodeURIComponent(agentName))
  
  const queryString = params.toString()
  router.push(`/chat${queryString ? `?${queryString}` : ''}`)
}

/**
 * Navigate to control center (root)
 * @example navigateToControlCenter({ router })
 */
export function navigateToControlCenter({ router }: NavigateToControlCenterParams): void {
  markUINavigation()
  router.push('/control-center')
}

interface NavigateToDealParams {
  dealId: string
  dealName: string
  router: any
}

/**
 * Navigate to a deal detail page
 * @example navigateToDeal({ dealId: '123', dealName: 'Acme Corp Deal', router })
 */
export function navigateToDeal({ dealId, dealName, router }: NavigateToDealParams): void {
  markUINavigation()
  const encodedName = encodeURIComponent(dealName)
  router.push(`/deals/${dealId}?name=${encodedName}`)
}
