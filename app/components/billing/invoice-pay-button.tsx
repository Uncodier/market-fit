"use client"

import { useEffect, useId, useRef, useState } from 'react'
import { useLocalization } from '@/app/context/LocalizationContext'
import { Button } from '../ui/button'

export function InvoicePayButton({ siteId, paymentId }: { siteId: string; paymentId: string }) {
  const { t } = useLocalization()
  const request = useRef<AbortController | null>(null)
  const [isOpening, setIsOpening] = useState(false)
  const [error, setError] = useState<'notPayable' | 'openPaymentError' | null>(null)
  const feedbackId = useId()

  useEffect(() => () => request.current?.abort(), [])

  async function openPayment() {
    if (request.current || error === 'notPayable') return
    const controller = new AbortController()
    request.current = controller
    setIsOpening(true)
    setError(null)

    try {
      const response = await fetch('/api/stripe/invoice-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose: 'pay', siteId, paymentId }),
        signal: controller.signal,
      })
      if (controller.signal.aborted) return
      if (response.status === 409) {
        setError('notPayable')
        return
      }
      if (!response.ok) throw new Error('Could not resolve payment URL')
      const { url } = await response.json()
      if (controller.signal.aborted) return
      if (typeof url !== 'string') throw new Error('Missing payment URL')
      window.location.assign(url)
    } catch {
      if (!controller.signal.aborted) setError('openPaymentError')
    } finally {
      request.current = null
      if (!controller.signal.aborted) setIsOpening(false)
    }
  }

  return (
    <div className="text-right">
      <Button
        type="button"
        size="sm"
        data-permission="allow"
        className="min-h-11"
        aria-disabled={isOpening || error === 'notPayable'}
        aria-describedby={isOpening || error ? feedbackId : undefined}
        onClick={openPayment}
      >
        {t('billing.payment.invoice.payNow') || 'Pay now'}
      </Button>
      <p id={feedbackId} role="status" className={isOpening || error ? 'mt-1 min-w-40 text-xs text-muted-foreground' : 'sr-only'}>
        {isOpening ? t('billing.payment.invoice.openingPayment') : error ? t(`billing.payment.invoice.${error}`) : ''}
      </p>
    </div>
  )
}