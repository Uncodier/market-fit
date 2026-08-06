"use client"

import { useEffect, useMemo, useRef } from "react"
import {
  formatQuoteExpirationLabel,
} from "@/app/catalog/dynamic-pricing"
import { validateDynamicQuoteFields } from "@/app/components/commerce/DynamicQuoteFieldsForm"
import { PdpCtaButton } from "./PdpCtaButton"
import { PdpPriceBlock } from "./PdpPriceBlock"
import { Button } from "@/app/components/ui/button"
import { Loader2 } from "@/app/components/ui/icons"
import { useDisplayCurrency } from "@/app/context/DisplayCurrencyContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { cn } from "@/lib/utils"
import { useDynamicQuotePdp } from "./DynamicQuotePdpProvider"
import { DynamicQuoteProgressFeed } from "./DynamicQuoteProgressFeed"

function LiveSummaryChips({
  chips,
}: {
  chips: Array<{ id: string; label: string; value: string }>
}) {
  if (!chips.length) return null
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <div
          key={chip.id}
          className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-3 py-1.5 text-xs"
        >
          <span className="text-muted-foreground shrink-0">{chip.label}</span>
          <span className="font-medium truncate">{chip.value}</span>
        </div>
      ))}
    </div>
  )
}

export function DynamicQuotePdpRail({
  className,
  compact = false,
}: {
  className?: string
  /** Hide secondary CTAs for mobile bar usage */
  compact?: boolean
}) {
  const { t } = useLocalization()
  const { formatPrice } = useDisplayCurrency()
  const {
    item,
    config,
    loading,
    quotationId,
    status,
    unitPrice,
    validUntil,
    quotationStatus,
    progressLogs,
    expired,
    canAccept,
    handleGetQuote,
    handleCheckout,
    handleAddToCart,
    values,
    quantity,
    isGuest,
    email,
  } = useDynamicQuotePdp()

  const railRef = useRef<HTMLDivElement>(null)
  const prevHasPrice = useRef(false)
  const currency = item.currency || "USD"

  const ctaLabel = (() => {
    if (expired || status === "failed") {
      return t("pdp.dynamicQuote.recalculate") || "Recalculate quote"
    }
    if (config.requires_advanced_compute) {
      return t("pdp.dynamicQuote.getQuote") || "Get quote"
    }
    return t("pdp.dynamicQuote.getInstantAiQuote") || "Get instant AI quote"
  })()

  /** Shorter label for the sticky mobile bar (matches cart/checkout density). */
  const compactCtaLabel = (() => {
    if (expired || status === "failed") {
      return t("pdp.dynamicQuote.recalculate") || "Recalculate"
    }
    return t("pdp.dynamicQuote.getQuote") || "Get quote"
  })()

  const validationError = validateDynamicQuoteFields(config, values, t)
  const hasEmailError = isGuest && (!email.trim() || !email.includes("@"))
  const isFormValid = !validationError && !hasEmailError
  const hasQuotedPrice = unitPrice != null && unitPrice > 0
  const isProcessing = status === "processing"
  const minPrice = config.min_price ?? null

  const chips = useMemo(() => {
    const list: Array<{ id: string; label: string; value: string }> = []
    if (quantity > 1) {
      list.push({
        id: "qty",
        label: t("common.quantity") || "Qty",
        value: String(quantity),
      })
    }
    for (const field of config.fields || []) {
      const raw = values[field.key]
      if (raw === undefined || raw === null || raw === "" || field.type === "boolean") continue
      list.push({
        id: field.key,
        label: field.label,
        value: String(raw),
      })
      if (list.length >= 6) break
    }
    return list
  }, [config.fields, values, quantity, t])

  useEffect(() => {
    if (hasQuotedPrice && !prevHasPrice.current) {
      if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
        railRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
      }
    }
    prevHasPrice.current = hasQuotedPrice
  }, [hasQuotedPrice])

  if (compact) {
    const amount = hasQuotedPrice
      ? unitPrice!
      : minPrice != null && minPrice > 0
        ? minPrice
        : null
    const amountLabel = amount != null ? formatPrice(amount, currency) : null
    const checkoutLabel = amountLabel
      ? `${t("shop.checkout") || "Checkout"} • ${amountLabel}`
      : t("shop.checkout") || "Checkout"
    const quoteLabel = amountLabel
      ? `${compactCtaLabel} • ${amountLabel}`
      : compactCtaLabel

    return (
      <div className={cn("flex flex-col gap-2 w-full", className)}>
        {canAccept ? (
          <div className="flex gap-2 w-full">
            <PdpCtaButton
              variant="outline"
              onClick={handleAddToCart}
              disabled={loading}
              className="px-4 shrink-0 w-auto"
            >
              {t("marketplace.add") || "Add"}
            </PdpCtaButton>
            <PdpCtaButton onClick={handleCheckout} disabled={loading} className="flex-1">
              {checkoutLabel}
            </PdpCtaButton>
          </div>
        ) : (
          <PdpCtaButton
            onClick={handleGetQuote}
            disabled={loading || !isFormValid || isProcessing}
            className="w-full"
          >
            {loading || isProcessing ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                {t("pdp.dynamicQuote.processing") || "Processing..."}
              </span>
            ) : (
              quoteLabel
            )}
          </PdpCtaButton>
        )}
      </div>
    )
  }

  return (
    <div ref={railRef} id="dynamic-quote-rail" className={cn("space-y-5", className)}>
      <div className="space-y-1">
        <div className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
          {t("pdp.dynamicQuote.yourQuote") || "Your quote"}
        </div>
        <LiveSummaryChips chips={chips} />
      </div>

      <div
        className={cn(
          "space-y-2 transition-all duration-300",
          hasQuotedPrice ? "opacity-100 scale-100" : "opacity-95"
        )}
      >
        {hasQuotedPrice ? (
          <>
            <PdpPriceBlock price={unitPrice!} currency={item.currency || "USD"} />
            {validUntil && (
              <p
                className={`text-sm ${
                  expired ? "text-destructive" : "text-muted-foreground"
                }`}
              >
                {expired
                  ? t("pdp.dynamicQuote.expired") ||
                    "Quote expired — recalculate to continue"
                  : (
                      t("pdp.dynamicQuote.validUntil") || "Valid until {date}"
                    ).replace("{date}", new Date(validUntil).toLocaleString())}
              </p>
            )}
          </>
        ) : (
          <>
            {minPrice != null && minPrice > 0 ? (
              <>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                  {t("catalog.dynamicPricing.from") || "From"}
                </div>
                <PdpPriceBlock price={minPrice} currency={item.currency || "USD"} />
              </>
            ) : (
              <div className="text-3xl font-black tracking-tight text-muted-foreground/70">
                {t("catalog.dynamicPricing.quote") || "Quote"}
              </div>
            )}
            {!isProcessing && (
              <p className="text-sm text-muted-foreground">
                {t("pdp.dynamicQuote.fillDetailsToQuote") ||
                  "Fill details to get your quote."}
              </p>
            )}
            {config.quote_expiration && !isProcessing && (
              <p className="text-xs text-muted-foreground">
                {(
                  t("pdp.dynamicQuote.validFor") ||
                  "Quote valid for {duration}."
                ).replace(
                  "{duration}",
                  formatQuoteExpirationLabel(config.quote_expiration, t)
                )}
              </p>
            )}
          </>
        )}
      </div>

      {isProcessing && <DynamicQuoteProgressFeed logs={progressLogs} />}

      {status === "awaiting_authorization" && quotationStatus !== "sent" && (
        <p className="text-sm text-amber-600">
          {t("pdp.dynamicQuote.willBeSentShortly") ||
            "Once ready, it will be sent to you shortly."}
        </p>
      )}
      {status === "failed" && (
        <p className="text-sm text-destructive">
          {t("pdp.dynamicQuote.failed") || "Quote calculation failed. Please try again."}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {(!quotationId || expired || status === "failed") && (
          <>
            <PdpCtaButton onClick={handleGetQuote} disabled={loading || !isFormValid}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {t("common.processing") || "Processing..."}
                </span>
              ) : (
                ctaLabel
              )}
            </PdpCtaButton>
            {!isFormValid && !loading && (
              <p className="text-sm text-amber-600 text-center font-medium">
                {hasEmailError
                  ? t("pdp.dynamicQuote.email") || "Email is required"
                  : validationError ||
                    t("pdp.dynamicQuote.fillFormToQuote") ||
                    "Fill the form to get your quote."}
              </p>
            )}
          </>
        )}
        {canAccept && (
          <>
            <PdpCtaButton onClick={handleCheckout} disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {t("common.processing") || "Processing..."}
                </span>
              ) : (
                t("shop.checkout") || t("checkout.title") || "Checkout"
              )}
            </PdpCtaButton>
            <PdpCtaButton variant="outline" onClick={handleAddToCart} disabled={loading}>
              {t("marketplace.add") || "Add to Cart"}
            </PdpCtaButton>
          </>
        )}
        {quotationId && isProcessing && (
          <Button variant="outline" disabled>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t("pdp.dynamicQuote.processing") || "Processing..."}
          </Button>
        )}
      </div>
    </div>
  )
}
