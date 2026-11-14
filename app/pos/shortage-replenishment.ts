"use server"

import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createTransferOrder } from "@/app/inventory/movements/order-actions"
import { requestDocumentSchema } from "@/app/purchases/requests/schema"

const uuid = z.string().uuid().transform(value => value.toLowerCase())
const shortageSchema = z.object({
  siteId: uuid,
  catalogItemId: uuid,
  quantity: z.number().finite().positive().max(1_000_000),
  locationId: uuid,
  requestId: uuid,
})
const purchaseSchema = shortageSchema.extend({ currency: z.string().regex(/^[A-Z]{3}$/).optional() }).strict()
const transferSchema = shortageSchema.extend({ sourceLocationId: uuid }).strict()
  .refine(value => value.sourceLocationId !== value.locationId)

type ShortageResult = { id?: string; error?: string; reviewRequired?: boolean }
type PurchaseInput = z.input<typeof purchaseSchema>
type TransferInput = z.input<typeof transferSchema>

/** Creates a draft only; approval, purchasing and receipt remain separate workflows. */
export async function requestPosShortagePurchase(input: PurchaseInput): Promise<ShortageResult> {
  const parsed = purchaseSchema.safeParse(input)
  if (!parsed.success) return { error: "Invalid purchase replenishment request" }
  let writeStarted = false
  try {
    const client = await createClient(true)
    const { data: { user }, error: authError } = await client.auth.getUser()
    if (authError || !user) return { error: "Not authenticated" }
    if (client._isDemo) return { error: "Demo replenishment requests are read-only" }
    const access = await client.rpc("procurement_request_access", { p_site: parsed.data.siteId })
    if (access.error || access.data !== true) return { error: "Purchase requisition access denied" }
    const { siteId, catalogItemId, quantity, locationId, requestId } = parsed.data
    const locationAccess = await client.rpc("user_can_access_location", { p_site_id: siteId, p_location_id: locationId })
    if (locationAccess.error || locationAccess.data !== true) return { error: "Receiving location access denied" }
    const [product, location] = await Promise.all([
      client.from("catalog_items").select("name,currency").eq("site_id", siteId).eq("id", catalogItemId)
        .eq("status", "active").eq("kind", "product").maybeSingle(),
      client.from("locations").select("name").eq("site_id", siteId).eq("id", locationId).eq("is_active", true).maybeSingle(),
    ])
    if (product.error || !product.data || location.error || !location.data) {
      return { error: "Product or receiving location is unavailable" }
    }
    // Procurement accepts whole units. Cost and taxes are derived by the existing
    // authorized RPC; the UI currency is never an authoritative document value.
    const document = requestDocumentSchema.safeParse({
      title: `POS replenishment: ${product.data.name}`.slice(0, 200),
      description: `POS stock shortage. Receiving location: ${location.data.name} (${locationId}). Reference: ${requestId}.`,
      currency: product.data.currency,
      lines: [{ catalog_item_id: catalogItemId, quantity: Math.ceil(quantity) }],
    })
    if (!document.success) return { error: "Check the product's procurement currency and receiving location." }
    writeStarted = true
    const { data, error } = await client.rpc("save_procurement_request", {
      p_site: siteId, p_id: null, p_revision: 0, p_document: document.data,
    })
    if (error?.code === "42501") return { error: "Purchase requisition access denied" }
    if (error && ["22023", "23514", "23503"].includes(error.code)) {
      return { error: "Check the product's procurement cost, currency and receiving location." }
    }
    if (error || !uuid.safeParse(data).success) {
      // This legacy workflow has no idempotency key. A correlation reference is
      // not replay protection: callers must block retry after an uncertain write.
      return { error: "Purchase request could not be confirmed. Review purchase requisitions before creating another request.", reviewRequired: true }
    }
    return { id: data as string }
  } catch {
    return writeStarted
      ? { error: "Purchase request could not be confirmed. Review purchase requisitions before creating another request.", reviewRequired: true }
      : { error: "Unable to prepare the purchase requisition. Please try again." }
  }
}

/** Requests stock without approving, dispatching, receiving or changing the cart. */
export async function requestPosShortageTransfer(input: TransferInput): Promise<ShortageResult> {
  const parsed = transferSchema.safeParse(input)
  if (!parsed.success) return { error: "Invalid transfer replenishment request" }
  try {
    const { siteId, catalogItemId, quantity, locationId, sourceLocationId, requestId } = parsed.data
    // This existing action authenticates and delegates location/item permission,
    // lifecycle and actor-bound replay checks to the atomic transfer workflow.
    const result = await createTransferOrder({
      siteId, requestId, fromLocationId: sourceLocationId, toLocationId: locationId,
      status: "requested", items: [{ catalogItemId, quantity }], notes: "POS stock shortage",
    })
    if ("error" in result) return { error: result.error }
    return { id: result.orderId }
  } catch {
    return { error: "Transfer request could not be confirmed. Retain the request ID and retry." }
  }
}