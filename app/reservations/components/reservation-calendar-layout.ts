import type { Reservation } from "@/app/types"
import {
  reservationColumnCatalogId,
  reservationServiceColorKey,
  reservationServiceColumnLabel,
} from "../reservation-helpers"

export const CALENDAR_HOUR_HEIGHT = 80
export const CALENDAR_MIN_EVENT_HEIGHT = 24
export const CALENDAR_DAY_MINUTES = 24 * 60
export const CALENDAR_TIME_COL_WIDTH = 100
export const CALENDAR_SERVICE_COL_MIN_WIDTH = 200

export function reservationDayGridStyle(columnCount: number) {
  const count = Math.max(1, columnCount)
  return {
    gridTemplateColumns: `${CALENDAR_TIME_COL_WIDTH}px repeat(${count}, minmax(${CALENDAR_SERVICE_COL_MIN_WIDTH}px, 1fr))`,
    minWidth: CALENDAR_TIME_COL_WIDTH + count * CALENDAR_SERVICE_COL_MIN_WIDTH,
  }
}

export type TimedReservation = Pick<Reservation, "id" | "start_time" | "end_time">

export type LaidOutReservation<T extends TimedReservation = TimedReservation> = {
  reservation: T
  top: number
  height: number
  leftPct: number
  widthPct: number
  zIndex: number
  lane: number
  laneCount: number
}

export type ReservationServiceGroup = {
  key: string
  label: string
  sample: Reservation
  reservations: Reservation[]
  catalogIds: string[]
}

type TimedSpan<T extends TimedReservation> = {
  reservation: T
  start: number
  end: number
  lane: number
  span: number
}

export function minutesFromMidnight(iso: string) {
  const date = new Date(iso)
  return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60
}

export function reservationTimeSpan(reservation: TimedReservation) {
  const start = clamp(minutesFromMidnight(reservation.start_time), 0, CALENDAR_DAY_MINUTES)
  let end = minutesFromMidnight(reservation.end_time)
  if (end <= start) end = start + 60
  end = clamp(end, start + 1, CALENDAR_DAY_MINUTES)
  return { start, end }
}

export function reservationServiceGroupKey(reservation: Reservation) {
  const columnId = reservationColumnCatalogId(reservation)
  if (columnId) return `catalog:${columnId}`
  return reservationServiceColorKey(reservation)
}

function reservationGroupCatalogIds(reservation: Reservation) {
  const ids = [
    reservationColumnCatalogId(reservation),
    reservation.catalog_item_id,
  ].filter((id): id is string => !!id)
  return Array.from(new Set(ids))
}

export function groupReservationsByService(reservations: Reservation[]): ReservationServiceGroup[] {
  const groups = new Map<string, ReservationServiceGroup>()
  const sorted = [...reservations].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  )

  for (const reservation of sorted) {
    const key = reservationServiceGroupKey(reservation)
    const existing = groups.get(key)
    if (existing) {
      existing.reservations.push(reservation)
      for (const catalogId of reservationGroupCatalogIds(reservation)) {
        if (!existing.catalogIds.includes(catalogId)) existing.catalogIds.push(catalogId)
      }
      continue
    }
    groups.set(key, {
      key,
      label: reservationServiceColumnLabel(reservation, "Unknown Service"),
      sample: reservation,
      reservations: [reservation],
      catalogIds: reservationGroupCatalogIds(reservation),
    })
  }

  return Array.from(groups.values())
}

export function layoutReservationLanes<T extends TimedReservation>(
  reservations: T[]
): LaidOutReservation<T>[] {
  if (reservations.length === 0) return []

  const items: TimedSpan<T>[] = reservations
    .map((reservation) => {
      const { start, end } = reservationTimeSpan(reservation)
      return { reservation, start, end, lane: 0, span: 1 }
    })
    .sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start
      const durationDiff = b.end - b.start - (a.end - a.start)
      if (durationDiff !== 0) return durationDiff
      return a.reservation.id.localeCompare(b.reservation.id)
    })

  const clusters = clusterOverlapping(items)
  const laidOut: LaidOutReservation<T>[] = []

  for (const cluster of clusters) {
    assignLanes(cluster)
    const laneCount = Math.max(1, ...cluster.map((item) => item.lane + 1))
    expandLanes(cluster, laneCount)

    for (const item of cluster) {
      const top = (item.start / 60) * CALENDAR_HOUR_HEIGHT
      const rawHeight = ((item.end - item.start) / 60) * CALENDAR_HOUR_HEIGHT
      const maxHeight = 24 * CALENDAR_HOUR_HEIGHT - top
      const height = clamp(Math.max(rawHeight, CALENDAR_MIN_EVENT_HEIGHT), 1, maxHeight)

      laidOut.push({
        reservation: item.reservation,
        top,
        height,
        leftPct: (item.lane / laneCount) * 100,
        widthPct: (item.span / laneCount) * 100,
        zIndex: item.lane + 1,
        lane: item.lane,
        laneCount,
      })
    }
  }

  return laidOut
}

function clusterOverlapping<T extends TimedReservation>(items: TimedSpan<T>[]) {
  const clusters: TimedSpan<T>[][] = []
  let current: TimedSpan<T>[] = []
  let clusterEnd = -1

  for (const item of items) {
    if (current.length === 0 || item.start < clusterEnd) {
      current.push(item)
      clusterEnd = Math.max(clusterEnd, item.end)
      continue
    }
    clusters.push(current)
    current = [item]
    clusterEnd = item.end
  }

  if (current.length > 0) clusters.push(current)
  return clusters
}

function assignLanes<T extends TimedReservation>(cluster: TimedSpan<T>[]) {
  const laneEnds: number[] = []

  for (const item of cluster) {
    let lane = laneEnds.findIndex((end) => end <= item.start)
    if (lane < 0) {
      lane = laneEnds.length
      laneEnds.push(item.end)
    } else {
      laneEnds[lane] = item.end
    }
    item.lane = lane
  }
}

function expandLanes<T extends TimedReservation>(cluster: TimedSpan<T>[], laneCount: number) {
  for (const item of cluster) {
    let span = 1
    for (let lane = item.lane + 1; lane < laneCount; lane++) {
      const blocked = cluster.some(
        (other) => other !== item && other.lane === lane && spansOverlap(item, other)
      )
      if (blocked) break
      span += 1
    }
    item.span = span
  }
}

function spansOverlap<T extends TimedReservation>(a: TimedSpan<T>, b: TimedSpan<T>) {
  return a.start < b.end && b.start < a.end
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
