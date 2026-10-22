"use client"

import { Button } from "@/app/components/ui/button"
import { createNewDatePreservingDay } from "./reservation-calendar-utils"
import { localDateKey, parseLocalDate } from "./reservation-calendar-select"

export function ReservationListPeriod({ date, onChange }: { date: Date; onChange: (date: Date) => void }) {
  const move = (delta: number) => onChange(createNewDatePreservingDay(date, date.getFullYear(), date.getMonth() + delta))
  return <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b text-sm">
    <Button variant="outline" size="sm" aria-label="Previous month" onClick={() => move(-1)}>Previous</Button>
    <label className="flex items-center gap-2">Reservation month
      <input aria-label="Reservation month" type="month" value={localDateKey(date).slice(0, 7)}
        className="rounded border bg-background p-1" onChange={event => {
          if (/^\d{4}-\d{2}$/.test(event.target.value)) onChange(parseLocalDate(`${event.target.value}-01`))
        }} />
    </label>
    <Button variant="outline" size="sm" aria-label="Next month" onClick={() => move(1)}>Next</Button>
    <Button variant="ghost" size="sm" onClick={() => onChange(new Date())}>This month</Button>
    <span className="text-muted-foreground">Showing all reservations and blocks overlapping this month. Search and filters apply to this period.</span>
  </div>
}