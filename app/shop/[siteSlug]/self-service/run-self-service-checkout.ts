import { checkoutCartRequest, type CheckoutCartSuccess } from "@/app/commerce/checkout-client"
import { toCheckoutModifiers } from "@/app/commerce/cart-modifiers"
import type { SelfServiceCartItem } from "./self-service-storage"
import type { CheckoutCartParams } from "@/app/commerce/checkout-types"
import { finishSelfServiceAttempt, getSelfServiceAttempt, recoverSelfServiceAttempt } from "./self-service-attempt"

export async function runSelfServiceCheckout(params: {
  siteId: string
  locationId: string
  cart: SelfServiceCartItem[]
  fulfillment: "pickup" | "dine_in"
  buyerIdentityQr?: string
  promotion?: { id: string; code?: string | null } | null
  notes?: string
}): Promise<CheckoutCartSuccess> {
  const recovered = await recoverSelfServiceAttempt(params.locationId)
  if (recovered) return recovered
  const request: CheckoutCartParams = {
    siteId: params.siteId,
    selfServiceLocationId: params.locationId,
    buyerIdentityQr: params.buyerIdentityQr,
    lines: params.cart.map((line) => ({
      catalogItemId: line.id,
      quantity: line.cartQty,
      clientLineKey: line.lineKey || line.id,
      modifiers: toCheckoutModifiers(line.modifiers).map(({ catalogItemId, quantity, groupId }) => ({ catalogItemId, quantity, groupId })),
    })),
    originLocationId: params.locationId,
    fulfillment: params.fulfillment,
    promotionCode: params.promotion?.code || undefined,
    promotionId: !params.promotion?.code ? params.promotion?.id : undefined,
    notes: params.notes?.trim() || undefined,
    source: "shop",
    paymentMethod: "cash",
    intent: "draft",
  }
  const attempt = await getSelfServiceAttempt(params.locationId, request)
  const result = await checkoutCartRequest({ ...request, clientMutationId: attempt.id })
  if (result.success || result.checkoutState === "rejected") finishSelfServiceAttempt(params.locationId, attempt.id)
  if (!result.success) throw new Error(result.error || "Unable to place your order. Please try again.")
  return result
}