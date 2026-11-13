"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useSite } from "@/app/context/SiteContext"
import { useOptionalPermissions } from "@/app/context/PermissionContext"
import type { Purchase } from "@/app/types"
import { getPurchaseById, publishPurchase, unpublishPurchase } from "@/app/purchases/actions"
import { ensureBillPublicAccessToken, sendVendorBill } from "@/app/bills/send-actions"
import { buildPublicDocPath } from "@/app/documents/public-token"
import { Button } from "@/app/components/ui/button"
import { MoreHorizontal, Pencil, Trash2, CreditCard, Printer, Send, Link, Package, BookOpen } from "@/app/components/ui/icons"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu"
import { CreatePurchaseDialog } from "./CreatePurchaseDialog"
import { RegisterPurchasePaymentDialog } from "./RegisterPurchasePaymentDialog"
import { ReceivePurchaseStockDialog } from "./ReceivePurchaseStockDialog"
import { usePendingReceipt } from "../use-pending-receipt"
import { hasPendingReceipt } from "../pending-receipt"

type RowAction = "edit" | "pay" | "receive" | "send" | "publish" | "unpublish"
export function BillRowActions({ purchase, onOpen, onDelete, onUpdate }: {
  purchase: Purchase; onOpen: (id: string) => void; onDelete: (id: string) => void; onUpdate?: () => void
}) {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const permissions = useOptionalPermissions()
  const [selected, setSelected] = useState<Purchase | null>(null)
  const [dialog, setDialog] = useState<"edit" | "pay" | "receive" | null>(null)
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const siteId = currentSite?.id
  const { pending: pendingReceipt, actorId } = usePendingReceipt(siteId, purchase.id)
  const demo = !!siteId?.startsWith("demo-") || purchase.siteId?.startsWith("demo-")
  const inSite = !!siteId && purchase.siteId === siteId
  const canUpdate = inSite && !demo && (!permissions || permissions.can("update"))
  const canDelete = inSite && !demo && (!permissions || permissions.can("delete"))
  const cancelled = purchase.status === "cancelled"
  const eligible = (bill: Purchase, action: RowAction) => {
    if (action === "pay") return bill.status !== "cancelled" && bill.amountDue > 0
    if (action === "receive") return bill.status !== "cancelled" && (!bill.stockReceived || hasPendingReceipt(actorId, siteId, bill.id))
    if (action === "send") return bill.status !== "cancelled"
    if (action === "publish") return bill.accountingState !== "posted"
    if (action === "unpublish") return bill.accountingState === "posted" && (!permissions || permissions.can("delete"))
    return true
  }
  const refresh = () => { setDialog(null); setSelected(null); onUpdate?.() }
  async function run(action: RowAction) {
    if (!canUpdate || pending.current || !siteId) return
    pending.current = true; setBusy(true)
    try {
      // List projections and receipt/payment state may be stale. Reuse the same
      // detail loader before opening a dialog or executing a document action.
      const result = await getPurchaseById(siteId, purchase.id)
      if (result.error || !result.purchase || result.purchase.siteId !== siteId) throw new Error("Bill is unavailable")
      const bill = result.purchase
      if (!eligible(bill, action)) { onUpdate?.(); throw new Error("This action is no longer available for this bill") }
      if (action === "edit" || action === "pay" || action === "receive") {
        setSelected(bill); setDialog(action); return
      }
      if (action === "send") {
        if (!bill.vendorEmail) throw new Error(t("bills.detail.sendMissingEmail") || "Add a vendor email before sending this bill")
        const sent = await sendVendorBill(bill.id)
        if (sent.error) throw new Error(sent.error)
        toast.success(t("bills.detail.sentEmail") || "Bill emailed with PDF attached")
        if (sent.warning) toast.warning(sent.warning)
      } else {
        const response = action === "publish" ? await publishPurchase(siteId, bill.id) : await unpublishPurchase(siteId, bill.id)
        if (response.error) throw new Error(response.error)
        toast.success(action === "publish" ? t("bills.success.published") || "Bill published to journal" : t("bills.success.unpublished") || "Bill unpublished")
      }
      onUpdate?.()
    } catch (error) { toast.error(error instanceof Error ? error.message : "Bill action failed") }
    finally { pending.current = false; setBusy(false) }
  }
  async function copyLink() {
    if (!canUpdate || pending.current) return
    pending.current = true; setBusy(true)
    try {
      const textPromise = ensureBillPublicAccessToken(purchase.id).then(result => {
        if (result.error || !result.token) throw new Error(result.error || "Failed to create public link")
        return `${window.location.origin}${buildPublicDocPath("vb", result.token)}`
      })
      if (typeof window.ClipboardItem !== "undefined" && navigator.clipboard.write) {
        await navigator.clipboard.write([new ClipboardItem({ "text/plain": textPromise.then(text => new Blob([text], { type: "text/plain" })) })])
      } else {
        await navigator.clipboard.writeText(await textPromise)
      }
      toast.success(t("bills.detail.linkCopied") || "Link copied to clipboard")
      onUpdate?.()
    } catch (error) { toast.error(error instanceof Error ? error.message : "Failed to copy public link") }
    finally { pending.current = false; setBusy(false) }
  }
  return <>
    <DropdownMenu><DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" aria-label={`Bill actions: ${purchase.title}`} disabled={busy}
        className="h-8 w-8 opacity-100 md:opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100">
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger><DropdownMenuContent align="end">
      <DropdownMenuItem onSelect={() => onOpen(purchase.id)}><Pencil className="h-4 w-4 mr-2" />{t("common.open") || "Open"}</DropdownMenuItem>
      <DropdownMenuItem disabled={!canUpdate} onSelect={() => void run("edit")}><Pencil className="h-4 w-4 mr-2" />{t("common.edit") || "Edit"}</DropdownMenuItem>
      {!cancelled && purchase.amountDue > 0 && <DropdownMenuItem disabled={!canUpdate} onSelect={() => void run("pay")}><CreditCard className="h-4 w-4 mr-2" />{t("bills.action.pay") || "Register payment"}</DropdownMenuItem>}
      {!cancelled && (!purchase.stockReceived || pendingReceipt) && <DropdownMenuItem disabled={!canUpdate} onSelect={() => void run("receive")}><Package className="h-4 w-4 mr-2" />{pendingReceipt ? "Retry saved receipt" : t("bills.action.receive") || "Receive stock"}</DropdownMenuItem>}
      <DropdownMenuSeparator />
      <DropdownMenuItem disabled={!canUpdate} onSelect={() => window.open(`/bill-pdf/${encodeURIComponent(purchase.id)}`, "_blank", "noopener,noreferrer")}><Printer className="h-4 w-4 mr-2" />{t("common.print") || "Print"}</DropdownMenuItem>
      {!cancelled && <DropdownMenuItem disabled={!canUpdate} onSelect={() => void run("send")}><Send className="h-4 w-4 mr-2" />{purchase.lastEmailedAt ? t("bills.detail.resendEmail") || "Resend" : t("bills.detail.sendEmail") || "Send"}</DropdownMenuItem>}
      <DropdownMenuItem disabled={!canUpdate} onSelect={() => void copyLink()}><Link className="h-4 w-4 mr-2" />{t("bills.detail.vendorLink") || "Vendor Link"}</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem disabled={!canUpdate || (purchase.accountingState === "posted" && !canDelete)} onSelect={() => void run(purchase.accountingState === "posted" ? "unpublish" : "publish")}><BookOpen className="h-4 w-4 mr-2" />{purchase.accountingState === "posted" ? t("bills.action.unpublish") || "Unpublish" : t("bills.action.publish") || "Publish"}</DropdownMenuItem>
      <DropdownMenuItem className="text-destructive focus:text-destructive" disabled={!canDelete} onSelect={() => onDelete(purchase.id)}><Trash2 className="h-4 w-4 mr-2" />{t("common.delete") || "Delete"}</DropdownMenuItem>
    </DropdownMenuContent></DropdownMenu>
    {dialog === "edit" && selected && canUpdate && selected.siteId === siteId && <CreatePurchaseDialog open onOpenChange={open => { if (!open) setDialog(null) }} purchaseToEdit={selected} onSuccess={refresh} />}
    {dialog === "pay" && selected && canUpdate && selected.siteId === siteId && <RegisterPurchasePaymentDialog purchase={selected} open onOpenChange={open => { if (!open) setDialog(null) }} onSuccess={refresh} />}
    {dialog === "receive" && selected && canUpdate && siteId && selected.siteId === siteId && <ReceivePurchaseStockDialog key={`${actorId}-${siteId}-${selected.id}`} siteId={siteId} purchase={selected} open onOpenChange={open => { if (!open) setDialog(null) }} onSuccess={refresh} />}
  </>
}