"use client"

import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from "react"
import { useSite } from "@/app/context/SiteContext"
import { createClient } from "@/lib/supabase/client"

// Robot interface
interface Robot {
  id: string;
  name: string;
  status: string;
  instance_type: string;
  provider_instance_id?: string;
  cdp_url?: string;
  site_id: string;
  created_at?: string;
  requirement_title?: string;
}

interface RobotsByActivity {
  [activityName: string]: Robot[];
}

interface RobotsContextValue {
  robotsByActivity: RobotsByActivity;
  totalRunningRobots: number;
  isLoading: boolean;
  error: string | null;
  lastRefreshAt: number | null;
  refreshCount: number;
  getRobotsForActivity: (activityName: string) => Robot[];
  getActiveRobotForActivity: (activityName: string) => Robot | null;
  hasActiveRobotsForActivity: (activityName: string) => boolean;
  getAllInstances: () => Robot[];
  getInstanceById: (id: string) => Robot | null;
  refreshRobots: (siteId?: string) => Promise<void>;
  setAutoRefreshEnabled: (enabled: boolean) => void;
  ensureRealtimeHealthy: () => void;
}

const RobotsContext = createContext<RobotsContextValue | undefined>(undefined)

export function useRobots() {
  const context = useContext(RobotsContext)
  if (!context) {
    throw new Error('useRobots must be used within a RobotsProvider')
  }
  return context
}

interface RobotsProviderProps {
  children: ReactNode;
}

