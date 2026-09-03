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

type UseZavuInvitationSyncOptions = {
  connections: ConnectionLike[]
  enabled: boolean
  update: (index: number, value: ConnectionLike) => void
  getValues: () => SiteFormValues
  onSave?: (data: SiteFormValues) => void | Promise<void>
}

export function useZavuInvitationSync({
  connections,
  enabled,
  update,
  getValues,
  onSave,
}: UseZavuInvitationSyncOptions) {
  const connectionsRef = useRef(connections)
  connectionsRef.current = connections
  const updateRef = useRef(update)
  updateRef.current = update
  const getValuesRef = useRef(getValues)
  getValuesRef.current = getValues
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave
  const inflightRef = useRef<Promise<void> | null>(null)

  const sync = useCallback(async () => {
    if (inflightRef.current) return inflightRef.current

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
          `/api/integrations/zavu/invitations/${channel.zavu_invitation_id}`
        )
        if (!response.success) continue

        const invitation = response.data?.invitation || response.data
        if (!invitation) continue

        const next = mapInvitationToConnection(invitation, channel)
        if (!hasConnectionChanged(channel, next)) continue

        nextConnections[index] = next
        updateRef.current(index, next)
        if (next.status === "connected") {
          justConnected = true
        } else {
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

    inflightRef.current = run
    try {
      await run
    } finally {
      inflightRef.current = null
    }
  }, [])

  const pendingKey = connections
    .filter(shouldSyncInvitation)
    .map((channel) => channel.zavu_invitation_id)
    .join(",")

  useEffect(() => {
    if (!enabled || !pendingKey) return

    void sync()
    const intervalId = window.setInterval(() => {
      void sync()
    }, POLL_INTERVAL_MS)

    const onVisible = () => {
      if (document.visibilityState === "visible") void sync()
    }

    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onVisible)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onVisible)
    }
  }, [enabled, pendingKey, sync])

  return { checkStatus: sync }
}
