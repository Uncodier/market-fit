import { NextResponse } from "next/server"
import { z } from "zod"
import { requireSiteAccess } from "@/lib/auth/api-site-access"
import { restrictedLocationIdsSchema } from "@/lib/permissions/location-access"
import { LOCATION_ACCESS_ROLLOUT_MESSAGE, LOCATION_RESTRICTION_EDITING_ENABLED } from "@/lib/permissions/location-access-rollout"
import { teamLocationAccessSchema } from "@/lib/permissions/team-location-access-schema"
import { decodeRequestBody, readLimitedRequestBody, RequestBodyTooLargeError } from "@/lib/http/read-limited-request-body"

type RouteContext = { params: Promise<{ siteId: string }> }
const uuidSchema = z.string().uuid()

function reply(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } })
}

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { siteId } = await params
    if (!uuidSchema.safeParse(siteId).success) return reply({ success: false, error: "Invalid site" }, 400)
    const access = await requireSiteAccess(request, siteId, { requireManager: true })
    if (access.error) return access.error
    // Scalar JSON from one user-scoped RPC avoids row caps and mixed authorization snapshots.
    const { data, error } = await access.supabase.rpc("read_site_location_restrictions", { p_site_id: siteId })
    if (error?.code === "PGRST202" || error?.code === "42883") {
      return reply({ success: false, code: "LOCATION_ACCESS_SCHEMA_UNAVAILABLE", error: "Location access database setup is not available" }, 503)
    }
    if (error?.code === "42501") return reply({ success: false, error: "Forbidden" }, 403)
    const scope = teamLocationAccessSchema.safeParse(data)
    if (error || !scope.success || scope.data.site_id.toLowerCase() !== siteId.toLowerCase()) {
      return reply({ success: false, error: "Location restrictions could not be verified" }, 503)
    }
    return reply({
      success: true,
      ...scope.data,
      editing_enabled: LOCATION_RESTRICTION_EDITING_ENABLED,
      message: LOCATION_ACCESS_ROLLOUT_MESSAGE,
    })
  } catch {
    return reply({ success: false, error: "Location restrictions are temporarily unavailable" }, 503)
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { siteId } = await params
    if (!uuidSchema.safeParse(siteId).success) return reply({ success: false, error: "Invalid site" }, 400)
    const access = await requireSiteAccess(request, siteId, { requireManager: true })
    if (access.error) return access.error
    let body: unknown
    try {
      body = JSON.parse(decodeRequestBody(await readLimitedRequestBody(request, 64 * 1024)))
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) return reply({ success: false, error: "Request body too large" }, 413)
      return reply({ success: false, error: "Invalid location restriction request" }, 400)
    }
    const parsed = z.object({ memberId: uuidSchema, restricted_location_ids: restrictedLocationIdsSchema })
      .strict().safeParse(body)
    if (!parsed.success) return reply({ success: false, error: "Invalid location restriction request" }, 400)
    // Deliberately no write path in this release, including explicit [] clearing.
    return reply({ success: false, code: "LOCATION_ACCESS_NOT_READY", error: LOCATION_ACCESS_ROLLOUT_MESSAGE }, 409)
  } catch {
    return reply({ success: false, error: "Location restrictions are temporarily unavailable" }, 503)
  }
}