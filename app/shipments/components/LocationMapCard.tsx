"use client"

import { useEffect, useState } from "react"
import { useSite } from "@/app/context/SiteContext"
import {
  SectionCard,
  SectionCardHeader,
  SectionCardTitle,
  SectionCardContent,
} from "@/app/components/ui/section-card"
import { MapPin } from "@/app/components/ui/icons"
import { listShipmentLocationPings } from "@/app/shipments/actions"
import { useLocalization } from "@/app/context/LocalizationContext"
import { formatDistanceToNow } from "date-fns"

interface LocationMapCardProps {
  shipmentId: string
  lastLat: number | null
  lastLng: number | null
  lastLocatedAt: string | null
}

export function LocationMapCard({ shipmentId, lastLat, lastLng, lastLocatedAt }: LocationMapCardProps) {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const [pings, setPings] = useState<any[]>([])

  useEffect(() => {
    if (currentSite) {
      listShipmentLocationPings(currentSite.id, shipmentId).then(res => {
        if (res.data) setPings(res.data)
      })
    }
  }, [currentSite, shipmentId])

  if (!lastLat || !lastLng) return null

  // Simple static OSM iframe
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lastLng - 0.01},${lastLat - 0.01},${lastLng + 0.01},${lastLat + 0.01}&layer=mapnik&marker=${lastLat},${lastLng}`

  return (
    <SectionCard>
      <SectionCardHeader>
        <SectionCardTitle className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-muted-foreground" />
            {t('shipments.liveLocation') || 'Live Location'}
          </div>
          {lastLocatedAt && (
            <span className="text-xs font-normal text-muted-foreground">
              Updated {formatDistanceToNow(new Date(lastLocatedAt), { addSuffix: true })}
            </span>
          )}
        </SectionCardTitle>
      </SectionCardHeader>
      <SectionCardContent>
        <div className="w-full h-[240px] bg-muted/50 rounded-lg overflow-hidden border">
          <iframe
            width="100%"
            height="100%"
            frameBorder="0"
            scrolling="no"
            src={mapUrl}
            title="Location Map"
          />
        </div>
        
        {pings.length > 1 && (
          <div className="mt-4 text-xs text-muted-foreground">
            {pings.length} location updates recorded.
          </div>
        )}
      </SectionCardContent>
    </SectionCard>
  )
}
