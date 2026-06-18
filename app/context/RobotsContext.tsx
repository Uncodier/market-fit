import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef, useMemo } from "react"
import useSWR from 'swr'
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
  updated_at?: string;
  requirement_title?: string;
  requirement_backlog?: any;
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
  const [error, setError] = useState<string | null>(null)
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null)
  const [refreshCount, setRefreshCount] = useState(0)
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true)
  const robotsSubscriptionRef = useRef<any>(null)
  const robotsSubscriptionStatusRef = useRef<string>('INIT')
  const isResubscribingRef = useRef(false)
  
  const [isSiteContextReady, setIsSiteContextReady] = useState(false)
  
  useEffect(() => {
    if (currentSite?.id) {
      const syncTimer = setTimeout(() => {
        setIsSiteContextReady(true)
      }, 100)
      return () => clearTimeout(syncTimer)
    } else {
      setIsSiteContextReady(false)
    }
  }, [currentSite?.id])

  const { data: robotsData, isLoading, mutate } = useSWR(
    isSiteContextReady && currentSite?.id ? ['remote_instances', currentSite.id] : null,
    async ([_, siteId]) => {
      const supabase = createClient()
      const { data: robots, error: robotsError } = await supabase
        .from('remote_instances')
        .select('id, status, instance_type, name, provider_instance_id, cdp_url, site_id, created_at, updated_at')
        .eq('site_id', siteId)
        .order('updated_at', { ascending: false })
      
      if (robotsError) {
        console.error('Error fetching robots:', robotsError)
        setError('Failed to fetch robots')
        throw robotsError
      }
      setError(null)
      
      if (robots && robots.length > 0) {
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
      return robots || []
    }
  )

  const { robotsByActivity, totalRunningRobots } = useMemo(() => {
    const organized: RobotsByActivity = {}
    let runningCount = 0

    const robots = robotsData || []

    robots.forEach((robot: Robot) => {
      if (!organized[robot.name]) {
        organized[robot.name] = []
      }
      organized[robot.name].push(robot)

      if (robot.status === 'running') {
        runningCount++
      }
    })

    Object.keys(organized).forEach(activityName => {
      organized[activityName].sort((a, b) => {
        const playStatuses = ['running', 'active', 'starting', 'pending', 'initializing'];
        const aIsPlay = playStatuses.includes(a.status) ? 1 : 0;
        const bIsPlay = playStatuses.includes(b.status) ? 1 : 0;
        
        if (aIsPlay !== bIsPlay) {
          return bIsPlay - aIsPlay;
        }
        
        const dateA = new Date(a.updated_at || a.created_at || 0).getTime()
        const dateB = new Date(b.updated_at || b.created_at || 0).getTime()
        return dateB - dateA
      })
    })

    return { robotsByActivity: organized, totalRunningRobots: runningCount }
  }, [robotsData])

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

  const getRobotsForActivity = useCallback((activityName: string): Robot[] => {
    const fullActivityName = activityMap[activityName] || activityName
    return robotsByActivity[fullActivityName] || []
  }, [robotsByActivity])

  const getActiveRobotForActivity = useCallback((activityName: string): Robot | null => {
    const robots = getRobotsForActivity(activityName)
    const activeRobot = robots.find(robot => 
      ['running', 'active'].includes(robot.status)
    )
    return activeRobot || null
  }, [getRobotsForActivity])

  const hasActiveRobotsForActivity = useCallback((activityName: string): boolean => {
    const robots = getRobotsForActivity(activityName)
    return robots.some(robot => 
      ['running', 'active', 'starting', 'pending', 'initializing'].includes(robot.status)
    )
  }, [getRobotsForActivity])

  const getAllInstances = useCallback((): Robot[] => {
    return Object.values(robotsByActivity).flat()
  }, [robotsByActivity])

  const getInstanceById = useCallback((id: string): Robot | null => {
    for (const list of Object.values(robotsByActivity)) {
      const found = list.find(r => r.id === id)
      if (found) return found
    }
    return null
  }, [robotsByActivity])

  const refreshRobots = useCallback(async (siteId?: string) => {
    if (!isSiteContextReady) return
    try {
      await mutate()
      setLastRefreshAt(Date.now())
      setRefreshCount(prev => prev + 1)
    } catch (error) {
      console.error('Error refreshing robots:', error)
    }
  }, [mutate, isSiteContextReady])

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
          if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current)
          
          const delay = payload.eventType === 'INSERT' ? 300 : 500
          refreshTimeoutRef.current = setTimeout(() => {
            mutate()
          }, delay)
        }
      )
      .subscribe((status: string, err?: any) => {
        robotsSubscriptionStatusRef.current = status
        if (status === 'SUBSCRIBED') {
        } else if (status === 'CHANNEL_ERROR') {
          console.warn('🔄 [RobotsContext] Temporary subscription error (auto-reconnecting...)', err || '')
        } else if (status === 'TIMED_OUT') {
          console.warn('🔄 [RobotsContext] Subscription timed out (auto-reconnecting...)')
        }
      })

    robotsSubscriptionRef.current = channel
  }, [autoRefreshEnabled, currentSite?.id, isSiteContextReady, teardownRealtimeSubscription, mutate])

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

  useEffect(() => {
    if (!currentSite?.id || !isSiteContextReady) return
    setupRealtimeSubscription()
    return () => {
      teardownRealtimeSubscription()
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current)
    }
  }, [currentSite?.id, isSiteContextReady, setupRealtimeSubscription, teardownRealtimeSubscription])

  useEffect(() => {
    let debounceTimer: NodeJS.Timeout;
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => {
          if (currentSite?.id && isSiteContextReady) {
            mutate()
          }
        }, 1000)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      clearTimeout(debounceTimer)
    }
  }, [currentSite?.id, isSiteContextReady, mutate])

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current)
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
