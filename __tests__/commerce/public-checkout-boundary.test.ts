/** @jest-environment node */
jest.mock("server-only", () => ({}))
jest.mock("@/app/commerce/private-site-access", () => ({ requirePrivateCommerceSiteAccess: jest.fn() }))
import { normalizePublicCheckoutInput } from "@/app/commerce/public-checkout-input"
import { authorizeCheckoutBoundary } from "@/app/commerce/checkout-boundary"
import { requirePrivateCommerceSiteAccess } from "@/app/commerce/private-site-access"
import type { CheckoutCartParams } from "@/app/commerce/checkout-types"

const request: CheckoutCartParams = { siteId: "site", source: "shop", fulfillment: "pickup", lines: [{ catalogItemId: "item", quantity: 1 }], clientMutationId: "a".repeat(32) }

it.each([
  { payments: [{ method: "cash", amount: 100 }] }, { existingOrderId: "kiosk-order" }, { intent: "pay" as const },
  { existingReservationId: "reservation" }, { registerSessionId: "shift" },
])("rejects private mutation fields without any kiosk flag %#", async (attack) => {
  expect(() => normalizePublicCheckoutInput({ ...request, ...attack })).toThrow()
  await expect(authorizeCheckoutBoundary({ ...request, ...attack })).rejects.toThrow()
})

it("discards client prices, identities, staff fields and completion claims", () => {
  const result = normalizePublicCheckoutInput({ ...request, intent: "complete", userId: "staff", buyerUserId: "victim", sellerUserId: "staff", leadId: "victim-lead",
    priceListId: "private-price", lines: [{ catalogItemId: "item", quantity: 1, unitPriceOverride: 0,
      modifiers: [{ catalogItemId: "extra", groupId: "group", quantity: 1, unitPriceOverride: -100 }] }] })
  expect(result.intent).toBe("draft")
  for (const field of ["userId", "buyerUserId", "sellerUserId", "leadId", "priceListId"]) expect(result).not.toHaveProperty(field)
  expect(result.lines[0]).not.toHaveProperty("unitPriceOverride")
  expect(result.lines[0].modifiers?.[0]).not.toHaveProperty("unitPriceOverride")
})

it("cannot elevate Server Action privileges with isStaffMutation or sales source", async () => {
  jest.mocked(requirePrivateCommerceSiteAccess).mockResolvedValue({ error: "Not authenticated" })
  await expect(authorizeCheckoutBoundary({ ...request, isStaffMutation: true, payments: [{ method: "cash", amount: 100 }] })).rejects.toThrow("Not authenticated")
  await expect(authorizeCheckoutBoundary({ ...request, source: "sales" })).rejects.toThrow("Not authenticated")
})

it("preserves authorized staff reservation edits only after site and order checks", async () => {
  const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: { id: "order" } }) }
  jest.mocked(requirePrivateCommerceSiteAccess).mockResolvedValue({ user: { id: "real-staff" }, supabase: {
    rpc: jest.fn().mockResolvedValue({ data: "collaborator" }), from: () => query,
  } } as never)
  const result = await authorizeCheckoutBoundary({ ...request, isStaffMutation: true, existingOrderId: "order", userId: "forged" })
  expect(result.publicCheckout).toBe(false)
  expect(result.params.userId).toBe("real-staff")
  expect(query.eq).toHaveBeenCalledWith("site_id", "site")
  query.maybeSingle.mockResolvedValue({ data: null })
  await expect(authorizeCheckoutBoundary({ ...request, isStaffMutation: true, existingOrderId: "foreign" })).rejects.toThrow("not available")
})