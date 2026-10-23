export const siteId = "11111111-1111-4111-8111-111111111111";
export const orderId = "22222222-2222-4222-8222-222222222222";
export const userId = "33333333-3333-4333-8333-333333333333";
export const locationId = "44444444-4444-4444-8444-444444444444";
export const sessionId = "55555555-5555-4555-8555-555555555555";
export const requestId = "66666666-6666-4666-8666-666666666666";
export const foreignId = "77777777-7777-4777-8777-777777777777";
export const checkoutInput = {
  siteId, userId, source: "pos" as const, fulfillment: "none" as const,
  lines: [{ catalogItemId: locationId, quantity: 1, unitPriceOverride: 10 }],
  clientMutationId: requestId,
};
export const checkoutResult = { success: true as const, orderId, saleId: orderId, publicAccessToken: "test-public-order-token" };
export const summary = {
  opening_amount: 0, cash_received: 0, cash_in: 0, cash_out: 0, cash_refunds: 0,
  expected_amount: 0, total_received: 0, payment_totals: {}, receipt_count: 0,
  movements: [], receipts: [],
};
export const register = {
  id: sessionId, site_id: siteId, location_id: locationId, currency: "USD", opened_by: userId,
  closed_by: null, opened_at: "2026-10-23T10:00:00Z", closed_at: null, opening_amount: 0,
  counted_amount: null, expected_amount: null, difference: null, notes: "", status: "open" as const,
  snapshot: null,
};
export const order = {
  id: orderId, site_id: siteId, sale_id: orderId, order_number: "POS-1", status: "pending",
  created_at: "2026-10-23T10:00:00Z", updated_at: "2026-10-23T10:00:00Z", subtotal: 10,
  tax_total: 0, discount_total: 0, total: 10, origin_location_id: locationId,
  sale_order_items: [], sales: null, leads: null,
};