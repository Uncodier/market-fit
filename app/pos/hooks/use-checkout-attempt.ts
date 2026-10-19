"use client"

import { useRef } from "react"
import { v4 as uuidv4 } from "uuid"

/** Preserve an in-flight receipt identity even if background sync finishes before a retry. */
export function useCheckoutAttempt() {
  const attempt = useRef<{ fingerprint: string; id: string } | null>(null)
  return {
    id(payload: unknown) {
      const fingerprint = JSON.stringify(payload)
      if (attempt.current?.fingerprint !== fingerprint) attempt.current = { fingerprint, id: uuidv4() }
      return attempt.current.id
    },
    clear() { attempt.current = null },
  }
}