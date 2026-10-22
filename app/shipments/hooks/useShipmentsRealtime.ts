"use client"

import { useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { createRealtimeInvalidation, type RealtimeInvalidation } from "@/app/orders/hooks/realtime-invalidation"

/** Refetch authoritative courier metadata; never infer provider state from an event. */
export function useShipmentsRealtime(
  siteId: string | undefined,
  onInvalidate: RealtimeInvalidation,
  shipmentId?: string,
) {
  const invalidateRef = useRef(onInvalidate)
  useEffect(() => { invalidateRef.current = onInvalidate }, [onInvalidate])

  useEffect(() => {
    if (!siteId || siteId.startsWith("demo-")) return
    const supabase = createClient()
    const refresh = createRealtimeInvalidation(() => invalidateRef.current())
    const channel = supabase.channel(`shipments_${siteId}_${shipmentId || "all"}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "shipments", filter: `site_id=eq.${siteId}`,
      }, (payload: { new?: { id?: string }; old?: { id?: string } }) => {
        const id = payload.new?.id || payload.old?.id
        if (shipmentId && id && id !== shipmentId) return
        refresh.request(350)
      })
      .subscribe()
    return () => {
      refresh.dispose()
      try {
        void Promise.resolve(supabase.removeChannel(channel)).catch(() => {
          console.warn("[useShipmentsRealtime] Failed to unsubscribe from realtime channel")
        })
      } catch {
        console.warn("[useShipmentsRealtime] Failed to unsubscribe from realtime channel")
      }
    }
  }, [siteId, shipmentId])
}