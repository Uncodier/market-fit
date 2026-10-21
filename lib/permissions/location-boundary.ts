import type { LocationRpcClient } from "./location-access"

/** Never cache permissions: a warm response must observe newly added exclusions. */
export async function readLocationRestrictionState(
  client: LocationRpcClient,
  siteId?: string,
): Promise<boolean | null> {
  try {
    const { data, error } = await client.rpc(
      siteId === undefined
        ? "current_user_has_location_restrictions"
        : "current_user_has_site_location_restrictions",
      siteId === undefined ? {} : { p_site_id: siteId },
    )
    // Missing RPCs are not evidence that restrictions are absent. In particular,
    // an empty RLS read can hide exclusions retained on disabled memberships.
    return !error && typeof data === "boolean" ? data : null
  } catch {
    return null
  }
}

/** Additional denial only; callers must authenticate and authorize the operation. */
export async function canAccessUnscopedSite(client: LocationRpcClient, siteId: string): Promise<boolean> {
  return await readLocationRestrictionState(client, siteId) === false
}