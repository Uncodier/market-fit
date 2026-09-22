"use client"

import { useEffect, useState, type FormEvent } from "react"
import { format } from "date-fns"
import { toast } from "sonner"
import { Button } from "@/app/components/ui/button"
import { DatePicker } from "@/app/components/ui/date-picker"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogForm,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { createSubscriptionInvoice } from "../actions"

interface CreateSubscriptionInvoiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  siteId: string
  subscriptionId: string
  defaultAmount: number
  onSuccess: () => void | Promise<void>
}

export function CreateSubscriptionInvoiceDialog({
  open,
  onOpenChange,
  siteId,
  subscriptionId,
  defaultAmount,
  onSuccess,
}: CreateSubscriptionInvoiceDialogProps) {
  const [amount, setAmount] = useState(String(defaultAmount || ""))
  const [invoiceDate, setInvoiceDate] = useState(new Date())
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setAmount(String(defaultAmount || ""))
    setInvoiceDate(new Date())
  }, [defaultAmount, open])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const numericAmount = Number(amount)

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      toast.error("Enter an amount greater than zero")
      return
    }

    setSubmitting(true)
    try {
      const result = await createSubscriptionInvoice({
        siteId,
        subscriptionId,
        amount: numericAmount,
        invoiceDate: format(invoiceDate, "yyyy-MM-dd"),
      })

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success("Invoice created")
      await onSuccess()
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" busy={submitting}>
        <DialogForm onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create invoice</DialogTitle>
            <DialogDescription>
              Add a pending invoice for this subscription.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="subscription-invoice-amount">Amount</Label>
              <Input
                id="subscription-invoice-amount"
                type="number"
                min="0.01"
                max="999999999999"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label>Invoice date</Label>
              <DatePicker
                date={invoiceDate}
                setDate={setInvoiceDate}
                placeholder="Select invoice date"
                showEvents={false}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create invoice"}
            </Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  )
}
