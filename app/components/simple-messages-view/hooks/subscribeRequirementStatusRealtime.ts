import { createClient } from "@/lib/supabase/client"

type Unsubscribe = () => void

type Entry = {
  refCount: number
  channel: { unsubscribe?: () => void } | null
  listeners: Set<() => void>
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
  instanceId: string,
  onChange: () => void
): Unsubscribe {
  let entry = byInstance.get(instanceId)
  if (!entry) {
    entry = { refCount: 0, channel: null, listeners: new Set(), debounce: null }
    byInstance.set(instanceId, entry)
  }

  entry.refCount += 1
  entry.listeners.add(onChange)

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
            if (!latest?.listeners.size) return
            for (const fn of latest.listeners) {
              fn()
            }
          }, DEBOUNCE_MS)
        }
      )
      .subscribe()
    entry.channel = ch
  }

  return () => {
    const e = byInstance.get(instanceId)
    if (!e) return
    e.listeners.delete(onChange)
    e.refCount -= 1
    if (e.refCount <= 0 && e.channel) {
      if (e.debounce) {
        clearTimeout(e.debounce)
        e.debounce = null
      }
      const supabase = createClient()
      supabase.removeChannel(e.channel as Parameters<typeof supabase.removeChannel>[0])
      e.channel = null
      e.listeners.clear()
      byInstance.delete(instanceId)
    }
  }
}
