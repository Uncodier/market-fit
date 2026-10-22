/** @jest-environment node */
jest.mock("server-only", () => ({}))
jest.mock("@/lib/supabase/server", () => ({ createServiceClient: jest.fn() }))
jest.mock("@/app/shop/[siteSlug]/actions", () => ({ getShopSite: jest.fn() }))
jest.mock("@/app/commerce/self-service-modifiers", () => ({ assertSelfServiceModifiers: jest.fn() }))

import { normalizeSelfServiceCheckout, prepareSelfServiceCheckout, resolveSelfServiceLocation } from "@/app/commerce/self-service"
import { getSelfServiceOptions, isSelfServiceItem } from "@/app/commerce/self-service-options"
import { getShopSite } from "@/app/shop/[siteSlug]/actions"
import { issueBuyerIdentityToken } from "@/app/commerce/buyer-identity-token"
import type { CheckoutCartParams } from "@/app/commerce/checkout-types"

const siteId = "55555555-5555-4555-8555-555555555555"
const locationId = "11111111-1111-4111-8111-111111111111"
const itemId = "22222222-2222-4222-8222-222222222222"
const buyerId = "33333333-3333-4333-8333-333333333333"
const base: CheckoutCartParams = { siteId, source: "shop", selfServiceLocationId: locationId, fulfillment: "pickup", lines: [{ catalogItemId: itemId, quantity: 1 }], clientMutationId: "unique-mutation-at-least-16" }
const originalSecret = process.env.SUPABASE_SERVICE_ROLE_KEY

function setup(overrides: Record<string, unknown> = {}) {
  const item = { id: itemId, site_id: siteId, status: "active", kind: "product", is_marketplace_listed: true, ...overrides }
  const location = { id: locationId, site_id: siteId, name: "Branch", is_active: true }
  const query = (data: unknown) => ({ select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), is: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data, error: null }), in: jest.fn().mockResolvedValue({ data, error: null }) })
  const tables = { locations: query(location), sites: query({ id: siteId }), catalog_items: query([item]) }
  const supabase = { from: jest.fn((table: keyof typeof tables) => tables[table]), auth: { admin: { getUserById: jest.fn().mockResolvedValue({ data: { user: { id: buyerId, email: "buyer@example.test", user_metadata: { name: "Buyer" } } } }) } } }
  ;(getShopSite as jest.Mock).mockResolvedValue({ id: siteId, name: "Shop", settings: { shop: { default_delivery_options: ["pickup", "dine_in", "ship"] } } })
  return { supabase, tables, item }
}

