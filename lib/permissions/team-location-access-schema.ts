import { z } from "zod"
import { restrictedLocationIdsSchema } from "./location-access"

/** Shared server/browser DTO; null activity is unknown, never silently active. */
export const teamLocationAccessSchema = z.object({
  site_id: z.string().uuid(),
  // Older foundation RPCs do not expose readiness. Absence must never enable writes.
  editing_enabled: z.boolean().default(false),
  locations: z.array(z.object({ id: z.string().uuid(), name: z.string(), is_active: z.boolean().nullable() })),
  members: z.array(z.object({
    id: z.string().uuid(),
    role: z.enum(["owner", "admin", "collaborator", "marketing"]),
    is_location_exempt: z.boolean(),
    restricted_location_ids: restrictedLocationIdsSchema,
  })),
}).superRefine((scope, context) => {
  const locationIds = new Set(scope.locations.map(location => location.id.toLowerCase()))
  const memberIds = new Set(scope.members.map(member => member.id.toLowerCase()))
  if (locationIds.size !== scope.locations.length || memberIds.size !== scope.members.length ||
    scope.members.some(member => member.restricted_location_ids.some(id => !locationIds.has(id.toLowerCase())))) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Incomplete or inconsistent location access" })
  }
})

export const teamLocationAccessResponseSchema = z.object({
  success: z.literal(true),
}).and(teamLocationAccessSchema)

export type TeamLocationAccessResponse = z.infer<typeof teamLocationAccessResponseSchema>

export const replaceMemberLocationRestrictionsSchema = z.object({
  memberId: z.string().uuid(),
  restricted_location_ids: restrictedLocationIdsSchema,
  expected_restricted_location_ids: restrictedLocationIdsSchema,
}).strict()

export const memberLocationReplacementSchema = z.object({
  site_id: z.string().uuid(),
  site_member_id: z.string().uuid(),
  restricted_location_ids: restrictedLocationIdsSchema,
  revision: z.number().int().nonnegative(),
})

export const memberLocationReplacementResponseSchema = memberLocationReplacementSchema.extend({ success: z.literal(true) })

export function sameLocationIds(first: string[], second: string[]) {
  return first.map(id => id.toLowerCase()).sort().join(",") === second.map(id => id.toLowerCase()).sort().join(",")
}