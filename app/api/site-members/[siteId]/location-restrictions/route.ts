import { NextResponse } from "next/server"
import { z } from "zod"
import { requireSiteAccess } from "@/lib/auth/api-site-access"
import {
  teamLocationAccessSchema, replaceMemberLocationRestrictionsSchema,
  memberLocationReplacementSchema, sameLocationIds,
} from "@/lib/permissions/team-location-access-schema"
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
    return reply({ success: true, ...scope.data })
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
    const parsed = replaceMemberLocationRestrictionsSchema.safeParse(body)
    if (!parsed.success) return reply({ success: false, error: "Invalid location restriction request" }, 400)
    const args = { p_site_id: siteId, p_member_id: parsed.data.memberId, p_location_ids: parsed.data.restricted_location_ids,
      p_expected_location_ids: parsed.data.expected_restricted_location_ids }
    // Only these SQL errors prove the transaction rolled back. Never replay an
    // interrupted HTTP request, an unrecognized error, or an unverifiable success.
    const retryable = new Set(["55P03", "40001", "40P01"])
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await access.supabase.rpc("replace_site_member_location_restrictions_checked", args)
      if (error) {
        if (error.code === "55000") return reply({ success: false, code: "LOCATION_RESTRICTIONS_CHANGED", error: "Location restrictions or editing availability changed. Refresh before saving" }, 409)
        if (error.code === "42501") return reply({ success: false, error: "Forbidden" }, 403)
        if (error.code === "22023") return reply({ success: false, code: "LOCATION_RESTRICTIONS_REJECTED", error: "The member or locations are no longer valid for this change" }, 400)
        if (error.code === "PGRST202" || error.code === "42883") {
          return reply({ success: false, code: "LOCATION_ACCESS_SCHEMA_UNAVAILABLE", error: "Location access database setup is not available" }, 503)
        }
        if (retryable.has(error.code)) {
          if (attempt < 2 && !request.signal.aborted) {
            await new Promise(resolve => setTimeout(resolve, 25 * (attempt + 1)))
            if (!request.signal.aborted) continue
          }
          return reply({ success: false, code: "LOCATION_RESTRICTIONS_BUSY", error: "Membership is being updated. Try again shortly" }, 409)
        }
        break
      }
      const saved = memberLocationReplacementSchema.safeParse(data)
      if (!saved.success || saved.data.site_id.toLowerCase() !== siteId.toLowerCase() ||
        saved.data.site_member_id.toLowerCase() !== parsed.data.memberId.toLowerCase() ||
        !sameLocationIds(saved.data.restricted_location_ids, parsed.data.restricted_location_ids)) break
      return reply({ success: true, ...saved.data })
    }
    return reply({ success: false, code: "LOCATION_RESTRICTIONS_UNCONFIRMED", error: "The save could not be confirmed. Refresh location access before trying again" }, 503)
  } catch {
    return reply({ success: false, code: "LOCATION_RESTRICTIONS_UNCONFIRMED", error: "The save could not be confirmed. Refresh location access before trying again" }, 503)
  }
}