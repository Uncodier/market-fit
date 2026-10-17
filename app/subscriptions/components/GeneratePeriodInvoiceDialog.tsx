"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/app/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { useOptionalPermissions } from "@/app/context/PermissionContext"
import type { Subscription } from "@/app/types"
import { formatCurrency } from "@/app/lib/formatters"
import { formatDueDate } from "@/lib/finance/due-date"
import { getSubscriptionBillingDate } from "../billing-period"
import { generateSubscriptionPeriodInvoice } from "../generate-period-invoice"

export function GeneratePeriodInvoiceDialog({ subscription, currency, open, onOpenChange, onSuccess }: {
  subscription: Pick<Subscription, "id" | "site_id" | "status" | "amount" | "next_billing_date" | "due_date">
  currency: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void | Promise<void>
}) {
  const permissions = useOptionalPermissions()
  const [generating, setGenerating] = useState(false)
  const inFlight = useRef(false)
  const billingDate = getSubscriptionBillingDate(subscription.next_billing_date)
  const canGenerate = subscription.status === "active" && Boolean(billingDate) && permissions?.can("insert") !== false

  const generate = async () => {
    if (!billingDate || !canGenerate || inFlight.current) return
    inFlight.current = true
    setGenerating(true)
    try {
      const result = await generateSubscriptionPeriodInvoice({ siteId: subscription.site_id, subscriptionId: subscription.id, billingDate })
      if (result.error || !result.data) {
        toast.error(result.error || "Unable to generate the period invoice")
        return
      }
      toast.success(result.existing ? "This period already has an invoice" : "Period invoice generated")
      onOpenChange(false)
      await onSuccess()
    } catch {
      toast.error("Unable to confirm the period invoice. Retry to check the same period.")
    } finally {
      inFlight.current = false
      setGenerating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!inFlight.current) onOpenChange(next) }}>
      <DialogContent size="sm" busy={generating}>
        <DialogHeader>
          <DialogTitle>Generate period invoice</DialogTitle>
          <DialogDescription>Create the invoice for the cycle at Next billing, including a newly created subscription&apos;s first cycle.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3 text-sm">
          <dl className="grid grid-cols-2 gap-2">
            <dt className="text-muted-foreground">Billing date</dt><dd>{formatDueDate(billingDate)}</dd>
            <dt className="text-muted-foreground">Amount</dt><dd>{formatCurrency(Number(subscription.amount) || 0, currency)}</dd>
            <dt className="text-muted-foreground">Due date</dt><dd>{formatDueDate(subscription.due_date)}</dd>
          </dl>
          <p className="text-xs text-muted-foreground">An existing invoice for this date will not be duplicated. Next billing will not advance, and no payment will be charged.</p>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={generating} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" disabled={generating || !canGenerate} onClick={() => void generate()}>{generating ? "Generating..." : "Generate invoice"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}