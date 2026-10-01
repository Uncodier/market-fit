import { createClient } from "@/lib/supabase/client"
import { mutate } from "swr"

type Unsubscribe = () => void

type Entry = {
  refCount: number
  channel: { unsubscribe?: () => void } | null
  debounce: ReturnType<typeof setTimeout> | null
}

const subscriptions = new Map<string, Entry>()
const DEBOUNCE_MS = 200

/**
 * One filtered Supabase Realtime channel per instance_id (ref-counted).
 * Avoids the global unfiltered table subscription + guards that dropped events, and
 * avoids multiple hook instances tearing down a shared channel name.
 */
export function subscribeRequirementStatusRealtime(
  instanceId: string
): Unsubscribe {
  return subscribeStatusInvalidation(instanceId, `requirement_status_inst_${instanceId}`, "requirement_status", `instance_id=eq.${instanceId}`)
}

/** The workspace, composer and preview share this subscription, not competing channels. */
export function subscribeRequirementExecutionRealtime(instanceId: string, requirementId: string): Unsubscribe {
  return subscribeStatusInvalidation(instanceId, `requirement_execution_${instanceId}_${requirementId}`, "requirements", `id=eq.${requirementId}`)
}

function subscribeStatusInvalidation(instanceId: string, key: string, table: string, filter: string): Unsubscribe {
  let entry = subscriptions.get(key)
  if (!entry) {
    entry = { refCount: 0, channel: null, debounce: null }
    subscriptions.set(key, entry)
  }

  entry.refCount += 1

  if (!entry.channel) {
    const supabase = createClient()
    const ch = supabase
      .channel(key)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter
        },
        () => {
          const current = subscriptions.get(key)
          if (!current) return
          if (current.debounce) {
            clearTimeout(current.debounce)
          }
          current.debounce = setTimeout(() => {
            const latest = subscriptions.get(key)
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
    const e = subscriptions.get(key)
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
      subscriptions.delete(key)
    }
  }
}
