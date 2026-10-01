import { z } from "zod"

export const ACTIVITY_START_TIME_ERROR = "Enter a start time in HH:mm (24-hour format), or use 09:00."
const START_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export function isValidActivityStartTime(value: unknown): value is string {
  return typeof value === "string" && value.length === 5 && START_TIME_PATTERN.test(value)
}

/** Missing preserves the legacy schedule; empty, null and malformed times are invalid. */
export const optionalActivityStartTimeSchema = z.string({ invalid_type_error: ACTIVITY_START_TIME_ERROR })
  .length(5, ACTIVITY_START_TIME_ERROR).regex(START_TIME_PATTERN, ACTIVITY_START_TIME_ERROR).optional()