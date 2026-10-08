"use client"

import { useId } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/app/components/ui/tabs'
import type { BillingInterval } from '@/lib/billing-pricing'

export function BillingIntervalSelector({ value, onChange, disabled }: {
  value: BillingInterval
  onChange: (interval: BillingInterval) => void
  disabled: boolean
}) {
  const labelId = useId()
  return (
    <div className="space-y-2">
      <p id={labelId} className="text-sm font-medium">Billing interval</p>
      <Tabs value={value} onValueChange={(interval) => {
        if (!disabled && (interval === 'month' || interval === 'year')) onChange(interval)
      }} className="w-fit">
        <TabsList aria-labelledby={labelId} className="h-9 rounded-full bg-muted/30 p-0.5">
          {(['month', 'year'] as const).map((interval) => (
            <TabsTrigger key={interval} type="button" value={interval} disabled={disabled} className="rounded-full px-4">
              {interval === 'month' ? 'Monthly' : 'Annual — save 10%'}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  )
}