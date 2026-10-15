"use client"

import { useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"

/** Refetch authoritative courier metadata; never infer provider state from an event. */
export function useShipmentsRealtime(
  siteId: string | undefined,
  onInvalidate: () => void,
  shipmentId?: string,
) {
  const invalidateRef = useRef(onInvalidate)
  useEffect(() => { invalidateRef.current = onInvalidate }, [onInvalidate])

  useEffect(() => {
    if (!siteId || siteId.startsWith("demo-")) return
    const supabase = createClient()
    let timer: ReturnType<typeof setTimeout> | undefined
    const channel = supabase.channel(`shipments_${siteId}_${shipmentId || "all"}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "shipments", filter: `site_id=eq.${siteId}`,
      }, (payload: { new?: { id?: string }; old?: { id?: string } }) => {
        const id = payload.new?.id || payload.old?.id
        if (shipmentId && id && id !== shipmentId) return
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => invalidateRef.current(), 350)
      })
      .subscribe()
    return () => {
      if (timer) clearTimeout(timer)
      void supabase.removeChannel(channel)
    }
  }, [siteId, shipmentId])
}