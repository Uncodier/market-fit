"use client"

import { useState } from "react"
import { Button } from "@/app/components/ui/button"
import { Receipt } from "@/app/components/ui/icons"
import { useOptionalPermissions } from "@/app/context/PermissionContext"
import type { SubscriptionDetail } from "../actions"
import { getSubscriptionBillingDate } from "../billing-period"
import { GeneratePeriodInvoiceDialog } from "./GeneratePeriodInvoiceDialog"

export function GeneratePeriodInvoiceButton({ subscription, currency, onSuccess }: {
  subscription: SubscriptionDetail
  currency: string
  onSuccess: () => void | Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const permissions = useOptionalPermissions()
  const billingDate = getSubscriptionBillingDate(subscription.next_billing_date)

  return (
    <>
      <Button
        variant="ghost" size="sm" className="h-8"
        disabled={subscription.status !== "active" || !billingDate || permissions?.can("insert") === false}
        onClick={() => setOpen(true)}
        title={!billingDate ? "Set a next billing date first" : undefined}
      >
        <Receipt className="mr-1.5 h-3.5 w-3.5" />
        Generate period invoice
      </Button>
      <GeneratePeriodInvoiceDialog subscription={subscription} currency={currency} open={open} onOpenChange={setOpen} onSuccess={onSuccess} />
    </>
  )
}