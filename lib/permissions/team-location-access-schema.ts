import { z } from "zod"
import { restrictedLocationIdsSchema } from "./location-access"

/** Shared server/browser DTO; null activity is unknown, never silently active. */
export const teamLocationAccessSchema = z.object({
  site_id: z.string().uuid(),
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
  editing_enabled: z.literal(false),
}).and(teamLocationAccessSchema)

export type TeamLocationAccessResponse = z.infer<typeof teamLocationAccessResponseSchema>