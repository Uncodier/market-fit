"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { BillingLimitDialog } from "@/app/components/billing/billing-limit-dialog"
import {
  BILLING_LIMIT_EVENT,
  emitBillingLimit,
  parseBillingLimitError,
  type BillingLimitPayload,
} from "@/lib/billing-limit-errors"

interface BillingLimitContextValue {
  showBillingLimit: (payload: BillingLimitPayload) => void
  showBillingLimitFromError: (error: unknown) => boolean
}

const BillingLimitContext = createContext<BillingLimitContextValue | null>(null)

export function BillingLimitProvider({ children }: { children: React.ReactNode }) {
  const [payload, setPayload] = useState<BillingLimitPayload | null>(null)

  const showBillingLimit = useCallback((next: BillingLimitPayload) => {
    setPayload(next)
  }, [])

  const showBillingLimitFromError = useCallback((error: unknown) => {
    const parsed = parseBillingLimitError(error)
    if (!parsed) return false
    setPayload(parsed)
    return true
  }, [])

  useEffect(() => {
    const onLimit = (event: Event) => {
      const detail = (event as CustomEvent<BillingLimitPayload>).detail
      if (detail?.kind) setPayload(detail)
    }
    window.addEventListener(BILLING_LIMIT_EVENT, onLimit)
    return () => window.removeEventListener(BILLING_LIMIT_EVENT, onLimit)
  }, [])

  const value = useMemo(
    () => ({ showBillingLimit, showBillingLimitFromError }),
    [showBillingLimit, showBillingLimitFromError]
  )

  return (
    <BillingLimitContext.Provider value={value}>
      {children}
      <BillingLimitDialog
        open={!!payload}
        onOpenChange={(open) => {
          if (!open) setPayload(null)
        }}
        payload={payload}
      />
    </BillingLimitContext.Provider>
  )
}

export function useBillingLimit() {
  const context = useContext(BillingLimitContext)
  if (!context) {
    return {
      showBillingLimit: emitBillingLimit,
      showBillingLimitFromError: (error: unknown) => {
        const parsed = parseBillingLimitError(error)
        if (!parsed) return false
        emitBillingLimit(parsed)
        return true
      },
    }
  }
  return context
}
