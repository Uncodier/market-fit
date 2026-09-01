"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getQuotation } from "@/app/quotations/actions"
import { rejectQuotation } from "@/app/quotations/buyer-actions"
import {
  getQuotationByPublicToken,
  rejectQuotationByPublicToken,
} from "@/app/quotations/public-actions"
import { startQuoteCheckout } from "@/app/commerce/quote-cart"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Button } from "@/app/components/ui/button"
import { Card, CardContent } from "@/app/components/ui/card"
import { toast } from "sonner"
import { Skeleton } from "@/app/components/ui/skeleton"
import { CheckCircle2, ChevronLeft, Ban, ShoppingCart } from "@/app/components/ui/icons"
import { DestinationSelector } from "@/app/components/commerce/DestinationSelector"
import { PublicDocumentShopNav } from "@/app/documents/components/PublicDocumentShopNav"
import { PublicDocumentViewSkeleton } from "@/app/documents/components/PublicDocumentViewSkeleton"
import { useAuthContext as useAuth } from "@/app/components/auth/auth-provider"
import { useLocalization } from "@/app/context/LocalizationContext"
import { BuyerQuoteDocument } from "@/app/buyer/components/BuyerQuoteDocument"

export interface BuyerQuoteDetailViewProps {
  quoteId?: string
  /** When set, loads/rejects via public token (no account required). */
  publicAccessToken?: string
  backHref?: string | null
  returnUrl?: string
  defaultOwnerSiteId?: string | null
  lockDestination?: boolean
}

