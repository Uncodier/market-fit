import { NextResponse } from "next/server"
import { z } from "zod"
import { privateHeaders, procurementError } from "../http"
import { supplierAccess } from "./access"
import { saveSupplier } from "./save"

const listSchema = z.object({
  q: z.string().trim().max(100).default(""),
  status: z.enum(["prospect", "under_review", "approved", "blocked", "archived", "all"]).default("all"),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
})
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams
    if (["q", "status", "offset"].some(key => params.getAll(key).length > 1)) {
      return procurementError("Invalid supplier search", 400)
    }
    const input = listSchema.safeParse(Object.fromEntries([...params].filter(([key]) => key !== "site_id")))
    if (!input.success) return procurementError("Invalid supplier search", 400)
    const access = await supplierAccess(request, "select")
    if (access.error) return access.error
    let query = access.supabase.from("suppliers")
      .select("id,site_id,name,status,company_id,version,created_at,updated_at", { count: "exact" })
      .eq("site_id", access.siteId).order("name").order("id")
      .range(input.data.offset, input.data.offset + 49)
    if (input.data.status !== "all") query = query.eq("status", input.data.status)
    if (input.data.q) query = query.ilike("name", `%${input.data.q.replace(/[\\%_]/g, "\\$&")}%`)
    const result = await query
    if (result.error) return procurementError("Unable to load suppliers", 503)
    const permission = await access.supabase.rpc("user_can", { p_site_id: access.siteId, p_command: "insert" })
    return NextResponse.json({ suppliers: result.data, total: result.count,
      can_create: !permission.error && permission.data === true && ["owner", "admin", "collaborator"].includes(access.role),
    }, { headers: privateHeaders })
  } catch { return procurementError("Unable to load suppliers", 503) }
}
export async function POST(request: Request) {
  try { return await saveSupplier(request, null) } catch { return procurementError("Unable to save supplier", 503) }
}