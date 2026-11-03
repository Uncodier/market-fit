"use client"

import { useState } from "react"
import useSWR from "swr"
import { useLocalization } from "@/app/context/LocalizationContext"
import { Button } from "@/app/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { RegisterPurchasePaymentDialog } from "@/app/bills/components/RegisterPurchasePaymentDialog"
import { formatCurrency } from "@/app/lib/formatters"
import type { Purchase } from "@/app/types"
import { getPayableBills } from "../actions"
import type { PayableAccount } from "../summary"

export function SupplierBillPaymentDialog({ account, siteId, orderFilter, onClose }: {
  account: PayableAccount
  siteId: string
  orderFilter: "active" | "cancelled"
  onClose: () => void
}) {
  const { t, locale } = useLocalization()
  const [selectedBill, setSelectedBill] = useState<Purchase | null>(null)
  const { data, error, isLoading, mutate } = useSWR(
    ["accounts-payable-bills", siteId, account.vendorId, orderFilter],
    () => getPayableBills(siteId, account.vendorId, orderFilter),
    { keepPreviousData: false },
  )
  const loadFailed = Boolean(error || data?.error)

  // Keep the picker mounted while payment completes so its success callback can notify the list.
  return <>
    <Dialog open={!selectedBill} onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t("operations.payables.chooseBill")}</DialogTitle>
          <DialogDescription>{t("operations.payables.chooseBillDescription", { name: account.name })}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-2">
          {isLoading ? <p role="status" className="text-sm text-muted-foreground">{t("operations.payables.loadingBills")}</p>
            : loadFailed ? <div role="alert">
              <p className="text-sm text-destructive">{t("operations.payables.errors.billsFailed")}</p>
              <Button variant="outline" className="mt-3" onClick={() => void mutate()}>{t("common.retry")}</Button>
            </div>
            : !data?.data.length ? <p className="text-sm text-muted-foreground">{t("operations.payables.noBills")}</p>
            : data.data.map(bill => <Button key={bill.id} variant="outline" disabled={bill.currency === "Unknown"} className="h-auto w-full justify-between gap-3 py-3 text-left"
              onClick={() => setSelectedBill(bill)}>
              <span className="min-w-0 truncate">{bill.title || t("operations.payables.untitledBill")}</span>
              <span className="shrink-0">{bill.currency === "Unknown"
                ? t("operations.payables.unknownCurrency", { amount: bill.amountDue.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) })
                : formatCurrency(bill.amountDue, bill.currency)}</span>
            </Button>)}
        </DialogBody>
        <DialogFooter><Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    {selectedBill ? <RegisterPurchasePaymentDialog purchase={selectedBill} open
      onOpenChange={open => { if (!open) setSelectedBill(null) }}
      onSuccess={() => {
        window.dispatchEvent(new CustomEvent("purchase:payment-recorded", { detail: { siteId } }))
        onClose()
      }} /> : null}
  </>
}