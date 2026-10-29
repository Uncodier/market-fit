import { z } from "zod";
import {
  registerPaymentScopeSchema, registerDashboardSchema, registerSessionSchema,
  registerOpenSchema, registerCloseSchema, registerMoveSchema,
} from "./register/validation";

const id = z.string().uuid();
const text = z.string().max(500);
const identity = z.string().min(1).max(128);
const date = z.string().max(64).datetime({ offset: true });
export const posOperationIdentitySchema = z.object({
  version: z.literal(1), deviceId: id, createdAt: date,
}).strict();
const money = z.number().finite().min(0).max(999999999);
const paymentMoney = money.refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.00001);
const quantity = z.number().finite().positive().max(1000);
const modifier = z.object({
  catalogItemId: id, quantity, unitPriceOverride: money.optional(),
  saleOrderItemId: id.optional(), groupId: id.or(z.literal("")).optional(),
}).strict();
const line = modifier.omit({ groupId: true }).extend({
  reservationStart: date.optional(), reservationEnd: date.optional(),
  clientLineKey: z.string().min(1).max(256).optional(),
  modifiers: z.array(modifier).max(25).optional(),
}).strict();
const payment = z.object({
  paymentId: id,
  method: z.enum(["cash", "credit_card", "debit_card", "transfer", "on_account", "other"]),
  amount: paymentMoney.refine((value) => value > 0), tendered: paymentMoney.optional(), change: paymentMoney.optional(),
}).strict().refine((value) => value.method !== "cash" ||
  Math.abs((value.tendered ?? value.amount) - (value.change ?? 0) - value.amount) < 0.00001);

/** POS-only input; public, staff override and account-owner fields are not accepted. */
export const posOperationCheckoutSchema = z.object({
  siteId: id, source: z.literal("pos"), clientMutationId: identity,
  posOperationIdentity: posOperationIdentitySchema.optional(),
  userId: id.optional(), sellerUserId: id.optional(), buyerUserId: id.optional(),
  lines: z.array(line).min(1).max(200),
  priceListId: id.optional(), leadId: id.optional(), promotionId: id.optional(),
  promotionCode: text.optional(),
  fulfillment: z.enum(["pickup", "ship", "dine_in", "none"]),
  originLocationId: id.optional(),
  shippingAddress: z.object({
    line1: text, line2: text, city: text, state: text, zip: text, country: text,
  }).strict().optional(),
  customerName: text.optional(), customerEmail: z.string().email().max(320).optional(),
  payments: z.array(payment).max(50).optional(), registerSessionId: id.optional(),
  existingOrderId: id.optional(), expectedOrderVersion: z.string().min(1).max(500_000).optional(),
  intent: z.enum(["draft", "send", "complete", "pay"]).optional(),
  paymentMethod: z.string().min(1).max(30).optional(), scheduledFor: date.optional(),
  notes: z.string().max(10_000).optional(), existingReservationId: id.optional(),
}).strict().superRefine((value, ctx) => {
  const payments = value.payments || [];
  if (value.lines.reduce((sum, row) => sum + (row.modifiers?.length || 0), 0) > 500 ||
      new Set(payments.map((row) => row.paymentId)).size !== payments.length ||
      (payments.length && (!value.registerSessionId || !value.originLocationId))) {
    ctx.addIssue({ code: "custom", message: "Invalid POS checkout bounds or payment scope" });
  }
});

export const posOperationSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("checkout"), input: posOperationCheckoutSchema }).strict(),
  z.object({ operation: z.literal("create-lead"), input: z.object({
    siteId: id, name: z.string().trim().min(1).max(500), clientMutationId: identity,
    email: z.string().email().max(320).nullable().optional(),
    phone: z.string().max(100).nullable().optional(),
  }).strict() }).strict(),
  z.object({ operation: z.literal("order"), input: z.object({ siteId: id, orderId: id }).strict() }).strict(),
  z.object({ operation: z.literal("register"), input: registerPaymentScopeSchema }).strict(),
  z.object({ operation: z.literal("register-dashboard"), input: registerDashboardSchema }).strict(),
  z.object({ operation: z.literal("register-summary"), input: registerSessionSchema }).strict(),
  z.object({ operation: z.literal("register-open"), input: registerOpenSchema }).strict(),
  z.object({ operation: z.literal("register-close"), input: registerCloseSchema }).strict(),
  z.object({ operation: z.literal("register-move"), input: registerMoveSchema }).strict(),
]);

export type PosOperation = z.infer<typeof posOperationSchema>;