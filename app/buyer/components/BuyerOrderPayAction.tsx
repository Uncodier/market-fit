"use client"

import { useRef, useState } from 'react'
import { Button } from '@/app/components/ui/button'
import { CreditCard, Loader2 } from '@/app/components/ui/icons'
import { useLocalization } from '@/app/context/LocalizationContext'
import { resolveAppApiUrl } from '@/app/commerce/app-api-url'
import type { BuyerOrderDetail } from '../order-detail-display'
import { orderPaymentState, stripeCheckoutUrl } from '../order-payment'

export function BuyerOrderPayAction({ order, demo = false, compact = false }: {
  order: BuyerOrderDetail
  demo?: boolean
  compact?: boolean
}) {
  const { t, locale } = useLocalization()
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)
  const isDemo = demo || order.id.startsWith('demo-')
  const payment = orderPaymentState(order)
  if (!payment) return null
  let amount: string
  try {
    amount = new Intl.NumberFormat(locale, { style: 'currency', currency: order.currency || 'USD' }).format(payment.due)
  } catch {
    amount = `${payment.due} ${order.currency || 'USD'}`
  }

  const checkout = async () => {
    if (isDemo || inFlight.current) return
    // Recheck expiry on click in case the page has remained open for a long time.
    const current = orderPaymentState(order)
    if (!current?.token) { setError(t('buyer.orders.pay.unavailable')); return }
    inFlight.current = true
    setProcessing(true)
    setError(null)
    try {
      const response = await fetch(resolveAppApiUrl('/api/stripe/checkout/order'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          publicAccessToken: current.token,
          returnUrl: `${window.location.origin}${window.location.pathname}`,
        }),
        signal: AbortSignal.timeout(30000),
      })
      const data = await response.json()
      const url = response.ok ? stripeCheckoutUrl(data?.url) : null
      if (!url) {
        setError(t(response.status === 409 ? 'buyer.orders.pay.changed' : 'buyer.orders.pay.error'))
        inFlight.current = false
        setProcessing(false)
        return
      }
      // A redirect is not payment confirmation; only server-settled balances establish payment.
      window.location.assign(url)
    } catch {
      setError(t('buyer.orders.pay.error'))
      inFlight.current = false
      setProcessing(false)
    }
  }

  return <div className="min-w-0 w-full space-y-3">
    <div className="min-w-0 space-y-1 break-words empty:hidden">
      {compact && <p className="text-sm text-muted-foreground">{t('buyer.orders.detail.amountDue')}: <span className="font-semibold text-foreground tabular-nums">{amount}</span></p>}
      {!isDemo && !payment.token && <p className="text-xs text-muted-foreground">{t('buyer.orders.pay.unavailable')}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
    <div className="flex justify-end">
      <div className="w-full min-w-0">
    <Button disabled={isDemo || !payment.token || processing} aria-busy={processing}
      onClick={() => void checkout()} className="w-full h-12 rounded-lg text-base">
      {processing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CreditCard className="h-4 w-4 mr-2" />}
      {t(processing ? 'buyer.orders.pay.processing' : 'buyer.orders.pay.now')}
    </Button>
      </div>
    </div>
  </div>
}