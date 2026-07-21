"use client"

import { useState, useEffect } from "react"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { X } from "@/app/components/ui/icons"
import { CreditCard, Banknote, HelpCircle } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"

interface PaymentEntry {
  method: string
  amount: number
  tendered: number
  change: number
}

interface PaymentConfirmationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  totalAmount: number
  onConfirm: (payments: PaymentEntry[]) => void
  isLoading?: boolean
}

export function PaymentConfirmationDialog({
  open,
  onOpenChange,
  totalAmount,
  onConfirm,
  isLoading = false
}: PaymentConfirmationDialogProps) {
  const { t } = useLocalization()
  
  const [payments, setPayments] = useState<PaymentEntry[]>([])
  const [selectedMethod, setSelectedMethod] = useState("cash")
  const [currentAmount, setCurrentAmount] = useState("")

  const remainingAmount = Math.max(0, totalAmount - payments.reduce((sum, p) => sum + p.amount, 0))
  const totalChange = payments.reduce((sum, p) => sum + p.change, 0)

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setPayments([])
      setSelectedMethod("cash")
      setCurrentAmount(totalAmount.toString())
    }
  }, [open, totalAmount])

  // Update currentAmount when remainingAmount changes
  useEffect(() => {
    if (open && remainingAmount > 0 && payments.length > 0) {
      setCurrentAmount(remainingAmount.toString())
    }
  }, [remainingAmount, open, payments.length])

  const paymentMethods = [
    { value: "cash", label: "Cash", icon: Banknote },
    { value: "credit_card", label: "Credit Card", icon: CreditCard },
    { value: "debit_card", label: "Debit Card", icon: CreditCard },
    { value: "transfer", label: "Bank Transfer", icon: Banknote },
    { value: "other", label: "Other", icon: HelpCircle },
  ]

  const handleAddPayment = () => {
    const parsedAmount = parseFloat(currentAmount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) return

    let applied = 0
    let change = 0
    let tendered = parsedAmount

    if (selectedMethod === "cash") {
      if (parsedAmount > remainingAmount) {
        applied = remainingAmount
        change = parsedAmount - remainingAmount
      } else {
        applied = parsedAmount
      }
    } else {
      // Non-cash methods usually exact match, but we cap it at remaining just in case
      applied = Math.min(parsedAmount, remainingAmount)
      tendered = applied
    }

    setPayments([...payments, { method: selectedMethod, amount: applied, tendered, change }])
    setCurrentAmount("")
  }

  const handleRemovePayment = (index: number) => {
    const newPayments = [...payments]
    newPayments.splice(index, 1)
    setPayments(newPayments)
  }

  const handleConfirm = () => {
    if (remainingAmount > 0) return
    onConfirm(payments)
  }

  const getMethodLabel = (val: string) => paymentMethods.find(m => m.value === val)?.label || val

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Complete Payment</DialogTitle>
          <DialogDescription>
            Select a payment method and confirm the transaction.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="flex flex-col items-center justify-center p-4 bg-muted/30 rounded-lg border">
            <span className="text-sm text-muted-foreground mb-1">Total to Pay</span>
            <span className="text-3xl font-bold text-foreground">
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalAmount)}
            </span>
          </div>

          {payments.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-foreground">Applied Payments</h4>
              <div className="space-y-2">
                {payments.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-card border rounded-md shadow-sm">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{getMethodLabel(p.method)}</span>
                      {p.method === 'cash' && p.change > 0 && (
                        <span className="text-xs text-muted-foreground">
                          Tendered: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(p.tendered)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-green-600">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(p.amount)}
                      </span>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleRemovePayment(idx)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {remainingAmount > 0 ? (
            <div className="space-y-4 p-4 border rounded-lg bg-card">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-foreground">Remaining Balance</span>
                <span className="text-lg font-bold text-blue-600">
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(remainingAmount)}
                </span>
              </div>
              
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="payment-method">Payment Method</Label>
                  <Select value={selectedMethod} onValueChange={setSelectedMethod}>
                    <SelectTrigger id="payment-method">
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentMethods.map(method => {
                        const Icon = method.icon
                        return (
                          <SelectItem key={method.value} value={method.value}>
                            <div className="flex items-center">
                              <Icon className="w-4 h-4 mr-2 text-muted-foreground" />
                              {method.label}
                            </div>
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="amount-tendered">
                    {selectedMethod === 'cash' ? 'Amount Tendered' : 'Amount to Charge'}
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      id="amount-tendered"
                      type="number"
                      step="0.01"
                      className="pl-7"
                      value={currentAmount}
                      onChange={(e) => setCurrentAmount(e.target.value)}
                    />
                  </div>
                </div>

                <Button className="w-full" variant="secondary" onClick={handleAddPayment} disabled={!currentAmount || parseFloat(currentAmount) <= 0}>
                  Add Payment
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-green-50 rounded-lg border border-green-200 space-y-2">
              <div className="flex items-center justify-between text-green-800">
                <span className="font-medium">Status</span>
                <span className="font-bold">Fully Paid</span>
              </div>
              {totalChange > 0 && (
                <div className="flex items-center justify-between text-green-800 pt-2 border-t border-green-200">
                  <span className="font-medium">Change to Return</span>
                  <span className="text-xl font-bold">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalChange)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={remainingAmount > 0 || isLoading}>
            {isLoading ? "Processing..." : "Complete Order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
