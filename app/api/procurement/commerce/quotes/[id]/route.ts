import { NextResponse } from "next/server"
import type { ProcurementQuotation } from "@/app/purchases/procurement/commerce/contracts"
import type { ProcurementQuotationDetail, ProcurementQuotationSupplier } from "@/app/purchases/procurement/commerce/quotation-detail-contracts"
import { uuid } from "../../../http"
import { commerceResult, procurementAccess, procurementError, privateHeaders } from "../../http"

type Context = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: Context) {
  try {
    const id = uuid.safeParse((await context.params).id)
    if (!id.success) return procurementError("Invalid quotation ID", 400)
    const access = await procurementAccess(request)
    if (access.error) return access.error

    // Procurement table RLS deliberately excludes these rows. Only this RPC
    // authorizes the buyer projection and enforces the publication opening clock.
    // Requires the single-target RPC migration; never fall back to a capped list
    // or raw procurement reads if deployment has not installed it yet.
    const quote = await access.supabase.rpc("get_procurement_quotation", {
      p_site: access.siteId, p_quotation: id.data,
    })
    if (quote.error) return commerceResult(null, quote.error)
    if (quote.data === null) return procurementError("Quotation not found", 404)
    if (!quote.data || typeof quote.data !== "object" || Array.isArray(quote.data) || quote.data.id !== id.data) {
      return procurementError("Unable to load quotation", 503)
    }
    const quotation = quote.data as ProcurementQuotation

    // Keep enrichment within the supplier SELECT boundary. The quotation RPC's
    // supplier name is not authority to read private supplier relationships.
    const permission = await access.supabase.rpc("user_can", { p_site_id: access.siteId, p_command: "select" })
    if (permission.error) return procurementError("Unable to load quotation", 503)
    let supplier: ProcurementQuotationSupplier | null = null
    if (permission.data === true) {
      const result = await access.supabase.from("suppliers")
        .select("id,name,status,commercial_terms,supplier_contacts(name,email,phone,role,is_primary)")
        .eq("site_id", access.siteId).eq("id", quotation.supplier_id).maybeSingle()
      if (result.error) return procurementError("Unable to load quotation", 503)
      if (result.data) {
        const row = result.data
        supplier = {
          id: row.id, name: row.name, status: row.status, commercial_terms: row.commercial_terms,
          contacts: (row.supplier_contacts ?? []).map((contact: ProcurementQuotationSupplier["contacts"][number]) => ({
            name: contact.name, email: contact.email, phone: contact.phone,
            role: contact.role, is_primary: contact.is_primary,
          })),
        }
      }
    }

    const data: ProcurementQuotationDetail = { quotation, supplier }
    return NextResponse.json({ data }, { headers: privateHeaders })
  } catch {
    return procurementError("Unable to load quotation", 503)
  }
}