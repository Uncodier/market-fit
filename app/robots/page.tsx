"use client"

import React, { useState, useEffect, useLayoutEffect, Suspense, useCallback, useRef, useMemo } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Settings, Globe, Target, Pause, Play, X, Plus, MoreHorizontal, ExternalLink, RotateCw, Loader, Monitor, Laptop, Tablet, Smartphone, Folder, Download, Archive, PanelRightClose, PanelRightOpen } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/app/components/ui/dropdown-menu"
import { useLayout } from "@/app/context/LayoutContext"
import { useSite } from "@/app/context/SiteContext"
import { useRobots } from "@/app/context/RobotsContext"
import { SimpleMessagesView } from "@/app/components/simple-messages-view"
import { RobotsPageSkeleton } from "@/app/components/skeletons/robots-page-skeleton"
import { BrowserSkeleton } from "@/app/components/skeletons/browser-skeleton"
import { DeleteRobotModal } from "@/app/components/robots/DeleteRobotModal"
import { InstanceBrowserModal } from "@/app/components/robots/InstanceBrowserModal"
import { createClient } from "@/lib/supabase/client"
import { LoadingSkeleton } from "@/app/components/ui/loading-skeleton"
import { ZipViewer } from '@/app/components/simple-messages-view/components/ZipViewer'
import { ImprentaPanel } from '@/app/components/agents/imprenta-panel'
import "@/app/styles/iframe-containment.css"
import { useRequirementStatus } from "@/app/components/simple-messages-view/hooks/useRequirementStatus"
import { useIframeUrl } from "@/app/hooks/use-iframe-url"

// Robot interface
interface Robot {
  id: string;
  name: string;
  description: string;
  type: "automation" | "integration" | "workflow" | "scheduler";
  status: "active" | "inactive" | "error" | "pending";
  lastRun?: string;
  nextRun?: string;
  runs: number;
  successRate: number;
}

// Helper to sort instances: 'play' status first, then by updated_at descending
const sortInstances = (instances: any[]) => {
  return [...instances].sort((a, b) => {
    const playStatuses = ['running', 'active', 'starting', 'pending', 'initializing'];
    const aIsPlay = playStatuses.includes(a.status) ? 1 : 0;
    const bIsPlay = playStatuses.includes(b.status) ? 1 : 0;
    
    if (aIsPlay !== bIsPlay) {
      return bIsPlay - aIsPlay;
    }
    
    const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
    const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
    return bTime - aTime;
  });
};

// Wrapper component for Suspense  
export default function RobotsPage() {
  return (
    <Suspense fallback={<RobotsPageSkeleton />}>
      <RobotsPageContent />
    </Suspense>
  )
}

