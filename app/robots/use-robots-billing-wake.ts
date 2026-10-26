"use client"

import { useEffect, useRef } from "react"
import { useSite } from "@/app/context/SiteContext"

/** Check subscription changes without putting the active workspace back into loading. */
export function useRobotsBillingWake() {
  const { currentSite, refreshSiteBilling } = useSite()
  const refresh = useRef(refreshSiteBilling)
  const pending = useRef<Promise<void> | null>(null)

  useEffect(() => { refresh.current = refreshSiteBilling }, [refreshSiteBilling])

  useEffect(() => {
    const siteId = currentSite?.id
    if (!siteId) return

    const handleWake = () => {
      if (document.visibilityState !== "visible" || pending.current) return
      // File pickers can emit both focus and visibilitychange. Keep the billing
      // read single-flight, and never refresh the full site or the router here.
      const request = Promise.resolve().then(() => refresh.current(siteId))
      pending.current = request
      void request.catch(() => {
        // A transient billing read failure must not interrupt an upload or draft.
      }).finally(() => {
        if (pending.current === request) pending.current = null
      })
    }

    document.addEventListener("visibilitychange", handleWake)
    window.addEventListener("focus", handleWake)
    return () => {
      document.removeEventListener("visibilitychange", handleWake)
      window.removeEventListener("focus", handleWake)
    }
  }, [currentSite?.id])
}