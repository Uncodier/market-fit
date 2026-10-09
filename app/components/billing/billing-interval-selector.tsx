"use client"

import { useId } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/app/components/ui/tabs'
import type { BillingInterval } from '@/lib/billing-pricing'
import { useLocalization } from '@/app/context/LocalizationContext'

export function BillingIntervalSelector({ value, onChange, disabled }: {
  value: BillingInterval
  onChange: (interval: BillingInterval) => void
  disabled: boolean
}) {
  const { t } = useLocalization()
  const labelId = useId()
  return (
    <div className="flex flex-row flex-wrap items-center justify-center gap-x-3 gap-y-2">
      <p id={labelId} className="whitespace-nowrap text-sm font-medium">{t('billing.plan.interval') || 'Billing interval'}</p>
      <Tabs value={value} onValueChange={(interval) => {
        if (!disabled && (interval === 'month' || interval === 'year')) onChange(interval)
      }} className="w-fit">
        <TabsList aria-labelledby={labelId} className="h-9 rounded-full bg-muted/30 p-0.5">
          {(['month', 'year'] as const).map((interval) => (
            <TabsTrigger key={interval} type="button" value={interval} disabled={disabled} className="rounded-full px-4">
              {interval === 'month' ? (t('billing.plan.monthly') || 'Monthly') : (t('billing.plan.annualSaving') || 'Annual — save 10%')}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  )
}