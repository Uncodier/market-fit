"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import {
  getPurchaseById,
  deletePurchase,
  publishPurchase,
  unpublishPurchase,
  receivePurchaseStock,
} from "@/app/purchases/actions"
import { Purchase } from "@/app/types"
import { Button } from "@/app/components/ui/button"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { CreditCard, Package, Trash2, BookOpen, Pencil } from "@/app/components/ui/icons"
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

  const onDelete = async () => {
    if (!currentSite?.id || !purchase) return
    const res = await deletePurchase(currentSite.id, purchase.id)
    if (res.error) toast.error(res.error)
    else {
      toast.success(t("bills.success.deleted") || "Bill deleted")
      router.push("/bills")
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))] bg-muted/30">
      <StickyHeader>
        <div className="w-full flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">
              {purchase?.title || (t("bills.detail.breadcrumb") || "Bill")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("bills.detail.subtitle") || "Vendor bill details"}
            </p>
          </div>
          {purchase && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} disabled={busy}>
                <Pencil className="h-4 w-4 mr-2" />
                {t("common.edit") || "Edit"}
              </Button>
              {purchase.amountDue > 0 && purchase.status !== "cancelled" && (
                <Button variant="outline" size="sm" onClick={() => setPaymentOpen(true)} disabled={busy}>
                  <CreditCard className="h-4 w-4 mr-2" />
                  {t("bills.action.pay") || "Register payment"}
                </Button>
              )}
              {!purchase.stockReceived && (
                <Button variant="outline" size="sm" onClick={onReceive} disabled={busy}>
                  <Package className="h-4 w-4 mr-2" />
                  {t("bills.action.receive") || "Receive stock"}
                </Button>
              )}
              {purchase.accountingState !== "posted" ? (
                <Button size="sm" onClick={onPublish} disabled={busy}>
                  <BookOpen className="h-4 w-4 mr-2" />
                  {t("bills.action.publish") || "Publish"}
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={onUnpublish} disabled={busy}>
                  {t("bills.action.unpublish") || "Unpublish"}
                </Button>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={busy}>
                    <Trash2 className="h-4 w-4 mr-2" />
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
                    <AlertDialogAction onClick={onDelete}>{t("common.delete") || "Delete"}</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </StickyHeader>

      <div className="px-6 py-6 max-w-5xl mx-auto w-full">
        {loading || !purchase ? (
          <div className="space-y-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <PurchaseInvoice
            purchase={purchase}
            siteName={currentSite?.name || "Site"}
          />
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