export function BuyerQuoteDetailView({
  quoteId,
  publicAccessToken,
  backHref = "/buyer/quotes",
  returnUrl,
  defaultOwnerSiteId = null,
  lockDestination = false,
}: BuyerQuoteDetailViewProps) {
  const router = useRouter()
  const { user } = useAuth()
  const { t } = useLocalization()
  const session = user ? { user } : null
  const isPublic = Boolean(publicAccessToken)
  const resolvedReturnUrl =
    returnUrl || (isPublic && publicAccessToken ? `/q/${publicAccessToken}` : "/buyer")

  const [quotation, setQuotation] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [ownerSiteId, setOwnerSiteId] = useState<string | null>(defaultOwnerSiteId)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadQuotation = async () => {
    setLoading(true)
    setLoadError(null)
    const res = publicAccessToken
      ? await getQuotationByPublicToken(publicAccessToken)
      : quoteId
        ? await getQuotation(quoteId)
        : { error: "Missing quote reference" }

    if (res.error) {
      toast.error(res.error)
      setLoadError(res.error)
      if (!isPublic && backHref) router.push(backHref)
    } else {
      setQuotation(res.data)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadQuotation()
  }, [quoteId, publicAccessToken])

  const handleAccept = () => {
    if (!quotation) return
    setAccepting(true)
    try {
      const path = startQuoteCheckout(quotation, {
        returnTo: resolvedReturnUrl,
        ownerSiteId,
        publicAccessToken: publicAccessToken || null,
      })
      router.push(path)
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : t("buyer.quotes.detail.checkoutError") || "Failed to start checkout"
      )
      setAccepting(false)
    }
  }

  const handleReject = async () => {
    if (!quotation) return
    setRejecting(true)
    const res = publicAccessToken
      ? await rejectQuotationByPublicToken(publicAccessToken)
      : await rejectQuotation(quotation.id)
    if (res.error) {
      toast.error(res.error)
      setRejecting(false)
      return
    }
    toast.success(t("buyer.quotes.detail.rejected") || "Quote rejected")
    await loadQuotation()
    setRejecting(false)
  }

  if (loading) {
    if (isPublic) {
      return <PublicDocumentViewSkeleton />
    }
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (loadError && !quotation) {
    return (
      <div className="min-h-screen bg-muted/30 flex flex-col">
        {isPublic ? <PublicDocumentShopNav /> : null}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md space-y-2">
            <h1 className="text-xl font-bold">
              {t("buyer.quotes.detail.unavailable") || "Quote unavailable"}
            </h1>
            <p className="text-muted-foreground text-sm">{loadError}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!quotation) return null

  const isExpired = quotation.valid_until && new Date(quotation.valid_until) < new Date()
  const canRespond = quotation.status === "sent" && !isExpired
  const busy = accepting || rejecting
  const isSiteScope = lockDestination || (backHref?.startsWith("/purchases") ?? false)
  const quoteSiteId = quotation.site?.id || quotation.site_id || null
  const siteName = quotation.site?.name || ""

  const headerContent = (
    <div className="flex w-full items-center gap-4">
      {backHref ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(backHref)}
          className="rounded-full"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
      ) : null}
      <div>
        <h1 className="font-bold text-lg leading-tight">
          {t("buyer.quotes.detail.quote") || "Quote"} {quotation.id.substring(0, 8)}
        </h1>
        <p className="text-xs text-muted-foreground">
          {t("buyer.quotes.detail.from") || "From"} {siteName}
        </p>
      </div>
    </div>
  )

  // Same sticky chrome as BuyerQuotesView / BuyerOrdersView / etc.
  const HeaderWrapper = isSiteScope
    ? StickyHeader
    : ({ children }: any) => (
        <div className="sticky top-[72px] z-30 bg-transparent h-[72px] flex items-center w-full">
          {isPublic ? (
            <div className="w-full max-w-7xl mx-auto px-4 md:px-8 flex items-center h-full">
              {children}
            </div>
          ) : (
            children
          )}
        </div>
      )

  return (
    <div
      className={`flex-1 flex flex-col min-h-full ${isPublic ? "min-h-screen bg-muted/30" : ""}`}
    >
      {isPublic ? (
        <PublicDocumentShopNav
          siteId={quoteSiteId}
          siteName={siteName}
          logoUrl={quotation.site?.logo_url}
          currency={quotation.currency}
        />
      ) : null}
      <HeaderWrapper>{headerContent}</HeaderWrapper>

      <div className="flex-1 p-4 md:p-6 overflow-auto">
        <div className="max-w-4xl mx-auto space-y-6">
          <BuyerQuoteDocument quotation={quotation} isExpired={Boolean(isExpired)} />

          {canRespond && (
            <Card className="border-primary/50 shadow-md">
              <CardContent className="pt-6 space-y-6">
                <div>
                  <h3 className="font-bold text-lg mb-2">
                    {t("buyer.quotes.detail.accept") || "Accept"}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {t("buyer.quotes.detail.acceptDesc") ||
                      "Accept this quote to continue to checkout with the quoted prices. You can choose delivery and payment options next."}
                  </p>
                </div>

                {session?.user && (
                  <DestinationSelector
                    value={ownerSiteId}
                    onChange={setOwnerSiteId}
                    label={
                      t("buyer.quotes.detail.whereToFile") ||
                      "Where should we file this purchase?"
                    }
                    locked={lockDestination}
                  />
                )}

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full sm:flex-1 text-base h-12 sm:h-14 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-red-500/30 dark:hover:bg-red-500/10"
                    onClick={handleReject}
                    disabled={busy}
                  >
                    {rejecting ? (
                      <span className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                        {t("buyer.quotes.detail.processing") || "Processing..."}
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Ban className="w-5 h-5" />
                        {t("buyer.quotes.detail.reject") || "Reject"}
                      </span>
                    )}
                  </Button>
                  <Button
                    size="lg"
                    className="w-full sm:flex-1 text-base h-12 sm:h-14"
                    onClick={handleAccept}
                    disabled={busy}
                  >
                    {accepting ? (
                      <span className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full border-2 border-background border-t-transparent animate-spin" />
                        {t("buyer.quotes.detail.processing") || "Processing..."}
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <ShoppingCart className="w-5 h-5" />
                        {t("buyer.quotes.detail.proceedToCheckout") ||
                          "Proceed to Checkout"}
                      </span>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {isExpired && quotation.status === "sent" && (
            <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 text-center dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20">
              {t("buyer.quotes.detail.expiredDesc") ||
                "This quote has expired and can no longer be accepted. Please contact the seller for a new quote."}
            </div>
          )}

          {quotation.status === "accepted" && (
            <div className="bg-green-50 text-green-700 p-4 rounded-xl border border-green-200 text-center flex items-center justify-center gap-2 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20">
              <CheckCircle2 className="w-5 h-5" />
              {t("buyer.quotes.detail.alreadyAccepted") ||
                "This quote has already been accepted."}
            </div>
          )}

          {quotation.status === "rejected" && (
            <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 text-center flex items-center justify-center gap-2 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20">
              <Ban className="w-5 h-5" />
              {t("buyer.quotes.detail.alreadyRejected") ||
                "This quote has been rejected."}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