export function RobotsProvider({ children }: RobotsProviderProps) {
  const { currentSite } = useSite()
  const [robotsByActivity, setRobotsByActivity] = useState<RobotsByActivity>({})
  const [totalRunningRobots, setTotalRunningRobots] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const hasInitiallyLoadedRef = useRef(false)
  const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null)
  const [refreshCount, setRefreshCount] = useState(0)
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true)
  const robotsSubscriptionRef = useRef<any>(null)
  const robotsSubscriptionStatusRef = useRef<string>('INIT')
  const isResubscribingRef = useRef(false)
  
  // 🆕 Wait for site context to be fully synchronized (same logic as robots page)
  const [isSiteContextReady, setIsSiteContextReady] = useState(false)
  
  useEffect(() => {
    if (currentSite?.id) {
      // Add a small delay to ensure site context is fully synchronized
      const syncTimer = setTimeout(() => {
        setIsSiteContextReady(true)
      }, 100) // 100ms delay to ensure synchronization
      
      return () => clearTimeout(syncTimer)
    } else {
      setIsSiteContextReady(false)
    }
  }, [currentSite?.id])
  
  // Log auto-refresh state changes
  useEffect(() => {
  }, [autoRefreshEnabled])
  

  // Map activity names
  const activityMap: Record<string, string> = {
    "free-agent": "Free Agent",
    "channel-market-fit": "Channel Market Fit",
    "engage": "Engage in Social Networks", 
    "seo": "SEO",
    "publish-content": "Publish Content",
    "publish-ads": "Publish Ads",
    "ux-analysis": "UX Analysis",
    "build-requirements": "Build Requirements",
    "execute-plan": "Execute Plan",
    "Assistant Session": "Assistant Session"
  }

  // Get robots for a specific activity
  const getRobotsForActivity = useCallback((activityName: string): Robot[] => {
    const fullActivityName = activityMap[activityName] || activityName
    return robotsByActivity[fullActivityName] || []
  }, [robotsByActivity])

  // Get the active robot for a specific activity
  const getActiveRobotForActivity = useCallback((activityName: string): Robot | null => {
    const robots = getRobotsForActivity(activityName)
    const activeRobot = robots.find(robot => 
      ['running', 'active'].includes(robot.status)
    )
    return activeRobot || null
  }, [getRobotsForActivity])

  // Check if there are active robots for a specific activity
  const hasActiveRobotsForActivity = useCallback((activityName: string): boolean => {
    const robots = getRobotsForActivity(activityName)
    return robots.some(robot => 
      ['running', 'active', 'starting', 'pending', 'initializing'].includes(robot.status)
    )
  }, [getRobotsForActivity])

  // Return all instances across activities (includes paused)
  const getAllInstances = useCallback((): Robot[] => {
    
    const allInstances = Object.values(robotsByActivity).flat()
    
    return allInstances
  }, [robotsByActivity, currentSite?.id])

  // Find instance by id
  const getInstanceById = useCallback((id: string): Robot | null => {
    for (const list of Object.values(robotsByActivity)) {
      const found = list.find(r => r.id === id)
      if (found) return found
    }
    return null
  }, [robotsByActivity])

  // Function to fetch all robots and organize by activity
  const refreshRobots = useCallback(async (siteId?: string) => {
    // 🆕 Use passed siteId or fallback to currentSite?.id
    const targetSiteId = siteId || currentSite?.id
    
    // 🆕 CRITICAL: Force use of the most recent currentSite
    if (!targetSiteId) {
      console.error('🔄 [RobotsContext] CRITICAL: No siteId available, cannot proceed')
      return
    }
    
    // 🆕 Only proceed if site context is ready
    if (!isSiteContextReady) {
      return
    }
    
    // 🆕 Homologated validation: same pattern as message temporal
    if (!siteId) {
      setRobotsByActivity({})
      setTotalRunningRobots(0)
      setIsLoading(false)
      hasInitiallyLoadedRef.current = true
      return
    }

    try {
      // Only show loading state on initial load, not on refreshes
      if (!hasInitiallyLoadedRef.current) {
        setIsLoading(true)
      }
      setError(null)
      
      const supabase = createClient()
      
      
      // Get all robots for the current site (includes active, paused, and stopped instances)
      const { data: robots, error: robotsError } = await supabase
        .from('remote_instances')
        .select('id, status, instance_type, name, provider_instance_id, cdp_url, site_id, created_at, updated_at')
        .eq('site_id', targetSiteId)  // 🆕 Use targetSiteId variable
        .order('updated_at', { ascending: false }) // Most recently updated first
      
      // CRITICAL: Log if we got no robots for the current site
      if (!robots || robots.length === 0) {
        console.warn('🔄 [RobotsContext] WARNING: No robots found for site:', targetSiteId)
        console.warn('🔄 [RobotsContext] This might mean the site has no instances or there was a query error')
      }
      
      // CRITICAL: Check if we got robots for the correct site
      if (robots && robots.length > 0) {
        const wrongSiteRobots = robots.filter((r: any) => r.site_id !== targetSiteId)
        if (wrongSiteRobots.length > 0) {
          console.error('🔄 [RobotsContext] CRITICAL: Got robots from wrong site!', {
            requestedSiteId: targetSiteId,
            wrongSiteRobots: wrongSiteRobots.map((r: any) => ({ id: r.id, site_id: r.site_id }))
          })
        }

        // Fetch requirement titles for instances named req-runner-* or req-maint-*
        const requirementIds = robots.map((r: any) => {
          if (r.name?.startsWith('req-runner-')) return r.name.replace('req-runner-', '');
          if (r.name?.startsWith('req-maint-')) return r.name.replace('req-maint-', '');
          return null;
        }).filter(Boolean);

        if (requirementIds.length > 0) {
          const { data: requirements } = await supabase
            .from('requirements')
            .select('id, title, backlog')
            .in('id', requirementIds);

          if (requirements && requirements.length > 0) {
            const reqMap = Object.fromEntries(requirements.map((req: any) => [req.id, { title: req.title, backlog: req.backlog }]));
            robots.forEach((r: any) => {
              if (r.name?.startsWith('req-runner-')) {
                const reqId = r.name.replace('req-runner-', '');
                if (reqMap[reqId]) {
                  r.requirement_title = reqMap[reqId].title;
                  r.requirement_backlog = reqMap[reqId].backlog;
                }
              } else if (r.name?.startsWith('req-maint-')) {
                const reqId = r.name.replace('req-maint-', '');
                if (reqMap[reqId]) {
                  r.requirement_title = `QA | ${reqMap[reqId].title}`;
                  r.requirement_backlog = reqMap[reqId].backlog;
                }
              }
            });
          }
        }
      }

      if (robotsError) {
        console.error('Error fetching robots:', robotsError)
        setError('Failed to fetch robots')
        return
      }

      // Organize robots by activity name
      const organizedRobots: RobotsByActivity = {}
      let runningCount = 0

      robots?.forEach((robot: Robot) => {
        if (!organizedRobots[robot.name]) {
          organizedRobots[robot.name] = []
        }
        organizedRobots[robot.name].push(robot)

        // Count running robots for the badge
        if (robot.status === 'running') {
          runningCount++
        }
      })

      // Sort instances within each activity: 'play' status first, then by updated_at descending
      Object.keys(organizedRobots).forEach(activityName => {
        organizedRobots[activityName].sort((a, b) => {
          const playStatuses = ['running', 'active', 'starting', 'pending', 'initializing'];
          const aIsPlay = playStatuses.includes(a.status) ? 1 : 0;
          const bIsPlay = playStatuses.includes(b.status) ? 1 : 0;
          
          if (aIsPlay !== bIsPlay) {
            return bIsPlay - aIsPlay;
          }
          
          const dateA = new Date(a.updated_at || a.created_at || 0).getTime()
          const dateB = new Date(b.updated_at || b.created_at || 0).getTime()
          return dateB - dateA // Newest first
        })
      })

      // Always update state when site changes to ensure fresh data
      setRobotsByActivity(organizedRobots)
      setTotalRunningRobots(runningCount)


    } catch (error) {
      console.error('Error refreshing robots:', error)
      setError('Failed to refresh robots')
    } finally {
      if (!hasInitiallyLoadedRef.current) {
        setIsLoading(false)
        hasInitiallyLoadedRef.current = true
      }
      const now = Date.now()
      setLastRefreshAt(now)
      setRefreshCount(prev => prev + 1)
      // quiet: omit refresh completed log
    }
  }, [currentSite?.id, isSiteContextReady])

  const teardownRealtimeSubscription = useCallback(() => {
    if (robotsSubscriptionRef.current) {
      try {
        const supabase = createClient()
        supabase.removeChannel(robotsSubscriptionRef.current)
      } catch (e) {
        console.warn('[RobotsContext] Failed to unsubscribe from realtime channel:', e)
      } finally {
        robotsSubscriptionRef.current = null
        robotsSubscriptionStatusRef.current = 'CLOSED'
      }
    }
  }, [])

  const setupRealtimeSubscription = useCallback(() => {
    if (!currentSite?.id || !isSiteContextReady) return

    const supabase = createClient()
    teardownRealtimeSubscription()

    const channel = supabase
      .channel(`robots_context_${currentSite.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'remote_instances',
          filter: `site_id=eq.${currentSite.id}`
        },
        (payload: any) => {
          if (!autoRefreshEnabled) return

          // Refresh on any instance change (INSERT, UPDATE, DELETE)
          if (refreshTimeoutRef.current) {
            clearTimeout(refreshTimeoutRef.current)
          }

          // Use different delays based on event type
          const delay = payload.eventType === 'INSERT' ? 300 : 500
          refreshTimeoutRef.current = setTimeout(() => {
            refreshRobots(currentSite?.id)
          }, delay)
        }
      )
      .subscribe((status: string, err?: any) => {
        robotsSubscriptionStatusRef.current = status
        if (status === 'SUBSCRIBED') {
        } else if (status === 'CHANNEL_ERROR') {
          // CHANNEL_ERROR is expected temporarily when network drops or during fast tab switching.
          // Supabase's realtime client auto-reconnects, so we don't need to log this as a critical error.
          console.warn('🔄 [RobotsContext] Temporary subscription error (auto-reconnecting...)', err || '')
        } else if (status === 'TIMED_OUT') {
          console.warn('🔄 [RobotsContext] Subscription timed out (auto-reconnecting...)')
        }
      })

    robotsSubscriptionRef.current = channel
  }, [autoRefreshEnabled, currentSite?.id, isSiteContextReady, refreshRobots, teardownRealtimeSubscription])

  const ensureRealtimeHealthy = useCallback(() => {
    if (!currentSite?.id || !isSiteContextReady) return

    const status = robotsSubscriptionStatusRef.current
    const hasChannel = Boolean(robotsSubscriptionRef.current)
    const shouldResubscribe =
      !hasChannel ||
      status === 'CHANNEL_ERROR' ||
      status === 'TIMED_OUT' ||
      status === 'CLOSED'

    if (!shouldResubscribe) return
    if (isResubscribingRef.current) return

    isResubscribingRef.current = true
    try {
      setupRealtimeSubscription()
    } finally {
      isResubscribingRef.current = false
    }
  }, [currentSite?.id, isSiteContextReady, setupRealtimeSubscription])

  // Initial load when site changes - SIMPLIFIED to avoid clearing instances unnecessarily
  useEffect(() => {
    
    // Only reset if we have a valid site
    if (currentSite?.id) {
      refreshRobots(currentSite.id)
    } else {
      setRobotsByActivity({})
      setTotalRunningRobots(0)
    }
  }, [currentSite?.id, refreshRobots])

  // Setup real-time monitoring
  useEffect(() => {
    if (!currentSite?.id || !isSiteContextReady) return

    setupRealtimeSubscription()

    return () => {
      teardownRealtimeSubscription()
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
    }
  }, [currentSite?.id, isSiteContextReady, setupRealtimeSubscription, teardownRealtimeSubscription])

  // 🆕 Separate useEffect to handle site context synchronization
  useEffect(() => {
    if (isSiteContextReady && currentSite?.id) {
      // The real-time monitoring will be handled by the previous useEffect
    }
  }, [isSiteContextReady, currentSite?.id])

  // Solo recargar datos al volver a la pestaña (Supabase reconecta el socket automáticamente)
  useEffect(() => {
    let debounceTimer: NodeJS.Timeout;
    
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => {
          if (currentSite?.id && isSiteContextReady) {
            refreshRobots(currentSite.id)
          }
        }, 1000)
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      clearTimeout(debounceTimer)
    }
  }, [currentSite?.id, isSiteContextReady, refreshRobots])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
    }
  }, [])

  const value: RobotsContextValue = {
    robotsByActivity,
    totalRunningRobots,
    isLoading,
    error,
    lastRefreshAt,
    refreshCount,
    getRobotsForActivity,
    getActiveRobotForActivity,
    hasActiveRobotsForActivity,
    getAllInstances,
    getInstanceById,
    refreshRobots,
    setAutoRefreshEnabled,
    ensureRealtimeHealthy
  }

  return (
    <RobotsContext.Provider value={value}>
      {children}
    </RobotsContext.Provider>
  )
}
