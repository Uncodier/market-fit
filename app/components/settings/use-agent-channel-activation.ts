"use client"

import { useEffect, useRef, useState } from "react"
import { useFormContext } from "react-hook-form"
import { toast } from "sonner"
import { useOptionalPermissions } from "@/app/context/PermissionContext"
import { useBillingLimit } from "@/app/context/BillingLimitContext"
import { notifySiteResourcesUpdated } from "@/app/context/site-resource-sync"
import { useSite } from "@/app/context/SiteContext"
import { channelsSchema } from "./channel-form-schema"
import type { SiteFormValues } from "./form-schema"

export function useAgentChannelActivation(siteId?: string) {
  const form = useFormContext<SiteFormValues>()
  const { getValues, setValue } = form
  const { currentSite: site } = useSite()
  const canonicalConnections = site && site.id === siteId ? site.settings?.channels?.connections : undefined
  useEffect(() => {
    if (!canonicalConnections) return
    const byId = new Map(canonicalConnections.map(row => [row.id, row]))
    const existing = getValues("channels.connections") || []
    const next = existing.map(row => {
      const canonical = byId.get(row.id)
      return canonical ? { ...row, status: canonical.status, enabled: canonical.enabled,
        license_suspended: canonical.license_suspended, _license: canonical._license } : row
    })
    if (JSON.stringify(existing) !== JSON.stringify(next)) {
      setValue("channels.connections", next, { shouldDirty: false })
    }
  }, [canonicalConnections, getValues, setValue])
  const permissions = useOptionalPermissions()
  const capabilities = permissions?.capabilities
  const canManage = Boolean(permissions?.siteId === siteId && capabilities && (
    capabilities.is_owner || capabilities.role === "owner" || capabilities.role === "admin"
  ))
  const { showBillingLimitFromError } = useBillingLimit()
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const inFlight = useRef(false)
  const currentSite = useRef(siteId)
  currentSite.current = siteId

  const setEnabled = async (connectionId: string, enabled: boolean) => {
    if (!siteId || !canManage || inFlight.current) return
    inFlight.current = true
    setUpdatingId(connectionId)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15_000)
    try {
      const response = await fetch(`/api/agent-channels/${encodeURIComponent(siteId)}/enabled`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId, enabled }),
        signal: controller.signal,
      })
      const result = await response.json()
      if (currentSite.current !== siteId) return
      if (!response.ok || result.success !== true) {
        if (showBillingLimitFromError(result)) return
        throw new Error("Channel activation failed")
      }
      const canonical = channelsSchema.removeDefault().unwrap().shape.connections.parse(result.channels?.connections)
      const existing = form.getValues("channels.connections") || []
      // Reconcile all server-enforced states (a freed slot may restore another
      // channel), but keep unsaved drafts and unrelated form sections intact.
      const byId = new Map(canonical.map(row => [row.id, row]))
      const merged = existing.map(row => byId.get(row.id) || row)
      for (const row of canonical) if (!existing.some(item => item.id === row.id)) merged.push(row)
      form.setValue("channels.connections", merged, { shouldDirty: false })
      notifySiteResourcesUpdated(siteId)
      toast.success(enabled ? "Channel activated" : "Channel deactivated. Connection and history are preserved.")
    } catch {
      if (currentSite.current === siteId) {
        // A timed-out response is ambiguous: refresh canonical state, never
        // replay the mutation or assume that the provider connection was deleted.
        notifySiteResourcesUpdated(siteId)
        toast.error("Could not confirm channel activation. Refresh the channel status before retrying.")
      }
    } finally {
      clearTimeout(timeout)
      inFlight.current = false
      setUpdatingId(null)
    }
  }
  return { canManage, updatingId, setEnabled }
}