beforeEach(() => { jest.clearAllMocks(); process.env.SUPABASE_SERVICE_ROLE_KEY = "isolated-test-signing-key" })
afterAll(() => {
  if (originalSecret === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
  else process.env.SUPABASE_SERVICE_ROLE_KEY = originalSecret
})

it("restricts configuration and catalog to in-person methods", () => {
  expect(getSelfServiceOptions()).toEqual(["pickup", "dine_in"])
  expect(getSelfServiceOptions({ default_delivery_options: ["ship", "pickup"] })).toEqual(["pickup"])
  expect(getSelfServiceOptions({ self_service_fulfillment_options: [] })).toEqual([])
  expect(isSelfServiceItem({ kind: "digital_asset" }, ["pickup"], locationId)).toBe(false)
  expect(isSelfServiceItem({ kind: "product", metadata: { delivery_options: ["ship"] } }, ["pickup"], locationId)).toBe(false)
  expect(isSelfServiceItem({ kind: "product", metadata: { pickup_location_ids: [buyerId] } }, ["dine_in"], locationId)).toBe(false)
  expect(isSelfServiceItem({ kind: "product" }, ["pickup"], locationId)).toBe(true)
})

it("allowlists anonymous input and discards all forged identity, tenant, payment, price and existing-record fields", () => {
  const result = normalizeSelfServiceCheckout({ ...base, siteId: buyerId, buyerUserId: buyerId, userId: buyerId, ownerSiteId: buyerId,
    customerName: "Spoof", customerEmail: "spoof@example.test", existingOrderId: buyerId, quotationId: buyerId, intent: "complete", payments: [{ method: "cash", amount: 999 }],
    lines: [{ catalogItemId: itemId, quantity: 1, unitPriceOverride: 0, saleOrderItemId: buyerId }], isStaffMutation: true }, siteId)
  expect(result).toMatchObject({ siteId, originLocationId: locationId, paymentMethod: "cash", intent: "draft", lines: [{ catalogItemId: itemId, quantity: 1 }] })
  for (const key of ["buyerUserId", "userId", "ownerSiteId", "customerName", "customerEmail", "existingOrderId", "quotationId", "payments", "isStaffMutation"]) expect(result).not.toHaveProperty(key)
  expect(result.lines[0]).not.toHaveProperty("unitPriceOverride")
})

it.each(["ship", "none"] as const)("rejects %s and non-Shop source", (fulfillment) => {
  expect(() => normalizeSelfServiceCheckout({ ...base, fulfillment }, siteId)).toThrow("only supports")
  expect(() => normalizeSelfServiceCheckout({ ...base, source: "pos" }, siteId)).toThrow("Shop channel")
})

it("derives tenant from active location and leaves anonymous checkout unassigned", async () => {
  const { supabase, tables } = setup()
  const result = await prepareSelfServiceCheckout({ ...base, siteId: buyerId, buyerUserId: buyerId }, supabase)
  expect(result.buyerUserId).toBeNull()
  expect(result.params.siteId).toBe(siteId)
  expect(supabase.auth.admin.getUserById).not.toHaveBeenCalled()
  expect(tables.locations.eq).toHaveBeenCalledWith("is_active", true)
  expect(tables.sites.is).toHaveBeenCalledWith("archived_at", null)
})

it("rejects missing/inactive/archived locations without granting public checkout", async () => {
  const { supabase, tables } = setup()
  tables.locations.maybeSingle.mockResolvedValue({ data: null, error: null })
  expect(await resolveSelfServiceLocation(locationId, supabase)).toBeNull()
  expect(await resolveSelfServiceLocation("not-a-location", supabase)).toBeNull()
  await expect(prepareSelfServiceCheckout(base, supabase)).rejects.toThrow("unavailable")
})

it.each([{ kind: "digital_asset" }, { is_recurring: true }, { is_marketplace_listed: false }, { status: "archived" }, { metadata: { delivery_options: ["ship"] } }])("rejects non-kiosk catalog %#", async (overrides) => {
  const { supabase } = setup(overrides)
  await expect(prepareSelfServiceCheckout(base, supabase)).rejects.toThrow("unavailable")
})

it("only associates a buyer via signed unexpired QR and never raw UUID", async () => {
  const { supabase } = setup()
  await expect(prepareSelfServiceCheckout({ ...base, buyerIdentityQr: `mf:user:${buyerId}` }, supabase)).rejects.toThrow("Invalid or expired")
  expect(supabase.auth.admin.getUserById).not.toHaveBeenCalled()
  const code = issueBuyerIdentityToken(buyerId).code
  const result = await prepareSelfServiceCheckout({ ...base, buyerIdentityQr: code }, supabase)
  expect(result.buyerUserId).toBe(buyerId)
  expect(result.params.customerName).toBe("Buyer")
})

it("allows a variant of a listed parent but enforces the parent's branch and delivery scope", async () => {
  const { supabase, tables } = setup({ parent_id: buyerId, is_marketplace_listed: false })
  const child = { id: itemId, site_id: siteId, kind: "product", status: "active", parent_id: buyerId, is_marketplace_listed: false }
  const parent = { id: buyerId, kind: "product", status: "active", is_marketplace_listed: true, metadata: { delivery_options: ["pickup"] } }
  tables.catalog_items.in.mockResolvedValueOnce({ data: [child], error: null }).mockResolvedValueOnce({ data: [parent], error: null })
  await expect(prepareSelfServiceCheckout(base, supabase)).resolves.toMatchObject({ buyerUserId: null })
  tables.catalog_items.in.mockResolvedValueOnce({ data: [child], error: null }).mockResolvedValueOnce({ data: [{ ...parent, metadata: { delivery_options: ["ship"] } }], error: null })
  await expect(prepareSelfServiceCheckout(base, supabase)).rejects.toThrow("unavailable")
})

it("rejects attached modifiers restricted to another location or delivery method", async () => {
  const { supabase, tables, item } = setup()
  const modifierId = "44444444-4444-4444-8444-444444444444"
  const extra = { id: modifierId, site_id: siteId, status: "active", kind: "product", metadata: { pickup_location_ids: [buyerId] } }
  const cart = { ...base, lines: [{ catalogItemId: itemId, quantity: 1, modifiers: [{ catalogItemId: modifierId, groupId: buyerId, quantity: 1 }] }] }
  tables.catalog_items.in.mockResolvedValueOnce({ data: [item, extra], error: null })
  await expect(prepareSelfServiceCheckout(cart, supabase)).rejects.toThrow("modifiers are unavailable")
  tables.catalog_items.in.mockResolvedValueOnce({ data: [item, { ...extra, metadata: { delivery_options: ["ship"] } }], error: null })
  await expect(prepareSelfServiceCheckout(cart, supabase)).rejects.toThrow("modifiers are unavailable")
})