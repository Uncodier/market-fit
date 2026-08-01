"use client"

import { useLocalization } from "@/app/context/LocalizationContext"
import { MapPin, ExternalLink } from "@/app/components/ui/icons"
import { formatVenueAddress, buildOpenStreetMapSearchUrl } from "@/app/catalog/product-details"

interface VenueLocationDetailsProps {
  name?: string | null
  address?: string | null
  city?: string | null
  showName?: boolean
  showAddress?: boolean
  showDirections?: boolean
  className?: string
  layout?: "stack" | "inline"
}

export function VenueLocationDetails({
  name,
  address,
  city,
  showName = true,
  showAddress = true,
  showDirections = true,
  className = "",
  layout = "stack",
}: VenueLocationDetailsProps) {
  const { t } = useLocalization()

  const formattedAddress = formatVenueAddress({ address, city })
  const queryParts = [name, formattedAddress].filter(Boolean) as string[]

  if (queryParts.length === 0) return null

  const mapsUrl = buildOpenStreetMapSearchUrl(queryParts.join(", "))
  const hasText = (showName && name) || (showAddress && formattedAddress)

  const directionsLink = showDirections ? (
    <a
      href={mapsUrl}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap text-sm font-medium text-primary hover:underline underline-offset-2 transition-colors"
    >
      <MapPin className="w-3.5 h-3.5" />
      {t("pdp.getDirections") || "Get directions"}
      <ExternalLink className="w-3 h-3 opacity-60" />
    </a>
  ) : null

  if (layout === "inline") {
    return (
      <div className={`flex flex-wrap items-center gap-x-2.5 gap-y-1 text-muted-foreground ${className}`}>
        {showName && name && (
          <span className="font-semibold text-foreground">{name}</span>
        )}
        {showName && name && showAddress && formattedAddress && (
          <span className="text-border select-none" aria-hidden>
            ·
          </span>
        )}
        {showAddress && formattedAddress && (
          <span className="text-sm sm:text-base">{formattedAddress}</span>
        )}
        {hasText && directionsLink && (
          <span className="text-border select-none" aria-hidden>
            ·
          </span>
        )}
        {directionsLink}
      </div>
    )
  }

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {showName && name && (
        <span className="font-bold text-foreground text-base sm:text-lg leading-tight">{name}</span>
      )}
      {showAddress && formattedAddress && (
        <span className="text-sm text-muted-foreground leading-snug">{formattedAddress}</span>
      )}
      {directionsLink}
    </div>
  )
}
