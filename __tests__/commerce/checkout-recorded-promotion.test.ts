/** @jest-environment node */
import { loadRecordedCheckoutPromotion } from "@/app/commerce/checkout-recorded-promotion"
import { persistCheckoutRecords } from "@/app/commerce/checkout-records"
import { resolvePromotionDiscount } from "@/app/promotions/resolve-promotion"
import type { ProcessedCheckoutLine } from "@/app/commerce/checkout-types"

jest.mock("@/app/promotions/resolve-promotion", () => ({ resolvePromotionDiscount: jest.fn() }))

const line: ProcessedCheckoutLine = {
  site_id: "site", catalog_item_id: "coffee", name: "Coffee", currency: "USD",
  quantity: 1, unit_price: 100, subtotal: 100, is_reservation_dropin: false,
  isRoundRobinDropin: false, client_line_key: "line", parent_client_line_key: null,
  modifier_group_id: null, parent_name: null,
}
const storedLine = { id: "line", site_id: "site", sale_order_id: "order", catalog_item_id: "coffee",
  name: "Coffee", quantity: 1, unit_price: 100, status: "draft", metadata: { client_line_key: "line" },
  parent_sale_order_item_id: null }
const order = { id: "order", site_id: "site", sale_id: "sale", status: "pending", currency: "USD",
  origin_location_id: "store", fulfillment_method: "pickup",
  subtotal: 100, tax_total: 2, shipping_cost: 0, total: 82, discount_total: 20,
  sales: { source: "shop" }, promotion_id: "shop-only", promotions: { code: "SAVE20" }, sale_order_items: [storedLine], items: [] }
const params = { siteId: "site", source: "pos", effectiveExistingOrderId: "order", promotionId: "shop-only",
  promotionCode: "SAVE20", processedLines: [line], orderSubtotal: 100, orderTaxTotal: 2,
  orderShippingCost: 0, orderCurrency: "USD", finalOriginLocationId: "store", fulfillment: "pickup" as const }

function database(savedOrder: unknown = order, error: unknown = null, sale = {
  id: "sale", status: "pending", source: "shop", amount: 82, amount_due: 72, payments: [{ amount: 10, method: "cash" }],
}) {
  const writes: { table: string; payload: Record<string, unknown> }[] = []
  const filters: { table: string; key: string; value: unknown }[] = []
  const from = jest.fn((table: string) => {
    let payload: Record<string, unknown> | undefined
    const data = () => table === "sale_orders" ? savedOrder : table === "sales" ? sale : [storedLine]
    const write = () => {
      const row = data()
      if (payload && row && !Array.isArray(row)) {
        writes.push({ table, payload })
        return { ...row, ...payload }
      }
      return row
    }
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { filters.push({ table, key, value }); return query },
      update: (value: Record<string, unknown>) => { payload = value; return query },
      single: async () => ({ data: write(), error }),
      then: <T>(resolve: (value: { data: unknown; error: unknown }) => T) =>
        Promise.resolve({ data: write(), error }).then(resolve),
    }
    return query
  })
  return { from, filters, writes }
}

beforeEach(() => jest.resetAllMocks())

it.each(["other-store", undefined])("does not reuse a location-bound redemption at %s", async (origin) => {
  expect(await loadRecordedCheckoutPromotion(database(), { ...params, finalOriginLocationId: origin })).toBeNull()
})

it.each(["none", "ship", "dine_in"])("revalidates a recorded coupon when pickup changes to %s", async (fulfillment) => {
  expect(await loadRecordedCheckoutPromotion(database(), { ...params, fulfillment })).toBeNull()
})

it("allows an online order without a recorded origin to acquire a checkout location", async () => {
  expect(await loadRecordedCheckoutPromotion(database({ ...order, origin_location_id: null }), params))
    .toMatchObject({ promotionId: "shop-only", discount: 20 })
})

it.each([undefined, "", 123])("does not interpret malformed recorded origins as unassigned: %s", async (origin) => {
  expect(await loadRecordedCheckoutPromotion(database({ ...order, origin_location_id: origin }), params)).toBeNull()
})

