import type { CheckoutCartParams, CheckoutLine } from "./checkout-types"

const identifier = (value: unknown): value is string => typeof value === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(value)
const optionalText = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : undefined

/** Shared by HTTP and the Server Action: omission of a kiosk flag grants no privileges. */
export function normalizePublicCheckoutInput(input: CheckoutCartParams): CheckoutCartParams {
  if (!input || !["shop", "marketplace", "quote"].includes(input.source)) throw new Error("Unsupported public checkout source.")
  if (!identifier(input.siteId) || !["pickup", "ship", "dine_in", "none"].includes(input.fulfillment)) throw new Error("Invalid checkout scope.")
  if (input.payments !== undefined || input.existingOrderId !== undefined || input.registerSessionId !== undefined || input.intent === "pay") {
    throw new Error("Public checkout cannot record payments or modify an existing order. Use the order payment link.")
  }
  if (input.existingReservationId !== undefined || input.expectedOrderVersion !== undefined) throw new Error("Private checkout references are not allowed.")
  if (input.source !== "quote" && (input.quotationId !== undefined || input.publicAccessToken !== undefined)) throw new Error("Quotation references require quotation checkout.")
  if (input.source === "quote" && !identifier(input.quotationId)) throw new Error("A valid quotation reference is required.")
  if (input.selfServiceLocationId !== undefined && (input.source !== "shop" || !identifier(input.selfServiceLocationId))) throw new Error("Invalid self-service checkout.")
  if (input.buyerIdentityQr !== undefined && (typeof input.buyerIdentityQr !== "string" || input.buyerIdentityQr.length > 1024 || input.selfServiceLocationId === undefined)) throw new Error("Invalid account QR.")
  if (!Array.isArray(input.lines) || !input.lines.length || input.lines.length > 50) throw new Error("Invalid checkout cart.")
  let modifierCount = 0
  const lines: CheckoutLine[] = input.lines.map((line) => {
    if (!line || !identifier(line.catalogItemId) || !Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 1000) throw new Error("Invalid cart line.")
    if (line.saleOrderItemId !== undefined) throw new Error("Stored order lines are not allowed in public checkout.")
    if (line.modifiers !== undefined && (!Array.isArray(line.modifiers) || line.modifiers.length > 25)) throw new Error("Invalid modifiers.")
    const modifiers = (line.modifiers || []).map((modifier) => {
      modifierCount++
      if (!modifier || !identifier(modifier.catalogItemId) || !Number.isSafeInteger(modifier.quantity) || modifier.quantity < 1 || modifier.quantity > 1000 ||
        modifier.saleOrderItemId !== undefined || (modifier.groupId !== undefined && !identifier(modifier.groupId))) throw new Error("Invalid modifier.")
      return { catalogItemId: modifier.catalogItemId, quantity: modifier.quantity, groupId: modifier.groupId }
    })
    return { catalogItemId: line.catalogItemId, quantity: line.quantity, clientLineKey: optionalText(line.clientLineKey, 128),
      reservationStart: optionalText(line.reservationStart, 64), reservationEnd: optionalText(line.reservationEnd, 64), modifiers }
  })
  if (modifierCount > 200) throw new Error("Too many modifiers.")
  if (input.clientMutationId !== undefined && (typeof input.clientMutationId !== "string" || !/^[a-zA-Z0-9_-]{16,128}$/.test(input.clientMutationId))) throw new Error("Invalid checkout attempt.")
  const method = input.paymentMethod === "cash" || input.paymentMethod === "bank_transfer" ? input.paymentMethod : undefined
  const address = input.shippingAddress && typeof input.shippingAddress === "object" ? input.shippingAddress : {}
  return {
    siteId: input.siteId, source: input.source, fulfillment: input.fulfillment, lines,
    selfServiceLocationId: input.selfServiceLocationId, buyerIdentityQr: input.buyerIdentityQr,
    clientMutationId: input.clientMutationId, originLocationId: identifier(input.originLocationId) ? input.originLocationId : undefined,
    customerName: optionalText(input.customerName, 120), customerEmail: optionalText(input.customerEmail, 254),
    ownerSiteId: identifier(input.ownerSiteId) ? input.ownerSiteId : null,
    promotionCode: optionalText(input.promotionCode, 128), promotionId: identifier(input.promotionId) ? input.promotionId : undefined,
    notes: optionalText(input.notes, 2000), scheduledFor: optionalText(input.scheduledFor, 64),
    paymentMethod: method, intent: method ? "send" : "draft",
    quotationId: input.quotationId, publicAccessToken: optionalText(input.publicAccessToken, 256),
    shippingAddress: input.fulfillment === "ship" ? Object.fromEntries(["line1", "line2", "city", "state", "zip", "country"].map((key) => [key, optionalText(address[key], 300) || ""])) : undefined,
  }
}