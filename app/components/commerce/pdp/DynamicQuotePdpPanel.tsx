"use client"

import { useEffect, useState } from "react"
import { CatalogItem } from "@/app/types"
import { formatQuoteExpirationLabel } from "@/app/catalog/dynamic-pricing"
import { DynamicQuoteFieldsForm } from "@/app/components/commerce/DynamicQuoteFieldsForm"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { useLocalization } from "@/app/context/LocalizationContext"
import { cn } from "@/lib/utils"
import {
  DynamicQuotePdpProvider,
  useDynamicQuotePdp,
} from "./DynamicQuotePdpProvider"
import { DynamicQuoteRoutePreview } from "./DynamicQuoteRoutePreview"
import { DynamicQuotePdpRail } from "./DynamicQuotePdpRail"
import { DynamicQuoteProgressFeed } from "./DynamicQuoteProgressFeed"
import { PdpMobileBuyBar } from "./PdpMobileBuyBar"

export { DynamicQuotePdpProvider } from "./DynamicQuotePdpProvider"
export { DynamicQuotePdpRail } from "./DynamicQuotePdpRail"

export function DynamicQuotePdpFields({ className }: { className?: string }) {
  const { t } = useLocalization()
  const {
    config,
    values,
    setValues,
    quantity,
    setQuantity,
    email,
    setEmail,
    isGuest,
    fieldsDisabled,
    status,
    progressLogs,
  } = useDynamicQuotePdp()
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className={cn("space-y-5", className)}>
      <div>
        <h3 className="text-base font-semibold tracking-tight">
          {t("pdp.dynamicQuote.title") || "Request a quote"}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {(t("pdp.dynamicQuote.validFor") || "Quote valid for {duration}.").replace(
            "{duration}",
            formatQuoteExpirationLabel(config.quote_expiration, t)
          )}
        </p>
        {config.requires_advanced_compute && (
          <p className="text-sm text-muted-foreground mt-2">
            {t("pdp.dynamicQuote.computeMayTakeMinutes") ||
              "Quotation may take several minutes to compute."}
          </p>
        )}
        {config.requires_authorization && (
          <p className="text-sm text-muted-foreground mt-2">
            {t("pdp.dynamicQuote.willBeSentShortly") ||
              "Once ready, it will be sent to you shortly."}
          </p>
        )}
      </div>

      {mounted ? (
        <>
          {isGuest && (
            <div className="space-y-2">
              <Label>{t("pdp.dynamicQuote.email") || "Email"}</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("pdp.dynamicQuote.emailPlaceholder") || "you@example.com"}
                disabled={fieldsDisabled}
                className="h-12 rounded-xl"
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore="true"
                data-bwignore="true"
                data-form-type="other"
              />
            </div>
          )}

          <DynamicQuoteFieldsForm
            config={config}
            values={values}
            onChange={setValues}
            quantity={quantity}
            onQuantityChange={setQuantity}
            showQuantity
            showExpirationHint={false}
            layout="composer"
            disabled={fieldsDisabled}
            routePreview={
              <DynamicQuoteRoutePreview
                fields={config.fields || []}
                values={values}
                embedded
              />
            }
          />

          {status === "processing" && (
            <div className="lg:hidden">
              <DynamicQuoteProgressFeed logs={progressLogs} />
            </div>
          )}
        </>
      ) : (
        <div className="min-h-[12rem] rounded-xl bg-muted/30" aria-hidden />
      )}
    </div>
  )
}

/** @deprecated Prefer DynamicQuotePdpRail — kept for existing imports */
export function DynamicQuotePdpSummary({ className }: { className?: string }) {
  return <DynamicQuotePdpRail className={className} />
}

export function DynamicQuoteMobileBar() {
  return (
    <PdpMobileBuyBar fullWidthCta className="lg:hidden">
      <DynamicQuotePdpRail compact />
    </PdpMobileBuyBar>
  )
}

/** Compact single-column fallback (modals / legacy). */
export function DynamicQuotePdpPanel({
  item,
  backUrl,
}: {
  item: CatalogItem
  backUrl: string
}) {
  return (
    <DynamicQuotePdpProvider item={item} backUrl={backUrl}>
      <div className="space-y-6">
        <DynamicQuotePdpFields />
        <div className="rounded-3xl border border-border/50 bg-card p-6 shadow-sm">
          <DynamicQuotePdpRail />
        </div>
      </div>
    </DynamicQuotePdpProvider>
  )
}