it("enforces current location rules before writing a changed-location payment", async () => {
  const client = database()
  jest.mocked(resolvePromotionDiscount).mockResolvedValue({ error: "This promotion is not available at this location" })
  await expect(persistCheckoutRecords({ ...params, source: "pos", supabase: client, supabaseAdmin: client,
    finalOriginLocationId: "other-store", isAdmin: false, quoteForAccept: null, fulfillment: "pickup",
    intent: "pay", payments: [{ method: "cash", amount: 72 }] })).rejects.toThrow("not available at this location")
  expect(client.writes).toEqual([])
})

it("rejects location evidence changed between restoration and the commit read", async () => {
  let reads = 0
  const client = database()
  const racing = { ...client, from: (table: string) => {
    if (table === "sale_orders" && ++reads > 1) return database({ ...order, origin_location_id: "other-store" }).from(table)
    return client.from(table)
  } }
  await expect(persistCheckoutRecords({ ...params, source: "pos", supabase: racing, supabaseAdmin: racing,
    isAdmin: false, quoteForAccept: null, fulfillment: "pickup", intent: "pay", payments: [{ method: "cash", amount: 72 }] }))
    .rejects.toThrow("promotion changed")
  expect(client.writes).toEqual([])
})

it("uses only the site-scoped stored discount rather than client amounts or current promotion eligibility", async () => {
  const client = database()
  await expect(loadRecordedCheckoutPromotion(client, params)).resolves.toMatchObject({ promotionId: "shop-only", discount: 20 })
  expect(client.filters).toEqual([
    { table: "sale_orders", key: "site_id", value: "site" },
    { table: "sale_orders", key: "id", value: "order" },
  ])
  expect(client.from).toHaveBeenCalledTimes(1)
  expect(resolvePromotionDiscount).not.toHaveBeenCalled()
})

it.each([
  { source: "shop" }, { effectiveExistingOrderId: undefined },
  { promotionId: undefined, promotionCode: undefined },
])("does not grant an existing redemption to a new/public/no-promotion checkout %j", async (change) => {
  const client = database()
  expect(await loadRecordedCheckoutPromotion(client, { ...params, ...change })).toBeNull()
  expect(client.from).not.toHaveBeenCalled()
})

it.each([
  { promotionId: "forged" }, { promotionCode: "OTHER" }, { orderSubtotal: 101 },
  { orderTaxTotal: 0 }, { orderShippingCost: 5 }, { orderCurrency: "EUR" },
  { processedLines: [] }, { processedLines: [line, line] },
  { processedLines: [{ ...line, catalog_item_id: "other" }] },
  { processedLines: [{ ...line, quantity: 2, unit_price: 50 }] },
  { processedLines: [{ ...line, client_line_key: "other" }] },
  { buyerUserId: "another-buyer" }, { finalLeadId: "another-lead" },
])("revalidates changed inputs instead of inheriting the recorded discount %j", async (change) => {
  expect(await loadRecordedCheckoutPromotion(database(), { ...params, ...change })).toBeNull()
})

it.each([null, { ...order, discount_total: Infinity }, { ...order, total: 1 },
  { ...order, promotion_id: null }, { ...order, discount_total: -1 }])("fails closed for missing/inconsistent stored evidence %j", async (saved) => {
  if (!saved) await expect(loadRecordedCheckoutPromotion(database(saved), params)).rejects.toThrow("verify")
  else expect(await loadRecordedCheckoutPromotion(database(saved), params)).toBeNull()
})

it("fails closed when the authorized order read fails", async () => {
  await expect(loadRecordedCheckoutPromotion(database(order, { message: "unavailable" }), params)).rejects.toThrow("verify")
})

