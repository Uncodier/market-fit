import { NextResponse } from "next/server"
import { privateHeaders, procurementError, uuid } from "../../http"
import { supplierAccess } from "../access"
import { saveSupplier } from "../save"

type Context = { params: Promise<{ id: string }> }
export async function GET(request: Request, context: Context) {
  try {
    const id = uuid.safeParse((await context.params).id)
    if (!id.success) return procurementError("Invalid supplier ID", 400)
    const access = await supplierAccess(request, "select")
    if (access.error) return access.error
    const { data, error } = await access.supabase.from("suppliers")
      .select("id,site_id,name,status,company_id,version,commercial_terms,private_notes,created_at,updated_at,supplier_contacts(name,email,phone,role,is_primary),supplier_category_links(category_id)")
      .eq("site_id", access.siteId).eq("id", id.data).maybeSingle()
    if (error) return procurementError("Unable to load supplier", 503)
    if (!data) return procurementError("Supplier not found", 404)
    const { supplier_contacts, supplier_category_links, ...supplier } = data
    const permission = await access.supabase.rpc("user_can", { p_site_id: access.siteId, p_command: "update" })
    return NextResponse.json({ supplier: { ...supplier, contacts: supplier_contacts,
      category_ids: supplier_category_links.map((link: { category_id: string }) => link.category_id) },
      can_edit: !permission.error && permission.data === true && ["owner", "admin", "collaborator"].includes(access.role),
    }, { headers: privateHeaders })
  } catch { return procurementError("Unable to load supplier", 503) }
}
export async function PUT(request: Request, context: Context) {
  try {
    const id = uuid.safeParse((await context.params).id)
    if (!id.success) return procurementError("Invalid supplier ID", 400)
    return await saveSupplier(request, id.data)
  } catch { return procurementError("Unable to save supplier", 503) }
}