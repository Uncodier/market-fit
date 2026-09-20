"use client"

import { useEffect, useRef } from "react"
import { apiClient } from "@/app/services/api-client-service"
import { useSite } from "@/app/context/SiteContext"
import {
  unwrapZavuItems,
  type ZavuPhoneNumber,
} from "./zavu-phone-number-utils"

type PhoneConnection = {
  status?: string
  metadata?: {
    phone_number?: string
    phone_number_id?: string
    regulatory_status?: string
    agent_enabled?: boolean
    activation_pending?: boolean
    failure_reason?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

export function applyRegulatoryStatuses(
  connections: PhoneConnection[],
  phoneNumbers: ZavuPhoneNumber[]
): { changed: boolean; connections: PhoneConnection[] } {
  let changed = false
  const next = connections.map((connection) => {
    if (connection.status !== "in_progress") return connection
    const phoneNumber = phoneNumbers.find((number) =>
      (connection.metadata?.phone_number_id && number.id === connection.metadata.phone_number_id) ||
      (connection.metadata?.phone_number && number.phoneNumber === connection.metadata.phone_number)
    )
    if (!phoneNumber?.regulatoryStatus) return connection

    if (phoneNumber.regulatoryStatus === "approved") {
      const nextStatus =
        connection.metadata?.agent_enabled === false ||
        connection.metadata?.activation_pending === true
          ? "in_progress"
          : "connected"
      if (
        connection.status === nextStatus &&
        connection.metadata?.regulatory_status === "approved" &&
        connection.metadata?.failure_reason === undefined
      ) {
        return connection
      }
      changed = true
      return {
        ...connection,
        status: nextStatus,
        metadata: {
          ...connection.metadata,
          regulatory_status: "approved",
          failure_reason: undefined,
        },
      }
    }
    if (phoneNumber.regulatoryStatus === "rejected") {
      if (
        connection.status === "failed" &&
        connection.metadata?.regulatory_status === "rejected" &&
        connection.metadata?.failure_reason ===
          "Phone number regulatory review was rejected."
      ) {
        return connection
      }
      changed = true
      return {
        ...connection,
        status: "failed",
        metadata: {
          ...connection.metadata,
          regulatory_status: "rejected",
          failure_reason: "Phone number regulatory review was rejected.",
        },
      }
    }
    return connection
  })

  return { changed, connections: next }
}

export function useZavuPhoneStatusSync(params: {
  connections: PhoneConnection[]
  enabled: boolean
  onConnectionsChange: (connections: PhoneConnection[]) => void | Promise<void>
  intervalMs?: number
}) {
  const { currentSite } = useSite()
  const siteId = currentSite?.id
  const callbackRef = useRef(params.onConnectionsChange)
  const connectionsRef = useRef(params.connections)
  callbackRef.current = params.onConnectionsChange
  connectionsRef.current = params.connections

  const pendingKey = params.connections
    .filter((connection) => connection.status === "in_progress")
    .map((connection) =>
      connection.metadata?.phone_number_id || connection.metadata?.phone_number || ""
    )
    .filter(Boolean)
    .sort()
    .join(",")

  useEffect(() => {
    if (!params.enabled || !siteId || !pendingKey) return
    let cancelled = false

    const sync = async () => {
      const response = await apiClient.get(
        `/api/integrations/zavu/phone-numbers?siteId=${encodeURIComponent(siteId)}`
      )
      if (cancelled || !response.success) return
      const result = applyRegulatoryStatuses(
        connectionsRef.current,
        unwrapZavuItems<ZavuPhoneNumber>(response.data)
      )
      if (result.changed) {
        await callbackRef.current(result.connections)
      }
    }

    void sync()
    const interval = window.setInterval(sync, params.intervalMs ?? 30_000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [params.enabled, params.intervalMs, siteId, pendingKey])
}
