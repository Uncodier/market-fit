import { NextResponse } from "next/server"
import { privateHeaders, procurementError, uuid } from "../../../http"
import { supplierAccess } from "../../access"

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = uuid.safeParse((await context.params).id)
    if (!id.success) return procurementError("Invalid supplier ID", 400)
    const access = await supplierAccess(request, "select")
    if (access.error) return access.error
    const { data, error } = await access.supabase.from("supplier_activity")
      .select("version,action,previous_status,status,created_at")
      .eq("site_id", access.siteId).eq("supplier_id", id.data).order("version", { ascending: false }).limit(100)
    if (error) return procurementError("Unable to load supplier activity", 503)
    return NextResponse.json({ activity: data }, { headers: privateHeaders })
  } catch { return procurementError("Unable to load supplier activity", 503) }
}