// Main content component
function RobotsPageContent() {
  const { isLayoutCollapsed, robotsViewMode, setRobotsViewMode } = useLayout()
  const { currentSite, refreshSites } = useSite()
  const { getAllInstances, getInstanceById, refreshRobots, isLoading: isLoadingRobots, refreshCount, setAutoRefreshEnabled } = useRobots()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const viewMode = robotsViewMode
  
  // Verify subscription on re-entry
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Refresh site data to check subscription status
        refreshSites()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleVisibilityChange)
    }
  }, [refreshSites])

  // Legacy bookmarks used ?mode= — sync to context, then strip (no mode in URL anymore)
  useEffect(() => {
    if (pathname !== "/robots") return
    const raw = searchParams.get("mode")
    if (!raw) return
    if (raw === "imprenta") setRobotsViewMode("imprenta")
    if (raw === "agent") setRobotsViewMode("agent")
    const p = new URLSearchParams(searchParams.toString())
    p.delete("mode")
    const q = p.toString()
    router.replace(q ? `/robots?${q}` : "/robots", { scroll: false })
  }, [pathname, searchParams, router, setRobotsViewMode])
  
  // No campaigns view here

  // Local state for tracking selected instance without URL navigation
  const [localSelectedInstanceId, setLocalSelectedInstanceId] = useState<string | null>(null)
  const [shouldAutoConvertTab, setShouldAutoConvertTab] = useState(false)
  const [pendingInstanceId, setPendingInstanceId] = useState<string | null>(null)
  
  // Force component refresh when site changes
  const [siteChangeKey, setSiteChangeKey] = useState(0)
  
  // 🆕 Show reload message in sticky header
  const [showReloadMessage, setShowReloadMessage] = useState(false)
  
  // 🆕 Force loading state when entering component or changing site
  const [forceLoading, setForceLoading] = useState(true)
  
  const [isBrowserModalOpen, setIsBrowserModalOpen] = useState(false)
  const [isChatHidden, setIsChatHidden] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [viewportSize, setViewportSize] = useState<'imac' | 'macbook' | 'ipad' | 'iphone'>('imac')
  const [scale, setScale] = useState(1)
  const prevSiteIdRef = useRef<string | null>(null)
  
  // Simplified site change handling - only reset when site actually changes
  useEffect(() => {
    const siteId = currentSite?.id
    if (siteId && siteId !== prevSiteIdRef.current) {
      
      // Only reset when site actually changes
      setLocalSelectedInstanceId(null)
      setPendingInstanceId(null)
      setShouldAutoConvertTab(false)
      setSiteChangeKey(prev => prev + 1)
      
      // Refresh robots for new site
      refreshRobots(siteId)
      
      prevSiteIdRef.current = siteId
    }
  }, [currentSite?.id, refreshRobots])

  // 🆕 Wait for site context to be fully synchronized before proceeding
  const [isSiteContextReady, setIsSiteContextReady] = useState(false)
  
  useEffect(() => {
    // 🆕 Homologated site ID validation (same pattern as RobotsProvider)
    const siteId = currentSite?.id
    if (siteId) {
      // Add a small delay to ensure site context is fully synchronized
      const syncTimer = setTimeout(() => {
        setIsSiteContextReady(true)
      }, 100) // 100ms delay to ensure synchronization
      
      return () => clearTimeout(syncTimer)
    } else {
      setIsSiteContextReady(false)
    }
  }, [currentSite?.id])

  // Simplified initial loading - clear forceLoading after robots are loaded
  useEffect(() => {
    if (!isLoadingRobots && forceLoading) {
      setForceLoading(false)
    }
  }, [isLoadingRobots, forceLoading])

  // Instance selection via URL param
  const selectedInstanceParam = searchParams.get('instance')
  const allInstances = useMemo(() => getAllInstances(), [getAllInstances])

  const tabInstances = allInstances

  // Use local state if available, otherwise fall back to URL param, then default to "new" or first instance
  // Validate that the selected instance actually exists to avoid using deleted instances
  let selectedInstanceId =
    localSelectedInstanceId ||
    selectedInstanceParam ||
    (allInstances.length > 0 ? allInstances[0].id : "new")
  
  // If selectedInstanceId is from URL param, verify it still exists
  if (selectedInstanceId && selectedInstanceId !== 'new' && !localSelectedInstanceId) {
    const instanceExists = allInstances.some(inst => inst.id === selectedInstanceId)
    if (!instanceExists) {
      // Selected instance no longer exists (was deleted), use first available (sorted by updated_at)
      if (allInstances.length > 0) {
        const sortedInstances = sortInstances(allInstances)
        selectedInstanceId = sortedInstances[0].id
      } else {
        selectedInstanceId = 'new'
      }
    }
  }
  
  // Get instance without site filtering
  const activeRobotInstance = selectedInstanceId !== 'new' ? getInstanceById(selectedInstanceId) : null

  // Update page title based on selected instance
  useEffect(() => {
    let title = 'Agents';
    if (activeRobotInstance) {
      if ((activeRobotInstance as any).requirement_title) {
        title = (activeRobotInstance as any).requirement_title;
      } else {
        title = activeRobotInstance.name || `ag-${activeRobotInstance.id.slice(-4)}`;
      }
    }
    
    // Use timeout to ensure this runs after navigation history updates its label
    const timer = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('breadcrumb:update', { 
        detail: { title } 
      }));
    }, 50);
    
    return () => {
      clearTimeout(timer);
    }
  }, [activeRobotInstance]);

  // Clean up title on unmount
  useEffect(() => {
    return () => {
      window.dispatchEvent(new CustomEvent('breadcrumb:update', { 
        detail: { title: null } 
      }));
    }
  }, []);

  // Activity param for controlling explorer visibility
  const activityParam = searchParams.get('activity')
  const isActivityRobot = activityParam === 'robot'
  const [isResuming, setIsResuming] = useState(false)
  
  const activeTabRef = useRef(selectedInstanceId)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [instanceToDelete, setInstanceToDelete] = useState<{ id: string; name: string } | null>(null)
  const [deletingInstanceIds, setDeletingInstanceIds] = useState<Set<string>>(new Set())
  
  // Refs and state for responsive tabs
  const tabsContainerRef = useRef<HTMLDivElement>(null)
  const tabsListRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [maxVisibleTabs, setMaxVisibleTabs] = useState(Infinity)
  const [hasMessageBeenSent, setHasMessageBeenSent] = useState(false)
  const [isAutoCreatingInstance, setIsAutoCreatingInstance] = useState(false)
  const [lastAutoCreationAttempt, setLastAutoCreationAttempt] = useState<number>(0)

  // Reset hasMessageBeenSent when there's no active robot instance
  useEffect(() => {
    if (!activeRobotInstance) {
      setHasMessageBeenSent(false)
    }
  }, [activeRobotInstance])

  // No activity tabs anymore

  // Note: Polling logic removed - RobotsContext handles robot state management

  // Note: Robot events are now handled by the RobotsContext automatically
  // No need for manual event listeners here

    // Note: Auto-creation of placeholder instances removed
  // startRobot and assistant already create instances when needed

  // Update ref when selected instance changes
  useEffect(() => {
    activeTabRef.current = selectedInstanceId
  }, [selectedInstanceId])

  // Reset connection state when site changes (simplified - main logic is in mount effect)
  useEffect(() => {
    const newSiteId = currentSite?.id || null
    if (newSiteId && newSiteId !== prevSiteIdRef.current) {
      
      // Reset connection state only
      setIsResuming(false)
      setIsAutoCreatingInstance(false)
      
      prevSiteIdRef.current = newSiteId
    }
  }, [currentSite?.id])

  // Function to check if instances exist in database (bypassing state)
  const checkInstancesExistInDB = useCallback(async (siteId: string): Promise<boolean> => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('remote_instances')
        .select('id', { count: 'exact', head: true })
        .eq('site_id', siteId)
        .limit(1)
      
      if (error) {
        console.error('Error checking instances in DB:', error)
        return true // Assume instances exist on error to prevent false creation
      }
      
      return (data && data.length > 0)
    } catch (error) {
      console.error('Error in checkInstancesExistInDB:', error)
      return true // Assume instances exist on error
    }
  }, [])

  // Auto-create instance when no instances exist after successful load
  useEffect(() => {
    // 🆕 Only proceed if site context is ready
    if (!isSiteContextReady) {
      return
    }
    
    // Only run this logic if:
    // 1. We're not loading robots anymore
    // 2. We have a current site
    // 3. There are no instances
    // 4. We're not already in the process of creating an instance
    // 5. We're not in the middle of auto-converting a tab
    // 6. We're not already auto-creating an instance
    // 7. We have successfully loaded robots at least once (not just initial loading)
    // 8. We haven't attempted auto-creation recently (debouncing)
    const hasSuccessfullyLoaded = refreshCount > 0
    const now = Date.now()
    const timeSinceLastAttempt = now - lastAutoCreationAttempt
    const debounceDelay = 5000 // 5 seconds debounce
    
    if (!isLoadingRobots && 
        currentSite?.id && 
        getAllInstances().length === 0 && 
        !shouldAutoConvertTab && 
        !pendingInstanceId && 
        !isAutoCreatingInstance &&
        hasSuccessfullyLoaded &&
        timeSinceLastAttempt > debounceDelay) {
      
      
      // CRITICAL: Double-check database before auto-creating
      checkInstancesExistInDB(currentSite.id).then((instancesExist) => {
        if (instancesExist) {
          setIsAutoCreatingInstance(false)
          return
        }
        
        
        // Set flag to prevent multiple creations and record attempt timestamp
        setIsAutoCreatingInstance(true)
        setLastAutoCreationAttempt(Date.now())
        
        // Create a new instance automatically
        createPlaceholderInstance().then((newInstance) => {
          if (newInstance) {
            // Refresh robots to get the new instance
            refreshRobots(currentSite?.id).then(() => {
              // Select the new instance
              setLocalSelectedInstanceId(newInstance.id)
              setPendingInstanceId(newInstance.id)
              setShouldAutoConvertTab(true)
              
              // Update URL to reflect the new instance
              const params = new URLSearchParams(searchParams.toString())
              params.set('instance', newInstance.id)
              const displayName = (newInstance as any).requirement_title ? (newInstance as any).requirement_title : (newInstance.name || `ag-${newInstance.id.slice(-4)}`)
              params.set('name', displayName)
              router.replace(`/robots?${params.toString()}`)
              
              // Reset the auto-creating flag after a delay to allow for proper state updates
              setTimeout(() => {
                setIsAutoCreatingInstance(false)
              }, 1000)
            })
          } else {
            // Reset flag if creation failed
            setIsAutoCreatingInstance(false)
          }
        }).catch((error) => {
          console.error('❌ Error auto-creating instance:', error)
          // Reset flag on error
          setIsAutoCreatingInstance(false)
        })
      })
    }
  }, [isLoadingRobots, currentSite?.id, getAllInstances, shouldAutoConvertTab, pendingInstanceId, isAutoCreatingInstance, refreshRobots, searchParams, router, refreshCount, isSiteContextReady, checkInstancesExistInDB])

  // No campaigns effect

  // Detect when pending instance becomes available and convert the tab
  useEffect(() => {
    if (pendingInstanceId && shouldAutoConvertTab && allInstances.length > 0) {
      // Check if the pending instance is now available
      const instanceExists = allInstances.some(inst => inst.id === pendingInstanceId)
      
      if (instanceExists) {
        
        // Transform the "new" tab into the new instance tab
        setLocalSelectedInstanceId(pendingInstanceId)
        setPendingInstanceId(null)
        setShouldAutoConvertTab(false)
        
        // Re-enable auto-refresh after conversion
        setAutoRefreshEnabled(true)
        
        // Don't update URL immediately - let the local state handle the selection
        // The URL will be updated when the user manually navigates or when the component unmounts
      }
    }
  }, [pendingInstanceId, shouldAutoConvertTab, allInstances, setAutoRefreshEnabled])

  // Derive instance status flags
  const isInstanceStarting = !!(activeRobotInstance && ['starting','pending','initializing'].includes((activeRobotInstance as any).status))
  const isInstanceRunning = !!(activeRobotInstance && ['running','active'].includes((activeRobotInstance as any).status))
  const isInstancePausedOrUninstantiated = !!(activeRobotInstance && ['paused','uninstantiated'].includes((activeRobotInstance as any).status))


  // Listen for resume events to immediately show loading on the left explorer
  useEffect(() => {
    const handleResumeStart = (e: any) => {
      if (!activeRobotInstance || e?.detail?.instanceId === (activeRobotInstance as any).id) {
        setIsResuming(true)
      }
    }
    const handleResumeFailed = (e: any) => {
      if (!activeRobotInstance || e?.detail?.instanceId === (activeRobotInstance as any).id) {
        setIsResuming(false)
      }
    }

    window.addEventListener('robot:resume-start', handleResumeStart as any)
    window.addEventListener('robot:resume-failed', handleResumeFailed as any)
    return () => {
      window.removeEventListener('robot:resume-start', handleResumeStart as any)
      window.removeEventListener('robot:resume-failed', handleResumeFailed as any)
    }
  }, [activeRobotInstance && (activeRobotInstance as any).id])


  // Clear forced resume loading once instance transitions to starting/running
  useEffect(() => {
    if (isInstanceStarting || isInstanceRunning) {
      setIsResuming(false)
    }
  }, [isInstanceStarting, isInstanceRunning])

  // Note: Real-time monitoring is now handled by RobotsContext
  // This ensures efficient data sharing across all components

  // Function to create placeholder instance
  const createPlaceholderInstance = async () => {
    if (!currentSite?.id) {
      console.error('❌ Cannot create placeholder: No current site')
      return null
    }
    
    
    try {
      const supabase = createClient()
      
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        console.error('❌ Cannot get current user:', userError)
        return null
      }
      
      const { data, error } = await supabase
        .from('remote_instances')
        .insert({
          site_id: currentSite.id,
          user_id: user.id,
          created_by: user.id,
          name: 'Assistant Session',
          status: 'uninstantiated',
          instance_type: 'ubuntu'
        })
        .select()
        .single()
      
      if (error) {
        console.error('❌ Supabase error creating placeholder instance:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        return null
      }
      
      if (!data) {
        console.error('❌ No data returned from placeholder creation')
        return null
      }
      
      return data
    } catch (error) {
      console.error('❌ Exception creating placeholder instance:', error)
      return null
    }
  }

  // Function to handle creating new instance (button click)
  const handleCreateNewInstance = async () => {
    const newInstance = await createPlaceholderInstance()
    if (newInstance) {
      // Refresh robots to get the new instance
      await refreshRobots(currentSite?.id)
      // Select the new instance
      setLocalSelectedInstanceId(newInstance.id)
      // Update URL to reflect the new instance selection
      const currentParams = new URLSearchParams(searchParams.toString())
      currentParams.set('instance', newInstance.id)
      const displayName = (newInstance as any).requirement_title ? (newInstance as any).requirement_title : (newInstance.name || `ag-${newInstance.id.slice(-4)}`)
      currentParams.set('name', displayName)
      router.replace(`/robots?${currentParams.toString()}`)
    }
  }

  // Function to handle instance tab change
  const handleTabChange = (newInstance: string) => {
    if (newInstance === 'new') {
      // Reset to new makina mode
      setLocalSelectedInstanceId(null)
      const currentParams = new URLSearchParams(searchParams.toString())
      currentParams.set('instance', 'new')
      currentParams.delete('name')
      router.push(`/robots?${currentParams.toString()}`)
    } else {
      // Set the selected instance
      setLocalSelectedInstanceId(newInstance)
      const currentParams = new URLSearchParams(searchParams.toString())
      currentParams.set('instance', newInstance)
      
      const instance = getInstanceById(newInstance)
      if (instance) {
        const displayName = (instance as any).requirement_title ? (instance as any).requirement_title : (instance.name || `ag-${instance.id.slice(-4)}`)
        currentParams.set('name', displayName)
      } else {
        currentParams.delete('name')
      }
      
      router.push(`/robots?${currentParams.toString()}`)
    }
  }

  // Function to handle tab change from overflow menu (hidden tabs)
  // Updates updated_at so the tab moves to the top, and moves last visible to top of hidden
  const handleTabChangeFromOverflow = async (newInstance: string) => {
    if (newInstance === 'new') {
      handleTabChange(newInstance)
      return
    }

    try {
      const supabase = createClient()
      const now = new Date()
      
      // Get current sorted instances to find the last visible one
      const sortedInstances = sortInstances(tabInstances)
      
      const showNewMakinaTab = tabInstances.length === 0 || isLoadingRobots || forceLoading
      const effectiveMaxTabs = showNewMakinaTab ? maxVisibleTabs - 1 : maxVisibleTabs
      const totalTabs = sortedInstances.length
      const needsOverflow = totalTabs > effectiveMaxTabs
      
      // Ensure selected instance is always visible
      const selectedInstanceIndex = sortedInstances.findIndex(inst => inst.id === selectedInstanceId)
      let visibleTabsCount = needsOverflow ? effectiveMaxTabs - 1 : totalTabs
      
      // If selected instance is beyond visible range, adjust to show it
      if (selectedInstanceIndex >= 0 && selectedInstanceIndex >= visibleTabsCount) {
        visibleTabsCount = Math.min(selectedInstanceIndex + 1, effectiveMaxTabs - 1)
      }
      
      const visibleInstances = sortedInstances.slice(0, visibleTabsCount)
      const hiddenInstances = sortedInstances.slice(visibleTabsCount)
      
      // 1. Update selected instance's updated_at to now (moves to first position)
      await supabase
        .from('remote_instances')
        .update({ updated_at: now.toISOString() })
        .eq('id', newInstance)
      
      // 2. If there's a last visible tab, move it to the top of hidden list
      // by setting its updated_at to just before now (but after all other hidden tabs)
      if (visibleInstances.length > 0 && hiddenInstances.length > 0) {
        const lastVisibleInstance = visibleInstances[visibleInstances.length - 1]
        
        // Get the most recent updated_at from hidden instances (excluding the one we just selected)
        const otherHiddenInstances = hiddenInstances.filter(inst => inst.id !== newInstance)
        if (otherHiddenInstances.length > 0) {
          const mostRecentHiddenTime = Math.max(
            ...otherHiddenInstances.map(inst => 
              new Date((inst as any).updated_at || (inst as any).created_at || 0).getTime()
            )
          )
          
          // Set last visible to be just after the most recent hidden (but before now)
          // This puts it at the top of hidden list
          const newTimeForLastVisible = new Date(mostRecentHiddenTime + 1).toISOString()
          
          await supabase
            .from('remote_instances')
            .update({ updated_at: newTimeForLastVisible })
            .eq('id', lastVisibleInstance.id)
        } else {
          // If no other hidden instances, just set it to a time slightly before now
          const timeBeforeNow = new Date(now.getTime() - 1000).toISOString()
          await supabase
            .from('remote_instances')
            .update({ updated_at: timeBeforeNow })
            .eq('id', lastVisibleInstance.id)
        }
      }
      
      // Refresh robots to reflect the updated order
      if (currentSite?.id) {
        await refreshRobots(currentSite.id)
      }
    } catch (error) {
      console.error('Error updating instance updated_at:', error)
    }

    // Then handle the tab change normally
    handleTabChange(newInstance)
  }

  // Function to enable auto-conversion when a new instance is created
  const handleNewInstanceCreated = useCallback((instanceId: string) => {
    // Immediately update local state and URL to reflect the new instance
    setLocalSelectedInstanceId(instanceId)
    // Update URL to reflect the new instance selection
    const currentParams = new URLSearchParams(searchParams.toString())
    currentParams.set('instance', instanceId)
    // We don't have the full instance object here easily, but the title effect will catch it
    // Still, try to clear the old name
    currentParams.delete('name')
    router.replace(`/robots?${currentParams.toString()}`)
    // Disable auto-refresh to prevent subscription from interfering
    setAutoRefreshEnabled(false)
    // Set the pending instance ID for tab conversion
    setPendingInstanceId(instanceId)
    setShouldAutoConvertTab(true)
  }, [setAutoRefreshEnabled, searchParams, router])

  // Calculate how many tabs can fit based on available width
  // Always calculates - no early returns, uses defaults if measurements aren't ready
  const calculateMaxVisibleTabs = useCallback(() => {
    // If container ref is available, its width is much more reliable
    const containerWidth = tabsContainerRef.current?.clientWidth || 0
    const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 0
    
    if (windowWidth === 0) {
      setMaxVisibleTabs(Infinity)
      return
    }
    
    // Calculate sidebar width based on collapsed state
    const sidebarWidth = isLayoutCollapsed ? 64 : 256 // w-16 = 64px, w-64 = 256px
    
    // Calculate available width: window width minus sidebar, margins (px-4 = 16px, px-8 = 32px)
    // Mobile: px-4 (16px * 2 = 32px)
    // Desktop: px-16 (64px * 2 = 128px) -> now px-8 (32px * 2 = 64px)
    const horizontalMargins = windowWidth >= 1024 ? 64 : 32
    
    const gapBetweenElements = 8 // gap-2 = 8px
    const plusButtonWidth = 44 // Approximate width of Plus button (h-9 with padding and shrink-0)
    const moreButtonWidth = 80 // Approximate width of "..." button (needs to fit icon + up to 3 digits)
    
    // Fixed estimated width to prevent oscillation loops during resize
    // We use a conservative average width for robot tabs
    // Note: tab max-w is 120px + 24px padding = 144px. So we use 150px to be safe.
    const estimatedTabWidth = 150
    
    // Calculate available width: 
    // Prefer actual container width if available (> 0), otherwise fallback to window width calculation
    const baseAvailableWidth = containerWidth > 0 
      ? containerWidth 
      : (windowWidth - sidebarWidth - horizontalMargins)
      
    const availableWidth = baseAvailableWidth - gapBetweenElements - plusButtonWidth - gapBetweenElements - moreButtonWidth - 16 // 16px extra buffer
    
    // Calculate how many tabs can fit (we already subtracted moreButtonWidth above)
    // We force at least 1 tab to be visible.
    const calculatedTabs = Math.floor(availableWidth / estimatedTabWidth)
    // Reduce max tabs by 1 to make sure we always have enough space and don't overflow
    const maxTabs = calculatedTabs > 0 ? calculatedTabs : 1
    
    // Always show at least 1 tab if there are instances
    const finalMaxTabs = maxTabs
    
    // Only update if value changed to prevent render loops
    setMaxVisibleTabs(prev => prev !== finalMaxTabs ? finalMaxTabs : prev)
    setContainerWidth(prev => prev !== windowWidth ? windowWidth : prev)
  }, [selectedInstanceId, isLayoutCollapsed])

  // Use ResizeObserver to track container width changes
  useEffect(() => {
    let resizeObserver: ResizeObserver | null = null;
    let timeoutId: NodeJS.Timeout | undefined;
    let resizeTimeout: NodeJS.Timeout | undefined;
    
    const observe = () => {
      if (!tabsContainerRef.current) {
        timeoutId = setTimeout(observe, 100);
        return;
      }

      // Initial calculation
      calculateMaxVisibleTabs();

      resizeObserver = new ResizeObserver(() => {
        if (resizeTimeout) {
          clearTimeout(resizeTimeout);
        }
        resizeTimeout = setTimeout(() => {
          calculateMaxVisibleTabs();
        }, 150);
      });

      resizeObserver.observe(tabsContainerRef.current);
    };
    
    observe();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (resizeTimeout) clearTimeout(resizeTimeout);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [calculateMaxVisibleTabs, tabInstances.length, isLayoutCollapsed, selectedInstanceId]);

  const { requirementStatuses } = useRequirementStatus(activeRobotInstance)
  
  const [showSourceCodePreview, setShowSourceCodePreview] = useState(false)
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)
  useEffect(() => {
    const handleToggle = () => setShowSourceCodePreview(prev => !prev)
    window.addEventListener('robot:toggle-source-code', handleToggle)
    return () => window.removeEventListener('robot:toggle-source-code', handleToggle)
  }, [])

  // Use a stable reference that only computes when requirementStatuses changes
  const latestPreviewUrl = useMemo(() => {
    if (!requirementStatuses || requirementStatuses.length === 0) return null;
    
    // Find the most recent requirement_status that has a preview
    for (let i = requirementStatuses.length - 1; i >= 0; i--) {
      const status = requirementStatuses[i];
      if (status.preview_url) {
        return status.preview_url;
      }
      // Fallback: If no preview_url but repo_url points to a zip file in Supabase
      if (!status.preview_url && status.repo_url && (status.repo_url.endsWith('.zip') || status.repo_url.includes('.zip?'))) {
        return status.repo_url;
      }
      // Fallback: Check source_code if it points to a zip
      if (!status.preview_url && status.source_code && (status.source_code.endsWith('.zip') || status.source_code.includes('.zip?'))) {
        return status.source_code;
      }
    }
    
    return null;
  }, [requirementStatuses, currentSite?.id]);

  const latestSourceCodeUrl = useMemo(() => {
    if (!requirementStatuses || requirementStatuses.length === 0) return null;
    
    // Find the most recent requirement_status that has source_code
    for (let i = requirementStatuses.length - 1; i >= 0; i--) {
      const status = requirementStatuses[i];
      if (status.source_code) {
        return status.source_code;
      }
      if (!status.source_code && status.repo_url && (status.repo_url.endsWith('.zip') || status.repo_url.includes('.zip?'))) {
        return status.repo_url;
      }
      if (!status.source_code && status.preview_url && (status.preview_url.endsWith('.zip') || status.preview_url.includes('.zip?'))) {
        return status.preview_url;
      }
    }
    
    return null;
  }, [requirementStatuses]);

  // So the iframe remounts when the preview row is updated in DB, even if the URL string is unchanged
  const requirementPreviewFrameKey = useMemo(() => {
    if (!requirementStatuses || requirementStatuses.length === 0) return "none"
    for (let i = requirementStatuses.length - 1; i >= 0; i--) {
      const s = requirementStatuses[i]
      const hasPreview =
        s.preview_url ||
        (s.repo_url &&
          (s.repo_url.endsWith(".zip") || s.repo_url.includes(".zip?"))) ||
        (s.source_code &&
          (s.source_code.endsWith(".zip") || s.source_code.includes(".zip?")))
      if (hasPreview) {
        return `${(s as { id?: string }).id ?? "row"}-${(s as { updated_at?: string; created_at?: string }).updated_at ?? (s as { created_at?: string }).created_at ?? i}`
      }
    }
    return "none"
  }, [requirementStatuses, currentSite?.id])

  // Preview pane should only appear when we actually have a preview URL
  // (preview_url / zip fallback from requirement_status). Running-instance-based
  // visibility is intentionally disabled; flip the flag below to restore the
  // previous behavior without removing logic.
  const SHOW_PREVIEW_FOR_RUNNING_INSTANCE = false

  // Compute if browser should be visible
  const isBrowserVisible = Boolean(
    (!!latestPreviewUrl || !!latestSourceCodeUrl) &&
    !pendingInstanceId &&
    viewMode !== 'imprenta'
  )

  const rawActiveUrlToDisplay = showSourceCodePreview 
    ? (latestSourceCodeUrl || latestPreviewUrl || "about:blank")
    : (latestPreviewUrl || latestSourceCodeUrl || "about:blank")
  const isZipUrl = typeof rawActiveUrlToDisplay === 'string' && (
    rawActiveUrlToDisplay.endsWith('.zip') || 
    rawActiveUrlToDisplay.includes('.zip?') ||
    rawActiveUrlToDisplay.endsWith('.tar.gz') ||
    rawActiveUrlToDisplay.includes('.tar.gz?')
  )

  const activeUrlToDisplay = useMemo(() => {
    return rawActiveUrlToDisplay;
  }, [rawActiveUrlToDisplay]);

  const { displayUrl: displayedIframeUrl, iframeSrc, handleIframeLoad } = useIframeUrl(iframeRef, activeUrlToDisplay)

  // Calculate scale based on container width and selected viewport
  const calculateScale = useCallback(() => {
    if (!containerRef.current) return;
    
    const containerWidth = containerRef.current.clientWidth;
    if (containerWidth === 0) return; // Not fully rendered yet
    
    let targetWidth = 100;
    const effectiveViewport = isZipUrl ? 'macbook' : viewportSize;
    
    switch(effectiveViewport) {
      case 'imac': targetWidth = 1920; break;
      case 'macbook': targetWidth = 1440; break;
      case 'ipad': targetWidth = 810; break;
      case 'iphone': targetWidth = 390; break;
    }
    
    const availableWidth = containerWidth;
    
    if (targetWidth > availableWidth) {
      setScale(availableWidth / targetWidth);
    } else {
      setScale(1);
    }
  }, [viewportSize, isZipUrl]);

  // Initial calculation and ResizeObserver
  useEffect(() => {
    // Run an initial calculation immediately
    calculateScale();
    
    if (!containerRef.current) return;
    
    const observer = new ResizeObserver(() => {
      calculateScale();
    });
    
    observer.observe(containerRef.current);
    
    // Also try to recalculate after a slight delay to catch late renders
    const timeoutId = setTimeout(calculateScale, 100);
    const timeoutId2 = setTimeout(calculateScale, 500); // add another one just in case
    const timeoutId3 = setTimeout(calculateScale, 1500); // and another
    
    return () => {
      observer.disconnect();
      clearTimeout(timeoutId);
      clearTimeout(timeoutId2);
      clearTimeout(timeoutId3);
    };
  }, [calculateScale, isBrowserVisible]);

  return (
    <div className={`flex flex-col h-full w-full ${viewMode === 'imprenta' ? 'overflow-visible' : 'overflow-hidden'} relative`}>
      <StickyHeader key={`${currentSite?.id}-${siteChangeKey}`} className="flex-none transition-all duration-300">
        <div className="pt-0 w-full overflow-hidden">
          <div className="flex items-center gap-4 w-full">
            <div className="flex items-center w-full min-w-0" ref={tabsContainerRef}>
              <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
                <Tabs key={`tabs-${currentSite?.id}-${siteChangeKey}`} value={selectedInstanceId} onValueChange={handleTabChange} className="flex-1 min-w-0">
                  <TabsList ref={tabsListRef} className="flex flex-nowrap justify-start w-full overflow-hidden">
                    {/* Show New Agent tab if no instances or while loading */}
                    {(tabInstances.length === 0 || isLoadingRobots || forceLoading) && (
                      <TabsTrigger value="new">
                        <span className="flex items-center gap-2 whitespace-nowrap truncate max-w-[120px]">
                          <Plus className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="truncate">New Agent</span>
                        </span>
                      </TabsTrigger>
                    )}
                    
                    {/* Show instances with responsive overflow */}
                    {(() => {
                      // Sort instances by updated_at descending (most recently updated first)
                      const sortedInstances = sortInstances(tabInstances)
                      
                      // Calculate how many tabs to show
                      const showNewMakinaTab = tabInstances.length === 0 || isLoadingRobots || forceLoading
                      // Account for "New Agent" tab in maxVisibleTabs if it's shown
                      const effectiveMaxTabs = showNewMakinaTab ? maxVisibleTabs - 1 : maxVisibleTabs
                      const totalTabs = sortedInstances.length
                      const needsOverflow = totalTabs > effectiveMaxTabs
                      
                      // Ensure selected instance is always visible
                      const selectedInstanceIndex = sortedInstances.findIndex(inst => inst.id === selectedInstanceId)
                      let visibleTabsCount = needsOverflow ? effectiveMaxTabs - 1 : totalTabs
                      
                      // If selected instance is beyond visible range, adjust to show it
                      if (selectedInstanceIndex >= 0 && selectedInstanceIndex >= visibleTabsCount) {
                        visibleTabsCount = Math.min(selectedInstanceIndex + 1, effectiveMaxTabs - 1)
                      }
                      
                      const visibleInstances = sortedInstances.slice(0, visibleTabsCount)
                      const hiddenInstances = sortedInstances.slice(visibleTabsCount)
                      
                      return (
                        <>
                          {visibleInstances.map((inst) => {
                            const isDeletingInstance = deletingInstanceIds.has(inst.id)
                            return (
                            <TabsTrigger key={`${inst.id}-${siteChangeKey}`} value={inst.id}>
                              <span className="flex items-center gap-2 max-w-[120px]">
                                {(() => {
                                  const status = (inst as any).status;
                                  const isRunning = ['running','active'].includes(status);
                                  const isPaused = ['paused'].includes(status);
                                  const isStarting = ['starting','pending','initializing'].includes(status);
                                  
                                  const isActiveState = isRunning || isStarting;
                                  
                                  return (
                                    <span 
                                      className="cursor-pointer hover:opacity-80 flex items-center justify-center w-4 h-4 flex-shrink-0"
                                      onClick={async (e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        try {
                                          const supabase = createClient();
                                          const newInstanceStatus = isActiveState ? 'paused' : 'running';
                                          
                                          // 1. Actualizar instancia
                                          await supabase
                                            .from('remote_instances')
                                            .update({ status: newInstanceStatus, updated_at: new Date().toISOString() })
                                            .eq('id', inst.id);
                                            
                                          // 2. Actualizar planes
                                          if (isActiveState) {
                                            const { data: plans } = await supabase
                                              .from('instance_plans')
                                              .select('id')
                                              .eq('instance_id', inst.id)
                                              .in('status', ['in_progress', 'pending']);
                                            if (plans && plans.length > 0) {
                                              await supabase
                                                .from('instance_plans')
                                                .update({ status: 'paused', updated_at: new Date().toISOString() })
                                                .in('id', plans.map(p => p.id));
                                            }
                                          } else {
                                            const { data: plans } = await supabase
                                              .from('instance_plans')
                                              .select('id')
                                              .eq('instance_id', inst.id)
                                              .eq('status', 'paused');
                                            if (plans && plans.length > 0) {
                                              await supabase
                                                .from('instance_plans')
                                                .update({ status: 'in_progress', updated_at: new Date().toISOString() })
                                                .in('id', plans.map(p => p.id));
                                            }
                                          }
                                          refreshRobots(currentSite?.id);
                                        } catch (err) {
                                          console.error('Error toggling state from tab icon:', err);
                                        }
                                      }}
                                      title={isActiveState ? "Pausar instancia y plan" : "Reanudar instancia y plan"}
                                    >
                                      {isRunning ? (
                                        <Play className="h-3 w-3 text-green-600" />
                                      ) : isPaused ? (
                                        <Pause className="h-3 w-3 text-yellow-600" />
                                      ) : isStarting ? (
                                        <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                                      ) : (
                                        <span className="w-2 h-2 rounded-full bg-gray-400" />
                                      )}
                                    </span>
                                  );
                                })()}
                                  <span className="truncate">{(inst as any).requirement_title ? (inst as any).requirement_title : (inst.name || `ag-${inst.id.slice(-4)}`)}</span>
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    if (isDeletingInstance) return
                                    setInstanceToDelete({ id: inst.id, name: (inst as any).requirement_title ? (inst as any).requirement_title : (inst.name || `ag-${inst.id.slice(-4)}`) })
                                    setIsDeleteModalOpen(true)
                                  }}
                                  className={`ml-1.5 flex items-center justify-center h-4 w-4 rounded-full transition-colors ${
                                    isDeletingInstance
                                      ? "cursor-default"
                                      : "hover:bg-destructive/10 cursor-pointer"
                                  }`}
                                  title={isDeletingInstance ? "Eliminando..." : "Eliminar conversación"}
                                  role="button"
                                  tabIndex={isDeletingInstance ? -1 : 0}
                                  aria-disabled={isDeletingInstance}
                                  onKeyDown={(e) => {
                                    if (isDeletingInstance) return
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      setInstanceToDelete({ id: inst.id, name: (inst as any).requirement_title ? (inst as any).requirement_title : (inst.name || `ag-${inst.id.slice(-4)}`) })
                                      setIsDeleteModalOpen(true)
                                    }
                                  }}
                                >
                                  {isDeletingInstance ? (
                                    <Loader className="h-3 w-3 text-destructive" size={12} />
                                  ) : (
                                    <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                                  )}
                                </span>
                              </span>
                            </TabsTrigger>
                            )
                          })}
                          
                          {/* Show "..." button when there are hidden tabs */}
                          {needsOverflow && hiddenInstances.length > 0 && (
                            <button
                              type="button"
                              className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-muted/50"
                              onClick={(e) => {
                                e.preventDefault()
                                setIsBrowserModalOpen(true)
                              }}
                            >
                              <span className="flex items-center gap-2">
                                <MoreHorizontal className="h-3 w-3" />
                                <span>{hiddenInstances.length}</span>
                              </span>
                            </button>
                          )}
                        </>
                      )
                    })()}
                  </TabsList>
                </Tabs>
                
                {/* Create new instance button - pegado a los tabs */}
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-9 w-9 shrink-0 rounded-full"
                  onClick={handleCreateNewInstance}
                  title="Create new agent"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </StickyHeader>

      {/* Instance Browser Modal */}
      <InstanceBrowserModal
        isOpen={isBrowserModalOpen}
        onClose={() => setIsBrowserModalOpen(false)}
        instances={tabInstances as any[]}
        onSelect={(id) => handleTabChangeFromOverflow(id)}
        onDelete={(instance) => {
          const displayName = (instance as any).requirement_title ? (instance as any).requirement_title : (instance.name || `ag-${instance.id.slice(-4)}`)
          setInstanceToDelete({ id: instance.id, name: displayName })
          setIsDeleteModalOpen(true)
        }}
        deletingInstanceIds={deletingInstanceIds}
      />

      {/* Delete Confirmation Modal */}
      {instanceToDelete && (
        <DeleteRobotModal
          open={isDeleteModalOpen}
          onOpenChange={(open) => {
            setIsDeleteModalOpen(open)
            if (!open) {
              setInstanceToDelete(null)
            }
          }}
          instanceId={instanceToDelete.id}
          instanceName={instanceToDelete.name}
          onDeleteStart={(id) => {
            setDeletingInstanceIds(prev => {
              const next = new Set(prev)
              next.add(id)
              return next
            })
          }}
          onDeleteError={(id) => {
            setDeletingInstanceIds(prev => {
              if (!prev.has(id)) return prev
              const next = new Set(prev)
              next.delete(id)
              return next
            })
          }}
          onDeleteSuccess={async () => {
            
            // Save the deleted instance ID before clearing state
            const deletedInstanceId = instanceToDelete?.id
            
            // Check if the deleted instance was the active one or was starting
            const wasActiveInstance = activeRobotInstance?.id === deletedInstanceId
            const wasStarting = wasActiveInstance && (isResuming || isInstanceStarting)
            
            
            // Reset robot starting/resuming state if the deleted instance was starting
            if (wasStarting || wasActiveInstance) {
              setIsResuming(false)
            }
            
            // Clear instance to delete
            setInstanceToDelete(null)
            
            // Clear local selection immediately (but don't update URL yet to avoid intermediate state)
            setLocalSelectedInstanceId(null)
            
            try {
              // First refresh robots to get updated instance list (without the deleted one)
              await refreshRobots(currentSite?.id)
              
              // Wait for state to be fully updated - use a retry mechanism
              let currentInstances = getAllInstances()
              let retries = 0
              const maxRetries = 15
              
              // Wait until the deleted instance is confirmed to be removed from the list
              while (retries < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 100))
                currentInstances = getAllInstances()
                
                // Check if the deleted instance is no longer in the list
                const deletedStillExists = deletedInstanceId && currentInstances.some(inst => inst.id === deletedInstanceId)
                
                // Only proceed if deleted instance is confirmed removed OR we have instances
                if (!deletedStillExists) {
                  break
                }
                retries++
              }
              
              // Final check: ensure deleted instance is not in the list
              if (deletedInstanceId && currentInstances.some(inst => inst.id === deletedInstanceId)) {
                console.warn('🗑️ [Delete] WARNING: Deleted instance still in list after retries, filtering it out')
                currentInstances = currentInstances.filter(inst => inst.id !== deletedInstanceId)
              }
              
              // Find the best instance to navigate to - select the first VISIBLE one
              let targetInstanceId = 'new'
              
              if (currentInstances.length > 0) {
                // Sort instances by updated_at descending (most recently updated first)
                // This matches the order used in the tabs
                const sortedInstances = sortInstances(currentInstances)
                
                // Calculate which instances are visible (same logic as in tab rendering)
                const showNewMakinaTab = currentInstances.length === 0 || isLoadingRobots || forceLoading
                const effectiveMaxTabs = showNewMakinaTab ? maxVisibleTabs - 1 : maxVisibleTabs
                const totalTabs = sortedInstances.length
                const needsOverflow = totalTabs > effectiveMaxTabs
                let visibleTabsCount = needsOverflow ? effectiveMaxTabs - 1 : totalTabs
                
                // Get visible instances (first N that fit in visible tabs)
                const visibleInstances = sortedInstances.slice(0, visibleTabsCount)
                
                // Select the first VISIBLE instance (not just first in sorted list)
                if (visibleInstances.length > 0) {
                  targetInstanceId = visibleInstances[0]?.id || 'new'
                } else {
                  // Fallback: if no visible instances (shouldn't happen), select first in list
                  targetInstanceId = sortedInstances[0]?.id || 'new'
                }
                
                // Set local selection and update URL atomically to avoid intermediate state
                setLocalSelectedInstanceId(targetInstanceId)
                
                // Navigate to the selected instance (update URL directly, skipping intermediate state)
                const newParams = new URLSearchParams(searchParams.toString())
                newParams.set('instance', targetInstanceId)
                
                if (targetInstanceId !== 'new') {
                  const targetInstance = currentInstances.find(inst => inst.id === targetInstanceId)
                  if (targetInstance) {
                    const displayName = (targetInstance as any).requirement_title ? (targetInstance as any).requirement_title : (targetInstance.name || `ag-${targetInstance.id.slice(-4)}`)
                    newParams.set('name', displayName)
                  }
                } else {
                  newParams.delete('name')
                }
                
                router.replace(`/robots?${newParams.toString()}`, { scroll: false })
              } else {
                // Prevent auto-create from triggering immediately after delete
                // Update lastAutoCreationAttempt to prevent auto-create for a short period
                setLastAutoCreationAttempt(Date.now())
                // Also set a flag to prevent auto-create during delete process
                setIsAutoCreatingInstance(true)
                // Reset the flag after a delay to allow auto-create to work normally later
                setTimeout(() => {
                  setIsAutoCreatingInstance(false)
                }, 3000) // 3 seconds delay before auto-create can trigger again
                
                // Set local selection and update URL atomically
                setLocalSelectedInstanceId(null)
                const newParams = new URLSearchParams(searchParams.toString())
                newParams.set('instance', 'new')
                newParams.delete('name')
                router.replace(`/robots?${newParams.toString()}`, { scroll: false })
              }
              
            } catch (error) {
              console.error('🗑️ [Delete] Error in delete success callback:', error)
              // Fallback: just navigate to 'new' if something goes wrong
              // Also prevent auto-create in error case
              setLastAutoCreationAttempt(Date.now())
              setIsAutoCreatingInstance(true)
              setTimeout(() => {
                setIsAutoCreatingInstance(false)
              }, 3000)
              
              const params = new URLSearchParams(searchParams.toString())
              params.set('instance', 'new')
              params.delete('name')
              router.replace(`/robots?${params.toString()}`)
            } finally {
              if (deletedInstanceId) {
                setDeletingInstanceIds(prev => {
                  if (!prev.has(deletedInstanceId)) return prev
                  const next = new Set(prev)
                  next.delete(deletedInstanceId)
                  return next
                })
              }
            }
          }}
        />
      )}
      
      <div className={`absolute inset-0 flex flex-col min-h-0 ${viewMode === 'imprenta' ? 'overflow-visible' : 'overflow-hidden'}`}>
        {/* Content area - no pt-[71px] here so it can go under header */}
        <div className={`flex-1 flex flex-col min-h-0 ${viewMode === 'imprenta' ? 'bg-transparent' : 'bg-muted/30'} transition-colors duration-300 ease-in-out ${viewMode === 'imprenta' ? 'overflow-visible' : 'overflow-hidden'}`}>
          <div className={`flex flex-col lg:flex-row flex-1 min-h-0 ${viewMode === 'imprenta' ? 'overflow-visible' : 'overflow-hidden'}`}>
            {isBrowserVisible && (
              <div className={`w-full ${isChatHidden ? 'lg:w-full' : 'lg:w-2/3'} border-b lg:border-b-0 lg:border-r border-border iframe-container flex flex-col shrink-0 h-[calc(40vh+135px)] lg:h-full overflow-hidden relative transition-all duration-300`}>
                <div className={`grid grid-rows-[auto_1fr] m-0 bg-card absolute inset-x-0 bottom-0 top-[135px] overflow-hidden`}>
                  {/* Browser navigation bar */}
                  <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-muted/40">
                    <div className="flex items-center gap-2 flex-1 min-w-0 bg-background/80 border border-border rounded-full px-2.5 py-1">
                      {isZipUrl ? (
                        <>
                          <div className="flex items-center gap-1.5 flex-1 min-w-0 text-xs text-muted-foreground">
                            <Archive className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{activeUrlToDisplay.split('/').pop()?.split('?')[0] || 'source-code.zip'}</span>
                            {selectedFilePath && (
                              <>
                                <span className="text-muted-foreground/30 mx-0.5">/</span>
                                <div className="flex items-center gap-1 truncate">
                                  {selectedFilePath.split('/').map((part, i, arr) => (
                                    <React.Fragment key={i}>
                                      <span className={i === arr.length - 1 ? 'text-foreground font-medium' : ''}>
                                        {part}
                                      </span>
                                      {i < arr.length - 1 && <span className="text-muted-foreground/30 mx-0.5">/</span>}
                                    </React.Fragment>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                          <button
                            onClick={() => window.open(activeUrlToDisplay, '_blank')}
                            className="shrink-0 h-6 w-6 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            title="Download Zip"
                          >
                            <Download className="h-3 w-3" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              const frame = iframeRef.current
                              if (frame) {
                                frame.src = frame.src
                              }
                            }}
                            className="shrink-0 h-6 w-6 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            title="Refresh"
                          >
                            <RotateCw className="h-3.5 w-3.5" />
                          </button>
                          <Globe className="h-3 w-3 text-muted-foreground shrink-0 ml-1" />
                          <input
                            type="text"
                            readOnly
                            value={displayedIframeUrl}
                            className="flex-1 min-w-0 text-xs text-muted-foreground bg-transparent outline-none cursor-default"
                          />
                          <button
                            onClick={() => window.open(displayedIframeUrl, '_blank')}
                            className="shrink-0 h-6 w-6 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            title="Open in new tab"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                    
                    {!isZipUrl && (
                      <div className="hidden sm:flex items-center gap-1 bg-background/80 border border-border rounded-full p-0.5 mx-1">
                        <button
                          onClick={() => setViewportSize('imac')}
                          className={`h-6 w-8 flex items-center justify-center rounded-full transition-colors ${viewportSize === 'imac' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}
                          title="Desktop"
                        >
                          <Monitor className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setViewportSize('macbook')}
                          className={`h-6 w-8 flex items-center justify-center rounded-full transition-colors ${viewportSize === 'macbook' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}
                          title="Laptop"
                        >
                          <Laptop className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setViewportSize('ipad')}
                          className={`h-6 w-8 flex items-center justify-center rounded-full transition-colors ${viewportSize === 'ipad' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}
                          title="Tablet"
                        >
                          <Tablet className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setViewportSize('iphone')}
                          className={`h-6 w-8 flex items-center justify-center rounded-full transition-colors ${viewportSize === 'iphone' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}
                          title="Mobile"
                        >
                          <Smartphone className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    <div className="hidden sm:flex items-center gap-1 bg-background/80 border border-border rounded-full p-0.5 mx-1">
                      <button
                        onClick={() => setShowSourceCodePreview(false)}
                        className={`h-6 px-3 flex items-center justify-center rounded-full transition-colors text-xs font-medium ${!showSourceCodePreview ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}
                        title="Live Preview"
                      >
                        <Globe className="h-3.5 w-3.5 mr-1.5" />
                        Preview
                      </button>
                      <button
                        onClick={() => setShowSourceCodePreview(true)}
                        className={`h-6 px-3 flex items-center justify-center rounded-full transition-colors text-xs font-medium ${showSourceCodePreview ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}
                        title="Source Code"
                      >
                        <Folder className="h-3.5 w-3.5 mr-1.5" />
                        Source
                      </button>
                    </div>

                    <button
                      onClick={() => setIsChatHidden(!isChatHidden)}
                      className="shrink-0 h-7 w-7 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      title={isChatHidden ? "Show Chat" : "Hide Chat"}
                    >
                      {isChatHidden ? <PanelRightOpen className="h-4 w-4" /> : <PanelRightClose className="h-4 w-4" />}
                    </button>
                  </div>
                  {/* Browser content - 1fr fills all remaining height */}
                  <div ref={containerRef} className={`relative overflow-hidden bg-muted/10 w-full h-full flex items-start justify-center`}>
                    <div 
                      className="relative transition-all duration-300 shrink-0 flex flex-col"
                      style={isZipUrl ? {
                        width: '100%',
                        height: '100%',
                        backgroundColor: 'var(--background)'
                      } : {
                        width: viewportSize === 'imac' ? '1920px' : 
                               viewportSize === 'macbook' ? '1440px' : 
                               viewportSize === 'ipad' ? '810px' : '390px',
                        transform: `scale(${scale})`,
                        transformOrigin: 'top center',
                        height: scale < 1 ? `calc(100% / ${scale})` : '100%',
                        boxShadow: '0 0 20px rgba(0,0,0,0.05)',
                        borderLeft: '1px solid var(--border)',
                        borderRight: '1px solid var(--border)',
                        backgroundColor: 'var(--background)'
                      }}
                    >
                      {(isResuming || isInstanceStarting) && !latestPreviewUrl && !latestSourceCodeUrl ? (
                        <div className="absolute inset-0 flex flex-col">
                          <BrowserSkeleton />
                        </div>
                      ) : (isActivityRobot && hasMessageBeenSent && !isInstanceRunning && !latestPreviewUrl && !latestSourceCodeUrl) ? (
                        <div className="absolute inset-0 flex flex-col">
                          <BrowserSkeleton />
                        </div>
                      ) : (!!latestPreviewUrl || !!latestSourceCodeUrl) ? (
                        <div className="absolute inset-0 bg-background robot-browser-session" style={{ isolation: 'isolate', zIndex: 0 }}>
                          {isZipUrl ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background">
                              <ZipViewer
                                key={`${activeUrlToDisplay}|${requirementPreviewFrameKey}`}
                                url={activeUrlToDisplay}
                                className="w-full h-full"
                                onFileSelect={setSelectedFilePath}
                              />
                            </div>
                          ) : (
                            <iframe
                              ref={iframeRef}
                              key={`${activeUrlToDisplay}|${requirementPreviewFrameKey}`}
                              src={iframeSrc}
                              className="absolute inset-0 w-full h-full border-0 bg-background contained-iframe"
                              title={latestPreviewUrl ? "Preview" : "Source Code"}
                              allowFullScreen
                              allow="fullscreen; autoplay; camera; microphone; clipboard-read; clipboard-write"
                              // Se eliminó el atributo sandbox temporalmente para verificar si es un bloqueo de permisos del iframe
                              // sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads allow-top-navigation-by-user-activation allow-popups-to-escape-sandbox allow-presentation"
                              style={{
                                isolation: 'isolate'
                              }}
                              onLoad={(e) => {
                                handleIframeLoad(e)
                              }}
                              onError={(e) => {
                                console.error('Iframe error:', e)
                              }}
                            />
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Messages View or Imprenta - Chat/Instance Logs */}
            {!isChatHidden && (
              <div className={`${isBrowserVisible ? 'w-full lg:w-1/3' : 'w-full mx-auto'} min-w-0 messages-area flex flex-col flex-1 min-h-0 ${viewMode === 'imprenta' ? 'overflow-visible' : 'overflow-hidden'}`}>
                <div className={`flex flex-col m-0 ${viewMode === 'imprenta' ? 'bg-transparent overflow-visible' : 'bg-card overflow-hidden'} min-w-0 flex-1 min-h-0 relative`}>
                  {viewMode === 'imprenta' ? (
                    <div className="h-full min-h-0 absolute inset-0 flex flex-col">
                      <ImprentaPanel activeInstanceId={activeRobotInstance?.id} />
                    </div>
                  ) : (
                    <SimpleMessagesView 
                      key={`${currentSite?.id}-${siteChangeKey}`}
                      className="h-full absolute inset-0"
                      activeRobotInstance={activeRobotInstance}
                      isBrowserVisible={isBrowserVisible}
                      hasTopHeaderSpace={!isBrowserVisible}
                      onMessageSent={setHasMessageBeenSent}
                      onNewInstanceCreated={handleNewInstanceCreated}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}