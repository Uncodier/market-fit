"use client"

import { useEffect, useState } from "react"
import { apiClient } from "@/app/services/api-client-service"
import {
  getAssignedPhoneNumber,
  getZavuSenderPhoneNumber,
} from "./zavu-phone-number-utils"

const PHONE_CHANNEL_TYPES = new Set(["whatsapp", "sms", "voice"])

type SenderConnection = {
  status?: string
  type?: string
  zavu_sender_id?: string
}

export function useZavuSenderPhoneNumbers(params: {
  connections: SenderConnection[]
  enabled: boolean
}): Record<string, string> {
  const [phoneNumbers, setPhoneNumbers] = useState<Record<string, string>>({})
  const unresolvedSenderKey = Array.from(new Set(
    params.connections
      .filter((connection) =>
        connection.status === "connected" &&
        PHONE_CHANNEL_TYPES.has(connection.type || "") &&
        connection.zavu_sender_id &&
        !getAssignedPhoneNumber(connection) &&
        !phoneNumbers[connection.zavu_sender_id]
      )
      .map((connection) => connection.zavu_sender_id as string)
  )).sort().join(",")

  useEffect(() => {
    if (!params.enabled || !unresolvedSenderKey) return
    let cancelled = false

    void (async () => {
      const entries: Array<[string, string]> = []
      await Promise.all(unresolvedSenderKey.split(",").map(async (senderId) => {
        const response = await apiClient.get(
          `/api/integrations/zavu/senders/${encodeURIComponent(senderId)}`
        )
        const phoneNumber = response.success
          ? getZavuSenderPhoneNumber(response.data)
          : undefined
        if (phoneNumber) entries.push([senderId, phoneNumber])
      }))

      if (!cancelled && entries.length > 0) {
        setPhoneNumbers((current) => ({
          ...current,
          ...Object.fromEntries(entries),
        }))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [params.enabled, unresolvedSenderKey])

  return phoneNumbers
}
