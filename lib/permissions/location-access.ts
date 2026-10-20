import { z } from "zod"
import { userCanOnSite } from "./site-access"
import type { PermissionCommand } from "./types"

export const restrictedLocationIdsSchema = z.array(z.string().uuid()).superRefine((ids, context) => {
  if (new Set(ids.map(id => id.toLowerCase())).size !== ids.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate location IDs are not allowed" })
  }
})

export const locationAccessSchema = z.object({
  site_id: z.string().uuid(),
  role: z.enum(["owner", "admin", "collaborator", "marketing"]),
  restricted_location_ids: restrictedLocationIdsSchema,
  revision: z.number().int().nonnegative(),
})

export type LocationAccess = z.infer<typeof locationAccessSchema>

export type LocationRpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{
    data: unknown
    error: { message?: string } | null
  }>
}

/** Resolve from the current authenticated session; never treat a failed lookup as an empty list. */
export async function readLocationAccess(client: LocationRpcClient, siteId: string): Promise<LocationAccess | null> {
  if (!z.string().uuid().safeParse(siteId).success) return null
  try {
    const { data, error } = await client.rpc("current_user_location_access", { p_site_id: siteId })
    if (error) return null
    const parsed = locationAccessSchema.safeParse(data)
    if (!parsed.success || parsed.data.site_id.toLowerCase() !== siteId.toLowerCase()) return null
    return parsed.data
  } catch {
    return null
  }
}

/** Additional denial only: a location result never grants a role/action permission. */
export async function userCanOnLocation(
  client: LocationRpcClient,
  siteId: string,
  locationId: string | null,
  command: PermissionCommand,
): Promise<boolean> {
  if (!z.string().uuid().safeParse(siteId).success ||
    (locationId !== null && !z.string().uuid().safeParse(locationId).success)) return false
  try {
    if (!await userCanOnSite(client, siteId, command)) return false
    const { data, error } = await client.rpc("user_can_access_location", {
      p_site_id: siteId,
      p_location_id: locationId,
    })
    return !error && data === true
  } catch {
    return false
  }
}