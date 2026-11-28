"use client"

import { createContext, useContext, useEffect, useLayoutEffect, useState, ReactNode, useCallback, useRef, useMemo } from "react"
import useSWR from 'swr'
import { usePathname } from "next/navigation"
import { useSite } from "@/app/context/SiteContext"
import { useAuth } from "@/app/hooks/use-auth"
import { useRobotsPermissionRevision } from "@/app/hooks/use-robots-permission-revision"
import { createClient } from "@/lib/supabase/client"
import { sortRobotInstances } from "@/lib/navigation/robots-instance"
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'

// Supabase reuses topics while an asynchronous unsubscribe is still pending.
let channelGeneration = 0
const RECONCILE_COOLDOWN_MS = 1000

function shouldLoadRobots(pathname: string | null): boolean {
  if (!pathname) return false
  return (
    pathname.startsWith("/robots") ||
    pathname.startsWith("/agents") ||
    pathname.startsWith("/chat") ||
    pathname.startsWith("/requirements")
  )
}

// Robot interface
interface Robot {
  id: string;
  name: string;
  status: string;
  is_archived: boolean;
  instance_type: string;
  provider_instance_id?: string;
  cdp_url?: string;
  site_id: string;
  created_at?: string;
  updated_at?: string;
  requirement_title?: string;
  requirement_backlog?: unknown;
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
  getAllInstances: (includeArchived?: boolean) => Robot[];
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

function extractRequirementId(name?: string): string | null {
  if (!name) return null
  if (name.startsWith('req-runner-')) return name.replace('req-runner-', '')
  if (name.startsWith('req-maint-')) return name.replace('req-maint-', '')
  return null
}

function applyRequirementTitles(robots: Robot[], requirements: Array<{ id: string; title: string; backlog: unknown }>): Robot[] {
  if (!requirements.length) return robots

  const reqMap = Object.fromEntries(
    requirements.map((req) => [req.id, { title: req.title, backlog: req.backlog }])
  )

  return robots.map((r) => {
    if (r.name?.startsWith('req-runner-')) {
      const reqId = r.name.replace('req-runner-', '')
      const req = reqMap[reqId]
      if (!req) return r
      return { ...r, requirement_title: req.title, requirement_backlog: req.backlog }
    }
    if (r.name?.startsWith('req-maint-')) {
      const reqId = r.name.replace('req-maint-', '')
      const req = reqMap[reqId]
      if (!req) return r
      return { ...r, requirement_title: `QA | ${req.title}`, requirement_backlog: req.backlog }
    }
    return r
  })
}

async function fetchRequirementTitles(requirementIds: string[]) {
  if (requirementIds.length === 0) return []
  const supabase = createClient()
  const { data: requirements } = await supabase
    .from('requirements')
    .select('id, title, backlog')
    .in('id', requirementIds)
  return requirements || []
}

export function RobotsProvider({ children }: RobotsProviderProps) {
  const pathname = usePathname()
  const loadRobots = shouldLoadRobots(pathname)
  const { currentSite, isLoading: siteLoading } = useSite()
  // Instance controllers and live channels are not a read-only list preview.
  const siteId = siteLoading ? undefined : currentSite?.id
  const { user } = useAuth()
  const userId = user?.id
  const { revision: permissionRevision, pending: permissionPending } = useRobotsPermissionRevision(
    loadRobots ? siteId ?? null : null, userId ?? null)
  const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null)
  const [refreshCount, setRefreshCount] = useState(0)
  // Kept for API compatibility; Realtime always mutates (never gated).
  const [, setAutoRefreshEnabled] = useState(true)
  const syncRealtimeRef = useRef<(() => void) | null>(null)
  const ensureRealtimeHealthy = useCallback(() => syncRealtimeRef.current?.(), [])
  const enrichingRef = useRef(false)
  
  const isSiteContextReady = Boolean(siteId)

