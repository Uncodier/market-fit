"use client"

import { ReactNode } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"
import { formatVenueAddress } from "@/app/catalog/product-details"
import { VenueLocationDetails } from "./VenueLocationDetails"
import { VenueMap } from "./VenueMap"

interface VenueLocationSectionProps {
  name?: string | null
  address?: string | null
  city?: string | null
  className?: string
  /** Compact heading style for nested cards (e.g. Pass "Valid at") */
  compact?: boolean
  /** Small uppercase label above the venue name (e.g. "Valid at") */
  eyebrow?: string | null
  /** Optional leading media (venue thumbnail / icon) aligned with the title block */
  leading?: ReactNode
}

/**
 * Airbnb / Luma / Meetup style location block:
 * section title → venue + address + directions → full-width map.
 */
export function VenueLocationSection({
  name,
  address,
  city,
  className = "",
  compact = false,
  eyebrow,
  leading,
}: VenueLocationSectionProps) {
  const { t } = useLocalization()
  const addressLine = formatVenueAddress({ address, city })

  if (!addressLine && !name) return null

  const showMap = !!(address || city)

  return (
    <section className={`w-full ${className}`}>
      <div className={`flex gap-4 min-w-0 ${compact ? "mb-4" : "mb-5"}`}>
        {leading}
        <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            {!compact && !eyebrow && (
              <h3 className="font-bold text-2xl mb-2">
                {t("pdp.whereYoullBe") || t("buyer.reservations.venue") || "Where you'll be"}
              </h3>
            )}
            {eyebrow && (
              <div className="text-[10px] sm:text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1">
                {eyebrow}
              </div>
            )}
            {name && (
              <div
                className={`font-bold text-foreground leading-tight ${
                  compact ? "text-base sm:text-lg" : "text-lg"
                }`}
              >
                {name}
              </div>
            )}
            {addressLine && (
              <div className="text-sm text-muted-foreground mt-1 leading-snug">
                {addressLine}
              </div>
            )}
          </div>
          <VenueLocationDetails
            name={name}
            address={address}
            city={city}
            showName={false}
            showAddress={false}
            layout="inline"
            className="sm:shrink-0 sm:pt-0.5"
          />
        </div>
      </div>
      {showMap && (
        <VenueMap
          name={name}
          address={address}
          city={city}
          variant={compact ? "card" : "section"}
        />
      )}
    </section>
  )
}
