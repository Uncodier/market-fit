import { NextResponse } from "next/server"
import { importQuotationSchema } from "@/app/purchases/procurement/commerce/contracts"
import { commerceBody, commerceResult, commerceWriteAccess, procurementAccess, procurementError, privateHeaders } from "../http"

export async function GET(request: Request) {
  const access = await procurementAccess(request)
  if (access.error) return access.error
  const [quotes, envelopes] = await Promise.all([
    access.supabase.rpc("list_procurement_quotations", { p_site: access.siteId }),
    access.supabase.rpc("list_procurement_quotation_envelopes", { p_site: access.siteId }),
  ])
  if (quotes.error || envelopes.error) return commerceResult(null, quotes.error || envelopes.error)
  return NextResponse.json({ data: quotes.data, envelopes: envelopes.data }, { headers: privateHeaders })
}

export async function POST(request: Request) {
  const originError = commerceWriteAccess(request)
  if (originError) return originError
  const access = await procurementAccess(request)
  if (access.error) return access.error
  const body = importQuotationSchema.safeParse(await commerceBody(request))
  if (!body.success) return procurementError("A supplier, published tender and complete quotation lines are required", 400)
  const { data, error } = await access.supabase.rpc("record_procurement_quotation", {
    p_site: access.siteId, p_document: body.data,
  })
  return commerceResult(data, error)
}