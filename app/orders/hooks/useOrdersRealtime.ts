"use client"

import { useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { createRealtimeInvalidation, type RealtimeInvalidation } from "./realtime-invalidation"
import {
  ensureAudioUnlockListeners,
  playNewOrderAlarm,
  unlockAudio,
} from "@/lib/audio"

export function useOrdersRealtime(
  siteId: string | undefined,
  onInvalidate: RealtimeInvalidation,
  options: { includeUnits?: boolean; orderId?: string; playAlarm?: boolean } = {},
) {
  const { includeUnits = false, orderId, playAlarm = true } = options
  const onInvalidateRef = useRef(onInvalidate)
  useEffect(() => {
    onInvalidateRef.current = onInvalidate
  }, [onInvalidate])

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
    let active = true
    const refresh = createRealtimeInvalidation(() => onInvalidateRef.current())

    const handleEvent = (payload: {
      eventType?: string
      table?: string
      new?: { id?: string; sale_order_id?: string; status?: string }
      old?: { id?: string; sale_order_id?: string }
    }) => {
      if (!active) return
      const eventOrderId = payload.table === "sale_orders"
        ? payload.new?.id || payload.old?.id
        : payload.new?.sale_order_id || payload.old?.sale_order_id
      if (orderId && eventOrderId && eventOrderId !== orderId) return

      // Play alarm on new sale orders
      if (playAlarm && payload.eventType === "INSERT" && payload.table === "sale_orders") {
        playNewOrderAlarm()
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("printer:order-event", { detail: payload }))
      }

      const delay = payload.eventType === "INSERT" ? 300 : 500
      refresh.request(delay)
    }

    let channel = supabase
      .channel(`sale_orders_${siteId}${orderId ? `_${orderId}` : ""}`)
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

    if (includeUnits) {
      channel = channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sale_order_item_units",
          filter: `site_id=eq.${siteId}`,
        },
        handleEvent
      )
    }

    channel.subscribe((status: string, err?: unknown) => {
        if (status === "CHANNEL_ERROR") {
          console.warn("[useOrdersRealtime] Temporary subscription error", err || "")
        } else if (status === "TIMED_OUT") {
          console.warn("[useOrdersRealtime] Subscription timed out")
        }
      })

    return () => {
      active = false
      refresh.dispose()
      try {
        void Promise.resolve(supabase.removeChannel(channel)).catch(() => {
          console.warn("[useOrdersRealtime] Failed to unsubscribe from realtime channel")
        })
      } catch (e) {
        console.warn("[useOrdersRealtime] Failed to unsubscribe from realtime channel:", e)
      }
    }
  }, [includeUnits, orderId, playAlarm, siteId])
}
