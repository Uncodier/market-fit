"use client"

import { useState, useEffect, Suspense, useCallback, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Settings, Globe } from "@/app/components/ui/icons"
import { useLayout } from "@/app/context/LayoutContext"
import { useSite } from "@/app/context/SiteContext"
import { SimpleMessagesView } from "@/app/components/simple-messages-view"
import { EmptyState } from "@/app/components/ui/empty-state"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { RobotsPageSkeleton } from "@/app/components/skeletons/robots-page-skeleton"
import { BrowserSkeleton } from "@/app/components/skeletons/browser-skeleton"
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
  console.log('🏁 ROBOTS PAGE LOADED - CHECK CONSOLE!')
  
  return (
    <Suspense fallback={<RobotsPageSkeleton />}>
      <RobotsPageContent />
    </Suspense>
  )
}

// Main content component
function RobotsPageContent() {
  console.log('🚀 RobotsPageContent component started rendering')
  
  const { isLayoutCollapsed } = useLayout()
  const { currentSite } = useSite()
  const searchParams = useSearchParams()
  const router = useRouter()
  
  console.log('🚀 Hooks loaded, currentSite:', currentSite?.id || 'null')

  // Get tab from URL params or default to free-agent
  const activeTab = searchParams.get('tab') || 'free-agent'
  const [activeRobotInstance, setActiveRobotInstance] = useState<any | null>(null)
  const [isLoadingRobots, setIsLoadingRobots] = useState(true)
  const [streamUrl, setStreamUrl] = useState<string | null>(null)

  // Reconnection states
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting' | 'error'>('disconnected')
  const [reconnectAttempts, setReconnectAttempts] = useState(0)
  const [maxReconnectAttempts] = useState(5)
  const [reconnectTimeoutId, setReconnectTimeoutId] = useState<NodeJS.Timeout | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [showConnectedIndicator, setShowConnectedIndicator] = useState(false)
  
  // Polling states for robot startup
  const [isPollingForInstance, setIsPollingForInstance] = useState(false)
  const [pollingAttempts, setPollingAttempts] = useState(0)
  const [maxPollingAttempts] = useState(20) // 20 attempts * 3 seconds = 60 seconds max
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const activeTabRef = useRef(activeTab)

  // Map tab values to activity names (for robot name matching)
  const getActivityName = (tabValue: string): string => {
    const activityMap: Record<string, string> = {
      "free-agent": "Free Agent",
      "channel-market-fit": "Channel Market Fit",
      "engage": "Engage in Social Networks", 
      "seo": "SEO",
      "publish-content": "Publish Content",
      "publish-ads": "Publish Ads",
      "ux-analysis": "UX Analysis",
      "build-requirements": "Build Requirements"
    }
    return activityMap[tabValue] || tabValue
  }

  // Function to check for active robots for the current tab
  const checkActiveRobots = useCallback(async () => {
    console.log('🔄 Robots page: checkActiveRobots called', { currentSite: currentSite?.id, activeTab })
    
    if (!currentSite) {
      setActiveRobotInstance(null)
      setStreamUrl(null)
      setIsLoadingRobots(false)
      console.log('❌ Robots page: No currentSite, exiting checkActiveRobots')
      return
    }

    try {
      setIsLoadingRobots(true)
      const supabase = createClient()
      
      // Get the activity name for the current tab to use as robot name filter
      const activityName = getActivityName(activeTab)
      
      // Find robot with the specific activity name only
      // Each tab should only show robots for its specific activity
      const { data, error } = await supabase
        .from('remote_instances')
        .select('id, status, instance_type, name, provider_instance_id, cdp_url')
        .eq('site_id', currentSite.id)
        .eq('name', activityName)
        .neq('status', 'stopped')
        .neq('status', 'error')
        .limit(1)

      if (error) {
        console.error('Error checking active robots:', error)
        setActiveRobotInstance(null)
        setStreamUrl(null)
      } else {
        const instance = data && data.length > 0 ? data[0] : null
        console.log(`🔍 Robots page: checkActiveRobots result for ${activityName}:`, instance)
        console.log(`🔍 Robots page: Previous activeRobotInstance:`, activeRobotInstance?.id)
        
        setActiveRobotInstance(instance)
        
        if (instance) {
          console.log(`✅ Found active robot for ${activityName}:`, instance)
          // Check if we need to get/update the stream URL
          await ensureStreamUrl(instance)
        } else {
          console.log(`❌ No active robot found for ${activityName}`)
          setStreamUrl(null)
        }
      }
    } catch (error) {
      console.error('Error checking active robots:', error)
      setActiveRobotInstance(null)
      setStreamUrl(null)
    } finally {
      setIsLoadingRobots(false)
    }
  }, [currentSite, activeTab])

  // Function to start polling for successful robot instance
  const startPollingForInstance = useCallback(() => {
    console.log('Starting polling for robot instance...')
    setIsPollingForInstance(true)
    setPollingAttempts(0)
    
    const pollForInstance = async () => {
      if (!currentSite) {
        stopPollingForInstance()
        return
      }

      try {
        console.log(`Polling attempt ${pollingAttempts + 1}/${maxPollingAttempts}`)
        const supabase = createClient()
        const activityName = getActivityName(activeTab)
        
        // First try to find a robot with the specific activity name
        let { data, error } = await supabase
          .from('remote_instances')
          .select('id, status, instance_type, name, provider_instance_id, cdp_url')
          .eq('site_id', currentSite.id)
          .eq('name', activityName)
          .in('status', ['running', 'active', 'failed', 'error'])
          .limit(1)

        // If no specific robot found and it's free-agent tab, look for any active robot
        if ((!data || data.length === 0) && activeTab === 'free-agent') {
          const fallbackQuery = await supabase
            .from('remote_instances')
            .select('id, status, instance_type, name, provider_instance_id, cdp_url')
            .eq('site_id', currentSite.id)
            .in('status', ['running', 'active', 'failed', 'error'])
            .limit(1)
          
          data = fallbackQuery.data
          error = fallbackQuery.error
        }

        if (error) {
          console.error('Error polling for robot instance:', error)
        } else if (data && data.length > 0) {
          const instance = data[0]
          console.log(`Found instance with status: ${instance.status}`)
          
          if (instance.status === 'running' || instance.status === 'active') {
            // Success! Stop polling and setup the instance
            console.log('Robot instance started successfully!')
            stopPollingForInstance()
            setActiveRobotInstance(instance)
            await ensureStreamUrl(instance)
            return
          } else if (instance.status === 'failed' || instance.status === 'error') {
            // Failed! Stop polling
            console.log('Robot instance failed to start')
            stopPollingForInstance()
            return
          }
        }

        // Continue polling if not found or still pending
        setPollingAttempts(prev => {
          const newAttempts = prev + 1
          if (newAttempts >= maxPollingAttempts) {
            console.log('Max polling attempts reached, stopping...')
            stopPollingForInstance()
            return prev
          }
          return newAttempts
        })

      } catch (error) {
        console.error('Error during polling:', error)
        setPollingAttempts(prev => prev + 1)
      }
    }

    // Start immediate poll
    pollForInstance()
    
    // Setup interval for subsequent polls
    pollingIntervalRef.current = setInterval(pollForInstance, 3000)
  }, [currentSite, activeTab, pollingAttempts, maxPollingAttempts])

  // Function to stop polling
  const stopPollingForInstance = useCallback(() => {
    console.log('Stopping polling for robot instance')
    setIsPollingForInstance(false)
    setPollingAttempts(0)
    
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
  }, [])

  // Function to ensure we have a stream URL for the robot instance
  const ensureStreamUrl = async (instance: any) => {
    try {
      // Construct the stream URL using provider_instance_id
      if (instance.provider_instance_id) {
        const streamUrl = `https://api.proxy.scrapybara.com/v1/instance/${instance.provider_instance_id}/stream`
        setStreamUrl(streamUrl)
        setConnectionStatus('connected')
        setShowConnectedIndicator(true)
        
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
        setShowConnectedIndicator(true)
      } else {
        console.error('No valid instance ID found')
        setConnectionStatus('error')
      }
    } catch (error) {
      console.error('Error ensuring stream URL:', error)
      setConnectionStatus('error')
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
      return
    }

    console.log(`Attempting reconnection ${reconnectAttempts + 1}/${maxReconnectAttempts}`)
    setConnectionStatus('reconnecting')
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
    
    if (activeRobotInstance) {
      attemptReconnection()
    }
  }, [activeRobotInstance, attemptReconnection])



  // Reset reconnection state when robot instance changes
  useEffect(() => {
    setReconnectAttempts(0)
    setConnectionStatus('disconnected')
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
      setReconnectTimeoutId(null)
    }

    // Stop polling when instance changes (unless we're starting a new one)
    if (!activeRobotInstance) {
      stopPollingForInstance()
    }
  }, [activeRobotInstance, stopPollingForInstance])

  // Listen for robot events from TopBarActions
  useEffect(() => {
    const handleRobotStopped = (event: CustomEvent) => {
      console.log('🔔 Robots page: Received robotStopped event:', event.detail)
      // Force a refresh of the robots page
      checkActiveRobots()
    }

    const handleRobotStarted = (event: CustomEvent) => {
      console.log('🔔 Robots page: Received robotStarted event:', event.detail)
      // Force a refresh of the robots page
      checkActiveRobots()
    }

    window.addEventListener('robotStopped', handleRobotStopped as EventListener)
    window.addEventListener('robotStarted', handleRobotStarted as EventListener)
    
    return () => {
      window.removeEventListener('robotStopped', handleRobotStopped as EventListener)
      window.removeEventListener('robotStarted', handleRobotStarted as EventListener)
    }
  }, [checkActiveRobots])

  // Cleanup timeouts and polling on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
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

  // Update activeTab ref when activeTab changes
  useEffect(() => {
    activeTabRef.current = activeTab
  }, [activeTab])

  // Check for active robots when site or tab changes
  useEffect(() => {
    checkActiveRobots()
  }, [currentSite, activeTab])

  // Setup real-time monitoring (separate from checking robots to avoid re-subscription)
  useEffect(() => {
    if (currentSite) {
      const supabase = createClient()
      
      const instancesSubscription = supabase
        .channel(`remote_instances_${currentSite.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'remote_instances',
            filter: `site_id=eq.${currentSite.id}`
          },
          (payload: any) => {
            console.log('🔄 Robots page: Real-time instance update:', payload)
            
            // Get current activity name for filtering - use ref to get fresh value
            const currentActivityName = getActivityName(activeTabRef.current)
            console.log(`🔍 Robots page: Current activity name: ${currentActivityName}`)
            console.log(`🔍 Robots page: Payload new name: ${payload.new?.name}, old name: ${payload.old?.name}`)
            
            // Check if this change affects the current tab's activity
            // Each tab should only respond to changes for its specific activity
            const isRelevantChange = payload.new?.name === currentActivityName || 
                                   payload.old?.name === currentActivityName
            
            if (isRelevantChange) {
              console.log(`🎯 Robots page: Instance change detected for ${currentActivityName}, refreshing...`)
              
              // Handle different event types
              if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
                console.log(`📝 Robots page: Processing ${payload.eventType} event for instance:`, payload.new)
                const instance = payload.new
                
                // If instance is stopped or error, clear the stream and stop polling
                if (instance.status === 'stopped' || instance.status === 'error' || instance.status === 'failed') {
                  console.log(`🛑 Robots page: Instance ${instance.name} stopped/error/failed, clearing stream`)
                  console.log(`🛑 Robots page: Previous activeRobotInstance:`, activeRobotInstance?.id)
                  console.log(`🛑 Robots page: Current streamUrl:`, streamUrl)
                  
                  setActiveRobotInstance(null)
                  setStreamUrl(null)
                  setConnectionStatus('disconnected')
                  stopPollingForInstance()
                  
                  // Clear any reconnection timeouts
                  if (reconnectTimeoutRef.current) {
                    clearTimeout(reconnectTimeoutRef.current)
                    reconnectTimeoutRef.current = null
                    setReconnectTimeoutId(null)
                  }
                  setReconnectAttempts(0)
                  
                  console.log(`✅ Robots page: Robot state cleared for stopped instance`)
                }
                // If instance is running/active, setup the stream and stop polling
                else if (instance.status === 'running' || instance.status === 'active') {
                  console.log(`Instance ${instance.name} started/active, setting up stream`)
                  stopPollingForInstance()
                  setActiveRobotInstance(instance)
                  ensureStreamUrl(instance)
                }
                // If instance is starting/pending, start polling
                else if (instance.status === 'starting' || instance.status === 'pending' || instance.status === 'initializing') {
                  console.log(`Instance ${instance.name} is starting, beginning polling`)
                  setActiveRobotInstance(null) // Clear any existing instance
                  setStreamUrl(null)
                  setConnectionStatus('disconnected')
                  startPollingForInstance()
                }
              }
              // If instance was deleted, clear everything
              else if (payload.eventType === 'DELETE') {
                console.log(`Instance deleted, clearing stream`)
                setActiveRobotInstance(null)
                setStreamUrl(null)
                setConnectionStatus('disconnected')
                stopPollingForInstance()
                
                if (reconnectTimeoutRef.current) {
                  clearTimeout(reconnectTimeoutRef.current)
                  reconnectTimeoutRef.current = null
                  setReconnectTimeoutId(null)
                }
                setReconnectAttempts(0)
              }
            } else {
              console.log(`⏸️ Robots page: Instance change ignored - not for current activity ${currentActivityName}`)
            }
          }
        )
        .subscribe()

      // Cleanup subscription on unmount or site change
      return () => {
        instancesSubscription.unsubscribe()
        stopPollingForInstance()
      }
    }
  }, [currentSite])

  // Function to handle tab change
  const handleTabChange = (newTab: string) => {
    const currentParams = new URLSearchParams(searchParams.toString())
    currentParams.set('tab', newTab)
    router.push(`/robots?${currentParams.toString()}`)
  }

  // Debug log to see what's happening
  console.log('🤖 Robots page render - activeRobotInstance:', activeRobotInstance?.id || 'null', 'isLoadingRobots:', isLoadingRobots, 'isPollingForInstance:', isPollingForInstance)

  return (
    <div className="flex-1 p-0">
          <StickyHeader>
            <div className="px-16 pt-0">
              <div className="flex items-center gap-4">
            <Tabs value={activeTab} onValueChange={handleTabChange}>
                  <TabsList>
                <TabsTrigger value="free-agent">Free Agent</TabsTrigger>
                <TabsTrigger value="channel-market-fit">Channel Market Fit</TabsTrigger>
                <TabsTrigger value="engage">Engage in Social Networks</TabsTrigger>
                <TabsTrigger value="seo">SEO</TabsTrigger>
                <TabsTrigger value="publish-content">Publish Content</TabsTrigger>
                <TabsTrigger value="publish-ads">Publish Ads</TabsTrigger>
                <TabsTrigger value="ux-analysis">UX Analysis</TabsTrigger>
                <TabsTrigger value="build-requirements">Build Requirements</TabsTrigger>
                  </TabsList>
            </Tabs>
          </div>
        </div>
      </StickyHeader>
      
      <div className="">
        <div className="flex h-[calc(100vh-136px)]">
          {/* Web View - 2/3 of available space */}
          <div className="w-2/3 h-full border-r border-border iframe-container">
            <div className="h-full flex flex-col m-0 bg-card">
              <div className="flex-1 p-0 overflow-hidden">
                {isLoadingRobots || isPollingForInstance ? (
                  <div className="h-full flex flex-col relative">
                    <BrowserSkeleton />
                    
                    {/* Loading status overlay - minimal and unobtrusive */}
                    <div className="absolute bottom-4 left-4 right-4">
                      <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-3">
                        <div className="flex items-center gap-3">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          </div>
                          
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">
                              {isPollingForInstance ? 'Starting Robot Browser...' : 'Loading Robot Session...'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {isPollingForInstance 
                                ? `Setting up robot instance (${pollingAttempts}/${maxPollingAttempts})` 
                                : 'Initializing robot components...'
                              }
                            </p>
                          </div>
                          
                          {isPollingForInstance && (
                            <div className="w-32">
                              <div className="w-full bg-muted rounded-full h-1.5">
                                <div 
                                  className="bg-primary h-1.5 rounded-full transition-all duration-300" 
                                  style={{ width: `${(pollingAttempts / maxPollingAttempts) * 100}%` }}
                                ></div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : !activeRobotInstance ? (
                  <div className="h-full flex items-center justify-center">
                    <EmptyState
                      icon={<Globe className="h-16 w-16 text-primary/40" />}
                      title="No robots running"
                      description="Start a robot to see the web browser automation in action."
                      variant="fancy"
                    />
                  </div>
                ) : (
                  <div className="relative w-full h-full bg-background robot-browser-session" style={{ isolation: 'isolate', zIndex: 0 }}>
                    {/* Connection status indicator */}
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
                    
                    {/* Connection success indicator (brief) */}
                    {showConnectedIndicator && (
                      <div className="absolute top-4 left-4 z-10 animate-in fade-in duration-300">
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-green-100/90 text-green-800 border border-green-200 shadow-lg backdrop-blur-sm">
                          <div className="w-4 h-4 bg-green-600 rounded-full animate-pulse"></div>
                          <span>Connected to Robot Session</span>
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
                              setShowConnectedIndicator(true)
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
                )}
              </div>
            </div>
          </div>

          {/* Messages View - 1/3 of available space */}
          <div className="w-1/3 h-full messages-area">
            <div className="h-full flex flex-col m-0 bg-card">
              <div className="flex-1 p-0 overflow-hidden">
                {isLoadingRobots || isPollingForInstance ? (
                  <div className="h-full flex items-center justify-center p-6">
                    <LoadingSkeleton variant="fullscreen" size="lg" />
                  </div>
                ) : !activeRobotInstance ? (
                  <div className="h-full flex items-center justify-center">
                    <EmptyCard
                      icon={<Settings className="h-16 w-16 text-primary/40" />}
                      title="No active sessions"
                      description="Robot sessions and communications will appear here when a robot is running."
                      variant="fancy"
                      showShadow={false}
                    />
                </div>
                              ) : (
                  <SimpleMessagesView 
                    className="h-full" 
                    activeRobotInstance={activeRobotInstance}
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