export type ReservationSlotOption = {
  start: string
  end: string
  available: number
}

export function isSameSlotInstant(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false
  const aTime = new Date(a).getTime()
  const bTime = new Date(b).getTime()
  return Number.isFinite(aTime) && Number.isFinite(bTime) && aTime === bTime
}

export function findSlotByInstant<T extends { start: string }>(
  slots: T[],
  startIso?: string | null
): T | undefined {
  if (!startIso) return undefined
  return slots.find((slot) => isSameSlotInstant(slot.start, startIso))
}

/** Keep the current booking visible without duplicating the same instant or inventing leftover. */
export function mergeCurrentReservationSlot(
  slots: ReservationSlotOption[],
  selectedStartIso?: string | null,
  selectedEndIso?: string | null
): ReservationSlotOption[] {
  if (!selectedStartIso || !selectedEndIso) return slots
  if (findSlotByInstant(slots, selectedStartIso)) return slots

  return [...slots, { start: selectedStartIso, end: selectedEndIso, available: 0 }].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  )
}

export function shouldShowSlotLeftover(
  slot: ReservationSlotOption,
  selectedStartIso?: string | null
): boolean {
  return !isSameSlotInstant(slot.start, selectedStartIso)
}
