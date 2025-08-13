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
}

interface RobotsByActivity {
  [activityName: string]: Robot[];
}

interface RobotsContextValue {
  robotsByActivity: RobotsByActivity;
  totalActiveRobots: number;
  isLoading: boolean;
  error: string | null;
  getRobotsForActivity: (activityName: string) => Robot[];
  getActiveRobotForActivity: (activityName: string) => Robot | null;
  hasActiveRobotsForActivity: (activityName: string) => boolean;
  refreshRobots: () => Promise<void>;
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
  const [totalActiveRobots, setTotalActiveRobots] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Map activity names
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

  // Function to fetch all robots and organize by activity
  const refreshRobots = useCallback(async () => {
    if (!currentSite?.id) {
      setRobotsByActivity({})
      setTotalActiveRobots(0)
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)
      
      const supabase = createClient()
      
      // Get all robots for the current site
      const { data: robots, error: robotsError } = await supabase
        .from('remote_instances')
        .select('id, status, instance_type, name, provider_instance_id, cdp_url, site_id')
        .eq('site_id', currentSite.id)
        .neq('status', 'stopped')
        .neq('status', 'error')

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

        // Count active robots
        if (['running', 'active', 'starting', 'pending', 'initializing'].includes(robot.status)) {
          activeCount++
        }
      })

      setRobotsByActivity(organizedRobots)
      setTotalActiveRobots(activeCount)

      console.log('🤖 RobotsContext: Refreshed robots data', {
        totalActivities: Object.keys(organizedRobots).length,
        totalActiveRobots: activeCount,
        robotsByActivity: organizedRobots
      })

    } catch (error) {
      console.error('Error refreshing robots:', error)
      setError('Failed to refresh robots')
    } finally {
      setIsLoading(false)
    }
  }, [currentSite?.id])

  // Initial load when site changes
  useEffect(() => {
    refreshRobots()
  }, [refreshRobots])

  // Setup real-time monitoring
  useEffect(() => {
    if (!currentSite?.id) return

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
          console.log('🔄 RobotsContext: Real-time robot update:', payload)
          
          // Debounce refresh to avoid too many calls
          if (refreshTimeoutRef.current) {
            clearTimeout(refreshTimeoutRef.current)
          }
          
          refreshTimeoutRef.current = setTimeout(() => {
            refreshRobots()
          }, 500) // Refresh after 500ms of no changes
        }
      )
      .subscribe()

    return () => {
      robotsSubscription.unsubscribe()
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
    }
  }, [currentSite?.id, refreshRobots])

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
    getRobotsForActivity,
    getActiveRobotForActivity,
    hasActiveRobotsForActivity,
    refreshRobots
  }

  return (
    <RobotsContext.Provider value={value}>
      {children}
    </RobotsContext.Provider>
  )
}
