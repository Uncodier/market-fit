import { isAfter, isBefore } from "date-fns"

/** Half-open intervals [start, end): back-to-back slots do not overlap. */
export function intervalsOverlap(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date
): boolean {
  return isBefore(startA, endB) && isAfter(endA, startB)
}
