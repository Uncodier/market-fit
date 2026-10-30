"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getQuotation } from "@/app/quotations/actions"
import { getBuyerQuotation } from "@/app/buyer/quote-actions"
import type { BuyerQuoteDto } from "@/app/buyer/quote-dto"
import { rejectQuotation } from "@/app/quotations/buyer-actions"
import {
  getQuotationByPublicToken,
  rejectQuotationByPublicToken,
} from "@/app/quotations/public-actions"
import { startQuoteCheckout } from "@/app/commerce/quote-cart"
import { toast } from "sonner"
import { BuyerQuoteDetailSkeleton } from "./BuyerQuoteDetailSkeleton"
import { DestinationSelector } from "@/app/components/commerce/DestinationSelector"
import { PublicDocumentShopNav } from "@/app/documents/components/PublicDocumentShopNav"
import { PublicDocumentViewSkeleton } from "@/app/documents/components/PublicDocumentViewSkeleton"
import { useAuthContext as useAuth } from "@/app/components/auth/auth-provider"
import { useLocalization } from "@/app/context/LocalizationContext"
import { BuyerQuotePresentation } from "./BuyerQuotePresentation"

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

  const [quotation, setQuotation] = useState<BuyerQuoteDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [ownerSiteId, setOwnerSiteId] = useState<string | null>(defaultOwnerSiteId)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadQuotation = async () => {
    setLoading(true)
    setLoadError(null)
    const isSitePurchase = lockDestination && Boolean(defaultOwnerSiteId)
    const res = publicAccessToken
      ? await getQuotationByPublicToken(publicAccessToken)
      : quoteId
        ? isSitePurchase
          ? await getQuotation(quoteId)
          : await getBuyerQuotation(quoteId)
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
    if (quotation.total == null) {
      toast.error(t("procurement.common.taxesBeforeOrder"))
      return
    }
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
    return <BuyerQuoteDetailSkeleton scope={lockDestination || backHref?.startsWith("/purchases") ? "site" : "personal"} />
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

  return (
    <BuyerQuotePresentation
      quotation={quotation}
      backHref={backHref}
      onBack={backHref ? () => router.push(backHref) : undefined}
      isPublic={isPublic}
      lockDestination={lockDestination}
      accepting={accepting}
      rejecting={rejecting}
      onAccept={handleAccept}
      onReject={handleReject}
      destination={session?.user ? (
        <DestinationSelector
          value={ownerSiteId}
          onChange={setOwnerSiteId}
          label={t("buyer.quotes.detail.whereToFile") || "Where should we file this purchase?"}
          locked={lockDestination}
        />
      ) : null}
      publicNavigation={isPublic ? (
        <PublicDocumentShopNav
          siteId={quotation.site?.id || quotation.site_id || null}
          siteName={quotation.site?.name || ""}
          logoUrl={quotation.site?.logo_url}
          currency={quotation.currency}
        />
      ) : null}
    />
  )
}
