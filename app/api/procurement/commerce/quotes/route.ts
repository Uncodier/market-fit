import { importQuotationSchema } from "@/app/purchases/procurement/commerce/contracts"
import { commerceBody, commerceResult, procurementAccess, procurementError } from "../http"

export async function GET(request: Request) {
  const access = await procurementAccess(request)
  if (access.error) return access.error
  const { data, error } = await access.supabase.rpc("list_procurement_quotations", { p_site: access.siteId })
  return commerceResult(data, error)
}

export async function POST(request: Request) {
  const access = await procurementAccess(request)
  if (access.error) return access.error
  const body = importQuotationSchema.safeParse(await commerceBody(request))
  if (!body.success) return procurementError("A supplier, published tender and complete quotation lines are required", 400)
  const { data, error } = await access.supabase.rpc("record_procurement_quotation", {
    p_site: access.siteId, p_document: body.data,
  })
  return commerceResult(data, error)
}