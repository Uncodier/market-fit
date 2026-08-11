"use client"

import { useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  ensureAudioUnlockListeners,
  playNewOrderAlarm,
  unlockAudio,
} from "@/lib/audio"

export function useOrdersRealtime(siteId: string | undefined, onInvalidate: () => void) {
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onInvalidateRef = useRef(onInvalidate)
  onInvalidateRef.current = onInvalidate

  // Unlock Web Audio on the first user gesture so realtime INSERT can play later.
  useEffect(() => {
    if (!siteId) return
    const detach = ensureAudioUnlockListeners()
    void unlockAudio()
    return detach
  }, [siteId])

  useEffect(() => {
    if (!siteId) return

    const supabase = createClient()

    const handleEvent = (payload: { eventType?: string; table?: string }) => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current)

      // Play alarm on new sale orders
      if (payload.eventType === "INSERT" && payload.table === "sale_orders") {
        playNewOrderAlarm()
      }

      const delay = payload.eventType === "INSERT" ? 300 : 500
      refreshTimeoutRef.current = setTimeout(() => {
        onInvalidateRef.current()
      }, delay)
    }

    const channel = supabase
      .channel(`sale_orders_${siteId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sale_orders",
          filter: `site_id=eq.${siteId}`,
        },
        handleEvent
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sale_order_items",
          filter: `site_id=eq.${siteId}`,
        },
        handleEvent
      )
      .subscribe((status: string, err?: unknown) => {
        if (status === "CHANNEL_ERROR") {
          console.warn("[useOrdersRealtime] Temporary subscription error", err || "")
        } else if (status === "TIMED_OUT") {
          console.warn("[useOrdersRealtime] Subscription timed out")
        }
      })

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
        refreshTimeoutRef.current = null
      }
      try {
        supabase.removeChannel(channel)
      } catch (e) {
        console.warn("[useOrdersRealtime] Failed to unsubscribe from realtime channel:", e)
      }
    }
  }, [siteId])
}
