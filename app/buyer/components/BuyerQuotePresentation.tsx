"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import type { BuyerQuoteDto } from "@/app/buyer/quote-dto"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Button } from "@/app/components/ui/button"
import { Card, CardContent, CardFooter } from "@/app/components/ui/card"
import { CheckCircle2, ChevronLeft, Ban, ShoppingCart } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"
import { BuyerQuoteDocument } from "./BuyerQuoteDocument"

export type BuyerQuotePresentationProps = {
  quotation: BuyerQuoteDto
  backHref?: string | null
  onBack?: () => void
  isPublic?: boolean
  lockDestination?: boolean
  accepting?: boolean
  rejecting?: boolean
  onAccept?: () => void
  onReject?: () => void
  destination?: ReactNode
  publicNavigation?: ReactNode
  demo?: boolean
}

/** Shared document and response UI; loading, identity and mutations stay in the live controller. */
export function BuyerQuotePresentation({
  quotation, backHref, onBack, isPublic = false, lockDestination = false,
  accepting = false, rejecting = false, onAccept, onReject,
  destination, publicNavigation, demo = false,
}: BuyerQuotePresentationProps) {
  const { t } = useLocalization()
  const isExpired = quotation.valid_until && new Date(quotation.valid_until) < new Date()
  const canRespond = quotation.status === "sent" && !isExpired
  const busy = demo || accepting || rejecting
  const isSiteScope = lockDestination || (backHref?.startsWith("/purchases") ?? false)
  const siteName = quotation.site?.name || ""

  const headerContent = (
    <div className="flex w-full items-center gap-4">
      {backHref && !onBack ? (
        <Button variant="ghost" size="icon" asChild className="rounded-full">
          <Link href={backHref} aria-label="Back"><ChevronLeft className="w-5 h-5" /></Link>
        </Button>
      ) : backHref ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          aria-label="Back"
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

  return (
    <div
      className={`flex-1 flex flex-col min-h-full ${isPublic ? "min-h-screen bg-muted/30" : ""}`}
    >
      {demo ? null : publicNavigation}
      {isSiteScope ? (
        <StickyHeader>{headerContent}</StickyHeader>
      ) : (
        <div className="bg-transparent min-h-[72px] flex items-center w-full">
          {isPublic ? (
            <div className="w-full max-w-7xl mx-auto px-4 md:px-8 flex items-center h-full">
              {headerContent}
            </div>
          ) : headerContent}
        </div>
      )}

      <div className="flex-1 p-4 md:p-6 overflow-auto">
        <div className="max-w-4xl mx-auto space-y-6">
          <BuyerQuoteDocument quotation={quotation} isExpired={Boolean(isExpired)} />

          {canRespond && (
            <Card className="overflow-hidden rounded-2xl border-border/70 shadow-sm">
              <CardContent className="space-y-5 p-5 sm:p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground ring-1 ring-inset ring-border/60">
                    <ShoppingCart className="h-5 w-5" aria-hidden={true} />
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <h3 className="text-lg font-semibold tracking-tight">
                      {t("buyer.quotes.detail.accept") || "Accept"}
                    </h3>
                    <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                      {t("buyer.quotes.detail.acceptDesc") ||
                        "Accept this quote to continue to checkout with the quoted prices. You can choose delivery and payment options next."}
                    </p>
                  </div>
                </div>

                {demo ? null : destination}

              </CardContent>
              <CardFooter className="flex flex-col-reverse gap-3 border-t border-border/60 bg-muted/30 p-4 sm:flex-row sm:justify-end sm:px-6">
                  <Button
                    size="lg"
                    variant="ghost"
                    className="h-12 w-full rounded-xl px-5 text-sm text-muted-foreground hover:bg-red-50 hover:text-red-700 sm:w-auto dark:hover:bg-red-500/10 dark:hover:text-red-400"
                    onClick={demo ? undefined : onReject}
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
                    className="h-12 w-full rounded-xl px-6 text-sm sm:w-auto"
                    onClick={demo ? undefined : onAccept}
                    disabled={busy || quotation.total == null}
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
              </CardFooter>
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
