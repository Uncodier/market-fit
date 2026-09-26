"use client"

import { useEffect, useState } from "react"
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
  const [lookup, setLookup] = useState<{ siteId?: string; attemptedKey?: string; phoneNumbers: Record<string, string> }>({ phoneNumbers: {} })
  const phoneNumbers = lookup.siteId === siteId ? lookup.phoneNumbers : {}
  const unresolvedSenderKey = Array.from(new Set(
    params.connections
      .filter((connection) =>
        ["connected", "active", "synced"].includes(connection.status || "") &&
        PHONE_CHANNEL_TYPES.has(connection.type || "") &&
        connection.zavu_sender_id &&
        !getAssignedPhoneNumber(connection) &&
        !phoneNumbers[connection.zavu_sender_id]
      )
      .map((connection) => `${connection.zavu_sender_id}:${connection.metadata?.phone_number_id || connection.metadata?.routing?.phone_number_id || ""}`)
  )).sort().join(",")

  useEffect(() => {
    if (!params.enabled || !siteId || !unresolvedSenderKey || (lookup.siteId === siteId && lookup.attemptedKey === unresolvedSenderKey)) return
    let cancelled = false

    void (async () => {
      try {
        const response = await apiClient.get(
          `/api/integrations/zavu/phone-numbers?siteId=${encodeURIComponent(siteId)}`
        )
        if (!cancelled && response.success) {
          const entries = matchSenderPhoneNumbers(
            params.connections,
            unwrapZavuItems<ZavuPhoneNumber>(response.data),
          )
          setLookup({ siteId, attemptedKey: unresolvedSenderKey, phoneNumbers: { ...phoneNumbers, ...entries } })
        }
      } catch {
        // Connection metadata remains available as a fallback when lookup fails.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [params.enabled, siteId, unresolvedSenderKey, lookup.siteId, lookup.attemptedKey])

  return phoneNumbers
}
