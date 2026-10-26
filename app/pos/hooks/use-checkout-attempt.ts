"use client"

import { useRef } from "react"
import { v4 as uuidv4 } from "uuid"
import { checkoutAttemptKey, getCheckoutCartSession } from "../local/checkout-attempt-storage"

/** Preserve an in-flight receipt identity even if background sync finishes before a retry. */
export function useCheckoutAttempt(siteId?: string, userId?: string) {
  const attempt = useRef<{ key: string; id: string } | null>(null)
  return {
    session() {
      if (!siteId || !userId) throw new Error("POS checkout requires an actor and site")
      return getCheckoutCartSession(siteId)
    },
    isCurrent(session: string) {
      return !!siteId && getCheckoutCartSession(siteId) === session
    },
    id(payload: unknown) {
      if (!siteId || !userId) throw new Error("POS checkout requires an actor and site")
      const key = checkoutAttemptKey(siteId, userId, getCheckoutCartSession(siteId), payload)
      const stored = localStorage.getItem(key)
      const id = stored || uuidv4()
      // Persist before enqueueing. A remount/reload must recover even a synced receipt.
      if (!stored) localStorage.setItem(key, id)
      attempt.current = { key, id }
      return attempt.current.id
    },
    clear(expectedId?: string) {
      if (expectedId && attempt.current?.id !== expectedId) return
      if (attempt.current && localStorage.getItem(attempt.current.key) === attempt.current.id) {
        localStorage.removeItem(attempt.current.key)
      }
      attempt.current = null
    },
    adopt(id: string) {
      if (!attempt.current) return
      localStorage.setItem(attempt.current.key, id)
      attempt.current = { ...attempt.current, id }
    },
  }
}