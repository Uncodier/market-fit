import { NextResponse } from "next/server"
import { z } from "zod"
import { requireSiteAccess } from "@/lib/auth/api-site-access"
import { decodeRequestBody, readLimitedRequestBody, RequestBodyTooLargeError } from "@/lib/http/read-limited-request-body"
import {
  locationScopeAssignmentSchema, locationScopeSavedSchema, locationScopeTableSchema,
  locationScopeLabels, type LocationScopeTable,
} from "@/app/components/location-scope-schema"

const uuid = z.string().uuid()
const querySchema = z.object({
  siteId: uuid, table: locationScopeTableSchema,
  page: z.coerce.number().int().min(0).max(100000).default(0), id: uuid.optional(),
})
const recordFields: Record<LocationScopeTable, string> = {
  deals: "name", quotations: "status", subscriptions: "status", tasks: "title",
  conversations: "title", records: "title", sale_orders: "order_number", reservations: "start_time",
}
const pageSize = 50
function reply(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } })
}
function unavailable() {
  return reply({ error: "Location scope is unavailable. Check database setup and refresh." }, 503)
}

export async function GET(request: Request) {
  try {
    const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
    if (!parsed.success) return reply({ error: "Invalid location scope request" }, 400)
    const { siteId, table, page, id } = parsed.data
    const access = await requireSiteAccess(request, siteId, { requireManager: true })
    if (access.error) return access.error
    const column = table === "reservations" ? "operating_location_id" : "location_id"
    const labelField = recordFields[table]
    let query = access.supabase.from(table).select(`id, ${column}, ${labelField}, created_at`)
      .eq("site_id", siteId).order("id", { ascending: true })
    if (id) query = query.eq("id", id)
    else query = query.is(column, null)
    const { data: rows, error } = await query.range(page * pageSize, page * pageSize + pageSize)
    if (error || !Array.isArray(rows)) return unavailable()
    const locations: { id: string; name: string; is_active: boolean | null }[] = []
    // Explicit pages avoid silently dropping branches at the Data API row cap.
    for (let offset = 0; ; offset += 500) {
      if (offset >= 10000) return unavailable()
      const result = await access.supabase.from("locations").select("id, name, is_active")
        .eq("site_id", siteId).order("id", { ascending: true }).range(offset, offset + 499)
      if (result.error || !Array.isArray(result.data)) return unavailable()
      locations.push(...result.data)
      if (result.data.length < 500) break
    }
    return reply({
      site_id: siteId, table, page, hasMore: rows.length > pageSize, locations,
      records: rows.slice(0, pageSize).map((row: Record<string, unknown>) => ({
        id: row.id, location_id: row[column],
        label: `${row[labelField] || locationScopeLabels[table]} · ${String(row.created_at || "").slice(0, 10)} · ${String(row.id).slice(0, 8)}`,
      })),
    })
  } catch { return unavailable() }
}

export async function POST(request: Request) {
  try {
    const site = uuid.safeParse(new URL(request.url).searchParams.get("siteId"))
    if (!site.success) return reply({ error: "Invalid site" }, 400)
    const access = await requireSiteAccess(request, site.data, { requireManager: true })
    if (access.error) return access.error
    let body: unknown
    try { body = JSON.parse(decodeRequestBody(await readLimitedRequestBody(request, 4096))) }
    catch (error) {
      return reply({ error: error instanceof RequestBodyTooLargeError ? "Request body too large" : "Invalid assignment" },
        error instanceof RequestBodyTooLargeError ? 413 : 400)
    }
    const parsed = locationScopeAssignmentSchema.safeParse(body)
    if (!parsed.success) return reply({ error: "Invalid assignment" }, 400)
    const { table, id, locationId } = parsed.data
    // The user-scoped RPC locks, reauthorizes and permits only unresolved -> known.
    const { data, error } = await access.supabase.rpc("assign_location_scope", {
      p_table: table, p_id: id, p_site_id: site.data, p_location_id: locationId,
    })
    if (error?.code === "42501") return reply({ error: "Forbidden" }, 403)
    if (["22023", "23503", "23514", "40001", "40P01", "55P03"].includes(error?.code || "")) {
      return reply({ error: "Assignment rejected. Refresh the record and verify its parent scope before trying again." }, 409)
    }
    const saved = locationScopeSavedSchema.safeParse(data)
    if (error || !saved.success || saved.data.table !== table ||
      saved.data.id.toLowerCase() !== id.toLowerCase() || saved.data.site_id.toLowerCase() !== site.data.toLowerCase() ||
      saved.data.location_id.toLowerCase() !== locationId.toLowerCase()) {
      return reply({ error: "Assignment could not be confirmed. Refresh before trying again." }, 503)
    }
    return reply(saved.data)
  } catch {
    return reply({ error: "Assignment could not be confirmed. Refresh before trying again." }, 503)
  }
}