"use client"

import { useState, useEffect } from "react"
import { 
  Dialog, 
  DialogBody,
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { X, CreditCard, Banknote, HelpCircle, User, CheckCircle2, Bank } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useSite } from "@/app/context/SiteContext"
import { cn } from "@/lib/utils"

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
  onConfirm: (payments: PaymentEntry[], promotionCode?: string, intent?: 'complete' | 'pay' | 'send') => void
  isLoading?: boolean
  hasCustomer?: boolean
}

export function PaymentConfirmationDialog({
  open,
  onOpenChange,
  totalAmount,
  onConfirm,
  isLoading = false,
  hasCustomer = false
}: PaymentConfirmationDialogProps) {
  const { t } = useLocalization()
  const { currentSite } = useSite()
  
  const [payments, setPayments] = useState<PaymentEntry[]>([])
  const [selectedMethod, setSelectedMethod] = useState("cash")
  const [currentAmount, setCurrentAmount] = useState("")
  const [promoCode, setPromoCode] = useState("")

  const remainingAmount = Math.max(0, totalAmount - payments.reduce((sum, p) => sum + p.amount, 0))
  const totalChange = payments.reduce((sum, p) => sum + p.change, 0)

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setPayments([])
      setSelectedMethod("cash")
      setCurrentAmount(totalAmount.toString())
      setPromoCode("")
    }
  }, [open, totalAmount])

  // Update currentAmount when remainingAmount changes
  useEffect(() => {
    if (open && remainingAmount > 0 && payments.length > 0) {
      setCurrentAmount(remainingAmount.toString())
    }
  }, [remainingAmount, open, payments.length])

  const paymentMethods = [
    { value: "cash", label: t('pos.payment.methods.cash') || "Cash", icon: Banknote },
    { value: "credit_card", label: t('pos.payment.methods.creditCard') || "Credit Card", icon: CreditCard },
    { value: "debit_card", label: t('pos.payment.methods.debitCard') || "Debit Card", icon: CreditCard },
    { value: "transfer", label: t('pos.payment.methods.transfer') || "Bank Transfer", icon: Bank },
    { value: "on_account", label: t('pos.payment.methods.onAccount') || "On Account", icon: User },
    { value: "other", label: t('pos.payment.methods.other') || "Other", icon: HelpCircle },
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

  const handlePayAndComplete = () => {
    onConfirm(payments, promoCode || undefined, 'pay')
  }

  const handleRegisterPaymentOnly = () => {
    onConfirm(payments, promoCode || undefined, 'send')
  }

  const handleCompleteOnAccount = () => {
    onConfirm(payments, promoCode || undefined, 'complete')
  }

  const handleClear = () => setCurrentAmount("")

  const handleBackspace = () => setCurrentAmount((prev) => prev.slice(0, -1))

  const handleDigit = (d: string) => {
    if (d === "." && currentAmount.includes(".")) return
    setCurrentAmount((prev) => {
      // If we are starting fresh and hit dot, prepend 0
      if (prev === "" && d === ".") return "0."
      // If we just have 0 and hit a number, replace 0
      if (prev === "0" && d !== ".") return d
      return prev + d
    })
  }

  const getMethodLabel = (val: string) => paymentMethods.find(m => m.value === val)?.label || val

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" busy={isLoading} className="sm:max-w-[900px] max-h-[90vh]">
        <DialogHeader className="relative pb-6 border-b">
          <div className="flex justify-between items-center w-full pr-6">
            <div className="flex flex-col gap-1">
              <DialogTitle className="text-2xl font-bold">{t('pos.payment.title') || 'Complete Payment'}</DialogTitle>
              <DialogDescription>
                {t('pos.payment.desc') || 'Select a payment method and confirm the transaction.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Column 1: Payment Input */}
          <div className="flex flex-col gap-6">
            {remainingAmount > 0 ? (
              <div className="flex flex-col h-full justify-between">
                <div className="space-y-8">
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t('pos.payment.method') || 'Payment Method'}</Label>
                    <div className="grid grid-cols-3 grid-rows-2 w-full gap-1 p-1 bg-muted/30 rounded-xl [grid-auto-rows:1fr]">
                      {paymentMethods.map((method) => {
                        const Icon = method.icon
                        const isSelected = selectedMethod === method.value
                        return (
                          <button
                            key={method.value}
                            type="button"
                            onClick={() => setSelectedMethod(method.value)}
                            className={cn(
                              "flex h-full min-h-[4.75rem] flex-col items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-muted-foreground transition-all",
                              isSelected
                                ? "bg-background text-foreground shadow-sm"
                                : "hover:text-foreground",
                            )}
                          >
                            <Icon size={20} />
                            <span className="text-[11px] font-medium leading-tight text-center">
                              {method.label}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {selectedMethod !== "on_account" && (
                    <div className="space-y-3">
                      <Label htmlFor="amount-tendered" className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                        {selectedMethod === 'cash' ? (t('pos.payment.amountTendered') || 'Amount Tendered') : (t('pos.payment.amountToCharge') || 'Amount to Charge')}
                      </Label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-xl">$</span>
                        <Input
                          id="amount-tendered"
                          type="number"
                          step="0.01"
                          className="pl-9 text-2xl font-bold h-14 bg-muted/10 border-muted-foreground/20 rounded-xl"
                          value={currentAmount}
                          onChange={(e) => setCurrentAmount(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-8">
                  {selectedMethod === "on_account" ? (
                    <div className="mb-6 p-4 bg-muted/30 border rounded-xl text-sm">
                      <h5 className="font-bold mb-2">{t('pos.payment.onAccountDesc') || 'Charge to Customer Account'}</h5>
                      <p className="text-muted-foreground">
                        {t('pos.payment.onAccountInstruction') || 'The remaining balance will be left pending on the customer\'s account.'}
                      </p>
                      {!hasCustomer && (
                        <p className="mt-2 text-destructive font-medium">
                          {t('pos.errorSelectCustomerUnpaid') || 'Select a customer to leave payment pending'}
                        </p>
                      )}
                    </div>
                  ) : selectedMethod === "transfer" && currentSite?.settings?.shop?.bank_transfer?.account_number && (
                    <div className="mb-6 p-4 bg-muted/30 border rounded-xl text-sm">
                      <h5 className="font-bold mb-2">{t('pos.payment.accountDetails') || 'Account Details for Transfer'}</h5>
                      <div className="space-y-1 text-muted-foreground">
                        {currentSite.settings.shop.bank_transfer.bank_name && (
                          <div className="flex justify-between"><span>{t('pos.payment.bank') || 'Bank'}:</span> <span className="font-medium text-foreground">{currentSite.settings.shop.bank_transfer.bank_name}</span></div>
                        )}
                        {currentSite.settings.shop.bank_transfer.account_holder && (
                          <div className="flex justify-between"><span>{t('pos.payment.name') || 'Name'}:</span> <span className="font-medium text-foreground">{currentSite.settings.shop.bank_transfer.account_holder}</span></div>
                        )}
                        <div className="flex justify-between"><span>{t('pos.payment.accountIban') || 'Account/IBAN'}:</span> <span className="font-medium font-mono text-foreground">{currentSite.settings.shop.bank_transfer.account_number}</span></div>
                        {currentSite.settings.shop.bank_transfer.routing_number && (
                          <div className="flex justify-between"><span>{t('pos.payment.routingSwift') || 'Routing/SWIFT'}:</span> <span className="font-medium text-foreground">{currentSite.settings.shop.bank_transfer.routing_number}</span></div>
                        )}
                      </div>
                    </div>
                  )}
                  {selectedMethod === "on_account" ? (
                    <Button 
                      className="w-full h-12 text-base rounded-xl" 
                      onClick={handleCompleteOnAccount} 
                      disabled={isLoading || !hasCustomer}
                      variant="secondary"
                    >
                      {isLoading ? (t('pos.payment.processing') || "Processing...") : (t('pos.payment.completeOnAccount') || "Complete on Account")}
                    </Button>
                  ) : (
                    <Button className="w-full h-12 text-base rounded-xl" onClick={handleAddPayment} disabled={!currentAmount || parseFloat(currentAmount) <= 0}>
                      {t('pos.payment.addPayment') || 'Add Payment'}
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-full justify-between bg-slate-50 dark:bg-muted/10 rounded-2xl overflow-hidden">
                <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
                  <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center">
                    <CheckCircle2 className="w-7 h-7 text-green-600" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      {t('pos.payment.status') || 'Status'}
                    </p>
                    <p className="text-2xl font-bold text-foreground">
                      {t('pos.payment.fullyPaid') || 'Fully Paid'}
                    </p>
                  </div>
                </div>
                {totalChange > 0 && (
                  <div className="flex flex-col items-center justify-center py-6 px-4 bg-green-50/50 dark:bg-green-950/20 border-t border-green-100 dark:border-green-900/50">
                    <span className="text-sm font-semibold text-green-800/70 dark:text-green-300/70 uppercase tracking-wider mb-2">
                      {t('pos.payment.changeToReturn') || 'Change to Return'}
                    </span>
                    <span className="text-4xl font-bold text-green-600 dark:text-green-400">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalChange)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Column 2: Summary (Total to Pay & Applied Payments) */}
          <div className="flex flex-col mt-4 md:mt-0 justify-between bg-slate-50 dark:bg-muted/10 rounded-2xl overflow-hidden h-full">
            <div className="flex flex-col items-center justify-center py-8 px-4 border-b border-border/40 bg-white/50 dark:bg-background/20">
              <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t('pos.payment.totalToPay') || 'Total to Pay'}</span>
              <span className="text-5xl font-bold text-foreground">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalAmount)}
              </span>
            </div>

            <div className="flex-1 flex flex-col min-h-0">
              {payments.length > 0 ? (
                <div className="flex-1 p-6 overflow-y-auto">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">{t('pos.payment.appliedPayments') || 'Applied Payments'}</h4>
                  <div className="space-y-1">
                    {payments.map((p, idx) => (
                      <div key={idx} className="flex items-center justify-between py-3 border-b border-border/40 last:border-0">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{getMethodLabel(p.method)}</span>
                          {p.method === 'cash' && p.change > 0 && (
                            <span className="text-[11px] text-muted-foreground mt-0.5">
                              {t('pos.payment.tendered') || 'Tendered'}: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(p.tendered)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-green-600">
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(p.amount)}
                          </span>
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => handleRemovePayment(idx)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center p-6 text-muted-foreground/50 text-sm italic">
                  {t('pos.payment.noPayments') || 'No payments applied yet.'}
                </div>
              )}
            </div>

            {remainingAmount > 0 && (
              <div className="flex flex-col items-center justify-center py-6 px-4 bg-blue-50/50 dark:bg-blue-950/20 border-t border-blue-100 dark:border-blue-900/50 mt-auto">
                <span className="text-sm font-semibold text-blue-800/70 dark:text-blue-300/70 uppercase tracking-wider mb-2">{t('pos.payment.remainingBalance') || 'Remaining Balance'}</span>
                <span className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(remainingAmount)}
                </span>
              </div>
            )}
          </div>

          {/* Column 3: Numpad */}
          <div className="flex flex-col gap-3 mt-4 md:mt-0 justify-center h-full px-2">
            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-3 grid grid-cols-3 gap-3">
                {["7", "8", "9", "4", "5", "6", "1", "2", "3", "0", ".", "C"].map((d) => (
                  <Button
                    key={d}
                    type="button"
                    variant="ghost"
                    className={`aspect-square !p-0 h-auto !min-w-0 !rounded-full text-2xl font-medium transition-colors ${
                      d === "C"
                        ? "bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive"
                        : "bg-muted/30 hover:bg-muted/50 text-foreground"
                    }`}
                    onClick={() => (d === "C" ? handleClear() : handleDigit(d))}
                    disabled={remainingAmount <= 0 || selectedMethod === "on_account"}
                  >
                    {d}
                  </Button>
                ))}
              </div>
              <div className="flex flex-col gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  className="flex-1 aspect-square !p-0 h-auto !min-w-0 !rounded-full bg-muted/30 hover:bg-muted/50 text-foreground"
                  onClick={handleBackspace}
                  disabled={remainingAmount <= 0 || !currentAmount || selectedMethod === "on_account"}
                >
                  ⌫
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="flex-1 aspect-square !p-0 h-auto !min-w-0 !rounded-full bg-muted/30 hover:bg-muted/50 text-foreground text-sm font-semibold tracking-tight"
                  onClick={() => setCurrentAmount(Math.ceil(remainingAmount).toString())}
                  disabled={remainingAmount <= 0 || selectedMethod === "on_account"}
                >
                  Exact
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="flex-1 aspect-square !p-0 h-auto !min-w-0 !rounded-full bg-muted/30 hover:bg-muted/50 text-foreground text-sm font-semibold tracking-tight"
                  onClick={() => setCurrentAmount(Math.ceil(remainingAmount / 10) * 10 + "")}
                  disabled={remainingAmount <= 0 || selectedMethod === "on_account"}
                >
                  +10
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="flex-1 aspect-square !p-0 h-auto !min-w-0 !rounded-full bg-muted/30 hover:bg-muted/50 text-foreground text-sm font-semibold tracking-tight"
                  onClick={() => setCurrentAmount(Math.ceil(remainingAmount / 50) * 50 + "")}
                  disabled={remainingAmount <= 0 || selectedMethod === "on_account"}
                >
                  +50
                </Button>
              </div>
            </div>
          </div>
        </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            {t('common.cancel') || 'Cancel'}
          </Button>

          {selectedMethod !== "on_account" && (
            <Button
              variant="secondary"
              onClick={handleRegisterPaymentOnly}
              disabled={payments.length === 0 || isLoading}
            >
              {isLoading
                ? (t('pos.payment.processing') || "Processing...")
                : (t('pos.payment.registerPaymentOnly') || "Register Payment Only")}
            </Button>
          )}

          <Button
            onClick={handlePayAndComplete}
            disabled={remainingAmount > 0 || isLoading || selectedMethod === "on_account"}
          >
            {isLoading
              ? (t('pos.payment.processing') || "Processing...")
              : (t('pos.payment.payAndComplete') || "Pay & Complete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
