"use client"

import { useMemo } from "react"
import { Combobox } from "./combobox"
import { useLocalization } from "@/app/context/LocalizationContext"
import { timezoneOptions } from "@/lib/calendar/timezone-options"

export function TimezoneField({ value, onChange, showHint = true }: {
  value: string
  onChange: (value: string) => void
  showHint?: boolean
}) {
  const { locale } = useLocalization()
  const options = useMemo(() => timezoneOptions(value, locale), [value, locale])
  return (
    <div className="w-full space-y-2">
      <Combobox label="Time zone" options={options} value={value} onValueChange={onChange}
        clearable={false} placeholder="Search country, region or city..."
        searchPlaceholder="Search country, region or city..." />
      {showHint && <p className="text-xs text-muted-foreground">Dates and times use this time zone. Daylight saving is applied automatically.</p>}
    </div>
  )
}