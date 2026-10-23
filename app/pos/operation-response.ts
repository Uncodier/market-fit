import { z } from "zod";

const id = z.string().uuid();
const number = z.number().finite();
const text = z.string();
const nullableText = text.nullable().optional();
const nullableId = id.nullable().optional();
const modifiers = z.array(z.object({ name: text, quantity: number }).passthrough()).optional();
const kitchenLine = z.object({ key: text, name: text, quantity: number, modifiers }).passthrough();
const kitchenDelta = z.object({
  kind: z.enum(["full", "delta", "none"]), adds: z.array(kitchenLine), voids: z.array(kitchenLine),
  qtyChanges: z.array(z.object({ key: text, name: text, from: number, to: number, modifiers }).passthrough()),
});
const checkoutSuccess = z.object({
  success: z.literal(true), saleId: id, orderId: id,
  publicAccessToken: text.optional(), orderNumber: nullableText, status: nullableText,
  total: number.nullable().optional(), currency: nullableText, createdAt: nullableText,
  notes: nullableText, fulfillment: nullableText, kitchenDelta: kitchenDelta.nullable().optional(),
  idempotent: z.boolean().optional(),
}).passthrough();
const lead = z.object({ id, site_id: id.optional(), name: nullableText, email: nullableText }).passthrough();
const sale = z.object({
  id, status: nullableText, source: nullableText, payment_method: nullableText,
  amount: number.nullable().optional(), amount_due: number.nullable().optional(),
  payments: z.array(z.object({ amount: number.nullable().optional() }).passthrough()).nullable().optional(),
  leads: lead.nullable().optional(),
}).passthrough();
const order = z.object({
  id, site_id: id, sale_id: id, order_number: text, status: text, created_at: text, updated_at: text,
  subtotal: number, tax_total: number, discount_total: number, total: number,
  currency: nullableText, notes: nullableText, fulfillment_method: nullableText,
  origin_location_id: id.nullable(), price_list_id: nullableId, promotion_id: nullableId,
  buyer_user_id: nullableId, seller_user_id: nullableId, scheduled_for: nullableText,
  shipping_address: z.object({
    line1: nullableText, line2: nullableText, city: nullableText, state: nullableText,
    zip: nullableText, country: nullableText,
  }).nullable().optional(),
  seller: z.object({ id, name: text }).optional(),
  sale_order_items: z.array(z.object({
    id, catalog_item_id: id.nullable(), unit_price: number, quantity: number,
    metadata: z.record(z.unknown()).nullable(), status: text.nullable(), name: text,
    parent_sale_order_item_id: id.nullable(),
  }).passthrough()),
  sales: sale.nullable(), leads: lead.nullable().optional(),
}).passthrough();
const summary = z.object({
  opening_amount: number, cash_received: number, cash_in: number, cash_out: number,
  cash_refunds: number, expected_amount: number, total_received: number,
  payment_totals: z.record(number), receipt_count: number,
  movements: z.array(z.object({
    id, kind: z.enum(["cash_in", "cash_out", "cash_refund"]), amount: number,
    reason: text, actor_id: id, created_at: text,
  })),
  receipts: z.array(z.object({
    id, sale_id: id, method: text, amount: number, tendered: number,
    change: number, actor_id: id, received_at: text,
  })),
});
const register = z.object({
  id, site_id: id, location_id: id, currency: text, opened_by: id,
  closed_by: id.nullable(), opened_at: text, closed_at: text.nullable(),
  opening_amount: number, counted_amount: number.nullable(), expected_amount: number.nullable(),
  difference: number.nullable(), notes: text, status: z.enum(["open", "closed"]), snapshot: summary.nullable(),
}).passthrough();
const dashboard = z.object({
  active: register.nullable(), history: z.array(register), hasMore: z.boolean(),
  role: z.enum(["owner", "admin", "collaborator"]), userId: id,
});
const movement = z.object({
  id, site_id: id, session_id: id, kind: z.enum(["cash_in", "cash_out", "cash_refund"]),
  amount: number, reason: text, actor_id: id, request_id: id, created_at: text,
}).passthrough();

export const posOperationRecoverySchema = z.object({
  state: z.enum(["completed", "not_found", "processing", "rejected", "payment_recorded", "review_required"]),
  message: text.min(1).max(1000), orderId: nullableId, saleId: nullableId,
  result: checkoutSuccess.optional(),
}).strict().refine((value) => value.state !== "completed" || !!value.result);

export const posOperationErrorSchema = z.object({
  error: text.min(1).max(1000),
  code: z.enum(["register_required", "register_location_required"]).optional(),
  recovery: posOperationRecoverySchema.optional(),
}).strict();

export function parsePosOperationSuccess(operation: string, value: unknown, input: unknown): unknown | null {
  // Error/success ambiguity is never a confirmed operation.
  if (!value || typeof value !== "object" || "error" in value) return null;
  if (operation === "checkout") {
    const parsed = checkoutSuccess.safeParse(value);
    return parsed.success ? parsed.data : null;
  }
  if (operation === "create-lead") {
    const parsed = z.object({ lead, idempotent: z.boolean().optional() }).strict().safeParse(value);
    if (!parsed.success) return null;
    const siteId = (input as { siteId?: string })?.siteId;
    return !parsed.data.lead.site_id || parsed.data.lead.site_id === siteId ? parsed.data : null;
  }
  const scope = input as { siteId?: string; orderId?: string; locationId?: string; sessionId?: string; requestId?: string };
  if (operation === "register-summary") {
    const parsed = z.object({ data: summary }).strict().safeParse(value);
    return parsed.success ? parsed.data : null;
  }
  if (operation === "register-dashboard") {
    const parsed = z.object({ data: dashboard }).strict().safeParse(value);
    if (!parsed.success) return null;
    const { active, history } = parsed.data.data;
    return (!active || (active.status === "open" && active.site_id === scope.siteId && active.location_id === scope.locationId)) &&
      history.every((session) => session.status === "closed" && session.site_id === scope.siteId && session.location_id === scope.locationId)
      ? parsed.data : null;
  }
  if (operation === "register-move") {
    const parsed = z.object({ data: movement }).strict().safeParse(value);
    return parsed.success && parsed.data.data.site_id === scope.siteId &&
      parsed.data.data.session_id === scope.sessionId && parsed.data.data.request_id === scope.requestId ? parsed.data : null;
  }
  const parsed = z.object({ data: operation === "order" ? order : register }).strict().safeParse(value);
  if (!parsed.success) return null;
  if (parsed.data.data.site_id !== scope?.siteId) return null;
  if (operation === "order" && parsed.data.data.id !== scope.orderId) return null;
  if (["register", "register-open"].includes(operation) && (parsed.data.data.status !== "open" ||
      (scope.locationId && parsed.data.data.location_id !== scope.locationId))) return null;
  if (operation === "register-close" && (parsed.data.data.status !== "closed" || parsed.data.data.id !== scope.sessionId)) return null;
  return parsed.data;
}