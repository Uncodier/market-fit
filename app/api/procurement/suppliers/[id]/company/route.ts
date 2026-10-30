import { NextResponse } from "next/server"
import type { Company } from "@/app/companies/types"
import { privateHeaders, procurementError, uuid } from "../../../http"
import { supplierAccess } from "../../access"

const companyFields = [
  "id", "name", "legal_name", "website", "email", "phone", "linkedin_url",
  "industry", "size", "employees_count", "annual_revenue", "founded", "description",
  "tax_id", "tax_country", "registration_number", "vat_number", "legal_structure",
  "is_public", "stock_symbol", "parent_company_id", "address", "created_at", "updated_at",
] as const satisfies readonly (keyof Company)[]

type Context = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: Context) {
  try {
    const id = uuid.safeParse((await context.params).id)
    if (!id.success) return procurementError("Invalid supplier ID", 400)
    const access = await supplierAccess(request, "select")
    if (access.error) return access.error

    const { data: supplier, error: supplierError } = await access.supabase.from("suppliers")
      .select("id,site_id,company_id")
      .eq("site_id", access.siteId).eq("id", id.data).maybeSingle()
    if (supplierError) return procurementError("Unable to load supplier", 503)
    if (!supplier || supplier.id !== id.data || supplier.site_id !== access.siteId) {
      return procurementError("Supplier not found", 404)
    }
    if (supplier.company_id === null) {
      return NextResponse.json({ company: null }, { headers: privateHeaders })
    }
    const companyId = uuid.safeParse(supplier.company_id)
    if (!companyId.success) return procurementError("Unable to load linked company", 503)

    // Reuse the authenticated client: company visibility is determined by RLS.
    const { data, error } = await access.supabase.from("companies")
      .select(companyFields.join(",")).eq("id", companyId.data).maybeSingle()
    if (error) return procurementError("Unable to load linked company", 503)
    if (data && data.id !== companyId.data) {
      return procurementError("Unable to load linked company", 503)
    }
    const company: Company | null = data
      ? Object.fromEntries(companyFields.map(field => [field, data[field]])) as unknown as Company
      : null
    return NextResponse.json({ company }, { headers: privateHeaders })
  } catch {
    return procurementError("Unable to load supplier company", 503)
  }
}