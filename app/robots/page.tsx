"use client"

import { useState, useEffect, useLayoutEffect, Suspense, useCallback, useRef, useMemo } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Settings, Globe, Target, Pause, Play, X, Plus, MoreHorizontal, ExternalLink, RotateCw } from "@/app/components/ui/icons"
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
  const { currentSite, refreshSites } = useSite()
  const { getAllInstances, getInstanceById, refreshRobots, isLoading: isLoadingRobots, refreshCount, setAutoRefreshEnabled } = useRobots()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  
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
  const iframeRef = useRef<HTMLIFrameElement>(null)
  
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
  const allInstances = getAllInstances()
  
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

  // Update page title based on selected instance
  useEffect(() => {
    const title = activeRobotInstance ? (activeRobotInstance.name || `ag-${activeRobotInstance.id.slice(-4)}`) : 'Agents';
    
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
  const [instanceToDelete, setInstanceToDelete] = useState<{ id: string; name: string } | null>(null)
  
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
    try {
      // Construct the stream URL using provider_instance_id
      if (instance.provider_instance_id) {
        const streamUrl = `https://api.proxy.scrapybara.com/v1/instance/${instance.provider_instance_id}/stream`
        setStreamUrl(streamUrl)
        setConnectionStatus('connected')
        
        // Only show indicator if status actually changed from non-connected to connected
        if (prevConnectionStatusRef.current !== 'connected') {
          setShowConnectedIndicator(true)
        } else {
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
          setShowConnectedIndicator(true)
        } else {
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
      
      const timeoutId = setTimeout(attemptReconnection, delay)
      reconnectTimeoutRef.current = timeoutId
      setReconnectTimeoutId(timeoutId)
    }
  }, [activeRobotInstance, reconnectAttempts, maxReconnectAttempts])

  // Handle connection loss detection
  const handleConnectionLoss = useCallback(() => {
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
      
      const timeoutId = setTimeout(attemptReconnection, delay)
      reconnectTimeoutRef.current = timeoutId
      setReconnectTimeoutId(timeoutId)
    }
  }, [activeRobotInstance, reconnectAttempts, maxReconnectAttempts, attemptReconnection])

  // Manual reconnection function
  const manualReconnect = useCallback(() => {
    
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
              params.set('name', newInstance.name || `ag-${newInstance.id.slice(-4)}`)
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
    const instanceId = (activeRobotInstance as any).id
    let intervalId = setInterval(async () => {
      // Check if instance still exists before polling
      const currentInstance = getInstanceById(instanceId)
      if (!currentInstance) {
        setIsResuming(false)
        clearInterval(intervalId)
        return
      }
      
      await refreshRobots(currentSite?.id)
      const updated = getInstanceById(instanceId)
      if (!updated) {
        // Instance was deleted during polling
        setIsResuming(false)
        clearInterval(intervalId)
        return
      }
      
      if (['running','active','error','stopped','failed'].includes((updated as any).status)) {
        if (['running','active'].includes((updated as any).status)) {
          try {
            // Only call ensureStreamUrl if we don't already have a stream URL or if status changed
            if (!streamUrl || prevConnectionStatusRef.current !== 'connected') {
              await ensureStreamUrl(updated)
            } else {
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
      currentParams.set('name', newInstance.name || `ag-${newInstance.id.slice(-4)}`)
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
        currentParams.set('name', instance.name || `ag-${instance.id.slice(-4)}`)
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
  }, [calculateMaxVisibleTabs, allInstances.length, isLayoutCollapsed, selectedInstanceId]);

  const { requirementStatuses } = useRequirementStatus(activeRobotInstance)
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
  }, [requirementStatuses]);
  
  // Get view mode from URL (agent vs imprenta)
  const viewMode = searchParams.get('mode') === 'imprenta' ? 'imprenta' : 'agent'
  
  // Compute if browser should be visible
  const isBrowserVisible = Boolean(
    ((selectedInstanceId !== 'new' && activeRobotInstance && (isResuming || isInstanceStarting || isInstanceRunning || !!latestPreviewUrl)) || 
    (isActivityRobot && hasMessageBeenSent)) && 
    !pendingInstanceId &&
    viewMode !== 'imprenta'
  )

  const activeUrlToDisplay = latestPreviewUrl || streamUrl || "https://www.google.com"
  const isZipUrl = typeof activeUrlToDisplay === 'string' && (activeUrlToDisplay.endsWith('.zip') || activeUrlToDisplay.includes('.zip?'))

  const { displayUrl: displayedIframeUrl, iframeSrc, handleIframeLoad } = useIframeUrl(iframeRef, activeUrlToDisplay)

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
                    {(allInstances.length === 0 || isLoadingRobots || forceLoading) && (
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
                      const sortedInstances = [...allInstances].sort((a, b) => {
                        const aTime = new Date((a as any).updated_at || (a as any).created_at || 0).getTime()
                        const bTime = new Date((b as any).updated_at || (b as any).created_at || 0).getTime()
                        return bTime - aTime
                      })
                      
                      // Calculate how many tabs to show
                      const showNewMakinaTab = allInstances.length === 0 || isLoadingRobots || forceLoading
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
                          {visibleInstances.map((inst) => (
                            <TabsTrigger key={`${inst.id}-${siteChangeKey}`} value={inst.id}>
                              <span className="flex items-center gap-2 max-w-[120px]">
                                {['running','active'].includes((inst as any).status) ? (
                                  <Play className="h-3 w-3 text-green-600 flex-shrink-0" />
                                ) : (['starting','pending','initializing'].includes((inst as any).status) ? (
                                  <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse flex-shrink-0" />
                                ) : null)}
                                  <span className="truncate">{inst.name || `ag-${inst.id.slice(-4)}`}</span>
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setInstanceToDelete({ id: inst.id, name: inst.name || `ag-${inst.id.slice(-4)}` })
                                    setIsDeleteModalOpen(true)
                                  }}
                                  className="ml-1.5 flex items-center justify-center h-4 w-4 rounded-full hover:bg-destructive/10 transition-colors cursor-pointer"
                                  title="Eliminar conversación"
                                  role="button"
                                  tabIndex={0}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      setInstanceToDelete({ id: inst.id, name: inst.name || `ag-${inst.id.slice(-4)}` })
                                      setIsDeleteModalOpen(true)
                                    }
                                  }}
                                >
                                  <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                                </span>
                              </span>
                            </TabsTrigger>
                          ))}
                          
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
        instances={allInstances as any[]}
        onSelect={(id) => handleTabChangeFromOverflow(id)}
        onDelete={(instance) => {
          setInstanceToDelete({ id: instance.id, name: instance.name })
          setIsDeleteModalOpen(true)
        }}
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
          onDeleteSuccess={async () => {
            
            // Save the deleted instance ID before clearing state
            const deletedInstanceId = instanceToDelete?.id
            
            // Check if the deleted instance was the active one or was starting
            const wasActiveInstance = activeRobotInstance?.id === deletedInstanceId
            const wasStarting = wasActiveInstance && (isResuming || isInstanceStarting)
            
            
            // Reset robot starting/resuming state if the deleted instance was starting
            if (wasStarting || wasActiveInstance) {
              setIsResuming(false)
              setStreamUrl(null)
              setConnectionStatus('disconnected')
              prevConnectionStatusRef.current = 'disconnected'
              setReconnectAttempts(0)
              setShowConnectedIndicator(false)
              
              // Clear any reconnection timeouts
              if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current)
                reconnectTimeoutRef.current = null
                setReconnectTimeoutId(null)
              }
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
                const sortedInstances = [...currentInstances].sort((a, b) => {
                  const aTime = new Date((a as any).updated_at || (a as any).created_at || 0).getTime()
                  const bTime = new Date((b as any).updated_at || (b as any).created_at || 0).getTime()
                  return bTime - aTime
                })
                
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
                    newParams.set('name', targetInstance.name || `ag-${targetInstance.id.slice(-4)}`)
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
            }
          }}
        />
      )}
      
      <div className={`absolute inset-0 flex flex-col min-h-0 ${viewMode === 'imprenta' ? 'overflow-visible' : 'overflow-hidden'}`}>
        {/* Content area - no pt-[71px] here so it can go under header */}
        <div className={`flex-1 flex flex-col min-h-0 ${viewMode === 'imprenta' ? 'bg-transparent' : 'bg-muted/30'} transition-colors duration-300 ease-in-out ${viewMode === 'imprenta' ? 'overflow-visible' : 'overflow-hidden'}`}>
          <div className={`flex flex-col lg:flex-row flex-1 min-h-0 ${viewMode === 'imprenta' ? 'overflow-visible' : 'overflow-hidden'}`}>
            {isBrowserVisible && (
              <div className="w-full lg:w-2/3 border-b lg:border-b-0 lg:border-r border-border iframe-container flex flex-col shrink-0 h-[calc(40vh+135px)] lg:h-full overflow-hidden relative">
                <div className="grid grid-rows-[auto_1fr] m-0 bg-card absolute inset-x-0 bottom-0 top-[135px] overflow-hidden">
                  {/* Browser navigation bar */}
                  <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-muted/40">
                    <button
                      onClick={() => {
                        const frame = iframeRef.current
                        if (frame) {
                          frame.src = frame.src
                        }
                      }}
                      className="shrink-0 h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      title="Refresh"
                    >
                      <RotateCw className="h-3.5 w-3.5" />
                    </button>
                    <div className="flex items-center gap-2 flex-1 min-w-0 bg-background/80 border border-border rounded-md px-2.5 py-1">
                      <Globe className="h-3 w-3 text-muted-foreground shrink-0" />
                      <input
                        type="text"
                        readOnly
                        value={displayedIframeUrl}
                        className="flex-1 min-w-0 text-xs text-muted-foreground bg-transparent outline-none cursor-default"
                      />
                    </div>
                    <button
                      onClick={() => window.open(displayedIframeUrl, '_blank')}
                      className="shrink-0 h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      title="Open in new tab"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {/* Browser content - 1fr fills all remaining height */}
                  <div className="relative overflow-hidden">
                    {isResuming || isInstanceStarting ? (
                      <div className="absolute inset-0 flex flex-col">
                        <BrowserSkeleton />
                      </div>
                    ) : (isActivityRobot && hasMessageBeenSent && !isInstanceRunning && !latestPreviewUrl) ? (
                      <div className="absolute inset-0 flex flex-col">
                        <BrowserSkeleton />
                      </div>
                    ) : (isInstanceRunning || !!latestPreviewUrl) ? (
                      <div className="absolute inset-0 bg-background robot-browser-session" style={{ isolation: 'isolate', zIndex: 0 }}>
                        {connectionStatus !== 'connected' && !latestPreviewUrl && (
                          <div className="absolute top-4 left-4 z-10">
                            <div className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium shadow-lg backdrop-blur-sm ${
                              connectionStatus === 'reconnecting' ? 'bg-yellow-100/90 text-yellow-800 border border-yellow-200' :
                              connectionStatus === 'error' ? 'bg-red-100/90 text-red-800 border border-red-200' :
                              'bg-gray-100/90 text-gray-800 border border-gray-200'
                            }`}>
                              {connectionStatus === 'reconnecting' && (
                                <>
                                  <LoadingSkeleton size="sm" className="text-yellow-600" />
                                  <span>Reconectando... ({reconnectAttempts}/{maxReconnectAttempts})</span>
                                </>
                              )}
                              {connectionStatus === 'error' && (
                                <>
                                  <div className="w-4 h-4 bg-red-600 rounded-full"></div>
                                  <span>Fallo de conexión</span>
                                  <button
                                    onClick={manualReconnect}
                                    className="ml-2 px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                                    disabled={activeRobotInstance === null}
                                  >
                                    Reintentar
                                  </button>
                                </>
                              )}
                              {connectionStatus === 'disconnected' && (
                                <>
                                  <div className="w-4 h-4 bg-gray-400 rounded-full"></div>
                                  <span>Desconectado</span>
                                  <button
                                    onClick={manualReconnect}
                                    className="ml-2 px-2 py-1 text-xs bg-primary text-white rounded hover:bg-primary/80 transition-colors"
                                    disabled={activeRobotInstance === null}
                                  >
                                    Conectar
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                        {showConnectedIndicator && !latestPreviewUrl && (
                          <div className="absolute top-4 left-4 z-10 animate-in fade-in duration-300">
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg text-sm font-medium bg-green-100/90 text-green-800 border border-green-200 shadow-lg backdrop-blur-sm">
                              <div className="w-4 h-4 bg-green-600 rounded-full animate-pulse"></div>
                            </div>
                          </div>
                        )}
                        {isZipUrl ? (
                          <div className="w-full h-full flex items-center justify-center p-4 iframe-wrapper">
                            <ZipViewer key={activeUrlToDisplay} url={activeUrlToDisplay} className="h-full border-0 rounded-lg shadow-none" />
                          </div>
                        ) : (
                          <iframe
                            ref={iframeRef}
                            key={activeUrlToDisplay}
                            src={iframeSrc}
                            className="absolute inset-0 w-full h-full border-0 bg-background contained-iframe"
                            title={latestPreviewUrl ? "Preview" : streamUrl ? "Robot Browser Session" : "Google"}
                            allowFullScreen
                            allow="fullscreen; autoplay; camera; microphone; clipboard-read; clipboard-write"
                            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads"
                            style={{
                              isolation: 'isolate'
                            }}
                            onLoad={(e) => {
                              handleIframeLoad(e)

                              if (latestPreviewUrl) return;

                              if (streamUrl) {
                                setConnectionStatus('connected')
                                if (prevConnectionStatusRef.current !== 'connected') {
                                  setShowConnectedIndicator(true)
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
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            )}

            {/* Messages View or Imprenta - Chat/Instance Logs */}
            <div className={`${isBrowserVisible ? 'w-full lg:w-1/3' : 'w-full mx-auto'} min-w-0 messages-area flex flex-col flex-1 min-h-0 ${viewMode === 'imprenta' ? 'overflow-visible' : 'overflow-hidden'}`}>
              <div className={`flex flex-col m-0 ${viewMode === 'imprenta' ? 'bg-transparent overflow-visible' : 'bg-card overflow-hidden'} min-w-0 flex-1 min-h-0 relative`}>
                {viewMode === 'imprenta' ? (
                  <div className="h-full absolute inset-0">
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
          </div>
        </div>
      </div>
    </div>
  )
}