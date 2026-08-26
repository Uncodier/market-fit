import type { CalendarBlock, Reservation } from "@/app/types"
import type { ReservationSortBy } from "./reservation-helpers"
import { sortReservationGroups } from "./reservation-helpers"

export type CalendarBlockSpan = {
  block: CalendarBlock
  dateStr: string
  start_time: string
  end_time: string
}

export type ReservationTimelineEntry =
  | { kind: "reservation"; id: string; start_time: string; reservation: Reservation }
  | { kind: "block"; id: string; start_time: string; block: CalendarBlock }

export function calendarBlockLocalDateKey(isoOrDate: string | Date) {
  const date = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

export function calendarBlockTitle(
  block: Pick<CalendarBlock, "reason">,
  fallback = "Blocked time"
) {
  const reason = block.reason?.trim()
  return reason || fallback
}

export function calendarBlockScopeLabel(
  block: Pick<CalendarBlock, "entity_type">,
  labels: { catalog_item: string; user: string; global: string } = {
    catalog_item: "Specific service",
    user: "Staff member",
    global: "Entire business",
  }
) {
  if (block.entity_type === "catalog_item") return labels.catalog_item
  if (block.entity_type === "user") return labels.user
  return labels.global
}

export function calendarBlockSearchText(block: Pick<CalendarBlock, "reason" | "entity_type">) {
  return [
    block.reason,
    "blocked",
    "block",
    calendarBlockScopeLabel(block),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}

export function filterCalendarBlocks(
  blocks: CalendarBlock[],
  options: {
    query?: string
    selectedMember?: string
    statusFilter?: "active" | "cancelled"
  }
) {
  if (options.statusFilter === "cancelled") return []

  let result = blocks
  if (options.selectedMember && options.selectedMember !== "all") {
    result = result.filter(
      (block) => block.entity_type !== "user" || block.entity_id === options.selectedMember
    )
  }

  const query = options.query?.trim().toLowerCase()
  if (query) {
    result = result.filter((block) => calendarBlockSearchText(block).includes(query))
  }

  return result
}

export function splitBlockByLocalDays(block: CalendarBlock): CalendarBlockSpan[] {
  const start = new Date(block.start_time)
  const end = new Date(block.end_time)
  if (!(end.getTime() > start.getTime())) return []

  const spans: CalendarBlockSpan[] = []
  let day = startOfLocalDay(start)
  const lastDay = startOfLocalDay(new Date(end.getTime() - 1))

  while (day.getTime() <= lastDay.getTime()) {
    const next = new Date(day)
    next.setDate(next.getDate() + 1)
    const spanStart = new Date(Math.max(start.getTime(), day.getTime()))
    let spanEnd = new Date(Math.min(end.getTime(), next.getTime()))
    if (spanEnd.getTime() === next.getTime()) {
      spanEnd = new Date(next.getTime() - 1)
    }
    if (spanEnd.getTime() > spanStart.getTime()) {
      spans.push({
        block,
        dateStr: calendarBlockLocalDateKey(day),
        start_time: spanStart.toISOString(),
        end_time: spanEnd.toISOString(),
      })
    }
    day = next
  }

  return spans
}

export function groupBlockSpansByDate(blocks: CalendarBlock[]): Record<string, CalendarBlockSpan[]> {
  const grouped: Record<string, CalendarBlockSpan[]> = {}
  for (const block of blocks) {
    for (const span of splitBlockByLocalDays(block)) {
      if (!grouped[span.dateStr]) grouped[span.dateStr] = []
      grouped[span.dateStr].push(span)
    }
  }
  return grouped
}

export function calendarBlockAppliesToGroup(
  block: CalendarBlock,
  groupKey: string,
  groupCatalogIds?: string[]
) {
  if (groupKey === "all") return true
  if (block.entity_type === "catalog_item") {
    if (!block.entity_id) return false
    if (groupKey === `catalog:${block.entity_id}`) return true
    return groupCatalogIds?.includes(block.entity_id) ?? false
  }
  return true
}

export function reservationTimelineEntries(
  reservations: Reservation[],
  blocks: CalendarBlock[]
): ReservationTimelineEntry[] {
  return [
    ...reservations.map((reservation) => ({
      kind: "reservation" as const,
      id: reservation.id,
      start_time: reservation.start_time,
      reservation,
    })),
    ...blocks.map((block) => ({
      kind: "block" as const,
      id: block.id,
      start_time: block.start_time,
      block,
    })),
  ]
}

export function groupTimelineByLocalDate(
  reservations: Reservation[],
  blocks: CalendarBlock[],
  sortBy: ReservationSortBy
): [string, ReservationTimelineEntry[]][] {
  const grouped = reservationTimelineEntries(reservations, blocks).reduce((acc, entry) => {
    const dayStr = calendarBlockLocalDateKey(entry.start_time)
    if (!acc[dayStr]) acc[dayStr] = []
    acc[dayStr].push(entry)
    return acc
  }, {} as Record<string, ReservationTimelineEntry[]>)

  return sortReservationGroups(Object.entries(grouped), sortBy)
}

export function calendarDayItems(reservations: Reservation[], blockSpans: CalendarBlockSpan[]) {
  return [
    ...reservations.map((reservation) => ({
      kind: "reservation" as const,
      id: reservation.id,
      start_time: reservation.start_time,
      reservation,
    })),
    ...blockSpans.map((span) => ({
      kind: "block" as const,
      id: span.block.id,
      start_time: span.start_time,
      block: span.block,
      span,
    })),
  ].sort((a, b) => a.start_time.localeCompare(b.start_time))
}

export function calendarBlockOverlapsMonth(block: CalendarBlock, year: number, month: number) {
  const monthStart = new Date(year, month, 1).getTime()
  const monthEnd = new Date(year, month + 1, 1).getTime()
  return new Date(block.start_time).getTime() < monthEnd && new Date(block.end_time).getTime() > monthStart
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}