it("matches modifier identities and rejects price swaps that keep the same subtotal", async () => {
  const child = { ...storedLine, id: "extra", catalog_item_id: "milk", unit_price: 10,
    parent_sale_order_item_id: "line", metadata: { modifier_group_id: "extras" } }
  const saved = { ...order, subtotal: 110, total: 92, sale_order_items: [storedLine, child] }
  const modifier = { ...line, catalog_item_id: "milk", unit_price: 10, subtotal: 10,
    client_line_key: "line:mod:extras:milk", parent_client_line_key: "line", modifier_group_id: "extras" }
  const input = { ...params, orderSubtotal: 110, processedLines: [line, modifier] }
  expect(await loadRecordedCheckoutPromotion(database(saved), input)).toMatchObject({ promotionId: "shop-only", discount: 20 })
  const extraHost = { ...line, catalog_item_id: "tea", client_line_key: "new" }
  expect(await loadRecordedCheckoutPromotion(database(saved), { ...input, processedLines: [extraHost, line, modifier],
    orderSubtotal: 210 })).toMatchObject({ discount: 20 })
  expect(await loadRecordedCheckoutPromotion(database(saved), { ...input, processedLines: [extraHost, line],
    orderSubtotal: 200 })).toBeNull()
  expect(await loadRecordedCheckoutPromotion(database(saved), { ...input, processedLines: [
    { ...line, unit_price: 90 }, { ...modifier, unit_price: 20 },
  ] })).toBeNull()
})

it("settles an unchanged online coupon order in POS without re-redeeming it or charging the undiscounted total", async () => {
  const client = database()
  const result = await persistCheckoutRecords({ ...params, source: "pos", supabase: client, supabaseAdmin: client,
    isAdmin: false, quoteForAccept: null, fulfillment: "pickup", intent: "pay",
    payments: [{ method: "cash", amount: 72 }] })
  expect(result).toMatchObject({ orderTotal: 82, isFullyPaid: true, normalizedPromotionCode: undefined,
    resolvedPromotionId: undefined, sale: { amount: 82, amount_due: 0 },
    order: { total: 82, discount_total: 20, promotion_id: "shop-only" } })
  expect(resolvePromotionDiscount).not.toHaveBeenCalled()
})

it.each(["send", "pay"] as const)("preserves the Shop discount on %s with extra lines and units", async intent => {
  const client = database()
  const result = await persistCheckoutRecords({ ...params, source: "pos", supabase: client, supabaseAdmin: client,
    processedLines: [{ ...line, quantity: 2, subtotal: 200 },
      { ...line, client_line_key: "new", catalog_item_id: "tea", unit_price: 15, subtotal: 15 }],
    orderSubtotal: 215, orderTaxTotal: 4, isAdmin: false, quoteForAccept: null, intent,
    payments: intent === "pay" ? [{ method: "cash", amount: 189 }] : [] })
  expect(result).toMatchObject({ orderTotal: 199, isFullyPaid: intent === "pay",
    sale: { amount_due: intent === "pay" ? 0 : 189, source: "shop" },
    order: { discount_total: 20, promotion_id: "shop-only" }, resolvedPromotionId: undefined })
  expect(resolvePromotionDiscount).not.toHaveBeenCalled()
})

it("does not extend a non-Shop redemption to additional units", async () => {
  const client = database({ ...order, sales: { source: "pos" } })
  expect(await loadRecordedCheckoutPromotion(client, { ...params, orderSubtotal: 200,
    processedLines: [{ ...line, quantity: 2, subtotal: 200 }] })).toBeNull()
})

it("retains the recorded promotion through partial POS payment", async () => {
  const client = database()
  const result = await persistCheckoutRecords({ ...params, source: "pos", supabase: client, supabaseAdmin: client,
    isAdmin: false, quoteForAccept: null, fulfillment: "pickup", intent: "pay",
    payments: [{ method: "cash", amount: 12 }] })
  expect(result).toMatchObject({ orderTotal: 82, isFullyPaid: false, sale: { amount_due: 60 },
    order: { discount_total: 20, promotion_id: "shop-only" } })
})

it("binds the admitted payment RPC to the stored coupon and customer snapshot", async () => {
  const client = database()
  const rpc = jest.fn(async (_name: string, input: Record<string, unknown>) => ({
    data: { sale: input.p_sale_patch, order: input.p_order_patch }, error: null,
  }))
  const result = await persistCheckoutRecords({ ...params, source: "pos", supabase: client,
    supabaseAdmin: { ...client, rpc }, isAdmin: false, quoteForAccept: null, fulfillment: "pickup", intent: "pay",
    posClaim: { mutationId: "mutation", ownerToken: "owner" } as never, payments: [{ method: "cash", amount: 72 }] })
  expect(result).toMatchObject({ orderTotal: 82, order: { discount_total: 20, promotion_id: "shop-only" } })
  expect(rpc).toHaveBeenCalledWith("pos_checkout_commit_order", expect.objectContaining({
    p_expected_order: expect.objectContaining({ promotion_id: "shop-only", discount_total: 20,
      origin_location_id: "store", fulfillment_method: "pickup" }),
    p_expected_sale: expect.objectContaining({ lead_id: null, amount: 82, amount_due: 72 }),
    p_order_patch: expect.objectContaining({ total: 82, discount_total: 20 }),
  }))
  expect(client.writes).toEqual([])
})

