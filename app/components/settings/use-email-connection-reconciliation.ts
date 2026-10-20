"use client"

import { useRef } from "react"
import { useFormContext } from "react-hook-form"
import { createClient } from "@/lib/supabase/client"
import { notifySiteResourcesUpdated } from "@/app/context/site-resource-sync"
import { channelsSchema } from "./channel-form-schema"
import type { SiteFormValues } from "./form-schema"

// Email APIs already persist their mutation. Never follow them with a stale
// whole-array settings write, which can erase webhook metadata or other senders.
export function useEmailConnectionReconciliation(siteId?: string) {
  const form = useFormContext<SiteFormValues>()
  const currentSiteId = useRef(siteId)
  currentSiteId.current = siteId

  return async (channelId: string) => {
    if (!siteId) return
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    notifySiteResourcesUpdated(siteId)
    try {
      const { data, error } = await createClient().from("settings").select("channels")
        .eq("site_id", siteId).abortSignal(controller.signal).maybeSingle()
      if (currentSiteId.current !== siteId) return
      if (error || !data) throw new Error("Could not refresh email settings")
      const result = channelsSchema.removeDefault().unwrap().shape.connections.safeParse(data.channels?.connections)
      if (!result.success) throw new Error("Invalid email settings response")
      const canonical = result.data
      const target = canonical.filter((row) => row.id === channelId)
      if (target.length !== 1 || target[0].type !== "email") throw new Error("Email connection was not found")

      const existing = form.getValues("channels.connections") || []
      const byId = new Map(canonical.map((row) => [row.id, row]))
      const next = existing.map((row) => {
        const saved = byId.get(row.id)
        if (!saved) return row // Preserve unsaved connection drafts.
        if (row.id === channelId) return saved
        // Refresh independent email state, but keep unsaved labels and unrelated
        // channel forms. No backend mutation is made by this reconciliation.
        return row.type === "email" ? { ...saved, name: row.name } : row
      })
      if (!existing.some((row) => row.id === channelId)) next.push(target[0])
      form.setValue("channels.connections", next, { shouldDirty: false })
    } catch {
      if (currentSiteId.current === siteId) {
        throw new Error("Email settings were saved, but could not be refreshed. Reload settings before retrying.")
      }
    } finally {
      clearTimeout(timeout)
    }
  }
}