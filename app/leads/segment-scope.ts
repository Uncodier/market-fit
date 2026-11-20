import { z } from "zod"

const segmentIdSchema = z.string().uuid()

export function isLeadSegmentId(value: unknown): value is string {
  return segmentIdSchema.safeParse(value).success
}