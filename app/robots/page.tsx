"use client"

import { useState, useEffect, Suspense, useCallback, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Settings, Globe, Target, Pause, Play, Trash2 } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
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
  const { getAllInstances, getInstanceById, refreshRobots, isLoading: isLoadingRobots, refreshCount } = useRobots()
  const searchParams = useSearchParams()
  const router = useRouter()
  
  // No campaigns view here

  // Instance selection via URL param
  const selectedInstanceParam = searchParams.get('instance')
  const allInstances = getAllInstances()
  // Default to 'new' when no instance param is provided
  const selectedInstanceId = selectedInstanceParam
    ? selectedInstanceParam
    : 'new'
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
  
  const activeTabRef = useRef(selectedInstanceId)
  const prevSiteIdRef = useRef<string | null>(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [hasMessageBeenSent, setHasMessageBeenSent] = useState(false)

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
  }, [activeRobotInstance])

  // Note: Robot events are now handled by the RobotsContext automatically
  // No need for manual event listeners here

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

  // Reset and realign selected instance when site changes
  useEffect(() => {
    const newSiteId = currentSite?.id || null
    if (newSiteId && newSiteId !== prevSiteIdRef.current) {
      // Reset connection state only; allow global navigation to dashboard to proceed
      setReconnectAttempts(0)
      setConnectionStatus('disconnected')
      setIsResuming(false)
      setStreamUrl(null)
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
        setReconnectTimeoutId(null)
      }

      prevSiteIdRef.current = newSiteId
    }
  }, [currentSite?.id])

  // After robots list refreshes, ensure selected instance exists for current site
  useEffect(() => {
    const all = getAllInstances()
    // If user explicitly selected 'new', honor it
    if (selectedInstanceId === 'new') return
    // If selected instance no longer exists (site switch or data refresh), fallback to 'new'
    const stillExists = all.some(inst => inst.id === selectedInstanceId)
    if (!stillExists) {
      const params = new URLSearchParams(searchParams.toString())
      params.set('instance', 'new')
      router.replace(`/robots?${params.toString()}`)
    }
  }, [refreshCount, getAllInstances, selectedInstanceId, router, searchParams])

  // No campaigns effect

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
    }
  }, [activeRobotInstance, isInstanceRunning])

  // Poll while instance is starting or resuming until it becomes ready or terminal
  useEffect(() => {
    if (!activeRobotInstance || (!isInstanceStarting && !isResuming)) return
    let intervalId = setInterval(async () => {
      await refreshRobots()
      const updated = getInstanceById((activeRobotInstance as any).id)
      if (updated && ['running','active','error','stopped','failed'].includes((updated as any).status)) {
        if (['running','active'].includes((updated as any).status)) {
          try {
            await ensureStreamUrl(updated)
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

  // Function to handle instance tab change
  const handleTabChange = (newInstance: string) => {
    const currentParams = new URLSearchParams(searchParams.toString())
    currentParams.set('instance', newInstance)
    router.push(`/robots?${currentParams.toString()}`)
  }

  

  return (
    <div className="flex-1 p-0">
      <StickyHeader>
        <div className="px-16 pt-0">
          <div className="flex items-center gap-4">
            <Tabs value={selectedInstanceId} onValueChange={handleTabChange}>
              <TabsList>
                {allInstances.length === 0 ? (
                  <TabsTrigger value="new">New Makina</TabsTrigger>
                ) : (
                  <>
                    {allInstances.map((inst) => (
                      <TabsTrigger key={inst.id} value={inst.id}>
                        <span className="flex items-center gap-2">
                          {['running','active'].includes((inst as any).status) ? (
                            <Play className="h-3 w-3 text-green-600" />
                          ) : (['starting','pending','initializing'].includes((inst as any).status) ? (
                            <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                          ) : (
                            <Pause className="h-3 w-3 text-muted-foreground" />
                          ))}
                          {`${inst.name || 'mk'}-${inst.id.slice(-4)}`}
                        </span>
                      </TabsTrigger>
                    ))}
                    <TabsTrigger value="new">New Makina</TabsTrigger>
                  </>
                )}
              </TabsList>
            </Tabs>
            
            {/* Delete button - only show when viewing a specific instance */}
            {selectedInstanceId !== 'new' && activeRobotInstance && (
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
      </StickyHeader>
      
      {/* Delete Confirmation Modal */}
      {activeRobotInstance && (
        <DeleteRobotModal
          open={isDeleteModalOpen}
          onOpenChange={setIsDeleteModalOpen}
          instanceId={activeRobotInstance.id}
          instanceName={activeRobotInstance.name || 'mk'}
          onDeleteSuccess={() => {
            refreshRobots()
          }}
        />
      )}
      
      <div className="flex h-[calc(100vh-136px)]">
          <>
            {((selectedInstanceId !== 'new' && (isLoadingRobots || isResuming || isInstanceStarting || isInstanceRunning)) || (isActivityRobot && hasMessageBeenSent)) && (
              <div className="w-2/3 h-full border-r border-border iframe-container">
                <div className="h-full flex flex-col m-0 bg-card">
                  <div className="flex-1 p-0 overflow-hidden relative">
                    {(isLoadingRobots && !isInstanceRunning) || isResuming || isInstanceStarting ? (
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
                    ) : null}
                  </div>
                </div>
              </div>
            )}

            {/* Messages View */}
            <div className={`${((selectedInstanceId !== 'new' && (isLoadingRobots || isResuming || isInstanceStarting || isInstanceRunning)) || (isActivityRobot && hasMessageBeenSent)) ? 'w-1/3' : 'w-full md:w-2/3 mx-auto'} h-full min-w-0 messages-area`}>
              <div className="h-full flex flex-col m-0 bg-card min-w-0">
                <div className="flex-1 p-0 overflow-hidden min-w-0 relative">
                  <div className="absolute inset-0">
                    <SimpleMessagesView 
                      className="h-full" 
                      activeRobotInstance={activeRobotInstance}
                      onMessageSent={setHasMessageBeenSent}
                    />
                  </div>
                </div>
              </div>
            </div>
          </>
      </div>
    </div>
  )
}