  const { data: cachedRobots, error: robotsFetchError, isLoading: robotsLoading, mutate } = useSWR(
    loadRobots && isSiteContextReady && currentSite?.id && userId && permissionRevision !== null
      ? ['remote_instances', currentSite.id, userId, permissionRevision] : null,
    async ([, siteId]) => {
      const supabase = createClient()
      const { data: robots, error: robotsError } = await supabase
        .from('remote_instances')
        .select('id, status, is_archived, instance_type, name, provider_instance_id, cdp_url, site_id, created_at, updated_at')
        .eq('site_id', siteId)
        .order('updated_at', { ascending: false })
      
      if (robotsError) {
        const errorDetail = robotsError instanceof Error ? robotsError.message : (robotsError?.message || JSON.stringify(robotsError));
        console.error('Error fetching robots:', errorDetail, robotsError)
        throw new Error(errorDetail || 'Failed to fetch robots')
      }

      // Return instances immediately; requirement titles enrich in a follow-up effect
      return (robots || []) as Robot[]
    },
    { keepPreviousData: false }
  )
  const isLoading = permissionPending || robotsLoading
  const robotsData = permissionRevision !== null ? cachedRobots : undefined
  const error = permissionRevision !== null && robotsFetchError ? robotsFetchError.message : null

  // Non-blocking enrichment of requirement titles after instances paint
  useEffect(() => {
    if (!robotsData?.length || enrichingRef.current) return

    const needsEnrichment = robotsData.some(
      (r) => extractRequirementId(r.name) && !r.requirement_title
    )
    if (!needsEnrichment) return

    const requirementIds = Array.from(
      new Set(robotsData.map((r) => extractRequirementId(r.name)).filter(Boolean) as string[])
    )
    if (requirementIds.length === 0) return

    let cancelled = false
    enrichingRef.current = true

    fetchRequirementTitles(requirementIds)
      .then((requirements) => {
        if (cancelled || !requirements.length) return
        mutate((current) => {
          if (!current?.length) return current
          return applyRequirementTitles(current, requirements)
        }, false)
      })
      .catch((err) => {
        console.warn('[RobotsContext] Failed to enrich requirement titles:', err)
      })
      .finally(() => {
        enrichingRef.current = false
      })

    return () => {
      cancelled = true
      enrichingRef.current = false
    }
  }, [robotsData, mutate])

  const { robotsByActivity, totalRunningRobots } = useMemo(() => {
    const organized: RobotsByActivity = {}
    let runningCount = 0

    const robots = (robotsData || []).filter((robot: Robot) => !robot.is_archived)

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
      organized[activityName] = sortRobotInstances(organized[activityName])
    })

