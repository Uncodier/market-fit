import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/app/components/ui/use-toast'
import { InstanceArtifact } from '../types'

interface UseInstanceArtifactsProps {
  instanceId?: string
}

export const useInstanceArtifacts = ({ instanceId }: UseInstanceArtifactsProps) => {
  const [artifacts, setArtifacts] = useState<InstanceArtifact[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const removeArtifactLocally = (screen: string) => {
    setArtifacts(prev => prev.filter(a => a.screen !== screen))
  }

  // Fetch artifacts for the instance
  const fetchArtifacts = async () => {
    if (!instanceId) {
      setArtifacts([])
      return
    }

    setIsLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('instance_artifacts')
        .select('id, instance_id, site_id, user_id, screen, url, title, description, should_reload, context, created_at')
        .eq('instance_id', instanceId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching artifacts:', error)
        toast({
          title: 'Error',
          description: 'Failed to load artifacts',
          variant: 'destructive'
        })
        return
      }

      setArtifacts(data || [])
    } catch (error) {
      console.error('Error fetching artifacts:', error)
      toast({
        title: 'Error',
        description: 'Failed to load artifacts',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Set up real-time subscription
  useEffect(() => {
    if (!instanceId) {
      setArtifacts([])
      return
    }
    
    // Clear artifacts when instance changes to avoid showing old artifacts
    setArtifacts([])

    const supabase = createClient()
    
    // Initial fetch
    fetchArtifacts()

    // Set up real-time subscription
    const channel = supabase
      .channel(`instance-artifacts-${instanceId}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'instance_artifacts',
          filter: `instance_id=eq.${instanceId}`
        },
        (payload: { eventType: string; old: { id?: string }; new: unknown }) => {
          setArtifacts((current) => {
            if (payload.eventType === 'DELETE') {
              return current.filter((artifact) => artifact.id !== payload.old.id)
            }
            const next = payload.new as InstanceArtifact
            if (payload.eventType === 'INSERT') {
              return current.some((artifact) => artifact.id === next.id)
                ? current
                : [next, ...current]
            }
            return current.map((artifact) =>
              artifact.id === next.id ? next : artifact
            )
          })
        }
      )
      .subscribe((status: string) => {
        console.log(`[useInstanceArtifacts] Subscription status for ${instanceId}:`, status)
      })

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        console.log(`[useInstanceArtifacts] Visibility changed to visible, refreshing artifacts for ${instanceId}`)
        fetchArtifacts()
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      console.log(`[useInstanceArtifacts] Cleaning up subscription for ${instanceId}`)
      document.removeEventListener('visibilitychange', handleVisibility)
      supabase.removeChannel(channel)
    }
  }, [instanceId])

  return {
    artifacts,
    isLoading,
    refetchArtifacts: fetchArtifacts,
    removeArtifactLocally
  }
}
