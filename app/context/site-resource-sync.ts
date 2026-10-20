"use client"

import { useEffect, type Dispatch, type SetStateAction } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Site, SiteSettings } from "./site-types"

const EVENT = "siteResourcesUpdated"
const BROADCAST = "site-resource-sync"

export function notifySiteResourcesUpdated(siteId: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { siteId } }))
}

/** Refresh resource mirrors, not unsaved settings or billing/payment state. */
export function useSiteResourceSync(siteId: string | undefined, setSites: Dispatch<SetStateAction<Site[]>>, setCurrentSite: Dispatch<SetStateAction<Site | null>>) {
  useEffect(() => {
    if (!siteId || siteId.startsWith("demo-")) return
    const database = createClient()
    const controller = new AbortController()
    const broadcast = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(BROADCAST)
    let revision = 0
    const refresh = async () => {
      const currentRevision = ++revision
      const { data, error } = await database.from("settings").select("channels,social_media")
        .eq("site_id", siteId).abortSignal(controller.signal).maybeSingle()
      if (controller.signal.aborted || error || !data || currentRevision !== revision) return
      const apply = (site: Site): Site => site.id === siteId
        ? { ...site, settings: { ...site.settings, ...data } as SiteSettings } : site
      setSites(previous => previous.map(apply))
      setCurrentSite(previous => previous ? apply(previous) : previous)
    }
    const onEvent = (event: Event) => {
      if ((event as CustomEvent<{ siteId: string }>).detail?.siteId !== siteId) return
      broadcast?.postMessage({ siteId })
      void refresh().catch(() => undefined)
    }
    const onBroadcast = (event: MessageEvent) => {
      if (event.data?.siteId === siteId) void refresh().catch(() => undefined)
    }
    window.addEventListener(EVENT, onEvent)
    broadcast?.addEventListener("message", onBroadcast)
    const subscription = database.channel(`site-resources-${siteId}`).on("postgres_changes", {
      event: "UPDATE", schema: "public", table: "settings", filter: `site_id=eq.${siteId}`,
    }, () => { void refresh().catch(() => undefined) }).subscribe()
    return () => {
      controller.abort()
      window.removeEventListener(EVENT, onEvent)
      broadcast?.close()
      void database.removeChannel(subscription)
    }
  }, [siteId, setSites, setCurrentSite])
}