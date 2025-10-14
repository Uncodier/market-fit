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
}

interface RobotsByActivity {
  [activityName: string]: Robot[];
}

interface RobotsContextValue {
  robotsByActivity: RobotsByActivity;
  totalActiveRobots: number;
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
  console.log('🔄 [RobotsProvider] Component mounted/updated - currentSite:', currentSite)
  const [robotsByActivity, setRobotsByActivity] = useState<RobotsByActivity>({})
  const [totalActiveRobots, setTotalActiveRobots] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const hasInitiallyLoadedRef = useRef(false)
  const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null)
  const [refreshCount, setRefreshCount] = useState(0)
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true)
  
  // 🆕 Wait for site context to be fully synchronized (same logic as robots page)
  const [isSiteContextReady, setIsSiteContextReady] = useState(false)
  
  useEffect(() => {
    if (currentSite?.id) {
      // Add a small delay to ensure site context is fully synchronized
      const syncTimer = setTimeout(() => {
        console.log('🔄 [RobotsProvider] Site context synchronized for site:', currentSite.id)
        setIsSiteContextReady(true)
      }, 100) // 100ms delay to ensure synchronization
      
      return () => clearTimeout(syncTimer)
    } else {
      setIsSiteContextReady(false)
    }
  }, [currentSite?.id])
  
  // Log auto-refresh state changes
  useEffect(() => {
    console.log('🔄 [RobotsContext] Auto-refresh enabled:', autoRefreshEnabled)
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
    console.log('🔄 [RobotsContext] getAllInstances called - currentSite.id:', currentSite?.id)
    
    const allInstances = Object.values(robotsByActivity).flat()
    
    console.log('🔄 [RobotsContext] getAllInstances result:', {
      currentSiteId: currentSite?.id,
      totalInstances: allInstances.length,
      instances: allInstances.map(i => ({ id: i.id, name: i.name, site_id: i.site_id }))
    })
    
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
    console.log('🔄 [RobotsContext] refreshRobots called for site:', targetSiteId)
    console.log('🔄 [RobotsContext] refreshRobots - passed siteId:', siteId, 'currentSite.id:', currentSite?.id, 'using:', targetSiteId)
    
    // 🆕 CRITICAL: Force use of the most recent currentSite
    if (!targetSiteId) {
      console.error('🔄 [RobotsContext] CRITICAL: No siteId available, cannot proceed')
      return
    }
    
    // 🆕 Only proceed if site context is ready
    if (!isSiteContextReady) {
      console.log('🔄 [RobotsContext] Waiting for site context to be ready...')
      return
    }
    
    // 🆕 Homologated validation: same pattern as message temporal
    if (!siteId) {
      console.log('🔄 [RobotsContext] No current site, clearing robots')
      setRobotsByActivity({})
      setTotalActiveRobots(0)
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
      
      console.log('🔄 [RobotsContext] Fetching robots for site:', targetSiteId)
      console.log('🔄 [RobotsContext] CRITICAL: About to query with siteId:', targetSiteId, 'Type:', typeof targetSiteId)
      
      // Get all robots for the current site (exclude stopped instances)
      const { data: robots, error: robotsError } = await supabase
        .from('remote_instances')
        .select('id, status, instance_type, name, provider_instance_id, cdp_url, site_id, created_at')
        .eq('site_id', targetSiteId)  // 🆕 Use targetSiteId variable
        .neq('status', 'stopped')
        .order('created_at', { ascending: true }) // Oldest first
      
      console.log('🔄 [RobotsContext] Query result:', {
        requestedSiteId: targetSiteId,  // 🆕 Use targetSiteId variable
        currentSiteId: currentSite?.id,  // 🆕 Debug: compare with currentSite
        robotsCount: robots?.length || 0,
        robots: robots?.map((r: any) => ({ id: r.id, name: r.name, site_id: r.site_id })) || []
      })
      
      // 🆕 CRITICAL: Log if we got no robots for the current site
      if (!robots || robots.length === 0) {
        console.warn('🔄 [RobotsContext] WARNING: No robots found for site:', targetSiteId)
        console.warn('🔄 [RobotsContext] This might mean the site has no instances or there was a query error')
      }
      
      // 🆕 CRITICAL: Check if we got robots for the correct site
      if (robots && robots.length > 0) {
        const wrongSiteRobots = robots.filter((r: any) => r.site_id !== targetSiteId)
        if (wrongSiteRobots.length > 0) {
          console.error('🔄 [RobotsContext] CRITICAL: Got robots from wrong site!', {
            requestedSiteId: targetSiteId,
            wrongSiteRobots: wrongSiteRobots.map((r: any) => ({ id: r.id, site_id: r.site_id }))
          })
        }
      }

      if (robotsError) {
        console.error('Error fetching robots:', robotsError)
        setError('Failed to fetch robots')
        return
      }

      // Organize robots by activity name
      const organizedRobots: RobotsByActivity = {}
      let activeCount = 0

      robots?.forEach((robot: Robot) => {
        if (!organizedRobots[robot.name]) {
          organizedRobots[robot.name] = []
        }
        organizedRobots[robot.name].push(robot)

        // Count active robots (exclude paused and uninstantiated)
        if (['running', 'active', 'starting', 'pending', 'initializing'].includes(robot.status)) {
          activeCount++
        }
      })

      // Sort instances within each activity by creation date (oldest first)
      Object.keys(organizedRobots).forEach(activityName => {
        organizedRobots[activityName].sort((a, b) => {
          const dateA = new Date(a.created_at || 0).getTime()
          const dateB = new Date(b.created_at || 0).getTime()
          return dateA - dateB // Oldest first
        })
      })

      console.log('🔄 [RobotsContext] Fetched robots:', {
        siteId: siteId,  // 🆕 Use homologated siteId variable
        robotsCount: robots?.length || 0,
        robots: robots?.map((r: any) => ({ id: r.id, name: r.name, site_id: r.site_id })),
        organizedActivities: Object.keys(organizedRobots),
        activeCount
      })

      // Always update state when site changes to ensure fresh data
      setRobotsByActivity(organizedRobots)
      setTotalActiveRobots(activeCount)

      console.log('🔄 [RobotsContext] State updated successfully')

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

  // Initial load when site changes - SIMPLIFIED to avoid clearing instances unnecessarily
  useEffect(() => {
    console.log('🔄 [RobotsContext] Site changed for site:', currentSite?.id)
    
    // Only reset if we have a valid site
    if (currentSite?.id) {
      console.log('🔄 [RobotsContext] Calling refreshRobots for site:', currentSite.id)
      refreshRobots(currentSite.id)
    } else {
      console.log('🔄 [RobotsContext] No site available, clearing robots')
      setRobotsByActivity({})
      setTotalActiveRobots(0)
    }
  }, [currentSite?.id, refreshRobots])

  // Setup real-time monitoring
  useEffect(() => {
    if (!currentSite?.id || !isSiteContextReady) return

    const supabase = createClient()
    
    const robotsSubscription = supabase
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
          if (!autoRefreshEnabled) {
            return
          }
          
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
      .subscribe((status: any) => {
        console.log('🔄 [RobotsContext] Subscription status:', status)
        if (status === 'SUBSCRIBED') {
          console.log('🔄 [RobotsContext] Subscription is active and ready to receive events')
        } else if (status === 'CHANNEL_ERROR') {
          console.error('🔄 [RobotsContext] Subscription error - check Supabase configuration')
        }
      })

    return () => {
      robotsSubscription.unsubscribe()
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
    }
  }, [currentSite?.id, refreshRobots, autoRefreshEnabled])

  // 🆕 Separate useEffect to handle site context synchronization
  useEffect(() => {
    if (isSiteContextReady && currentSite?.id) {
      console.log('🔄 [RobotsContext] Site context is ready, setting up real-time monitoring for site:', currentSite.id)
      // The real-time monitoring will be handled by the previous useEffect
    }
  }, [isSiteContextReady, currentSite?.id])

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
    totalActiveRobots,
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
    setAutoRefreshEnabled
  }

  return (
    <RobotsContext.Provider value={value}>
      {children}
    </RobotsContext.Provider>
  )
}
