"use client"

import { useState, useEffect, Suspense, useCallback, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Settings, Globe, Target } from "@/app/components/ui/icons"
import { useLayout } from "@/app/context/LayoutContext"
import { useSite } from "@/app/context/SiteContext"
import { useRobots } from "@/app/context/RobotsContext"
import { getCampaigns } from "@/app/campaigns/actions/campaigns/read"
import type { Campaign } from "@/app/types"
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
  const { getActiveRobotForActivity, hasActiveRobotsForActivity, isLoading: isLoadingRobots } = useRobots()
  const searchParams = useSearchParams()
  const router = useRouter()
  
  // Campaign state
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(false)
  
  console.log('🚀 Hooks loaded, currentSite:', currentSite?.id || 'null')

  // Get tab from URL params or default to free-agent
  const activeTab = searchParams.get('tab') || 'free-agent'
  const activeRobotInstance = getActiveRobotForActivity(activeTab)
  const [streamUrl, setStreamUrl] = useState<string | null>(null)

  // Reconnection states
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting' | 'error'>('disconnected')
  const [reconnectAttempts, setReconnectAttempts] = useState(0)
  const [maxReconnectAttempts] = useState(5)
  const [reconnectTimeoutId, setReconnectTimeoutId] = useState<NodeJS.Timeout | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [showConnectedIndicator, setShowConnectedIndicator] = useState(false)
  
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

  // Update activeTab ref when activeTab changes
  useEffect(() => {
    activeTabRef.current = activeTab
  }, [activeTab])

  // Fetch campaigns for campaigns tab
  useEffect(() => {
    const fetchCampaigns = async () => {
      if (activeTab === 'campaigns' && currentSite?.id) {
        setIsLoadingCampaigns(true)
        try {
          const result = await getCampaigns(currentSite.id)
          if (result.data && !result.error) {
            // Filter out completed campaigns - we only want active and pending
            const nonCompletedCampaigns = result.data.filter(campaign => 
              campaign.status !== 'completed'
            )
            setCampaigns(nonCompletedCampaigns)
          }
        } catch (error) {
          console.error('Error fetching campaigns:', error)
        } finally {
          setIsLoadingCampaigns(false)
        }
      }
    }

    fetchCampaigns()
  }, [activeTab, currentSite?.id])

  // Update stream URL when active robot changes
  useEffect(() => {
    if (activeRobotInstance) {
      console.log(`✅ Found active robot for ${activeTab}:`, activeRobotInstance)
      ensureStreamUrl(activeRobotInstance)
    } else {
      console.log(`❌ No active robot found for ${activeTab}`)
      setStreamUrl(null)
      setConnectionStatus('disconnected')
    }
  }, [activeRobotInstance, activeTab])

  // Note: Real-time monitoring is now handled by RobotsContext
  // This ensures efficient data sharing across all components

  // Function to handle tab change
  const handleTabChange = (newTab: string) => {
    const currentParams = new URLSearchParams(searchParams.toString())
    currentParams.set('tab', newTab)
    router.push(`/robots?${currentParams.toString()}`)
  }

  // Debug log to see what's happening
  console.log('🤖 Robots page render - activeRobotInstance:', activeRobotInstance?.id || 'null', 'isLoadingRobots:', isLoadingRobots, 'activeTab:', activeTab)

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
                <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </StickyHeader>
      
      <div className="flex h-[calc(100vh-136px)]">
        {/* For campaigns tab, show full-width content */}
        {activeTab === 'campaigns' ? (
          <div className="w-full h-full">
            <div className="h-full flex flex-col m-0 bg-card">
              <div className="flex-1 p-8 overflow-auto">
                {isLoadingCampaigns ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                      <p className="text-sm text-muted-foreground">Loading campaigns...</p>
                    </div>
                  </div>
                ) : campaigns.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <EmptyState
                      icon={<Target className="h-16 w-16 text-primary/40" />}
                      title="No active campaigns"
                      description="Create campaigns to see them appear here. Only active and pending campaigns are shown."
                      variant="fancy"
                    />
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {campaigns.map((campaign) => (
                        <div
                          key={campaign.id}
                          className="bg-card border border-border rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                          onClick={() => router.push(`/campaigns/${campaign.id}`)}
                        >
                          <div className="flex items-start justify-between mb-4">
                            <h3 className="font-semibold text-lg line-clamp-2">{campaign.title}</h3>
                            <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                              campaign.status === 'active' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {campaign.status}
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                            {campaign.description}
                          </p>
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-muted-foreground">
                              {campaign.type}
                            </div>
                            <div className={`px-2 py-1 rounded text-xs font-medium ${
                              campaign.priority === 'high' 
                                ? 'bg-red-100 text-red-800'
                                : campaign.priority === 'medium'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {campaign.priority}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Web View - 2/3 of available space */}
            <div className="w-2/3 h-full border-r border-border iframe-container">
              <div className="h-full flex flex-col m-0 bg-card">
                <div className="flex-1 p-0 overflow-hidden">
                  {isLoadingRobots ? (
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
                              Loading Robot Session...
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Initializing robot components...
                            </p>
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
                  {isLoadingRobots ? (
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
          </>
        )}
      </div>
    </div>
  )
}