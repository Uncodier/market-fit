"use client"

import { useEffect, useMemo, useState } from "react"
import { apiClient } from "@/app/services/api-client-service"
import { useSite } from "@/app/context/SiteContext"
import {
  getAssignedPhoneNumber,
  unwrapZavuItems,
  type ZavuPhoneNumber,
} from "./zavu-phone-number-utils"

const PHONE_CHANNEL_TYPES = new Set(["whatsapp", "sms", "voice"])

type SenderConnection = {
  status?: string
  type?: string
  zavu_sender_id?: string
  metadata?: { phone_number_id?: string; routing?: { phone_number_id?: string } }
}

export function getSenderPhoneNumberKey(connection: SenderConnection): string {
  return `${connection.type}:${connection.zavu_sender_id}`
}

export function matchSenderPhoneNumbers(
  connections: SenderConnection[],
  numbers: ZavuPhoneNumber[],
): Record<string, string> {
  const matched: Record<string, string> = {}
  const ambiguous = new Set<string>()
  for (const connection of connections) {
    const senderId = connection.zavu_sender_id
    if (!senderId || getAssignedPhoneNumber(connection) || ambiguous.has(senderId)) continue
    const numberId = connection.metadata?.phone_number_id || connection.metadata?.routing?.phone_number_id
    const candidates = numbers.filter((number) => {
      if (!number.phoneNumber || (number.senderId && number.senderId !== senderId)) return false
      return numberId ? number.id === numberId : number.senderId === senderId
    })
    if (candidates.length !== 1) continue
    const phoneNumber = candidates[0].phoneNumber
    if (matched[senderId] && matched[senderId] !== phoneNumber) {
      delete matched[senderId]
      ambiguous.add(senderId)
      continue
    }
    matched[senderId] = phoneNumber
  }
  return matched
}

export function useZavuSenderPhoneNumbers(params: {
  connections: SenderConnection[]
  enabled: boolean
}): Record<string, string> {
  const { currentSite } = useSite()
  const siteId = currentSite?.id
  const [lookup, setLookup] = useState<{
    siteId?: string
    requestKey?: string
    phoneNumbers: Record<string, string>
  }>({ phoneNumbers: {} })
  // Only lookup-relevant fields participate in the effect, not form object identity.
  const requestKey = JSON.stringify(Array.from(new Set(
    params.connections
      .filter((connection) =>
        ["connected", "active", "synced"].includes(connection.status || "") &&
        PHONE_CHANNEL_TYPES.has(connection.type || "") &&
        connection.zavu_sender_id &&
        !getAssignedPhoneNumber(connection)
      )
      .map((connection) => JSON.stringify({
        type: connection.type,
        zavu_sender_id: connection.zavu_sender_id,
        metadata: { phone_number_id: connection.metadata?.phone_number_id || connection.metadata?.routing?.phone_number_id },
      }))
  )).sort())
  const requests = useMemo<SenderConnection[]>(
    () => JSON.parse(requestKey).map((entry: string) => JSON.parse(entry)),
    [requestKey],
  )

  useEffect(() => {
    if (!params.enabled || !siteId || requests.length === 0) return
    let cancelled = false

    void (async () => {
      const entries: Record<string, string> = {}
      const whatsappSenderIds = Array.from(new Set(requests
        .filter((connection) => connection.type === "whatsapp")
        .map((connection) => connection.zavu_sender_id!)))
      const phoneConnections = requests.filter((connection) => connection.type !== "whatsapp")

      await Promise.all([
        ...whatsappSenderIds.map(async (senderId) => {
          try {
            // Meta-linked numbers need not exist in Zavu's purchased-number inventory.
            const response = await apiClient.get<{
              id: string
              whatsapp?: { displayPhoneNumber?: string | null }
            }>(
              `/api/integrations/zavu/senders/${encodeURIComponent(senderId)}?siteId=${encodeURIComponent(siteId)}`,
              { timeout: 10000 },
            )
            const number = response.data?.whatsapp?.displayPhoneNumber
            if (response.success && response.data?.id === senderId && typeof number === "string" && number.trim()) {
              entries[getSenderPhoneNumberKey({ type: "whatsapp", zavu_sender_id: senderId })] = number.trim()
            }
          } catch {
            // Keep the existing account label when its number is unavailable.
          }
        }),
        (async () => {
          if (phoneConnections.length === 0) return
          try {
            const response = await apiClient.get(
              `/api/integrations/zavu/phone-numbers?siteId=${encodeURIComponent(siteId)}`,
              { timeout: 10000 },
            )
            if (!response.success) return
            const matched = matchSenderPhoneNumbers(
              phoneConnections, unwrapZavuItems<ZavuPhoneNumber>(response.data),
            )
            for (const connection of phoneConnections) {
              const number = matched[connection.zavu_sender_id!]
              if (number) entries[getSenderPhoneNumberKey(connection)] = number
            }
          } catch {
            // A failed inventory lookup must not hide a resolved WhatsApp number.
          }
        })(),
      ])
      if (!cancelled) {
        setLookup({ siteId, requestKey, phoneNumbers: entries })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [params.enabled, siteId, requestKey, requests])

  return lookup.siteId === siteId && lookup.requestKey === requestKey ? lookup.phoneNumbers : {}
}
