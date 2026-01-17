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
    console.log('🟢 isRootRoute check:', { fullPath, pathname, hasParams, result: false, reason: 'has query params' })
    return false
  }
  
  // Count path segments (excluding empty strings)
  const segments = pathname.split('/').filter(Boolean)
  
  // Root route = only one segment (e.g., /content, /chat, /leads)
  // NOT root = multiple segments (e.g., /content/123, /control-center/abc)
  const isRoot = segments.length <= 1
  
  console.log('🟢 isRootRoute check:', { 
    fullPath, 
    pathname, 
    segments: segments.length,
    segmentsList: segments,
    isRoot,
    reason: isRoot ? 'single segment, no params' : 'multiple segments'
  })
  
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
    
    console.log('⏱️ Timestamp check (priority):', {
      timestamp,
      timeDiff,
      isUINav,
      result: isUINav ? 'UI NAVIGATION ✅' : 'expired timestamp'
    })
    
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
      
      console.log('🔍 Navigation API detection:', {
        type: navType,
        referrer: document.referrer,
        hasSameOriginReferrer,
        isReload,
        willTrustReload: isReload && !hasSameOriginReferrer
      })
      
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
  
  // Method 3: Final fallback - check referrer
  console.log('📍 Final referrer check:', {
    referrer: document.referrer,
    origin: window.location.origin,
    hasSameOrigin: document.referrer.includes(window.location.origin)
  })
  
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
  
  // Initialize history from localStorage on mount
  useEffect(() => {
    const loadedHistory = loadHistory()
    console.log('🔄 Initializing navigation history from localStorage:', {
      loadedItemsCount: loadedHistory.items.length,
      items: loadedHistory.items.map(i => ({ path: i.path, label: i.label }))
    })
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
    
    console.log('🔵 Navigation detected:', {
      fullPath,
      pathname,
      hasQuery: fullPath.includes('?'),
      isRoot,
      isDirect,
      currentHistoryLength: history.items.length
    })
    
    // Handle root routes (base routes without IDs like /leads, /content)
    if (isRoot) {
      // If it's UI navigation (coming from another page in the app)
      // Reset breadcrumb and start with this new base route
      if (!isDirect) {
        console.log('🔵 Root route via UI navigation - Starting fresh breadcrumb')
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
        console.log('🔴 Direct navigation to root with no history - Resetting breadcrumb')
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
      console.log('💾 Direct navigation to root with existing history - Preserving')
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
      
      console.log('🟠 Direct navigation detected:', { 
        fullPath, 
        hasExistingHistory,
        willReset: !hasExistingHistory
      })
      
      // If there's NO existing history, this is a fresh direct entry (typed URL or external link)
      // Reset breadcrumb to start fresh
      if (!hasExistingHistory) {
        console.log('🔴 No existing history - starting fresh')
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
      console.log('💾 Preserving existing history on reload:', {
        historyLength: history.items.length,
        items: history.items.map(i => i.label)
      })
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
      console.log('🧹 Cleaned up UI navigation timestamp')
    }
    
    // FIRST: Check if this route already exists in history (navigation back to previous page)
    const existingIndex = history.items.findIndex(item => item.path === fullPath)
    
    if (existingIndex !== -1) {
      // Navigate back to existing item (remove items after it)
      console.log('🔵 Existing route found in history at index', existingIndex, '- navigating back')
      console.log('   Current history:', history.items.map(i => i.label))
      console.log('   Will keep only:', history.items.slice(0, existingIndex + 1).map(i => i.label))
      
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
    const lastItem = history.items[history.items.length - 1]
    
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
      
      console.log('🔍 Path comparison:', {
        current: { path: currentPathname, ...currentPathInfo },
        last: { path: lastPathname, ...lastPathInfo }
      })
      
      // If base path is the same, check if we should replace or add
      if (currentPathInfo.basePath === lastPathInfo.basePath) {
        // CASE 1: /leads → /leads/id (list to detail)
        // last has NO ID, current has ID = ADD new item
        if (!lastPathInfo.hasId && currentPathInfo.hasId) {
          console.log('✅ Navigating from list to detail - ADDING base + detail to breadcrumb')
          
          // First, ensure the base route is in history
          const baseLabel = generateLabel(lastPathname, null)
          const baseExists = history.items.some(item => item.path === lastPathname)
          
          if (!baseExists) {
            // Add the base route first (e.g., "Leads")
            console.log('📍 Adding base route to breadcrumb:', baseLabel)
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
            console.log('🟡 ID changed in same detail view (path segments) - REPLACING last item')
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
          
          // Common ID parameter names that indicate selection change
          const idParams = ['id', 'agentId', 'conversationId', 'leadId', 'segmentId', 'campaignId', 'experimentId', 'requirementId', 'contentId', 'saleId', 'robotId', 'instance']
          
          // Check if any ID parameter in query changed
          const queryIdChanged = idParams.some(param => {
            const currentId = currentParams.get(param)
            const lastId = lastParams.get(param)
            return currentId !== lastId && (currentId || lastId)
          })
          
          // If query param changed, replace the last item
          if (queryIdChanged) {
            console.log('🟡 ID changed in same level (query params) - REPLACING last item')
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
    console.log('🟢 Adding new item to breadcrumb:', { 
      currentPath: fullPath,
      currentHistoryLength: history.items.length 
    })
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
    console.log('✅ Breadcrumb updated:', { 
      newHistoryLength: newHistory.items.length,
      items: newHistory.items.map(i => ({ path: i.path, label: i.label }))
    })
    
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
    console.log('✅ UI Navigation marked with timestamp:', timestamp)
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
