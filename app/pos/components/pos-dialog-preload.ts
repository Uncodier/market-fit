import { addDays, format, startOfMonth } from "date-fns"
import { getReservationSlotsLocalFirst } from "@/app/pos/local/reservation-slots"

type ChunkLoader = () => Promise<unknown>

/** Warm code only, one chunk per idle turn; never mount a dialog or run its actions. */
export function scheduleDialogChunkWarming(loaders: readonly ChunkLoader[]) {
  if (typeof window === "undefined" || loaders.length === 0) return () => {}

  let cancelled = false
  let index = 0
  let cancelPending: (() => void) | undefined

  const warmNext = () => {
    if (cancelled) return
    cancelPending = undefined
    const load = loaders[index++]
    try {
      // Warming is best effort. Opening the dialog still uses its normal loader.
      void load().catch(() => {})
    } catch {
      // A synchronous loader failure must not stop the remaining idle work.
    }
    if (index < loaders.length) scheduleNext()
  }

  const scheduleNext = () => {
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(warmNext, { timeout: 2000 })
      cancelPending = () => window.cancelIdleCallback?.(id)
    } else {
      const id = window.setTimeout(warmNext, 300)
      cancelPending = () => window.clearTimeout(id)
    }
  }

  scheduleNext()
  return () => {
    cancelled = true
    cancelPending?.()
  }
}

/** Match ReservationSlotPicker's initial Sunday-aligned 42-day calendar grid. */
export function warmSelectedReservationAvailability(catalogItemId: string) {
  let cancelled = false
  // Allow effect cleanup to cancel an abandoned selection before starting a read.
  void Promise.resolve().then(async () => {
    if (cancelled) return
    const monthStart = startOfMonth(new Date())
    const rangeStart = addDays(monthStart, -monthStart.getDay())
    await getReservationSlotsLocalFirst({
      catalogItemId,
      startDate: format(rangeStart, "yyyy-MM-dd"),
      endDate: format(addDays(rangeStart, 41), "yyyy-MM-dd"),
      qty: 1,
    })
  }).catch(() => {})

  // An active read belongs to the shared inflight/cache layer; don't abort it
  // when options close and the reservation picker mounts to consume it.
  return () => { cancelled = true }
}