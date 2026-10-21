import { useState, useEffect, useRef, useMemo } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"

import { useLayout } from "@/app/context/LayoutContext"
import { useTheme } from "@/app/context/ThemeContext"
import { useSite } from "@/app/context/SiteContext"
import { useRobots } from "@/app/context/RobotsContext"
import { useLocalization } from "@/app/context/LocalizationContext"

import { useInstanceBrowserData } from "@/app/components/robots/use-instance-browser-data"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/app/components/ui/use-toast"

import { useIsMobile } from "@/app/hooks/use-mobile-view"

import { resolveInstanceIdParam, resolveSelectedInstanceId } from "@/lib/navigation/robots-instance"

export function useRobotsController() {

  const { t } = useLocalization()
  const { toast } = useToast()
  const { isLayoutCollapsed, robotsViewMode, setRobotsViewMode } = useLayout()
  const { currentSite, refreshSites } = useSite()
  const { getAllInstances, getInstanceById, refreshRobots, isLoading: isLoadingRobots, refreshCount } = useRobots()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const viewMode = robotsViewMode
  const isCanvasMode = viewMode === 'imprenta' || viewMode === 'workflow'
  const { theme, isDarkMode } = useTheme()
  const isMobile = useIsMobile()
  
  // Prevent any body scroll on this page to fix Mac/iOS Safari scroll chaining
  useEffect(() => {
    // Only apply if we are strictly in the robots view
    if (isCanvasMode) return
    
    const originalHtmlOverflow = document.documentElement.style.overflow
    const originalBodyOverflow = document.body.style.overflow
    const originalHtmlOverscroll = document.documentElement.style.overscrollBehavior
    const originalBodyOverscroll = document.body.style.overscrollBehavior
    
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    // Prevent scroll chaining explicitly
    document.documentElement.style.overscrollBehavior = 'none'
    document.body.style.overscrollBehavior = 'none'
    
    return () => {
      document.documentElement.style.overflow = originalHtmlOverflow
      document.body.style.overflow = originalBodyOverflow
      document.documentElement.style.overscrollBehavior = originalHtmlOverscroll
      document.body.style.overscrollBehavior = originalBodyOverscroll
    }
  }, [isCanvasMode])
  
  // 🆕 Wait for site context to be fully synchronized before proceeding
  const [isSiteContextReady, setIsSiteContextReady] = useState(false)
  
  useEffect(() => {
    // 🆕 Homologated site ID validation (same pattern as RobotsProvider)
    const siteId = currentSite?.id
    if (siteId) {
      // Proceed without an artificial delay.
      setIsSiteContextReady(true)
    } else {
      setIsSiteContextReady(false)
    }
  }, [currentSite?.id])

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

  // Detect mode/activity changes
  useEffect(() => {
    const rawMode = searchParams.get("mode")
    const rawActivity = searchParams.get("activity")
    
    if (rawMode === "imprenta") {
      setRobotsViewMode("imprenta")
    } else if (rawMode === "workflow") {
      setRobotsViewMode("workflow")
    } else {
      setRobotsViewMode("agent")
    }
    
    // Check if we need to auto-create an instance or start a new conversation
    if (rawActivity === 'robot') {
      const isNewRequest = searchParams.get("new") === "true" || searchParams.get("instance") === "new"
      const currentQuery = searchParams.get("query")
      
      // If a new conversation is explicitly requested
      if (isNewRequest) {
        setLocalSelectedInstanceId('new')
      }
      
      // If we have a query, wait for everything to settle then trigger the query
      if (currentQuery) {
        let retries = 0;
        const maxRetries = 20; // 4 seconds total
        
        const checkReadyInterval = setInterval(() => {
          retries++;
          
          // Ensure we have a current site and robots are loaded
          // Also check that we are either fully created, or the system is stable
          const isReady = isSiteContextReady && !isLoadingRobots;
          
          if (isReady || retries >= maxRetries) {
            clearInterval(checkReadyInterval)
            
            // Clean up the URL by removing the query param so it doesn't re-trigger on refresh
            const newParams = new URLSearchParams(searchParams.toString())
            newParams.delete("query")
            newParams.delete("new") // Also clean up the 'new' flag
            router.replace(`/robots?${newParams.toString()}`, { scroll: false })
            
            // Dispatch a custom event to the simple messages view to prefill and send the query
            setTimeout(() => {
              const decodedQuery = decodeURIComponent(currentQuery).replace(/\+/g, ' ')
              window.dispatchEvent(new CustomEvent('robot:send-query-from-url', {
                detail: { query: decodedQuery }
              }))
            }, 300)
          }
        }, 200)
      }
    }
  }, [pathname, searchParams, setRobotsViewMode, isSiteContextReady, isLoadingRobots, router])
  
  // No campaigns view here

  // Local state for tracking selected instance without URL navigation
  const [localSelectedInstanceId, setLocalSelectedInstanceId] = useState<string | null>(null)
  const [shouldAutoConvertTab, setShouldAutoConvertTab] = useState(false)
  const [pendingInstanceId, setPendingInstanceId] = useState<string | null>(null)
  
  // Force component refresh when site changes
  const [siteChangeKey, setSiteChangeKey] = useState(0)
  
  
  
  const [isBrowserModalOpen, setIsBrowserModalOpen] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const desktopToolbarRef = useRef<HTMLDivElement>(null)
  const desktopDeviceControlsRef = useRef<HTMLDivElement>(null)
  const desktopLayoutToggleRef = useRef<HTMLButtonElement>(null)
  const [viewportSize, setViewportSize] = useState<'imac' | 'macbook' | 'ipad' | 'iphone'>('imac')
  const [scale, setScale] = useState(1)
  const [desktopTabsPreferredWidth, setDesktopTabsPreferredWidth] = useState(0)
  const [desktopTabsWidth, setDesktopTabsWidth] = useState<number | null>(null)
  const prevSiteIdRef = useRef<string | null>(currentSite?.id || null)
  
  // Simplified site change handling - only reset when site actually changes
  useEffect(() => {
    const siteId = currentSite?.id
    if (siteId && siteId !== prevSiteIdRef.current) {
      
      // Only reset when site actually changes
      setLocalSelectedInstanceId(null)
      setPendingInstanceId(null)
      setShouldAutoConvertTab(false)
      setSiteChangeKey(prev => prev + 1)
      setIsResuming(false)
      setIsAutoCreatingInstance(false)
      
      // Refresh robots for new site
      refreshRobots(siteId)
      
      prevSiteIdRef.current = siteId
    }
  }, [currentSite?.id, refreshRobots])

  // Instance selection via URL param (`instance`, `instance_id`, or `instanceId`)
  const selectedInstanceParam = resolveInstanceIdParam(searchParams)
  const allInstances = useMemo(() => getAllInstances(true), [getAllInstances])

  const tabInstances = useMemo(
    () => allInstances.filter((instance) => !instance.is_archived),
    [allInstances],
  )

  const selectedInstanceId = resolveSelectedInstanceId({
    requestedId: selectedInstanceParam,
    localId: localSelectedInstanceId,
    instanceIds: tabInstances.map((inst) => inst.id),
    isLoading: isLoadingRobots,
  })

  useEffect(() => {
    const canonical = searchParams.get("instance")
    const hasAlias = Boolean(searchParams.get("instance_id") || searchParams.get("instanceId"))
    if (!selectedInstanceParam || selectedInstanceParam === "new") return
    if (canonical === selectedInstanceParam && !hasAlias) return

    const params = new URLSearchParams(searchParams.toString())
    params.set("instance", selectedInstanceParam)
    params.delete("instance_id")
    params.delete("instanceId")
    params.delete('artifact')
    params.delete('screen')
    params.delete('tab')
    router.replace(`/robots?${params.toString()}`, { scroll: false })
  }, [searchParams, selectedInstanceParam, router])
  
  // Get instance without site filtering
  const activeRobotInstance = selectedInstanceId !== 'new' ? getInstanceById(selectedInstanceId) : null

  // Update page title based on selected instance
  useEffect(() => {
    let title = 'Agents';
    if (activeRobotInstance) {
      if (activeRobotInstance.requirement_title) {
        title = activeRobotInstance.requirement_title;
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

  const shouldFetchStats = viewMode === "imprenta" || viewMode === "workflow"
  const { instanceStats } = useInstanceBrowserData(shouldFetchStats, tabInstances)
  
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
  const lastTabSelectionTimeRef = useRef<Record<string, number>>({})
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [instanceToDelete, setInstanceToDelete] = useState<{ id: string; name: string } | null>(null)
  const [deletingInstanceIds, setDeletingInstanceIds] = useState<Set<string>>(new Set())
  const [instanceAvatars, setInstanceAvatars] = useState<Record<string, string>>({})
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingInstanceId, setEditingInstanceId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  
  const handleInstanceNameUpdate = async (id: string, newName: string) => {
    if (!newName.trim()) return
    try {
      const supabase = createClient()
      await supabase
        .from('remote_instances')
        .update({ name: newName.trim(), updated_at: new Date().toISOString() })
        .eq('id', id)
      
      refreshRobots(currentSite?.id)
      
      if (selectedInstanceId === id) {
        const params = new URLSearchParams(searchParams.toString())
        params.set('name', newName.trim())
        router.replace(`/robots?${params.toString()}`, { scroll: false })
      }
    } catch (err) {
      console.error('Error updating instance name:', err)
    }
  }

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
  return { t, toast, isLayoutCollapsed, robotsViewMode, setRobotsViewMode, currentSite, refreshSites, getAllInstances, getInstanceById, refreshRobots, isLoadingRobots, refreshCount, searchParams, router, pathname, viewMode, isCanvasMode, theme, isDarkMode, isMobile, isSiteContextReady, setIsSiteContextReady, localSelectedInstanceId, setLocalSelectedInstanceId, shouldAutoConvertTab, setShouldAutoConvertTab, pendingInstanceId, setPendingInstanceId, siteChangeKey, setSiteChangeKey, isBrowserModalOpen, setIsBrowserModalOpen, iframeRef, containerRef, desktopToolbarRef, desktopDeviceControlsRef, desktopLayoutToggleRef, viewportSize, setViewportSize, scale, setScale, desktopTabsPreferredWidth, setDesktopTabsPreferredWidth, desktopTabsWidth, setDesktopTabsWidth, prevSiteIdRef, selectedInstanceParam, allInstances, tabInstances, selectedInstanceId, activeRobotInstance, shouldFetchStats, instanceStats, activityParam, isActivityRobot, isResuming, setIsResuming, activeTabRef, lastTabSelectionTimeRef, isDeleteModalOpen, setIsDeleteModalOpen, instanceToDelete, setInstanceToDelete, deletingInstanceIds, setDeletingInstanceIds, instanceAvatars, setInstanceAvatars, isEditModalOpen, setIsEditModalOpen, editingInstanceId, setEditingInstanceId, editingName, setEditingName, handleInstanceNameUpdate, tabsContainerRef, tabsListRef, containerWidth, setContainerWidth, maxVisibleTabs, setMaxVisibleTabs, hasMessageBeenSent, setHasMessageBeenSent, isAutoCreatingInstance, setIsAutoCreatingInstance, lastAutoCreationAttempt, setLastAutoCreationAttempt }
}
