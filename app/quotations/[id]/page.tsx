"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  getQuotation,
  updateQuotationStatus,
  removeQuotationItem,
  deleteQuotation,
  sendQuotation,
} from "../actions"
import { ensureQuotationPublicAccessToken } from "../public-actions"
import { buildPublicQuotePath } from "../public-token"
import { authorizeDynamicQuote, retryDynamicQuoteItem } from "../dynamic-quote-actions"
import { updateQuotationItem, updateQuotationNotes } from "../actions"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Button } from "@/app/components/ui/button"
import { toast } from "sonner"
import { Skeleton } from "@/app/components/ui/skeleton"
import { CheckCircle2, Link, Pencil, Printer, Send, Trash2 } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"
import { AddQuotationItemDialog } from "../components/AddQuotationItemDialog"
import { CreateQuotationDialog } from "../components/CreateQuotationDialog"
import { QuotationInvoice } from "../components/QuotationInvoice"
import {
  QuotationStatusBar,
  QuotationStatus,
} from "../components/QuotationStatusBar"
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

export default function QuotationDetail({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params)
  const router = useRouter()
  const { t } = useLocalization()

  const [quotation, setQuotation] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [isAddItemOpen, setIsAddItemOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)

  const [itemToDelete, setItemToDelete] = useState<string | null>(null)

  const loadQuotation = async () => {
    setLoading(true)
    const res = await getQuotation(resolvedParams.id)
    if (res.error) {
      toast.error(res.error)
      router.push("/quotations")
    } else {
      setQuotation(res.data)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadQuotation()
  }, [resolvedParams.id])

  useEffect(() => {
    if (quotation) {
      const event = new CustomEvent("breadcrumb:update", {
        detail: {
          title: `${t("quotations.detail.breadcrumbQuote") || "Quote"} ${quotation.id.substring(0, 8)}`,
          parent: {
            title: t("quotations.detail.breadcrumbParent") || "Quotations",
            path: "/quotations",
          },
        },
      })
      window.dispatchEvent(event)
    }
  }, [quotation, t])

  const awaitingAuthorization = (quotation?.items || []).some(
    (item: any) => item.metadata?.dynamic_quote?.status === "awaiting_authorization"
  )
  const hasProcessing = (quotation?.items || []).some(
    (item: any) => item.metadata?.dynamic_quote?.status === "processing"
  )

  const handleUpdateStatus = async (status: QuotationStatus) => {
    if (status === "sent" && (awaitingAuthorization || hasProcessing)) {
      toast.error(
        t("quotations.detail.cannotSendYet") ||
          "Authorize dynamic quote items before marking as sent"
      )
      return
    }

    setUpdating(true)
    const res = await updateQuotationStatus(quotation.id, status)
    if (res.error) {
      toast.error(res.error)
    } else {
      const label = t(`status.${status}`) || t(`quotations.status.${status}`) || status
      toast.success(
        t("quotations.detail.statusUpdatedTo", { status: label }) ||
          `Status updated to ${label}`
      )
      setQuotation((prev: any) => ({ ...prev, ...res.data }))
    }
    setUpdating(false)
  }

  const handleRemoveItem = async () => {
    if (!itemToDelete) return
    setUpdating(true)
    const res = await removeQuotationItem(itemToDelete)
    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success(t("quotations.detail.itemRemoved") || "Item removed successfully")
      loadQuotation()
    }
    setItemToDelete(null)
    setUpdating(false)
  }

  const handleAuthorize = async () => {
    setUpdating(true)
    const res = await authorizeDynamicQuote(quotation.id)
    if (res.error) toast.error(res.error)
    else {
      toast.success(
        t("quotations.dynamicQuote.authorized") || "Quote authorized — you can send it now"
      )
      loadQuotation()
    }
    setUpdating(false)
  }

  const handleRetry = async (itemId: string) => {
    setUpdating(true)
    const res = await retryDynamicQuoteItem(itemId)
    if (res.error && !res.data?.quotationId) toast.error(res.error)
    else {
      toast.success(t("quotations.dynamicQuote.retrying") || "Retrying quote calculation")
      loadQuotation()
    }
    setUpdating(false)
  }

  const handleUpdateItemQuantity = async (itemId: string, quantity: number) => {
    setUpdating(true)
    const res = await updateQuotationItem(itemId, { quantity })
    if (res.error) {
      toast.error(res.error)
    } else {
      loadQuotation()
    }
    setUpdating(false)
  }

  const handleUpdateItemPrice = async (itemId: string, unitPrice: number) => {
    setUpdating(true)
    const res = await updateQuotationItem(itemId, { unitPrice })
    if (res.error) {
      toast.error(res.error)
    } else {
      loadQuotation()
    }
    setUpdating(false)
  }

  const handleUpdateNotes = async (notes: string | null) => {
    setUpdating(true)
    const res = await updateQuotationNotes(quotation.id, notes)
    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success(t("common.saved") || "Saved")
      setQuotation((prev: any) => ({ ...prev, notes }))
    }
    setUpdating(false)
  }

  const handleDelete = async () => {
    setUpdating(true)
    const res = await deleteQuotation(quotation.id)
    if (res.error) {
      toast.error(res.error)
      setUpdating(false)
    } else {
      toast.success(t("quotations.detail.deleted") || "Quotation deleted successfully")
      router.push("/quotations")
    }
  }

  const handleSend = async () => {
    if (awaitingAuthorization || hasProcessing) {
      toast.error(
        t("quotations.detail.cannotSendYet") ||
          "Authorize dynamic quote items before marking as sent"
      )
      return
    }
    if (!quotation.lead?.email) {
      toast.error(
        t("quotations.detail.sendMissingEmail") ||
          "Add a client email before sending this quote"
      )
      return
    }

    setUpdating(true)
    const res = await sendQuotation(quotation.id)
    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success(
        t("quotations.detail.sentEmail") ||
          "Quote emailed to the client with PDF attached"
      )
      if (res.data) setQuotation((prev: any) => ({ ...prev, ...res.data }))
      else loadQuotation()
    }
    setUpdating(false)
  }

  const handlePrint = () => {
    if (quotation?.id) {
      window.open(`/quote-pdf/${quotation.id}`, "_blank")
    }
  }

  const handleCopyClientLink = async () => {
    setUpdating(true)
    const tokenRes = await ensureQuotationPublicAccessToken(quotation.id)
    if (tokenRes.error || !tokenRes.token) {
      toast.error(tokenRes.error || "Failed to create public link")
      setUpdating(false)
      return
    }
    const clientLink = `${window.location.origin}${buildPublicQuotePath(tokenRes.token)}`
    await navigator.clipboard.writeText(clientLink)
    toast.success(t("quotations.detail.linkCopied") || "Link copied to clipboard")
    if (!quotation.public_access_token) {
      setQuotation({ ...quotation, public_access_token: tokenRes.token })
    }
    setUpdating(false)
  }

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!quotation) return null

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))] bg-muted/30">
      <StickyHeader>
        <div className="flex flex-col w-full">
          <div className="flex items-center justify-between h-[50px]">
            <div className="flex items-center gap-1">
              {awaitingAuthorization && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleAuthorize}
                    disabled={updating || hasProcessing}
                    className="flex items-center gap-1"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {t("quotations.dynamicQuote.authorize") || "Authorize"}
                  </Button>
                  <div className="w-px h-6 bg-border mx-1" />
                </>
              )}

              {quotation.status === "draft" && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditOpen(true)}
                    disabled={updating}
                    className="flex items-center gap-1"
                  >
                    <Pencil className="h-4 w-4" />
                    {t("common.edit") || "Edit"}
                  </Button>
                  <div className="w-px h-6 bg-border mx-1" />
                </>
              )}

              {(quotation.status === "draft" || quotation.status === "sent") && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSend}
                    disabled={updating || awaitingAuthorization || hasProcessing}
                    className="flex items-center gap-1"
                  >
                    <Send className="h-4 w-4" />
                    {quotation.status === "sent"
                      ? t("quotations.detail.resendEmail") || "Resend"
                      : t("quotations.detail.sendEmail") || "Send"}
                  </Button>
                  <div className="w-px h-6 bg-border mx-1" />
                </>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyClientLink}
                className="flex items-center gap-1"
              >
                <Link className="h-4 w-4" />
                {t("quotations.detail.clientLink") || "Client Link"}
              </Button>

              <div className="w-px h-6 bg-border mx-1" />

              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrint}
                className="flex items-center gap-1"
              >
                <Printer className="h-4 w-4" />
                {t("common.print") || "Print"}
              </Button>

              <div className="w-px h-6 bg-border mx-1" />

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={updating}
                    className="flex items-center gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                    {t("common.delete") || "Delete"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {t("quotations.detail.deleteTitle") || "Delete Quotation"}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("quotations.detail.deleteConfirm") ||
                        "Are you sure you want to delete this quotation? This action cannot be undone."}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("common.cancel") || "Cancel"}</AlertDialogCancel>
                    <AlertDialogAction
                      className="!bg-destructive hover:!bg-destructive/90 !text-destructive-foreground"
                      onClick={handleDelete}
                    >
                      {t("common.delete") || "Delete"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <div className="flex items-center justify-end">
              <QuotationStatusBar
                currentStatus={quotation.status}
                onStatusChange={handleUpdateStatus}
                disabled={updating}
                disabledStatuses={
                  awaitingAuthorization || hasProcessing ? ["sent"] : []
                }
              />
            </div>
          </div>
        </div>
      </StickyHeader>

      <div className="px-4 md:px-16 py-8 bg-muted/50 dark:bg-background min-h-screen">
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            <QuotationInvoice
              quotation={quotation}
              updating={updating}
              onAddItem={() => setIsAddItemOpen(true)}
              onRemoveItem={(itemId) => setItemToDelete(itemId)}
              onUpdateItemQuantity={handleUpdateItemQuantity}
              onUpdateItemPrice={handleUpdateItemPrice}
              onRetryItem={handleRetry}
              onUpdateNotes={handleUpdateNotes}
            />
            <div className="absolute inset-0 rounded-lg shadow-xl -z-10 transform translate-y-1 bg-card/50 dark:bg-card/10 opacity-50 dark:border dark:border-border/30" />
            <div className="absolute inset-0 rounded-lg shadow-md -z-20 transform translate-y-2 bg-card/30 dark:bg-card/5 opacity-30 dark:border dark:border-border/20" />
          </div>
        </div>
      </div>

      <AddQuotationItemDialog
        open={isAddItemOpen}
        onOpenChange={setIsAddItemOpen}
        quotationId={quotation.id}
        onSuccess={loadQuotation}
      />

      {quotation.status === "draft" && (
        <CreateQuotationDialog
          open={isEditOpen}
          onOpenChange={setIsEditOpen}
          quotationToEdit={quotation}
          onSuccess={loadQuotation}
        />
      )}

      <AlertDialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("quotations.detail.deleteItemTitle") || "Delete Item"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("common.confirmDelete") || "Are you sure you want to delete this?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel") || "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              className="!bg-destructive hover:!bg-destructive/90 !text-destructive-foreground"
              onClick={handleRemoveItem}
            >
              {t("common.delete") || "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
