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
import { BrowserSkeleton } from "@/app/components/skeletons/browser-skeleton"
import { createClient } from "@/lib/supabase/client"

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
    <Suspense fallback={<div className="flex justify-center items-center min-h-screen">Loading...</div>}>
      <RobotsPageContent />
    </Suspense>
  )
}

// Main content component
function RobotsPageContent() {
  const { isLayoutCollapsed } = useLayout()
  const { currentSite } = useSite()
  const searchParams = useSearchParams()
  const router = useRouter()

  // Get tab from URL params or default to channel-market-fit
  const activeTab = searchParams.get('tab') || 'channel-market-fit'
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

  // Map tab values to activity names (for robot name matching)
  const getActivityName = (tabValue: string): string => {
    const activityMap: Record<string, string> = {
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
    if (!currentSite) {
      setActiveRobotInstance(null)
      setStreamUrl(null)
      setIsLoadingRobots(false)
      return
    }

    try {
      setIsLoadingRobots(true)
      const supabase = createClient()
      
      // Get the activity name for the current tab to use as robot name filter
      const activityName = getActivityName(activeTab)
      
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
        setActiveRobotInstance(instance)
        
        if (instance) {
          console.log(`Found active robot for ${activityName}:`, instance)
          // Check if we need to get/update the stream URL
          await ensureStreamUrl(instance)
        } else {
          console.log(`No active robot found for ${activityName}`)
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
        
        const { data, error } = await supabase
          .from('remote_instances')
          .select('id, status, instance_type, name, provider_instance_id, cdp_url')
          .eq('site_id', currentSite.id)
          .eq('name', activityName)
          .in('status', ['running', 'active', 'failed', 'error'])
          .limit(1)

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

  // Check for active robots when site changes and setup real-time monitoring
  useEffect(() => {
    checkActiveRobots()

    // Setup real-time subscription for remote_instances changes
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
            console.log('Real-time instance update:', payload)
            
            // Get current activity name for filtering
            const currentActivityName = getActivityName(activeTab)
            
            // Check if this change affects the current tab's activity
            if (payload.new?.name === currentActivityName || payload.old?.name === currentActivityName) {
              console.log(`Instance change detected for ${currentActivityName}, refreshing...`)
              
              // Handle different event types
              if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
                const instance = payload.new
                
                // If instance is stopped or error, clear the stream and stop polling
                if (instance.status === 'stopped' || instance.status === 'error' || instance.status === 'failed') {
                  console.log(`Instance ${instance.name} stopped/error/failed, clearing stream`)
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
  }, [checkActiveRobots, currentSite, activeTab])

  // Function to handle tab change
  const handleTabChange = (newTab: string) => {
    const currentParams = new URLSearchParams(searchParams.toString())
    currentParams.set('tab', newTab)
    router.push(`/robots?${currentParams.toString()}`)
  }

  return (
    <div className="flex-1 p-0">
          <StickyHeader>
            <div className="px-16 pt-0">
              <div className="flex items-center gap-4">
            <Tabs value={activeTab} onValueChange={handleTabChange}>
                  <TabsList>
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
          <div className="w-2/3 h-full border-r border-border">
            <div className="h-full flex flex-col m-0 bg-card">
              <div className="flex-1 p-0 overflow-hidden">
                {isLoadingRobots || isPollingForInstance ? (
                  <div className="h-full flex flex-col">
                    {/* Robot startup loading state */}
                    <div className="h-full bg-muted/50 rounded-lg flex flex-col items-center justify-center p-8 relative overflow-hidden">
                      {/* Browser skeleton frame */}
                      <div className="w-full h-full border-2 border-dashed border-muted-foreground/20 rounded-lg flex flex-col">
                        {/* Browser toolbar skeleton */}
                        <div className="h-12 bg-muted/30 rounded-t-lg border-b border-muted-foreground/20 flex items-center px-4 gap-2">
                          <div className="flex gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-400/40 animate-pulse"></div>
                            <div className="w-3 h-3 rounded-full bg-yellow-400/40 animate-pulse"></div>
                            <div className="w-3 h-3 rounded-full bg-green-400/40 animate-pulse"></div>
                          </div>
                          <div className="flex-1 mx-4">
                            <div className="h-6 bg-muted/50 rounded animate-pulse"></div>
                          </div>
                        </div>
                        
                        {/* Browser content skeleton */}
                        <div className="flex-1 p-6 space-y-4">
                          <div className="space-y-3">
                            <div className="h-4 bg-muted/40 rounded w-3/4 animate-pulse"></div>
                            <div className="h-4 bg-muted/40 rounded w-1/2 animate-pulse"></div>
                            <div className="h-4 bg-muted/40 rounded w-5/6 animate-pulse"></div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 mt-8">
                            <div className="h-24 bg-muted/40 rounded animate-pulse"></div>
                            <div className="h-24 bg-muted/40 rounded animate-pulse"></div>
                          </div>
                          
                          <div className="space-y-2 mt-6">
                            <div className="h-3 bg-muted/40 rounded w-full animate-pulse"></div>
                            <div className="h-3 bg-muted/40 rounded w-4/5 animate-pulse"></div>
                            <div className="h-3 bg-muted/40 rounded w-3/5 animate-pulse"></div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Loading overlay */}
                      <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex flex-col items-center justify-center">
                        <div className="flex flex-col items-center space-y-4">
                          <div className="relative">
                            <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary/20 border-t-primary"></div>
                            <div className="absolute inset-0 animate-ping rounded-full h-12 w-12 border-2 border-primary/40"></div>
                          </div>
                          
                          <div className="text-center space-y-2">
                            <h3 className="text-lg font-semibold text-foreground">
                              {isPollingForInstance ? 'Starting Robot Browser...' : 'Loading Robot Session...'}
                            </h3>
                            <p className="text-sm text-muted-foreground max-w-md">
                              {isPollingForInstance 
                                ? `Setting up robot instance (${pollingAttempts}/${maxPollingAttempts})` 
                                : 'Initializing robot components...'
                              }
                            </p>
                            
                            {isPollingForInstance && (
                              <div className="mt-4">
                                <div className="w-48 bg-muted rounded-full h-2">
                                  <div 
                                    className="bg-primary h-2 rounded-full transition-all duration-300" 
                                    style={{ width: `${(pollingAttempts / maxPollingAttempts) * 100}%` }}
                                  ></div>
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                  Checking for successful startup...
                                </p>
                              </div>
                            )}
                          </div>
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
                  <div className="relative w-full h-full">
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
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600"></div>
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
                    
                    <iframe
                      src={streamUrl || "https://www.google.com"}
                      className="w-full h-full border-0"
                      title={streamUrl ? "Robot Browser Session" : "Google"}
                      allowFullScreen
                      allow="fullscreen; autoplay; camera; microphone; clipboard-read; clipboard-write"
                      sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
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
                )}
              </div>
            </div>
          </div>

          {/* Messages View - 1/3 of available space */}
          <div className="w-1/3 h-full">
            <div className="h-full flex flex-col m-0 bg-card">
              <div className="flex-1 p-0 overflow-hidden">
                {isLoadingRobots || isPollingForInstance ? (
                  <div className="h-full flex items-center justify-center p-6">
                    <div className="text-center space-y-4">
                      <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary/20 border-t-primary mx-auto"></div>
                      <div className="space-y-2">
                        <h3 className="text-sm font-medium text-foreground">
                          {isPollingForInstance ? 'Setting up communication...' : 'Loading messages...'}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {isPollingForInstance 
                            ? 'Preparing robot messaging interface'
                            : 'Initializing session...'
                          }
                        </p>
                      </div>
                    </div>
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