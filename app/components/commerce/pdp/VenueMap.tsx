"use client"

import React, { useEffect, useState } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"

interface VenueMapProps {
  name?: string | null
  address?: string | null
  city?: string | null
  className?: string
  /** section = full-bleed location block (Airbnb-style); card = nested in a card */
  variant?: "section" | "card"
}

function resolveGeocodeUrl(params: { name?: string | null; address?: string | null; city?: string | null }) {
  const search = new URLSearchParams()
  if (params.address) search.set("address", params.address)
  if (params.city) search.set("city", params.city)
  if (params.name) search.set("name", params.name)

  const path = `/api/geocode?${search.toString()}`
  const isWww =
    typeof window !== "undefined" && window.location.hostname === "www.makinari.com"
  // Fallback while commercial-site rewrite for /api/geocode rolls out
  return isWww ? `https://app.makinari.com${path}` : path
}

export function VenueMap({
  name,
  address,
  city,
  className = "",
  variant = "section",
}: VenueMapProps) {
  const { t } = useLocalization()
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadCoords() {
      if (!address && !city) {
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const response = await fetch(resolveGeocodeUrl({ name, address, city }))
        if (!response.ok) {
          throw new Error(`Geocode request failed with status: ${response.status}`)
        }
        const data = await response.json()
        setCoords(data?.coords ?? null)
      } catch (error) {
        console.error("Failed to load map coords", error)
        setCoords(null)
      } finally {
        setLoading(false)
      }
    }

    loadCoords()
  }, [name, address, city])

  const sizeClass =
    variant === "card"
      ? "h-[180px] sm:h-[220px]"
      : "h-[220px] sm:h-[280px] md:h-[320px]"

  if (loading) {
    return (
      <div
        className={`w-full bg-muted/50 border animate-pulse rounded-2xl ${sizeClass} ${className}`}
      />
    )
  }

  if (!coords) {
    return null
  }

  // Wider bbox (~street neighborhood zoom) reads better in location sections
  const delta = variant === "card" ? 0.008 : 0.012
  const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${coords.lon - delta},${coords.lat - delta},${coords.lon + delta},${coords.lat + delta}&layer=mapnik&marker=${coords.lat},${coords.lon}`

  return (
    <div
      className={`w-full overflow-hidden border rounded-2xl bg-muted/20 ${sizeClass} ${className}`}
    >
      <iframe
        width="100%"
        height="100%"
        frameBorder="0"
        scrolling="no"
        marginHeight={0}
        marginWidth={0}
        src={embedUrl}
        className="w-full h-full"
        title={name || t("buyer.reservations.venue") || "Venue Map"}
        style={{ border: "none" }}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  )
}
