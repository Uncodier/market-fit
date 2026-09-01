"use client"

import { useEffect, useState } from "react"
import { CreditCard } from "../ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"

export type StripeCardSummary = {
  brand: string
  last4: string
  expMonth: number
  expYear: number
}

export function useStripePaymentMethod(siteId?: string) {
  const [paymentMethod, setPaymentMethod] = useState<StripeCardSummary | null>(null)
  const [loading, setLoading] = useState(Boolean(siteId))

  useEffect(() => {
    if (!siteId) {
      setPaymentMethod(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    fetch(`/api/stripe/payment-method?siteId=${encodeURIComponent(siteId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setPaymentMethod(data.paymentMethod ?? null)
      })
      .catch(() => {
        if (!cancelled) setPaymentMethod(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [siteId])

  return { paymentMethod, loading }
}

function formatBrand(brand: string) {
  if (!brand) return "Card"
  return brand.charAt(0).toUpperCase() + brand.slice(1)
}

interface StripePaymentMethodProps {
  siteId?: string
  compact?: boolean
}

export function StripePaymentMethod({ siteId, compact }: StripePaymentMethodProps) {
  const { t } = useLocalization()
  const { paymentMethod, loading } = useStripePaymentMethod(siteId)

  if (loading) {
    return (
      <div className="flex items-center gap-4 rounded-lg border px-4 py-3">
        <div className="h-10 w-14 animate-pulse rounded border bg-muted/50" />
        <div className="space-y-2">
          <div className="h-4 w-28 animate-pulse rounded bg-muted" />
          <div className="h-3 w-36 animate-pulse rounded bg-muted" />
        </div>
      </div>
    )
  }

  if (!paymentMethod) {
    return (
      <div className="flex items-center gap-4 rounded-lg border border-dashed bg-muted/20 px-4 py-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/50">
          <CreditCard className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium">{t("billing.payment.noMethod") || "No payment method"}</p>
          <p className="text-sm text-muted-foreground">
            {t("billing.payment.willBeCollected") || "Payment details will be collected during checkout."}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4 rounded-lg border px-4 py-3">
      <div className="flex h-10 w-14 items-center justify-center rounded border bg-muted/50">
        <CreditCard className="h-5 w-5 text-muted-foreground" />
      </div>
      <div>
        <p className="font-medium">
          {formatBrand(paymentMethod.brand)} •••• {paymentMethod.last4}
        </p>
        <p className="text-sm text-muted-foreground">
          {compact
            ? t("billing.checkout.savedCard") || "Saved card"
            : t("billing.payment.primary") || "Primary payment method"}
          {` · ${String(paymentMethod.expMonth).padStart(2, "0")}/${paymentMethod.expYear}`}
        </p>
      </div>
    </div>
  )
}
