"use client"

import { useLocalization } from "@/app/context/LocalizationContext"
import { PdpItemDescription } from "./PdpItemDescription"
import { PdpSpecGroups } from "./PdpSpecGroups"
import type { PdpSpecGroup, PdpSpecRow } from "@/app/catalog/product-details"

export function PdpProductDetails({
  description,
  attrFields,
  attributes,
  specs,
  specGroups = [],
  aboutLabel,
  showShortDescription = false,
}: {
  description?: string | null
  attrFields: string[]
  attributes: Record<string, string | undefined>
  specs: PdpSpecRow[]
  specGroups?: PdpSpecGroup[]
  aboutLabel?: string
  showShortDescription?: boolean
}) {
  const { t } = useLocalization()
  const hasAttrs = attrFields.length > 0
  const hasGroups = specGroups.length > 0
  const hasRows = specs.length > 0

  return (
    <>
      <PdpItemDescription
        description={description}
        variant="section"
        aboutLabel={aboutLabel}
        showShort={showShortDescription}
      />

      {hasAttrs && (
        <div className="mb-10 sm:mb-12 grid grid-cols-2 gap-x-6 sm:gap-x-8 gap-y-6">
          {attrFields.map((f) => {
            const camelCaseKey = f.replace(/_([a-z])/g, (g) => g[1].toUpperCase())
            return (
              <div key={f}>
                <div className="text-[10px] sm:text-xs uppercase tracking-widest font-bold text-muted-foreground mb-1 sm:mb-2">
                  {t(`marketplace.catalogDetails.${camelCaseKey}`) || f.replace("_", " ")}
                </div>
                <div className="font-semibold text-base sm:text-lg">{attributes[f]}</div>
              </div>
            )
          })}
        </div>
      )}

      {hasGroups && (
        <div className={hasAttrs ? "pt-2" : ""}>
          <PdpSpecGroups groups={specGroups} />
        </div>
      )}

      {hasRows && (
        <div className={hasAttrs || hasGroups ? "pt-8 mt-8 border-t" : ""}>
          <h3 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">
            {t("marketplace.catalogDetails.specs") || "Specifications"}
          </h3>
          <div className="border rounded-2xl sm:rounded-[1.5rem] overflow-hidden">
            {specs.map((s, i) => (
              <div key={i} className="flex border-b last:border-0 hover:bg-muted/30 transition-colors">
                <div className="w-1/3 bg-muted/30 p-4 sm:p-5 font-bold text-muted-foreground text-xs sm:text-sm uppercase tracking-wider">
                  {s.label}
                </div>
                <div className="w-2/3 p-4 sm:p-5 font-semibold text-sm sm:text-base text-foreground">
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
