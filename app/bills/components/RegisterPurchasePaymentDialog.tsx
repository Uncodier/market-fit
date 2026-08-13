"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
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
import { Textarea } from "@/app/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { CreditCard } from "@/app/components/ui/icons"
import { formatCurrency } from "@/app/components/dashboard/campaign-revenue-donut"
import { Purchase } from "@/app/types"
import { registerPurchasePayment } from "@/app/purchases/actions"
import { useLocalization } from "@/app/context/LocalizationContext"

interface RegisterPurchasePaymentDialogProps {
  purchase: Purchase | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

const PAYMENT_METHODS = [
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cash", label: "Cash" },
  { value: "credit_card", label: "Credit Card" },
  { value: "check", label: "Check" },
  { value: "wire_transfer", label: "Wire Transfer" },
]

export function RegisterPurchasePaymentDialog({
  purchase,
  open,
  onOpenChange,
  onSuccess,
}: RegisterPurchasePaymentDialogProps) {
  const { t } = useLocalization()
  const [loading, setLoading] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer")
  const [notes, setNotes] = useState("")

  useEffect(() => {
    if (open && purchase) {
      setPaymentAmount(purchase.amountDue.toString())
      setPaymentMethod("bank_transfer")
      setNotes("")
    }
  }, [open, purchase?.id, purchase?.amountDue])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!purchase) return

    const amount = parseFloat(paymentAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.error(t("bills.error.invalidPayment") || "Please enter a valid payment amount")
      return
    }
    if (amount > purchase.amountDue) {
      toast.error(t("bills.error.paymentExceedsDue") || "Payment amount cannot exceed the amount due")
      return
    }

    setLoading(true)
    try {
      const result = await registerPurchasePayment({
        siteId: purchase.siteId,
        purchaseId: purchase.id,
        amount,
        method: paymentMethod,
        notes: notes.trim() || undefined,
      })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(t("bills.success.payment") || "Payment registered successfully")
        onOpenChange(false)
        onSuccess()
      }
    } catch (error) {
      console.error("Error registering payment:", error)
      toast.error(t("bills.error.payment") || "Failed to register payment")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" busy={loading}>
        <DialogForm onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              {t("bills.payment.title") || "Register payment"}
            </DialogTitle>
            <DialogDescription>
              {t("bills.payment.desc") || "Record a payment against this vendor bill."}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4">
            <div className="rounded-md bg-muted/50 p-3 text-sm">
              <div className="text-muted-foreground">{t("bills.field.amountDue") || "Amount due"}</div>
              <div className="font-medium text-primary">
                {purchase ? formatCurrency(purchase.amountDue) : "$0.00"} {purchase?.currency}
              </div>
            </div>
            <div className="grid gap-2">
              <Label>{t("bills.field.amount") || "Amount"}</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                max={purchase?.amountDue || 0}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                required
                className="h-12"
              />
            </div>
            <div className="grid gap-2">
              <Label>{t("bills.field.method") || "Method"}</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{t("bills.field.notes") || "Notes"}</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              {t("common.cancel") || "Cancel"}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading
                ? (t("common.saving") || "Saving...")
                : (t("bills.payment.submit") || "Register payment")}
            </Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  )
}
