import { NextResponse } from "next/server"
import { z } from "zod"
import { privateHeaders, procurementError } from "../../http"
import { supplierAccess } from "../access"

const schema = z.object({ kind: z.enum(["companies", "categories"]), q: z.string().trim().max(100).default("") })
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams
    const input = schema.safeParse({ kind: params.get("kind"), q: params.get("q") ?? "" })
    if (!input.success || params.getAll("kind").length !== 1 || params.getAll("q").length > 1) {
      return procurementError("Invalid reference search", 400)
    }
    const access = await supplierAccess(request, "select")
    if (access.error) return access.error
    const { kind, q } = input.data
    let query = access.supabase.from(kind === "companies" ? "companies" : "catalog_categories")
      .select("id,name").order("name").order("id").limit(51)
    if (kind === "categories") query = query.eq("site_id", access.siteId).eq("status", "active")
    if (q) query = query.ilike("name", `%${q.replace(/[\\%_]/g, "\\$&")}%`)
    const { data, error } = await query
    if (error) return procurementError("Unable to load supplier references", 503)
    return NextResponse.json({ options: (data ?? []).slice(0, 50), has_more: (data?.length ?? 0) > 50 }, { headers: privateHeaders })
  } catch { return procurementError("Unable to load supplier references", 503) }
}