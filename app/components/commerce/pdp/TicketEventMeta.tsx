"use client"

import { Calendar, Clock, MapPin } from "@/app/components/ui/icons"
import { VenueLocationDetails } from "./VenueLocationDetails"

interface TicketEventMetaProps {
  date?: string | null
  time?: string | null
  duration?: string | null
  venueName?: string | null
  venueAddress?: string | null
  venueCity?: string | null
  className?: string
}

export function TicketEventMeta({
  date,
  time,
  duration,
  venueName,
  venueAddress,
  venueCity,
  className = "",
}: TicketEventMetaProps) {
  const hasWhen = date || time || duration
  const hasWhere = venueName || venueAddress || venueCity

  if (!hasWhen && !hasWhere) return null

  return (
    <div className={`space-y-4 ${className}`}>
      {hasWhen && (
        <div className="flex gap-4">
          <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="flex flex-col justify-center">
            {date && <div className="font-semibold text-foreground text-base sm:text-lg">{date}</div>}
            {(time || duration) && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                <Clock className="w-3.5 h-3.5" />
                <span>{[time, duration].filter(Boolean).join(" · ")}</span>
              </div>
            )}
          </div>
        </div>
      )}
      
      {hasWhere && (
        <div className="flex gap-4">
          <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center shrink-0">
            <MapPin className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="flex flex-col justify-center">
            <VenueLocationDetails
              name={venueName}
              address={venueAddress}
              city={venueCity}
              showDirections={false}
              layout="stack"
            />
          </div>
        </div>
      )}
    </div>
  )
}
