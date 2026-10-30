import { receiptSchema } from "@/app/purchases/procurement/commerce/contracts"
import { commerceBody, commerceResult, commerceWriteAccess, procurementAccess, procurementError } from "../http"

export async function POST(request: Request) {
  const originError = commerceWriteAccess(request)
  if (originError) return originError
  const access = await procurementAccess(request)
  if (access.error) return access.error
  const body = receiptSchema.safeParse(await commerceBody(request))
  if (!body.success) return procurementError("A valid order, receipt note and quantities are required", 400)
  const { data, error } = await access.supabase.rpc("record_procurement_receipt", {
    p_site: access.siteId, p_document: body.data,
  })
  return commerceResult(data, error)
}