import { useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useRobots } from '@/app/context/RobotsContext'
import { useSite } from '@/app/context/SiteContext'
import { useToast } from '@/app/components/ui/use-toast'

interface UseRobotInstanceProps {
  onClearNewMakinaThinking?: () => void
  onScrollToBottom?: () => void
}

export const useRobotInstance = ({ onClearNewMakinaThinking, onScrollToBottom }: UseRobotInstanceProps) => {
  const [isStartingRobot, setIsStartingRobot] = useState(false)
  const queuedMessageRef = useRef<string | null>(null)
  const startTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const { currentSite } = useSite()
  const { toast } = useToast()
  const router = useRouter()
  const { refreshRobots } = useRobots()

  // Start polling for a newly created or resumed instance until it becomes running/active or fails
  const startInstancePolling = useCallback(async (activityName: string, instanceId?: string) => {
    let attempts = 0
    const maxAttempts = 40 // ~60s at 1.5s interval
    let active = true
    const supabase = createClient()

    const tick = async () => {
      if (!active) return
      attempts += 1

      try {
        await refreshRobots()

        let query = supabase
          .from('remote_instances')
          .select('id, status, name')
          .eq('site_id', currentSite!.id)
          .neq('status', 'stopped')
          .neq('status', 'error')
          .limit(1)

        if (instanceId) {
          query = query.eq('id', instanceId)
        } else {
          query = query.eq('name', activityName)
        }

        const { data, error } = await query
        if (!error && data && data[0]) {
          const inst = data[0] as { id: string; status: string; name: string }
          if (["running", "active"].includes(inst.status)) {
            active = false
            if (startTimeoutRef.current) {
              clearTimeout(startTimeoutRef.current)
              startTimeoutRef.current = null
            }
            setIsStartingRobot(false)
            if (!instanceId) {
              const params = new URLSearchParams(window.location.search)
              params.set('instance', inst.id)
              router.push(`/robots?${params.toString()}`)
              // Force refresh robots to ensure tabs update immediately
              refreshRobots()
              // Clear New Makina thinking state when instance is detected
              onClearNewMakinaThinking?.()
              // Force scroll to bottom when switching to new instance - wait for navigation
              setTimeout(() => onScrollToBottom?.(), 500)
            }
            return
          }
          if (["failed", "error"].includes(inst.status)) {
            active = false
            if (startTimeoutRef.current) {
              clearTimeout(startTimeoutRef.current)
              startTimeoutRef.current = null
            }
            setIsStartingRobot(false)
            queuedMessageRef.current = null
            // Clear New Makina thinking state on error
            onClearNewMakinaThinking?.()
            toast({ title: 'Robot failed to start', description: 'Please try again.', variant: 'destructive' })
            return
          }
        }
      } catch (e) {
        // Ignore and continue polling until timeout
      }

      if (attempts < maxAttempts && active) {
        setTimeout(tick, 1500)
      } else if (active) {
        active = false
        if (startTimeoutRef.current) {
          clearTimeout(startTimeoutRef.current)
          startTimeoutRef.current = null
        }
        setIsStartingRobot(false)
        queuedMessageRef.current = null
        // Clear New Makina thinking state on timeout
        onClearNewMakinaThinking?.()
        toast({ title: 'Failed to start robot in time', description: 'Please try again.', variant: 'destructive' })
      }
    }

    setTimeout(tick, 1500)
  }, [currentSite?.id, refreshRobots, router, onClearNewMakinaThinking, onScrollToBottom])

  return {
    isStartingRobot,
    setIsStartingRobot,
    queuedMessageRef,
    startTimeoutRef,
    startInstancePolling
  }
}
