import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { supplierSubmissionSchema } from "@/app/purchases/procurement/commerce/contracts"
import { commerceBody, commerceResult, commerceWriteAccess, procurementError, privateHeaders } from "../http"
import { uuid } from "../../http"

async function authenticatedClient(request: Request) {
  if (/(?:^|;\s*)market_fit_demo_site_id=/.test(request.headers.get("cookie") ?? "")) return null
  const client = await createClient(true)
  const { data, error } = await client.auth.getUser()
  return error || !data.user ? null : client
}

export async function GET(request: Request) {
  const client = await authenticatedClient(request)
  if (!client) return procurementError("Authentication required", 401)
  const { data, error } = await client.rpc("my_procurement_submissions")
  return commerceResult(data, error)
}

export async function POST(request: Request) {
  const originError = commerceWriteAccess(request)
  if (originError) return originError
  const client = await authenticatedClient(request)
  if (!client) return procurementError("Authentication required", 401)
  const params = new URL(request.url).searchParams
  const site = uuid.safeParse(params.get("site_id"))
  const body = supplierSubmissionSchema.safeParse(await commerceBody(request))
  if (!site.success || params.getAll("site_id").length !== 1 || !body.success) {
    return procurementError("A buyer workspace, publication and complete quotation are required", 400)
  }
  // This is an external actor, not a buyer-site member. The user-scoped RPC
   // validates explicit representation or publication-scoped self participation atomically.
  const { data, error } = await client.rpc("submit_procurement_quotation", { p_site: site.data, p_document: body.data })
   if (error) {
     // Only this known validation diagnostic is safe to expose; never return raw SQL errors.
     if (error.code === '22023' && error.message === 'Active same-currency catalog mapping required') {
       return procurementError('A catalog item linked to this tender is unavailable or uses a different currency. Ask the buyer to correct the linked item. Your quotation was not submitted.', 422)
     }
     return commerceResult(null, error)
   }
  return NextResponse.json({ data: { quotation_id: data } }, { headers: privateHeaders })
}