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
  if (brand.toLowerCase() === "amex") return "American Express"
  return brand.charAt(0).toUpperCase() + brand.slice(1)
}

function CardIcon({ brand, className = "" }: { brand?: string; className?: string }) {
  const b = (brand || "").toLowerCase()
  
  if (b === "visa") {
    return (
      <svg viewBox="0 0 32 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <rect width="32" height="20" rx="2" fill="#1434CB"/>
        <path d="M12.9818 13.9167L14.7303 6.08337H17.4334L15.6849 13.9167H12.9818ZM23.3644 6.27379C22.8808 6.08337 22.0469 5.86016 21.0537 5.86016C18.4234 5.86016 16.5937 7.0423 16.5776 9.07325C16.5593 10.5649 18.0617 11.3989 19.1672 11.837C20.3013 12.285 20.6865 12.5713 20.6805 13.013C20.6725 13.6874 19.7828 13.9939 18.8471 13.9939C17.4578 13.9939 16.634 13.6701 15.9616 13.4118L15.4851 13.2082L15.1326 15.1213C15.8282 15.3945 17.0658 15.6421 18.3541 15.654C21.229 15.654 23.0134 14.4171 23.0366 12.2612C23.0537 10.228 20.4079 10.1268 20.4431 8.87441C20.4632 8.35715 20.9859 7.78155 22.0298 7.78155C22.8687 7.76608 23.498 7.93512 23.9785 8.11846L24.1673 8.19584L23.3644 6.27379ZM29.2435 13.9167H31.542L29.6976 6.08337H27.533C26.966 6.08337 26.5412 6.36015 26.3113 6.81195L22.4574 13.9167H25.3056L26.1039 12.0202H29.5828L29.2435 13.9167ZM26.9038 9.9482L28.1691 6.84053L28.7905 10.6351L26.9038 9.9482ZM9.90795 13.9167L7.42082 8.01633L7.14713 6.8929L6.11585 6.08337H2.03906L1.86536 6.33813C2.86872 6.78635 4.39828 7.61611 5.34032 8.42326L8.14074 13.9167H10.9701L14.4842 6.08337H11.6666L9.90795 13.9167Z" fill="white"/>
      </svg>
    )
  }
  
  if (b === "mastercard") {
    return (
      <svg viewBox="0 0 32 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <rect width="32" height="20" rx="2" fill="#141413"/>
        <path d="M13.6845 10C13.6845 11.9687 14.5422 13.7381 15.867 14.9317C14.7335 15.8239 13.2987 16.3533 11.751 16.3533C8.24376 16.3533 5.3999 13.5095 5.3999 10C5.3999 6.49053 8.24376 3.64667 11.751 3.64667C13.2987 3.64667 14.7335 4.17615 15.867 5.06833C14.5422 6.26189 13.6845 8.03131 13.6845 10Z" fill="#EA001B"/>
        <path d="M22.0628 3.64667C18.5555 3.64667 15.7117 6.49053 15.7117 10C15.7117 13.5095 18.5555 16.3533 22.0628 16.3533C25.5701 16.3533 28.414 13.5095 28.414 10C28.414 6.49053 25.5701 3.64667 22.0628 3.64667Z" fill="#F79E1B"/>
        <path d="M15.8672 5.06833C17.0007 5.96052 17.7374 7.32971 17.7374 8.86877V11.1312C17.7374 12.6703 17.0007 14.0395 15.8672 14.9317C14.5424 13.7381 13.6846 11.9687 13.6846 10C13.6846 8.03131 14.5424 6.26189 15.8672 5.06833Z" fill="#FF5F00"/>
      </svg>
    )
  }
  
  if (b === "amex" || b === "american express") {
    return (
      <svg viewBox="0 0 32 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <rect width="32" height="20" rx="2" fill="#006FCF"/>
        <path d="M11.602 12.9248L12.5694 10.3705H9.00624L9.95759 12.9248H11.602ZM15.4208 14.3942L13.1251 8.21251H14.1508H14.3735L15.9084 12.5029L17.2003 8.21251H18.9103H19.133L20.6679 12.5029L21.9599 8.21251H24.3168V14.3942H23.364V10.1583L21.4391 14.3942H20.0827L18.1578 10.1583V14.3942H17.205H15.4208ZM29.2155 12.0306L27.0854 8.21251H28.261L29.7422 10.9634L31.206 8.21251H32.4005V14.3942L31.2587 12.2891L30.1337 14.3942H28.917L29.2155 12.0306ZM10.5113 7.82251L6.77663 14.3942H8.38407L8.91068 13.0617H12.6659L13.1925 14.3942H14.7999L11.0653 7.82251H10.5113ZM24.7335 14.3942V8.21251H28.7907V9.16723H25.6863V10.7427H28.3283V11.6974H25.6863V13.4394H28.8787V14.3942H24.7335Z" fill="white"/>
      </svg>
    )
  }

  // Fallback icon
  return <CreditCard className={className} />
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
      <div className="flex h-10 w-14 items-center justify-center rounded border bg-muted/20">
        <CardIcon brand={paymentMethod.brand} className="h-full w-full object-contain drop-shadow-sm p-1" />
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
