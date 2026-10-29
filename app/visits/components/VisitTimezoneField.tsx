"use client"

import { useState, useSyncExternalStore } from "react"
import { TimezoneField } from "@/app/components/ui/timezone-field"
import { browserTimeZone } from "@/lib/calendar/timezone"
import { formatInTimeZone } from "date-fns-tz"

const subscribe = () => () => {}
const serverZone = () => "UTC"

export function VisitTimezoneField({ startTime, endTime }: {
  startTime?: string
  endTime?: string
}) {
  const localZone = useSyncExternalStore(subscribe, browserTimeZone, serverZone)
  const [override, setTimezone] = useState<string | null>(null)
  const timezone = override || localZone
  return (
    <div className="w-full space-y-2">
      <TimezoneField value={timezone} onChange={setTimezone} showHint={false} />
      {startTime && <p className="text-sm" data-testid="visit-zoned-time">
        {formatInTimeZone(startTime, timezone, "yyyy-MM-dd HH:mm zzz")}
        {endTime && ` – ${formatInTimeZone(endTime, timezone, "yyyy-MM-dd HH:mm zzz")}`}
      </p>}
      <p className="text-xs text-muted-foreground">Visits start at registration time, recorded by the server. This zone changes only how the time is displayed.</p>
    </div>
  )
}