    return { robotsByActivity: organized, totalRunningRobots: runningCount }
  }, [robotsData])

  const activityMap = useMemo<Record<string, string>>(() => ({
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
  }), [])

  const getRobotsForActivity = useCallback((activityName: string): Robot[] => {
    const fullActivityName = activityMap[activityName] || activityName
    return robotsByActivity[fullActivityName] || []
  }, [robotsByActivity, activityMap])

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

  const getAllInstances = useCallback((includeArchived = false): Robot[] => {
    if (includeArchived) return robotsData || []
    return Object.values(robotsByActivity).flat()
  }, [robotsByActivity, robotsData])

  const getInstanceById = useCallback((id: string): Robot | null => {
    for (const list of Object.values(robotsByActivity)) {
      const found = list.find(r => r.id === id)
      if (found) return found
    }
    return null
  }, [robotsByActivity])

  const refreshRobots = useCallback(async () => {
    if (!isSiteContextReady) return
    try {
      await mutate()
      setLastRefreshAt(Date.now())
      setRefreshCount(prev => prev + 1)
    } catch (error) {
      console.error('Error refreshing robots:', error)
    }
  }, [mutate, isSiteContextReady])

  // Retire callbacks in the same commit that switches the bound SWR key.
  useLayoutEffect(() => {
    if (!loadRobots || !siteId || !isSiteContextReady || !userId || permissionRevision === null) return
    const supabase = createClient()
    let channel: RealtimeChannel | null = null
    let generation = 0
    let status = 'CLOSED'
    let paused = false
    let resumeTimer: ReturnType<typeof setTimeout> | undefined
    let repairTimer: ReturnType<typeof setTimeout> | undefined

    const disconnect = () => {
      ++generation
      clearTimeout(resumeTimer)
      clearTimeout(repairTimer)
      repairTimer = undefined
      if (!channel) return
      const retired = channel
      channel = null
      void Promise.resolve(supabase.removeChannel(retired)).catch(() => {
        console.warn('[RobotsContext] Failed to remove retired channel')
      })
    }
    const sync = () => {
      if (document.visibilityState !== 'visible' || navigator.onLine === false) {
        paused = true
        disconnect()
        return
      }
      if (channel && !['CLOSED', 'CHANNEL_ERROR', 'TIMED_OUT'].includes(status)) return
      disconnect()
      const currentGeneration = generation
      status = 'SUBSCRIBING'
      let reading = false
      let joinedDuringRead = false
      let changedDuringRead = false
      const reconcile = async () => {
        if (currentGeneration !== generation) return
        clearTimeout(repairTimer)
        repairTimer = undefined
        if (reading) { joinedDuringRead = true; return }
        reading = true
        changedDuringRead = false
        try {
          await mutate()
        } catch {
          console.warn('[RobotsContext] Failed to refresh robot list')
        } finally {
          reading = false
          if (currentGeneration === generation) {
            // A join needs a snapshot started after it, even without row events.
            if (joinedDuringRead) {
              joinedDuringRead = false
              void reconcile()
            } else if (changedDuringRead) {
              // One trailing snapshot per cooldown, even if the stream never goes quiet.
              repairTimer = setTimeout(() => void reconcile(), RECONCILE_COOLDOWN_MS)
            }
          }
        }
      }
      // Keep the visibility refresh even if the socket cannot join (or is a demo client).
      if (paused) resumeTimer = setTimeout(() => void reconcile(), 1000)
      paused = false
      channel = supabase.channel(`robots_context_${siteId}_${userId}_${++channelGeneration}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'remote_instances', filter: `site_id=eq.${siteId}`,
        }, (payload: RealtimePostgresChangesPayload<Robot>) => {
          if (currentGeneration !== generation) return
          // A cache patch during reconciliation could discard the missed-event snapshot.
          if (reading) { changedDuringRead = true; return }
          mutate((current) => {
            const robots = current || []
            if (payload.eventType === 'DELETE') {
              return robots.filter((robot) => robot.id !== payload.old.id)
            }
            const next = payload.new as Robot
            if (payload.eventType === 'INSERT') {
              return robots.some((robot) => robot.id === next.id)
                ? robots
                : [next, ...robots]
            }
            return robots.map((robot) =>
              robot.id === next.id
                ? { ...robot, ...next }
                : robot
            )
          }, false)
        })
        .subscribe((nextStatus: string, err?: Error) => {
          if (currentGeneration !== generation) return
          status = nextStatus
          // Postgres Changes does not replay events missed before a join or rejoin.
          if (status === 'SUBSCRIBED') {
            clearTimeout(resumeTimer)
            void reconcile()
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn('[RobotsContext] Temporary subscription failure:', status, err || '')
          }
        })
    }
    syncRealtimeRef.current = sync
    document.addEventListener('visibilitychange', sync)
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    sync()
    return () => {
      syncRealtimeRef.current = null
      document.removeEventListener('visibilitychange', sync)
      window.removeEventListener('online', sync)
      window.removeEventListener('offline', sync)
      disconnect()
    }
  }, [siteId, isSiteContextReady, userId, permissionRevision, loadRobots, mutate])

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
