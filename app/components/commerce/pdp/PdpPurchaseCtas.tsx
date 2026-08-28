"use client"

import { useLocalization } from "@/app/context/LocalizationContext"
import { cn } from "@/lib/utils"
import { PdpCtaButton } from "./PdpCtaButton"
import { isAddToCartPrimary } from "./pdp-purchase-cta"

type PdpPurchaseCtasProps = {
  catalogSize: number
  disabled?: boolean
  disabledLabel?: string | null
  onAdd: () => void
  onBuyNow: () => void
  buyNowLabel: string
  addLabel?: string
  addShortLabel?: string
  presentation: "stack" | "row" | "mobile"
  className?: string
}

export function PdpPurchaseCtas({
  catalogSize,
  disabled,
  disabledLabel,
  onAdd,
  onBuyNow,
  buyNowLabel,
  addLabel,
  addShortLabel,
  presentation,
  className,
}: PdpPurchaseCtasProps) {
  const { t } = useLocalization()
  const addPrimary = isAddToCartPrimary(catalogSize)
  const addText = addLabel || t("marketplace.add") || "Add to Cart"
  const addCompact = addShortLabel || t("marketplace.add") || "Add"

  if (presentation === "stack") {
    return (
      <div className={cn("space-y-3", className)}>
        {addPrimary ? (
          <>
            <PdpCtaButton onClick={onAdd} disabled={disabled}>
              {disabledLabel || addText}
            </PdpCtaButton>
            <PdpCtaButton variant="outline" onClick={onBuyNow} disabled={disabled}>
              {buyNowLabel}
            </PdpCtaButton>
          </>
        ) : (
          <>
            <PdpCtaButton onClick={onBuyNow} disabled={disabled}>
              {disabledLabel || buyNowLabel}
            </PdpCtaButton>
            <PdpCtaButton variant="outline" onClick={onAdd} disabled={disabled}>
              {addText}
            </PdpCtaButton>
          </>
        )}
      </div>
    )
  }

  if (presentation === "row") {
    return (
      <div className={cn("flex gap-3", className)}>
        {addPrimary ? (
          <>
            <PdpCtaButton onClick={onAdd} disabled={disabled} className="w-auto px-6">
              {disabledLabel || addText}
            </PdpCtaButton>
            <PdpCtaButton variant="outline" onClick={onBuyNow} disabled={disabled} className="w-auto px-10">
              {buyNowLabel}
            </PdpCtaButton>
          </>
        ) : (
          <>
            <PdpCtaButton onClick={onBuyNow} disabled={disabled} className="w-auto px-10">
              {disabledLabel || buyNowLabel}
            </PdpCtaButton>
            <PdpCtaButton variant="outline" onClick={onAdd} disabled={disabled} className="w-auto px-6">
              {addText}
            </PdpCtaButton>
          </>
        )}
      </div>
    )
  }

  return (
    <div className={cn("flex gap-2 w-full min-w-0", className)}>
      {addPrimary ? (
        <>
          <PdpCtaButton
            variant="outline"
            onClick={onBuyNow}
            disabled={disabled}
            className="px-4 shrink-0 w-auto"
          >
            {buyNowLabel}
          </PdpCtaButton>
          <PdpCtaButton onClick={onAdd} disabled={disabled} className="flex-1">
            {disabledLabel || addCompact}
          </PdpCtaButton>
        </>
      ) : (
        <>
          <PdpCtaButton
            variant="outline"
            onClick={onAdd}
            disabled={disabled}
            className="px-4 shrink-0 w-auto"
          >
            {addCompact}
          </PdpCtaButton>
          <PdpCtaButton onClick={onBuyNow} disabled={disabled} className="flex-1">
            {disabledLabel || buyNowLabel}
          </PdpCtaButton>
        </>
      )}
    </div>
  )
}
