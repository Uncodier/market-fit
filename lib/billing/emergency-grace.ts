import { z } from "zod"
import { temporaryWorkspaceLicenseSchema } from "./startup-trial"

export const emergencyGraceGrantSchema = temporaryWorkspaceLicenseSchema.pick({ plan: true, ends_at: true }).extend({
  outcome: z.enum(["granted", "already_granted"]),
})

export type EmergencyGraceGrant = z.infer<typeof emergencyGraceGrantSchema>

export const emergencyGraceDeniedSchema = z.object({
  outcome: z.enum(["forbidden", "ineligible", "limit_reached"]),
})