it("binds manual recovery to the full calculated balance, original fingerprint and baseline", async () => {
  const client = database(order, null, { id: "sale", status: "pending", source: "shop", amount: 82, amount_due: 82, payments: [] })
  const rpc = jest.fn(async (_name: string, input: Record<string, unknown>) => ({
    data: { sale: input.p_sale_patch, order: input.p_order_patch }, error: null,
  }))
  const args = { ...params, source: "pos" as const, isAdmin: false, quoteForAccept: null, intent: "pay" as const,
    supabase: client, supabaseAdmin: { ...client, rpc }, registerSessionId: "register", registerActorId: "actor",
    posClaim: { siteId: "site", mutationId: "original", ownerToken: "fresh", receivedCash: {
      actorId: "actor", fingerprint: "fingerprint", baseline: '{"id":"order"}',
    } } }
  const pay = (amount: number) => persistCheckoutRecords({ ...args, payments: [{ method: "cash", paymentId: "receipt", amount }] })
  for (const amount of [81.99, 82.01]) await expect(pay(amount)).rejects.toThrow("Cash does not match")
  expect(rpc).not.toHaveBeenCalled()
  await expect(pay(82)).resolves.toMatchObject({ orderTotal: 82 })
  expect(rpc).toHaveBeenCalledWith("pos_checkout_recover_cash", expect.objectContaining({
    p_baseline: { id: "order" }, p_actor_id: "actor", p_fingerprint: "fingerprint", p_payment_id: "receipt",
    p_mutation_id: "original", p_owner_token: "fresh", p_order_id: "order", p_site_id: "site",
    p_sale_patch: expect.objectContaining({ amount: 82, amount_due: 0, source: "shop", payments: [expect.objectContaining({
      amount: 82, method: "cash", payment_id: "receipt", register_session_id: "register", recorded_by: "actor",
    })] }),
  }))
  expect(client.writes).toEqual([])
})

it("still enforces current promotion rules for edited carts", async () => {
  const client = database()
  jest.mocked(resolvePromotionDiscount).mockResolvedValue({ error: "This promotion is not available in POS" })
  await expect(persistCheckoutRecords({ ...params, source: "pos", supabase: client, supabaseAdmin: client,
    processedLines: [{ ...line, quantity: 2, unit_price: 50 }], isAdmin: false, quoteForAccept: null, fulfillment: "pickup" }))
    .rejects.toThrow("not available in POS")
  expect(client.writes).toEqual([])
})

it("accepts historical fractional percentage discounts at settlement precision", async () => {
  const saved = { ...order, subtotal: 19.99, tax_total: 0, discount_total: 1.999, total: 17.991,
    sale_order_items: [{ ...storedLine, unit_price: 19.99 }] }
  expect(await loadRecordedCheckoutPromotion(database(saved), { ...params, orderSubtotal: 19.99, orderTaxTotal: 0,
    processedLines: [{ ...line, unit_price: 19.99, subtotal: 19.99 }] })).toMatchObject({ discount: 1.999 })
})

it("rejects promotion evidence that changes between restoration and the commit read", async () => {
  let reads = 0
  const client = database()
  const from = client.from
  const racing = { ...client, from: (table: string) => {
    if (table === "sale_orders" && ++reads > 1) return database({ ...order, promotion_id: null, discount_total: 0 }).from(table)
    return from(table)
  } }
  await expect(persistCheckoutRecords({ ...params, source: "pos", supabase: racing, supabaseAdmin: racing,
    isAdmin: false, quoteForAccept: null, fulfillment: "pickup", intent: "pay", payments: [{ method: "cash", amount: 72 }] }))
    .rejects.toThrow("promotion changed")
  expect(client.writes).toEqual([])
})