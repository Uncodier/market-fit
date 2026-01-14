"use client"

import { useState, useEffect, useLayoutEffect, Suspense, useCallback, useRef } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Settings, Globe, Target, Pause, Play, Trash2, Plus, MoreHorizontal } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/app/components/ui/dropdown-menu"
import { useLayout } from "@/app/context/LayoutContext"
import { useSite } from "@/app/context/SiteContext"
import { useRobots } from "@/app/context/RobotsContext"
import { SimpleMessagesView } from "@/app/components/simple-messages-view"
import { RobotsPageSkeleton } from "@/app/components/skeletons/robots-page-skeleton"
import { BrowserSkeleton } from "@/app/components/skeletons/browser-skeleton"
import { DeleteRobotModal } from "@/app/components/robots/DeleteRobotModal"
import { createClient } from "@/lib/supabase/client"
import { LoadingSkeleton } from "@/app/components/ui/loading-skeleton"
import "@/app/styles/iframe-containment.css"

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
  const { isLayoutCollapsed } = useLayout()
  const { currentSite } = useSite()
  const { getAllInstances, getInstanceById, refreshRobots, isLoading: isLoadingRobots, refreshCount, setAutoRefreshEnabled } = useRobots()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  
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
  
  // Simplified site change handling - only reset when site actually changes
  useEffect(() => {
    const siteId = currentSite?.id
    if (siteId && siteId !== prevSiteIdRef.current) {
      console.log('🔄 [Robots] Site changed, resetting state for site:', siteId)
      
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
        console.log('🔄 [Robots] Site context synchronized for site:', siteId)
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
      console.log('🔄 [Robots] Robots loaded, clearing force loading')
      setForceLoading(false)
    }
  }, [isLoadingRobots, forceLoading])

  // Instance selection via URL param
  const selectedInstanceParam = searchParams.get('instance')
  const allInstances = getAllInstances()
  
  // 🆕 Debug logging for instances
  console.log('🔍 [Robots] Current instances:', {
    siteId: currentSite?.id,
    instancesCount: allInstances.length,
    instances: allInstances.map(i => ({ id: i.id, name: i.name, site_id: i.site_id })),
    isLoadingRobots,
    refreshCount
  })
  
  // Use local state if available, otherwise fall back to URL param, then default to "new" or first instance
  // Validate that the selected instance actually exists to avoid using deleted instances
  let selectedInstanceId = localSelectedInstanceId || selectedInstanceParam || (allInstances.length > 0 ? allInstances[0].id : 'new')
  
  // If selectedInstanceId is from URL param, verify it still exists
  if (selectedInstanceId && selectedInstanceId !== 'new' && !localSelectedInstanceId) {
    const instanceExists = allInstances.some(inst => inst.id === selectedInstanceId)
    if (!instanceExists) {
      // Selected instance no longer exists (was deleted), use first available (sorted by updated_at)
      if (allInstances.length > 0) {
        const sortedInstances = [...allInstances].sort((a, b) => {
          const aTime = new Date((a as any).updated_at || (a as any).created_at || 0).getTime()
          const bTime = new Date((b as any).updated_at || (b as any).created_at || 0).getTime()
          return bTime - aTime
        })
        selectedInstanceId = sortedInstances[0].id
      } else {
        selectedInstanceId = 'new'
      }
    }
  }
  
  // Get instance without site filtering
  const activeRobotInstance = selectedInstanceId !== 'new' ? getInstanceById(selectedInstanceId) : null

  
  // Activity param for controlling explorer visibility
  const activityParam = searchParams.get('activity')
  const isActivityRobot = activityParam === 'robot'
  const [streamUrl, setStreamUrl] = useState<string | null>(null)
  const [isResuming, setIsResuming] = useState(false)

  // Reconnection states
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting' | 'error'>('disconnected')
  const [reconnectAttempts, setReconnectAttempts] = useState(0)
  const [maxReconnectAttempts] = useState(5)
  const [reconnectTimeoutId, setReconnectTimeoutId] = useState<NodeJS.Timeout | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [showConnectedIndicator, setShowConnectedIndicator] = useState(false)
  const prevConnectionStatusRef = useRef<string>('disconnected')
  
  const activeTabRef = useRef(selectedInstanceId)
  const prevSiteIdRef = useRef<string | null>(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  
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

  // Function to ensure we have a stream URL for the robot instance
  const ensureStreamUrl = async (instance: any) => {
    console.log('🔍 ensureStreamUrl called with status:', prevConnectionStatusRef.current)
    try {
      // Construct the stream URL using provider_instance_id
      if (instance.provider_instance_id) {
        const streamUrl = `https://api.proxy.scrapybara.com/v1/instance/${instance.provider_instance_id}/stream`
        setStreamUrl(streamUrl)
        setConnectionStatus('connected')
        
        // Only show indicator if status actually changed from non-connected to connected
        if (prevConnectionStatusRef.current !== 'connected') {
          console.log('✅ Showing connected indicator - status changed from', prevConnectionStatusRef.current, 'to connected')
          setShowConnectedIndicator(true)
        } else {
          console.log('⏭️ Skipping indicator - already connected')
        }
        prevConnectionStatusRef.current = 'connected'
        
        // Update the database with the stream URL
        try {
          const supabase = createClient()
          await supabase
            .from('remote_instances')
            .update({ cdp_url: streamUrl })
            .eq('id', instance.id)
        } catch (dbError) {
          console.error('Error updating database:', dbError)
        }
      } else if (instance.id) {
        // Fallback: use instance.id if no provider_instance_id
        const fallbackUrl = `https://api.proxy.scrapybara.com/v1/instance/${instance.id}/stream`
        setStreamUrl(fallbackUrl)
        setConnectionStatus('connected')
        
        // Only show indicator if status actually changed from non-connected to connected
        if (prevConnectionStatusRef.current !== 'connected') {
          console.log('✅ Showing connected indicator (fallback) - status changed from', prevConnectionStatusRef.current, 'to connected')
          setShowConnectedIndicator(true)
        } else {
          console.log('⏭️ Skipping indicator (fallback) - already connected')
        }
        prevConnectionStatusRef.current = 'connected'
      } else {
        console.error('No valid instance ID found')
        setConnectionStatus('error')
        prevConnectionStatusRef.current = 'error'
      }
    } catch (error) {
      console.error('Error ensuring stream URL:', error)
      setConnectionStatus('error')
      prevConnectionStatusRef.current = 'error'
    }
  }

  // Calculate exponential backoff delay
  const calculateBackoffDelay = (attempt: number): number => {
    const baseDelay = 1000 // 1 second
    const maxDelay = 30000 // 30 seconds
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
    return delay + Math.random() * 1000 // Add jitter
  }

  // Reconnection function
  const attemptReconnection = useCallback(async () => {
    if (!activeRobotInstance || reconnectAttempts >= maxReconnectAttempts) {
      setConnectionStatus('error')
      prevConnectionStatusRef.current = 'error'
      return
    }

    console.log(`Attempting reconnection ${reconnectAttempts + 1}/${maxReconnectAttempts}`)
    setConnectionStatus('reconnecting')
    prevConnectionStatusRef.current = 'reconnecting'
    setReconnectAttempts(prev => prev + 1)

    try {
      await ensureStreamUrl(activeRobotInstance)
      // If successful, reset reconnect attempts
      setReconnectAttempts(0)
    } catch (error) {
      console.error('Reconnection failed:', error)
      
      // Schedule next reconnection attempt
      const delay = calculateBackoffDelay(reconnectAttempts)
      console.log(`Scheduling next reconnection in ${delay}ms`)
      
      const timeoutId = setTimeout(attemptReconnection, delay)
      reconnectTimeoutRef.current = timeoutId
      setReconnectTimeoutId(timeoutId)
    }
  }, [activeRobotInstance, reconnectAttempts, maxReconnectAttempts])

  // Handle connection loss detection
  const handleConnectionLoss = useCallback(() => {
    console.log('Connection lost detected')
    setConnectionStatus('disconnected')
    prevConnectionStatusRef.current = 'disconnected'
    setStreamUrl(null)
    
    // Clear any existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
      setReconnectTimeoutId(null)
    }
    
    // Start reconnection attempts
    if (activeRobotInstance && reconnectAttempts < maxReconnectAttempts) {
      const delay = calculateBackoffDelay(reconnectAttempts)
      console.log(`Starting reconnection in ${delay}ms`)
      
      const timeoutId = setTimeout(attemptReconnection, delay)
      reconnectTimeoutRef.current = timeoutId
      setReconnectTimeoutId(timeoutId)
    }
  }, [activeRobotInstance, reconnectAttempts, maxReconnectAttempts, attemptReconnection])

  // Manual reconnection function
  const manualReconnect = useCallback(() => {
    console.log('Manual reconnection triggered')
    
    // Clear any existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
      setReconnectTimeoutId(null)
    }
    
    // Reset attempts and try reconnection immediately
    setReconnectAttempts(0)
    setConnectionStatus('reconnecting')
    prevConnectionStatusRef.current = 'reconnecting'
    
    if (activeRobotInstance) {
      attemptReconnection()
    }
  }, [activeRobotInstance, attemptReconnection])



  // Reset reconnection state when robot instance changes
  useEffect(() => {
    setReconnectAttempts(0)
    setConnectionStatus('disconnected')
    prevConnectionStatusRef.current = 'disconnected'
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
      setReconnectTimeoutId(null)
    }
  }, [activeRobotInstance])

  // Note: Robot events are now handled by the RobotsContext automatically
  // No need for manual event listeners here

    // Note: Auto-creation of placeholder instances removed
    // startRobot and assistant already create instances when needed

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [])

  // Auto-hide connected indicator after 3 seconds
  useEffect(() => {
    if (showConnectedIndicator) {
      const timer = setTimeout(() => {
        setShowConnectedIndicator(false)
      }, 3000)
      
      return () => clearTimeout(timer)
    }
  }, [showConnectedIndicator])

  // Update ref when selected instance changes
  useEffect(() => {
    activeTabRef.current = selectedInstanceId
  }, [selectedInstanceId])

  // Reset connection state when site changes (simplified - main logic is in mount effect)
  useEffect(() => {
    const newSiteId = currentSite?.id || null
    if (newSiteId && newSiteId !== prevSiteIdRef.current) {
      console.log('🔄 [Robots] Site changed, resetting connection state:', { 
        from: prevSiteIdRef.current, 
        to: newSiteId 
      })
      console.log('🔄 [Robots] Full currentSite object during site change:', currentSite)
      
      // Reset connection state only
      setReconnectAttempts(0)
      setConnectionStatus('disconnected')
      prevConnectionStatusRef.current = 'disconnected'
      setIsResuming(false)
      setStreamUrl(null)
      setIsAutoCreatingInstance(false)
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
        setReconnectTimeoutId(null)
      }

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
      console.log('🔄 [Robots] Waiting for site context before auto-creating instance...')
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
    // 8. We're not in a reconnection state
    // 9. We haven't attempted auto-creation recently (debouncing)
    const hasSuccessfullyLoaded = refreshCount > 0
    const isNotReconnecting = connectionStatus !== 'reconnecting' && connectionStatus !== 'error'
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
        isNotReconnecting &&
        timeSinceLastAttempt > debounceDelay) {
      
      console.log('🔄 State shows no instances, verifying in database...')
      
      // CRITICAL: Double-check database before auto-creating
      checkInstancesExistInDB(currentSite.id).then((instancesExist) => {
        if (instancesExist) {
          console.log('✅ Instances exist in DB, skipping auto-create (false positive avoided)')
          setIsAutoCreatingInstance(false)
          return
        }
        
        console.log('🔄 Confirmed: No instances in DB, proceeding with auto-create')
        
        // Set flag to prevent multiple creations and record attempt timestamp
        setIsAutoCreatingInstance(true)
        setLastAutoCreationAttempt(Date.now())
        
        // Create a new instance automatically
        createPlaceholderInstance().then((newInstance) => {
          if (newInstance) {
            console.log('✅ Auto-created instance:', newInstance.id)
            // Refresh robots to get the new instance
            refreshRobots(currentSite?.id).then(() => {
              // Select the new instance
              setLocalSelectedInstanceId(newInstance.id)
              setPendingInstanceId(newInstance.id)
              setShouldAutoConvertTab(true)
              
              // Update URL to reflect the new instance
              const params = new URLSearchParams(searchParams.toString())
              params.set('instance', newInstance.id)
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
  }, [isLoadingRobots, currentSite?.id, getAllInstances, shouldAutoConvertTab, pendingInstanceId, isAutoCreatingInstance, refreshRobots, searchParams, router, refreshCount, connectionStatus, isSiteContextReady, checkInstancesExistInDB])

  // No campaigns effect

  // Detect when pending instance becomes available and convert the tab
  useEffect(() => {
    if (pendingInstanceId && shouldAutoConvertTab && allInstances.length > 0) {
      // Check if the pending instance is now available
      const instanceExists = allInstances.some(inst => inst.id === pendingInstanceId)
      
      if (instanceExists) {
        console.log('🔄 Pending instance now available, converting tab:', pendingInstanceId)
        
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


  // Ensure stream URL only when instance is running/active
  useEffect(() => {
    console.log('🔍 useEffect triggered - activeRobotInstance:', !!activeRobotInstance, 'isInstanceRunning:', isInstanceRunning)
    if (activeRobotInstance && isInstanceRunning) {
      ensureStreamUrl(activeRobotInstance)
    } else {
      setStreamUrl(null)
      setConnectionStatus('disconnected')
      prevConnectionStatusRef.current = 'disconnected'
    }
  }, [activeRobotInstance, isInstanceRunning])

  // Poll while instance is starting or resuming until it becomes ready or terminal
  useEffect(() => {
    if (!activeRobotInstance || (!isInstanceStarting && !isResuming)) return
    let intervalId = setInterval(async () => {
      await refreshRobots(currentSite?.id)
      const updated = getInstanceById((activeRobotInstance as any).id)
      if (updated && ['running','active','error','stopped','failed'].includes((updated as any).status)) {
        if (['running','active'].includes((updated as any).status)) {
          try {
            // Only call ensureStreamUrl if we don't already have a stream URL or if status changed
            if (!streamUrl || prevConnectionStatusRef.current !== 'connected') {
              console.log('🔄 Polling: calling ensureStreamUrl')
              await ensureStreamUrl(updated)
            } else {
              console.log('⏭️ Polling: skipping ensureStreamUrl - already connected')
            }
          } catch (e) {
            console.error('Error ensuring stream after polling:', e)
          }
          setIsResuming(false)
        }
        clearInterval(intervalId)
      }
    }, 1500)
    return () => {
      clearInterval(intervalId)
    }
  }, [activeRobotInstance && (activeRobotInstance as any).id, isInstanceStarting, isResuming, refreshRobots, getInstanceById, selectedInstanceId])

  // Note: Real-time monitoring is now handled by RobotsContext
  // This ensures efficient data sharing across all components

  // Function to create placeholder instance
  const createPlaceholderInstance = async () => {
    if (!currentSite?.id) {
      console.error('❌ Cannot create placeholder: No current site')
      return null
    }
    
    console.log('🔄 Creating placeholder instance for site:', currentSite.id)
    
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
      
      console.log('✅ Created placeholder instance:', data.id)
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
      router.replace(`/robots?${currentParams.toString()}`)
      console.log('🔄 New instance created and selected:', newInstance.id)
    }
  }

  // Function to handle instance tab change
  const handleTabChange = (newInstance: string) => {
    if (newInstance === 'new') {
      // Reset to new makina mode
      setLocalSelectedInstanceId(null)
      const currentParams = new URLSearchParams(searchParams.toString())
      currentParams.set('instance', 'new')
      router.push(`/robots?${currentParams.toString()}`)
    } else {
      // Set the selected instance
      setLocalSelectedInstanceId(newInstance)
      const currentParams = new URLSearchParams(searchParams.toString())
      currentParams.set('instance', newInstance)
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
      const sortedInstances = [...allInstances].sort((a, b) => {
        const aTime = new Date((a as any).updated_at || (a as any).created_at || 0).getTime()
        const bTime = new Date((b as any).updated_at || (b as any).created_at || 0).getTime()
        return bTime - aTime
      })
      
      const showNewMakinaTab = allInstances.length === 0 || isLoadingRobots || forceLoading
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
    console.log('🔄 New instance created, setting pending conversion:', instanceId)
    // Immediately update local state and URL to reflect the new instance
    setLocalSelectedInstanceId(instanceId)
    // Update URL to reflect the new instance selection
    const currentParams = new URLSearchParams(searchParams.toString())
    currentParams.set('instance', instanceId)
    router.replace(`/robots?${currentParams.toString()}`)
    // Disable auto-refresh to prevent subscription from interfering
    setAutoRefreshEnabled(false)
    // Set the pending instance ID for tab conversion
    setPendingInstanceId(instanceId)
    setShouldAutoConvertTab(true)
  }, [setAutoRefreshEnabled, searchParams, router])

  // Calculate how many tabs can fit based on available width
  const calculateMaxVisibleTabs = useCallback(() => {
    if (!tabsContainerRef.current) {
      setMaxVisibleTabs(Infinity)
      return
    }

    const containerRect = tabsContainerRef.current.getBoundingClientRect()
    const containerWidth = containerRect.width
    
    // Calculate available width: container width minus margins (px-16 = 64px each side = 128px total)
    const horizontalMargins = 128 // 64px * 2
    const gapBetweenElements = 16 // gap-4 = 16px
    const plusButtonWidth = 40 // Approximate width of Plus button (h-9 with padding)
    // Check if delete button is visible (when there's an active robot instance)
    const deleteButtonWidth = selectedInstanceId !== 'new' && activeRobotInstance ? 40 : 0
    const moreButtonWidth = 60 // Approximate width of "..." button
    
    // Try to measure actual tab widths if tabsListRef is available
    let estimatedTabWidth = 140 // Default estimated width
    if (tabsListRef.current) {
      const tabs = tabsListRef.current.querySelectorAll('[role="tab"]')
      if (tabs.length > 0) {
        // Calculate average width of existing tabs
        let totalWidth = 0
        tabs.forEach((tab) => {
          totalWidth += (tab as HTMLElement).offsetWidth || 0
        })
        if (totalWidth > 0) {
          estimatedTabWidth = totalWidth / tabs.length
        }
      }
    }
    
    const availableWidth = containerWidth - horizontalMargins - gapBetweenElements - plusButtonWidth - deleteButtonWidth - gapBetweenElements
    
    // Calculate how many tabs can fit (reserving space for "..." button if needed)
    // We add moreButtonWidth to availableWidth because we want to know how many tabs fit including the "..." button space
    const maxTabs = Math.floor((availableWidth + moreButtonWidth) / estimatedTabWidth)
    
    // Always show at least 1 tab if there are instances
    setMaxVisibleTabs(Math.max(1, maxTabs))
    setContainerWidth(containerWidth)
  }, [selectedInstanceId, activeRobotInstance])

  // Use ResizeObserver to track container width changes
  useEffect(() => {
    // Retry mechanism to wait for ref to be ready (important for SPA navigation)
    let retryCount = 0
    const maxRetries = 10
    let retryTimer: NodeJS.Timeout
    let resizeObserver: ResizeObserver | null = null
    let rafId: number
    let handleResize: (() => void) | null = null
    
    const setupObserver = () => {
      if (!tabsContainerRef.current) {
        if (retryCount < maxRetries) {
          retryCount++
          retryTimer = setTimeout(setupObserver, 50)
        }
        return
      }

      resizeObserver = new ResizeObserver(() => {
        calculateMaxVisibleTabs()
      })

      resizeObserver.observe(tabsContainerRef.current)

      // Also recalculate on window resize
      handleResize = () => {
        calculateMaxVisibleTabs()
      }
      window.addEventListener('resize', handleResize)

      // Initial calculation immediately using requestAnimationFrame
      rafId = requestAnimationFrame(() => {
        calculateMaxVisibleTabs()
      })
    }
    
    setupObserver()

    return () => {
      if (retryTimer) clearTimeout(retryTimer)
      if (rafId) cancelAnimationFrame(rafId)
      if (resizeObserver) resizeObserver.disconnect()
      if (handleResize) window.removeEventListener('resize', handleResize)
    }
  }, [calculateMaxVisibleTabs, allInstances.length, isLayoutCollapsed, selectedInstanceId])

  // Recalculate when instances change or selectedInstanceId changes
  // Use useLayoutEffect for immediate calculation after DOM update
  useLayoutEffect(() => {
    // Skip if still loading
    if (isLoadingRobots || forceLoading) return
    
    // Use requestAnimationFrame for immediate calculation after layout
    const rafId = requestAnimationFrame(() => {
      if (tabsContainerRef.current && tabsListRef.current) {
        calculateMaxVisibleTabs()
      }
    })
    return () => cancelAnimationFrame(rafId)
  }, [allInstances.length, calculateMaxVisibleTabs, selectedInstanceId, isLoadingRobots, forceLoading])

  // Get instance param from URL for dependency tracking
  const instanceParam = searchParams.get('instance')
  
  // Recalculate when navigating to the page (without refresh) or when searchParams change
  // This ensures tabs are recalculated when navigating from another page in SPA mode
  // Uses useLayoutEffect for immediate calculation after DOM update
  useLayoutEffect(() => {
    if (pathname !== '/robots') return
    
    // Wait for instances to be loaded and searchParams to be ready
    if (isLoadingRobots || forceLoading) return
    
    // Retry mechanism to wait for ref to be ready (faster retries)
    let rafId: number
    let timer: NodeJS.Timeout
    let retryCount = 0
    const maxRetries = 10
    
    const attemptCalculation = () => {
      if (tabsContainerRef.current && tabsListRef.current) {
        // Use requestAnimationFrame for immediate calculation
        rafId = requestAnimationFrame(() => {
          calculateMaxVisibleTabs()
        })
      } else if (retryCount < maxRetries) {
        // Retry faster if ref is not ready
        retryCount++
        timer = setTimeout(attemptCalculation, 50)
      }
    }
    
    attemptCalculation()
    
    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      if (timer) clearTimeout(timer)
    }
  }, [pathname, calculateMaxVisibleTabs, isLoadingRobots, forceLoading, instanceParam, allInstances.length, selectedInstanceId])

  

  return (
    <div className="flex-1 p-0">
      <StickyHeader key={`${currentSite?.id}-${siteChangeKey}`}>
        <div className="px-16 pt-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center w-full" ref={tabsContainerRef}>
              <div className="flex items-center gap-2 flex-1">
                <Tabs key={`tabs-${currentSite?.id}-${siteChangeKey}`} value={selectedInstanceId} onValueChange={handleTabChange}>
                  <TabsList ref={tabsListRef}>
                    {/* Show New Makina tab if no instances or while loading */}
                    {(allInstances.length === 0 || isLoadingRobots || forceLoading) && (
                      <TabsTrigger value="new">
                        <span className="flex items-center gap-2">
                          <Plus className="h-3 w-3 text-muted-foreground" />
                          New Makina
                        </span>
                      </TabsTrigger>
                    )}
                    
                    {/* Show instances with responsive overflow */}
                    {(() => {
                      console.log('🔍 [Robots] Rendering tabs for instances:', {
                        siteId: currentSite?.id,
                        siteChangeKey,
                        forceLoading,
                        instances: allInstances.map(i => ({ id: i.id, name: i.name, site_id: i.site_id })),
                        maxVisibleTabs
                      })
                      
                      // Sort instances by updated_at descending (most recently updated first)
                      const sortedInstances = [...allInstances].sort((a, b) => {
                        const aTime = new Date((a as any).updated_at || (a as any).created_at || 0).getTime()
                        const bTime = new Date((b as any).updated_at || (b as any).created_at || 0).getTime()
                        return bTime - aTime
                      })
                      
                      // Calculate how many tabs to show
                      const showNewMakinaTab = allInstances.length === 0 || isLoadingRobots || forceLoading
                      // Account for "New Makina" tab in maxVisibleTabs if it's shown
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
                          {visibleInstances.map((inst) => (
                            <TabsTrigger key={`${inst.id}-${siteChangeKey}`} value={inst.id}>
                              <span className="flex items-center gap-2">
                                {['running','active'].includes((inst as any).status) ? (
                                  <Play className="h-3 w-3 text-green-600" />
                                ) : (['starting','pending','initializing'].includes((inst as any).status) ? (
                                  <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                                ) : (
                                  <Pause className="h-3 w-3 text-muted-foreground" />
                                ))}
                                {inst.name || `mk-${inst.id.slice(-4)}`}
                              </span>
                            </TabsTrigger>
                          ))}
                          
                          {/* Show "..." button when there are hidden tabs */}
                          {needsOverflow && hiddenInstances.length > 0 && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-muted/50"
                                  onClick={(e) => e.preventDefault()}
                                >
                                  <span className="flex items-center gap-2">
                                    <MoreHorizontal className="h-3 w-3" />
                                    <span>{hiddenInstances.length}</span>
                                  </span>
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="max-h-[300px] overflow-y-auto">
                                {hiddenInstances.map((inst) => (
                                  <DropdownMenuItem
                                    key={`overflow-${inst.id}`}
                                    onClick={() => handleTabChangeFromOverflow(inst.id)}
                                    className="cursor-pointer"
                                  >
                                    <span className="flex items-center gap-2">
                                      {['running','active'].includes((inst as any).status) ? (
                                        <Play className="h-3 w-3 text-green-600" />
                                      ) : (['starting','pending','initializing'].includes((inst as any).status) ? (
                                        <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                                      ) : (
                                        <Pause className="h-3 w-3 text-muted-foreground" />
                                      ))}
                                      {inst.name || `mk-${inst.id.slice(-4)}`}
                                    </span>
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </>
                      )
                    })()}
                  </TabsList>
                </Tabs>
                
                {/* Create new instance button - pegado a los tabs */}
                <Button
                  variant="secondary"
                  className="h-9"
                  onClick={handleCreateNewInstance}
                  title="Create new robot instance"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Delete button - solo a la derecha cuando hay instancia activa */}
              {activeRobotInstance && (
                <Button
                  variant="secondary"
                  className="h-9"
                  onClick={() => setIsDeleteModalOpen(true)}
                  title="Delete robot instance"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </StickyHeader>
      
      {/* Delete Confirmation Modal */}
      {activeRobotInstance && (
        <DeleteRobotModal
          open={isDeleteModalOpen}
          onOpenChange={setIsDeleteModalOpen}
          instanceId={activeRobotInstance.id}
          instanceName={activeRobotInstance.name || 'mk'}
          onDeleteSuccess={async () => {
            console.log('🗑️ [Delete] Starting delete success callback')
            
            // Save the deleted instance ID before clearing state
            const deletedInstanceId = activeRobotInstance?.id
            console.log('🗑️ [Delete] Deleted instance ID:', deletedInstanceId)
            
            // Clear local selection immediately (but don't update URL yet to avoid intermediate state)
            setLocalSelectedInstanceId(null)
            
            try {
              // First refresh robots to get updated instance list (without the deleted one)
              console.log('🗑️ [Delete] Refreshing robots after delete...')
              await refreshRobots(currentSite?.id)
              console.log('🗑️ [Delete] Robots refreshed successfully')
              
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
                  console.log('🗑️ [Delete] Deleted instance confirmed removed after', retries, 'retries')
                  break
                }
                retries++
              }
              
              // Final check: ensure deleted instance is not in the list
              if (deletedInstanceId && currentInstances.some(inst => inst.id === deletedInstanceId)) {
                console.warn('🗑️ [Delete] WARNING: Deleted instance still in list after retries, filtering it out')
                currentInstances = currentInstances.filter(inst => inst.id !== deletedInstanceId)
              }
              
              console.log('🗑️ [Delete] Current instances after refresh:', {
                count: currentInstances.length,
                instances: currentInstances.map(i => ({ id: i.id, name: i.name })),
                deletedInstanceId,
                retries
              })
              
              // Find the best instance to navigate to - select the first VISIBLE one
              let targetInstanceId = 'new'
              
              if (currentInstances.length > 0) {
                // Sort instances by updated_at descending (most recently updated first)
                // This matches the order used in the tabs
                const sortedInstances = [...currentInstances].sort((a, b) => {
                  const aTime = new Date((a as any).updated_at || (a as any).created_at || 0).getTime()
                  const bTime = new Date((b as any).updated_at || (b as any).created_at || 0).getTime()
                  return bTime - aTime
                })
                
                console.log('🗑️ [Delete] Sorted instances by updated_at:', sortedInstances.map(i => ({ 
                  id: i.id, 
                  name: i.name, 
                  updated_at: (i as any).updated_at,
                  created_at: (i as any).created_at 
                })))
                
                // Calculate which instances are visible (same logic as in tab rendering)
                const showNewMakinaTab = currentInstances.length === 0 || isLoadingRobots || forceLoading
                const effectiveMaxTabs = showNewMakinaTab ? maxVisibleTabs - 1 : maxVisibleTabs
                const totalTabs = sortedInstances.length
                const needsOverflow = totalTabs > effectiveMaxTabs
                let visibleTabsCount = needsOverflow ? effectiveMaxTabs - 1 : totalTabs
                
                // Get visible instances (first N that fit in visible tabs)
                const visibleInstances = sortedInstances.slice(0, visibleTabsCount)
                
                console.log('🗑️ [Delete] Visibility calculation:', {
                  totalTabs,
                  maxVisibleTabs,
                  effectiveMaxTabs,
                  needsOverflow,
                  visibleTabsCount,
                  visibleInstances: visibleInstances.map(i => ({ id: i.id, name: i.name })),
                  hiddenCount: sortedInstances.length - visibleTabsCount
                })
                
                // Select the first VISIBLE instance (not just first in sorted list)
                if (visibleInstances.length > 0) {
                  targetInstanceId = visibleInstances[0]?.id || 'new'
                  console.log('🗑️ [Delete] Selecting first VISIBLE instance:', targetInstanceId)
                } else {
                  // Fallback: if no visible instances (shouldn't happen), select first in list
                  targetInstanceId = sortedInstances[0]?.id || 'new'
                  console.log('🗑️ [Delete] No visible instances, selecting first in sorted list:', targetInstanceId)
                }
                
                // Set local selection and update URL atomically to avoid intermediate state
                setLocalSelectedInstanceId(targetInstanceId)
                
                // Navigate to the selected instance (update URL directly, skipping intermediate state)
                console.log('🗑️ [Delete] Navigating to first visible instance:', targetInstanceId)
                const newParams = new URLSearchParams(searchParams.toString())
                newParams.set('instance', targetInstanceId)
                router.replace(`/robots?${newParams.toString()}`, { scroll: false })
              } else {
                console.log('🗑️ [Delete] No instances available, going to new')
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
              router.replace(`/robots?${params.toString()}`)
            }
          }}
        />
      )}
      
      <div className="flex flex-col h-full">
        {/* Content area - flex-1 with overflow-auto for natural scroll */}
        <div className="flex-1 overflow-visible bg-muted/30 transition-colors duration-300 ease-in-out">
          <div className="flex h-full">
            {((selectedInstanceId !== 'new' && activeRobotInstance && (isResuming || isInstanceStarting || isInstanceRunning)) || (isActivityRobot && hasMessageBeenSent)) && !pendingInstanceId && (
              <div className="w-2/3 border-r border-border iframe-container flex flex-col sticky top-[71px] h-[calc(100vh-136px)]" style={{ position: 'sticky' }}>
                <div className="flex flex-col m-0 bg-card h-full">
                  <div className="flex flex-col p-0 relative h-full">
                    {isResuming || isInstanceStarting ? (
                      <div className="absolute inset-0 flex flex-col">
                        <BrowserSkeleton />
                      </div>
                    ) : (isActivityRobot && hasMessageBeenSent && !isInstanceRunning) ? (
                      <div className="absolute inset-0 flex flex-col">
                        <BrowserSkeleton />
                      </div>
                    ) : isInstanceRunning ? (
                      <div className="relative w-full h-full bg-background robot-browser-session" style={{ isolation: 'isolate', zIndex: 0 }}>
                        {connectionStatus !== 'connected' && (
                          <div className="absolute top-4 left-4 z-10">
                            <div className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium shadow-lg backdrop-blur-sm ${
                              connectionStatus === 'reconnecting' ? 'bg-yellow-100/90 text-yellow-800 border border-yellow-200' :
                              connectionStatus === 'error' ? 'bg-red-100/90 text-red-800 border border-red-200' :
                              'bg-gray-100/90 text-gray-800 border border-gray-200'
                            }`}>
                              {connectionStatus === 'reconnecting' && (
                                <>
                                  <LoadingSkeleton size="sm" className="text-yellow-600" />
                                  <span>Reconnecting... ({reconnectAttempts}/{maxReconnectAttempts})</span>
                                </>
                              )}
                              {connectionStatus === 'error' && (
                                <>
                                  <div className="w-4 h-4 bg-red-600 rounded-full"></div>
                                  <span>Connection failed</span>
                                  <button
                                    onClick={manualReconnect}
                                    className="ml-2 px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                                    disabled={activeRobotInstance === null}
                                  >
                                    Retry
                                  </button>
                                </>
                              )}
                              {connectionStatus === 'disconnected' && (
                                <>
                                  <div className="w-4 h-4 bg-gray-400 rounded-full"></div>
                                  <span>Disconnected</span>
                                  <button
                                    onClick={manualReconnect}
                                    className="ml-2 px-2 py-1 text-xs bg-primary text-white rounded hover:bg-primary/80 transition-colors"
                                    disabled={activeRobotInstance === null}
                                  >
                                    Connect
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                        {showConnectedIndicator && (
                          <div className="absolute top-4 left-4 z-10 animate-in fade-in duration-300">
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg text-sm font-medium bg-green-100/90 text-green-800 border border-green-200 shadow-lg backdrop-blur-sm">
                              <div className="w-4 h-4 bg-green-600 rounded-full animate-pulse"></div>
                            </div>
                          </div>
                        )}
                        <div className="w-full h-full flex items-center justify-center bg-background iframe-wrapper">
                          <div className="bg-background rounded-lg shadow-2xl border border-muted-foreground/30 overflow-hidden" style={{
                            width: '100%',
                            maxWidth: '1024px',
                            height: 'auto',
                            aspectRatio: '4/3',
                            maxHeight: 'calc(100vh - 200px)',
                            contain: 'layout style paint',
                            isolation: 'isolate'
                          }}>
                            <iframe
                              src={streamUrl || "https://www.google.com"}
                              className="border-0 bg-background rounded-lg contained-iframe"
                              title={streamUrl ? "Robot Browser Session" : "Google"}
                              allowFullScreen
                              allow="fullscreen; autoplay; camera; microphone; clipboard-read; clipboard-write"
                              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads"
                              style={{
                                width: 'calc(100% + 4px)',
                                height: 'calc(100% + 4px)',
                                transform: 'translate(-2px, -2px)',
                                transformOrigin: 'center center',
                                position: 'relative',
                                zIndex: 1,
                                isolation: 'isolate'
                              }}
                              onLoad={() => {
                                if (streamUrl) {
                                  setConnectionStatus('connected')
                                  
                                  // Only show indicator if status actually changed from non-connected to connected
                                  if (prevConnectionStatusRef.current !== 'connected') {
                                    console.log('✅ Showing connected indicator (iframe) - status changed from', prevConnectionStatusRef.current, 'to connected')
                                    setShowConnectedIndicator(true)
                                  } else {
                                    console.log('⏭️ Skipping indicator (iframe) - already connected')
                                  }
                                  prevConnectionStatusRef.current = 'connected'
                                  
                                  setReconnectAttempts(0)
                                }
                              }}
                              onError={(e) => {
                                console.error('Iframe error:', e)
                                handleConnectionLoss()
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            )}

            {/* Messages View - Chat/Instance Logs */}
            <div className={`${((selectedInstanceId !== 'new' && activeRobotInstance && (isLoadingRobots || isResuming || isInstanceStarting || isInstanceRunning)) || (isActivityRobot && hasMessageBeenSent)) && !pendingInstanceId ? 'w-1/3' : 'w-full mx-auto'} min-w-0 messages-area flex flex-col overflow-auto`}>
              <div className="flex flex-col m-0 bg-card min-w-0">
                <SimpleMessagesView 
                  key={`${currentSite?.id}-${siteChangeKey}`}
                  className="" 
                  activeRobotInstance={activeRobotInstance}
                  isBrowserVisible={((selectedInstanceId !== 'new' && activeRobotInstance && (isLoadingRobots || isResuming || isInstanceStarting || isInstanceRunning)) || (isActivityRobot && hasMessageBeenSent)) && !pendingInstanceId}
                  onMessageSent={setHasMessageBeenSent}
                  onNewInstanceCreated={handleNewInstanceCreated}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}