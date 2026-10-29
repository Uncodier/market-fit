"use client"

import { useMemo } from "react"
import { Combobox } from "@/app/components/ui/combobox"

export function ReservationTimezoneField({ value, onChange }: {
  value: string
  onChange: (value: string) => void
}) {
  const options = useMemo(() => {
    const intl = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] }
    const zones = intl.supportedValuesOf?.("timeZone") || [
      "America/Mexico_City", "America/New_York", "America/Los_Angeles",
      "America/Bogota", "America/Argentina/Buenos_Aires", "Europe/Madrid",
      "Europe/London", "Asia/Tokyo", "Asia/Kolkata", "Australia/Sydney",
    ]
    return [...new Set([value, "UTC", ...zones])].sort().map(zone => ({
      value: zone,
      label: zone.replace(/_/g, " "),
    }))
  }, [value])
  return (
    <div className="space-y-2">
      <Combobox label="Time zone" options={options} value={value} onValueChange={onChange}
        clearable={false} searchPlaceholder="Search time zones..." />
      <p className="text-xs text-muted-foreground">Dates and times use this time zone. Daylight saving is applied automatically.</p>
    </div>
  )
}