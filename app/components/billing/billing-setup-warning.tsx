"use client"

import { Button } from "@/app/components/ui/button"
import { useLocalization } from "@/app/context/LocalizationContext"
import { BILLING_INITIALIZATION_WARNING, BILLING_UNAVAILABLE_WARNING, BILLING_REFRESH_WARNING } from "@/app/services/initialize-site-billing"

export function BillingSetupWarning({ message, isLoading, onRetry }: {
  message: string
  isLoading: boolean
  onRetry?: () => void
}) {
  const { t } = useLocalization()
  const warningKey = message === BILLING_INITIALIZATION_WARNING ? 'billing.setup.initializationWarning'
    : message === BILLING_UNAVAILABLE_WARNING ? 'billing.setup.unavailableWarning'
    : message === BILLING_REFRESH_WARNING ? 'billing.setup.refreshWarning' : null
  return (
    <div role="alert" className="my-4 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 space-y-3">
      <p className="text-sm">{warningKey ? (t(warningKey) || message) : message}</p>
      {onRetry && <Button type="button" variant="outline" disabled={isLoading} onClick={onRetry}>
        {isLoading ? (t('billing.setup.confirming') || 'Confirming billing setup...') : (t('billing.setup.retry') || 'Retry billing setup')}
      </Button>}
    </div>
  )
}