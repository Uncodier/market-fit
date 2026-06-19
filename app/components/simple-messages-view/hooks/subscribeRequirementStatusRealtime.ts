import { createClient } from "@/lib/supabase/client"
import { mutate } from "swr"

type Unsubscribe = () => void

type Entry = {
  refCount: number
  channel: { unsubscribe?: () => void } | null
  debounce: ReturnType<typeof setTimeout> | null
}

const byInstance = new Map<string, Entry>()
const DEBOUNCE_MS = 200

/**
 * One filtered Supabase Realtime channel per instance_id (ref-counted).
 * Avoids the global unfiltered table subscription + guards that dropped events, and
 * avoids multiple hook instances tearing down a shared channel name.
 */
export function subscribeRequirementStatusRealtime(
  instanceId: string
): Unsubscribe {
  let entry = byInstance.get(instanceId)
  if (!entry) {
    entry = { refCount: 0, channel: null, debounce: null }
    byInstance.set(instanceId, entry)
  }

  entry.refCount += 1

  if (!entry.channel) {
    const supabase = createClient()
    const filter = `instance_id=eq.${instanceId}`
    const ch = supabase
      .channel(`requirement_status_inst_${instanceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "requirement_status",
          filter
        },
        () => {
          const current = byInstance.get(instanceId)
          if (!current) return
          if (current.debounce) {
            clearTimeout(current.debounce)
          }
          current.debounce = setTimeout(() => {
            const latest = byInstance.get(instanceId)
            if (latest) {
              latest.debounce = null
            }
            // Disparar un mutate global de SWR para este instanceId
            mutate(['requirement_status', instanceId])
          }, DEBOUNCE_MS)
        }
      )
      .subscribe()
    entry.channel = ch
  }

  return () => {
    const e = byInstance.get(instanceId)
    if (!e) return
    e.refCount -= 1
    if (e.refCount <= 0 && e.channel) {
      if (e.debounce) {
        clearTimeout(e.debounce)
        e.debounce = null
      }
      const supabase = createClient()
      supabase.removeChannel(e.channel as Parameters<typeof supabase.removeChannel>[0])
      e.channel = null
      byInstance.delete(instanceId)
    }
  }
}
