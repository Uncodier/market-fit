"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { StatusBar } from "../components/StatusBar"
import {
  getPurchaseById,
  deletePurchase,
  publishPurchase,
  unpublishPurchase,
  receivePurchaseStock,
  updatePurchase,
} from "@/app/purchases/actions"
import { Purchase } from "@/app/types"
import { Button } from "@/app/components/ui/button"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { CreditCard, Package, Trash2, BookOpen, Pencil, Send, Link, Printer } from "@/app/components/ui/icons"
import {
  ensureBillPublicAccessToken,
  sendVendorBill,
} from "@/app/bills/send-actions"
import { buildPublicDocPath } from "@/app/documents/public-token"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/app/components/ui/alert-dialog"
import { PurchaseInvoice } from "../components/PurchaseInvoice"
import { RegisterPurchasePaymentDialog } from "../components/RegisterPurchasePaymentDialog"
import { CreatePurchaseDialog } from "../components/CreatePurchaseDialog"
import { Skeleton } from "@/app/components/ui/skeleton"

export default function BillDetailPage(props: { params: Promise<{ id: string }> }) {
  const unwrappedParams = React.use(props.params)
  const router = useRouter()
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const [purchase, setPurchase] = useState<Purchase | null>(null)
  const [loading, setLoading] = useState(true)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sending, setSending] = useState(false)

  const load = async () => {
    if (!currentSite?.id || !unwrappedParams.id) return
    setLoading(true)
    try {
      const res = await getPurchaseById(currentSite.id, String(unwrappedParams.id))
      if (res.error || !res.purchase) {
        toast.error(res.error || (t("bills.error.notFound") || "Bill not found"))
        return
      }
      setPurchase(res.purchase)
      const event = new CustomEvent("breadcrumb:update", {
        detail: {
          title: res.purchase.title || (t("bills.detail.breadcrumb") || "Bill"),
          path: `/bills/${res.purchase.id}`,
          section: "bills",
        },
      })
      window.dispatchEvent(event)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [currentSite?.id, unwrappedParams.id])

  const onPublish = async () => {
    if (!currentSite?.id || !purchase) return
    setBusy(true)
    try {
      const res = await publishPurchase(currentSite.id, purchase.id)
      if (res.error) toast.error(res.error)
      else {
        toast.success(t("bills.success.published") || "Bill published to journal")
        await load()
      }
    } finally {
      setBusy(false)
    }
  }

  const onUnpublish = async () => {
    if (!currentSite?.id || !purchase) return
    setBusy(true)
    try {
      const res = await unpublishPurchase(currentSite.id, purchase.id)
      if (res.error) toast.error(res.error)
      else {
        toast.success(t("bills.success.unpublished") || "Bill unpublished")
        await load()
      }
    } finally {
      setBusy(false)
    }
  }

  const onReceive = async () => {
    if (!currentSite?.id || !purchase) return
    setBusy(true)
    try {
      const res = await receivePurchaseStock(currentSite.id, purchase.id, purchase.locationId)
      if (res.error) toast.error(res.error)
      else if (res.alreadyReceived) {
        toast.success(t("bills.success.alreadyReceived") || "Stock already received")
      } else {
        toast.success(t("bills.success.received") || "Stock received")
        await load()
      }
    } finally {
      setBusy(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!currentSite?.id || !purchase) return
    try {
      const res = await updatePurchase({
        siteId: currentSite.id,
        id: purchase.id,
        status: newStatus as "draft" | "pending" | "completed" | "cancelled"
      })
      if (res.error) {
        toast.error(res.error)
      } else {
        const label = t(`bills.status.${newStatus}`) || newStatus
        toast.success(`${t("bills.detail.statusUpdated") || "Status updated to"} ${label}`)
        if (res.purchase) setPurchase(res.purchase)
      }
    } catch (error) {
      console.error("Error updating status:", error)
      toast.error(t("bills.detail.errorStatus") || "Error updating status")
    }
  }

  const onDelete = async () => {
    if (!currentSite?.id || !purchase) return
    const res = await deletePurchase(currentSite.id, purchase.id)
    if (res.error) toast.error(res.error)
    else {
      toast.success(t("bills.success.deleted") || "Bill deleted")
      router.push("/bills")
    }
  }

  const handlePrint = () => {
    if (!purchase) return
    window.open(`/bill-pdf/${purchase.id}`, "_blank")
  }

  const handleSend = async () => {
    if (!purchase) return
    if (!purchase.vendorEmail) {
      toast.error(
        t("bills.detail.sendMissingEmail") ||
          "Add a vendor email before sending this bill"
      )
      return
    }
    setSending(true)
    try {
      const res = await sendVendorBill(purchase.id)
      if (res.error) toast.error(res.error)
      else {
        toast.success(
          t("bills.detail.sentEmail") || "Bill emailed with PDF attached"
        )
        if (res.data) setPurchase(res.data)
      }
    } finally {
      setSending(false)
    }
  }

  const handleCopyVendorLink = async () => {
    if (!purchase) return
    setSending(true)
    try {
      const tokenRes = await ensureBillPublicAccessToken(purchase.id)
      if (tokenRes.error || !tokenRes.token) {
        toast.error(tokenRes.error || "Failed to create public link")
        return
      }
      const link = `${window.location.origin}${buildPublicDocPath("vb", tokenRes.token)}`
      await navigator.clipboard.writeText(link)
      toast.success(t("bills.detail.linkCopied") || "Link copied to clipboard")
      setPurchase({ ...purchase, publicAccessToken: tokenRes.token })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex-1 p-0">
      <StickyHeader>
        <div className="flex flex-col w-full">
          <div className="px-16 flex items-center justify-between h-[50px]">
            <div className="flex items-center gap-1">
              {purchase && purchase.amountDue > 0 && purchase.status !== "cancelled" && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPaymentOpen(true)}
                    disabled={busy}
                    className="flex items-center gap-1 text-green-600 hover:bg-green-50 hover:text-green-700"
                  >
                    <CreditCard className="h-4 w-4" />
                    {t("bills.action.pay") || "Register payment"}
                  </Button>
                  <div className="w-px h-6 bg-border mx-1" />
                </>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditOpen(true)}
                disabled={busy}
                className="flex items-center gap-1"
              >
                <Pencil className="h-4 w-4" />
                {t("common.edit") || "Edit"}
              </Button>

              <div className="w-px h-6 bg-border mx-1" />

              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrint}
                disabled={busy}
                className="flex items-center gap-1"
              >
                <Printer className="h-4 w-4" />
                {t("common.print") || "Print"}
              </Button>

              <div className="w-px h-6 bg-border mx-1" />

              {purchase && purchase.status !== "cancelled" && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSend}
                    disabled={busy || sending}
                    className="flex items-center gap-1"
                  >
                    <Send className="h-4 w-4" />
                    {purchase.lastEmailedAt
                      ? t("bills.detail.resendEmail") || "Resend"
                      : t("bills.detail.sendEmail") || "Send"}
                  </Button>
                  <div className="w-px h-6 bg-border mx-1" />
                </>
              )}
              {purchase && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyVendorLink}
                    disabled={busy || sending}
                    className="flex items-center gap-1"
                  >
                    <Link className="h-4 w-4" />
                    {t("bills.detail.vendorLink") || "Vendor Link"}
                  </Button>
                  <div className="w-px h-6 bg-border mx-1" />
                </>
              )}

              {purchase && !purchase.stockReceived && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onReceive}
                    disabled={busy}
                    className="flex items-center gap-1"
                  >
                    <Package className="h-4 w-4" />
                    {t("bills.action.receive") || "Receive stock"}
                  </Button>
                  <div className="w-px h-6 bg-border mx-1" />
                </>
              )}

              {purchase && (
                purchase.accountingState !== "posted" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onPublish}
                    disabled={busy}
                    className="flex items-center gap-1 text-primary hover:bg-primary/10"
                  >
                    <BookOpen className="h-4 w-4 mr-1" />
                    {t("bills.action.publish") || "Publish"}
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onUnpublish}
                    disabled={busy}
                    className="flex items-center gap-1 text-orange-600 hover:bg-orange-50"
                  >
                    {t("bills.action.unpublish") || "Unpublish"}
                  </Button>
                )
              )}

              <div className="w-px h-6 bg-border mx-1" />

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    className="flex items-center gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                    {t("common.delete") || "Delete"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("bills.confirmDelete") || "Delete this bill?"}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("bills.confirmDeleteDesc") || "This will remove the bill and its journal entry."}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("common.cancel") || "Cancel"}</AlertDialogCancel>
                    <AlertDialogAction className="!bg-destructive hover:!bg-destructive/90 !text-destructive-foreground" onClick={onDelete}>{t("common.delete") || "Delete"}</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <div className="flex items-center justify-end">
              {purchase && (
                <StatusBar
                  currentStatus={purchase.status}
                  onStatusChange={handleStatusChange}
                />
              )}
            </div>
          </div>
        </div>
      </StickyHeader>

      <div className="px-16 py-8 bg-muted/50 dark:bg-background min-h-screen">
        {loading || !purchase ? (
          <div className="space-y-4 max-w-[800px] mx-auto">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <div className="max-w-[800px] mx-auto">
            <div className="relative">
              <PurchaseInvoice
                purchase={purchase}
                siteName={currentSite?.name || "Site"}
              />
              <div className="absolute inset-0 rounded-lg shadow-xl -z-10 transform translate-y-1 bg-card/50 dark:bg-card/10 opacity-50 dark:border dark:border-border/30"></div>
              <div className="absolute inset-0 rounded-lg shadow-md -z-20 transform translate-y-2 bg-card/30 dark:bg-card/5 opacity-30 dark:border dark:border-border/20"></div>
            </div>
          </div>
        )}
      </div>

      <RegisterPurchasePaymentDialog
        purchase={purchase}
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        onSuccess={load}
      />

      <CreatePurchaseDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        purchaseToEdit={purchase}
        onSuccess={() => load()}
      />
    </div>
  )
}
