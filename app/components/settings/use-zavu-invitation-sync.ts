"use client"

import { useCallback, useEffect, useRef } from "react"
import { toast } from "sonner"
import { apiClient } from "@/app/services/api-client-service"
import { type SiteFormValues } from "./form-schema"
import {
  hasConnectionChanged,
  mapInvitationToConnection,
  shouldSyncInvitation,
  type ConnectionLike,
} from "./zavu-invitation-helpers"

const POLL_INTERVAL_MS = 3000
const POLL_DEADLINE_MS = 10 * 60 * 1000

type UseZavuInvitationSyncOptions = {
  siteId?: string
  connections: ConnectionLike[]
  enabled: boolean
  update: (index: number, value: ConnectionLike) => void
  getValues: () => SiteFormValues
  onSave?: (data: SiteFormValues) => void | Promise<void>
}

export function useZavuInvitationSync({
  siteId,
  connections,
  enabled,
  update,
  getValues,
  onSave,
}: UseZavuInvitationSyncOptions) {
  const connectionsRef = useRef(connections)
  const updateRef = useRef(update)
  const getValuesRef = useRef(getValues)
  const onSaveRef = useRef(onSave)
  const inflightRef = useRef<{ siteId: string; promise: Promise<void> } | null>(null)
  const scopeRef = useRef({ siteId, enabled })
  useEffect(() => {
    connectionsRef.current = connections
    updateRef.current = update
    getValuesRef.current = getValues
    onSaveRef.current = onSave
    scopeRef.current = { siteId, enabled }
  })

  const sync = useCallback(async () => {
    if (!siteId || !enabled) return
    if (inflightRef.current?.siteId === siteId) return inflightRef.current.promise
    if (document.visibilityState === "hidden" || !navigator.onLine) return

    const pending = connectionsRef.current
      .map((channel, index) => ({ channel, index }))
      .filter(({ channel }) => shouldSyncInvitation(channel))

    if (pending.length === 0) return

    const run = (async () => {
      let persistFailed = false
      let justConnected = false
      const nextConnections = [...connectionsRef.current]

      for (const { channel, index } of pending) {
        const response = await apiClient.get(
          `/api/integrations/zavu/invitations/${encodeURIComponent(channel.zavu_invitation_id!)}?siteId=${encodeURIComponent(siteId)}`
        )
        if (scopeRef.current.siteId !== siteId || !scopeRef.current.enabled) return
        if (!response.success) throw new Error(response.error?.message || "Could not check channel setup status. Please try again.")

        const invitation = response.data?.invitation || response.data
        if (!invitation) continue

        const next = mapInvitationToConnection(invitation, channel)
        if (!hasConnectionChanged(channel, next)) continue

        nextConnections[index] = next
        updateRef.current(index, next)
        if (next.status === "connected") {
          justConnected = true
        } else if (["failed", "expired", "cancelled"].includes(next.status || "")) {
          persistFailed = true
        }
      }

      // Completed invitations are persisted by GET finalize. Saving the form
      // afterwards would overwrite webhook secrets the API just wrote.
      if (persistFailed && onSaveRef.current) {
        const values = getValuesRef.current()
        await onSaveRef.current({
          ...values,
          channels: {
            ...values.channels,
            connections: nextConnections as SiteFormValues["channels"]["connections"],
          },
        })
      }
      if (justConnected) {
        toast.success("Channel connected")
      }
    })()

    inflightRef.current = { siteId, promise: run }
    try {
      await run
    } finally {
      if (inflightRef.current?.promise === run) inflightRef.current = null
    }
  }, [siteId, enabled])

  const pendingKey = connections
    .filter(shouldSyncInvitation)
    .map((channel) => channel.zavu_invitation_id)
    .join(",")

  useEffect(() => {
    if (!enabled || !siteId || !pendingKey) return
    let cancelled = false
    let timeoutId: number | null = null
    const deadline = Date.now() + POLL_DEADLINE_MS

    const schedule = () => {
      if (!cancelled && Date.now() < deadline) {
        if (timeoutId !== null) window.clearTimeout(timeoutId)
        timeoutId = window.setTimeout(run, POLL_INTERVAL_MS)
      }
    }
    const run = async () => {
      try {
        await sync()
      } catch {
        // Keep pending connections retryable; manual checks surface the error.
      } finally {
        schedule()
      }
    }

    const onVisible = () => {
      if (
        document.visibilityState === "visible" &&
        navigator.onLine &&
        Date.now() < deadline
      ) {
        if (timeoutId !== null) window.clearTimeout(timeoutId)
        void run()
      }
    }

    void run()
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onVisible)
    window.addEventListener("online", onVisible)

    return () => {
      cancelled = true
      if (timeoutId !== null) window.clearTimeout(timeoutId)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onVisible)
      window.removeEventListener("online", onVisible)
    }
  }, [enabled, siteId, pendingKey, sync])

  const checkStatus = useCallback(async () => {
    try {
      await sync()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not check channel setup status")
    }
  }, [sync])

  return { checkStatus }
}
