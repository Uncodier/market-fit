"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Textarea } from "@/app/components/ui/textarea"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogForm, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { useOptionalPermissions } from "@/app/context/PermissionContext"
import { formatCurrency } from "@/app/lib/formatters"
import type { SubscriptionListItem } from "../invoice-summary"
import { SUBSCRIPTION_PAYMENT_METHODS } from "../payment-methods"
import { registerSubscriptionPayment } from "../register-payment"

export function RegisterSubscriptionPaymentDialog({ subscription, siteId, onClose, onSuccess }: {
  subscription: SubscriptionListItem
  siteId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const permissions = useOptionalPermissions()
  const invoices = subscription.pendingInvoices || []
  const [invoiceId, setInvoiceId] = useState(invoices[0]?.id || "")
  const invoice = invoices.find((item) => item.id === invoiceId)
  const [amount, setAmount] = useState(String(invoice?.amountDue || ""))
  const [method, setMethod] = useState("credit_card")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const submitting = useRef(false)
  const requestId = useRef<string | null>(null)
  const canPay = permissions?.can("update") !== false

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (submitting.current || !invoice || !canPay) return
    const paymentAmount = Number(amount)
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0 || paymentAmount > invoice.amountDue) {
      toast.error("Enter a payment amount within the outstanding balance")
      return
    }
    submitting.current = true
    setSaving(true)
    try {
      requestId.current ||= crypto.randomUUID()
      const result = await registerSubscriptionPayment({
        siteId, subscriptionId: subscription.id, invoiceId,
        requestId: requestId.current, amount: paymentAmount, method, notes,
      })
      if (result.error) {
        setUncertain(Boolean(result.uncertain))
        toast.error(result.error)
        return
      }
      toast.success("Payment registered successfully")
      if (result.warning) toast.warning(result.warning)
      onClose()
      onSuccess()
    } catch {
      setUncertain(true)
      toast.error("Unable to confirm the payment. Retry with the same details.")
    } finally {
      submitting.current = false
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !submitting.current && !uncertain) onClose() }}>
      <DialogContent busy={saving || uncertain} showClose={!saving && !uncertain}>
        <DialogForm onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Register payment</DialogTitle>
            <DialogDescription>
              Record a payment against an outstanding invoice for {subscription.lead?.name || "this customer"}.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            {uncertain ? <p role="alert" className="text-sm text-amber-700 dark:text-amber-400">
              Payment confirmation was interrupted. Retry with the same details before making another payment.
            </p> : null}
            <div className="space-y-2">
              <Label htmlFor="subscription-payment-invoice">Invoice</Label>
              <Select value={invoiceId} disabled={saving || uncertain} onValueChange={(value) => {
                setInvoiceId(value)
                setAmount(String(invoices.find((item) => item.id === value)?.amountDue || ""))
                requestId.current = null
              }}>
                <SelectTrigger id="subscription-payment-invoice"><SelectValue placeholder="Select invoice" /></SelectTrigger>
                <SelectContent>
                  {invoices.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      #{item.invoiceNumber || item.id.slice(0, 8).toUpperCase()} — {item.title} — {formatCurrency(item.amountDue, item.currency)} due
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {invoice ? (
              <div className="rounded-md bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">Amount due</p>
                <p className="font-semibold">{formatCurrency(invoice.amountDue, invoice.currency)}</p>
              </div>
            ) : <p className="text-sm text-muted-foreground">No pending invoices.</p>}
            <div className="space-y-2">
              <Label htmlFor="subscription-payment-amount">Payment amount</Label>
              <Input id="subscription-payment-amount" type="number" min="0.01" step="0.01"
                max={invoice?.amountDue} required value={amount} disabled={saving || uncertain}
                onChange={(event) => { setAmount(event.target.value); requestId.current = null }} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subscription-payment-method">Payment method</Label>
              <Select value={method} disabled={saving || uncertain} onValueChange={(value) => { setMethod(value); requestId.current = null }}>
                <SelectTrigger id="subscription-payment-method"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUBSCRIPTION_PAYMENT_METHODS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="subscription-payment-notes">Notes</Label>
              <Textarea id="subscription-payment-notes" value={notes} maxLength={2000} disabled={saving || uncertain}
                placeholder="Add any payment notes..."
                onChange={(event) => { setNotes(event.target.value); requestId.current = null }} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving || uncertain} onClick={onClose}>Cancel</Button>
            <Button type="submit" data-permission="update" disabled={saving || !invoice || !canPay}>
              {saving ? "Processing..." : "Register payment"}
            </Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  )
}