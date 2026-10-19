import "server-only"
import { z } from "zod"
import type { CheckoutCartParams, CheckoutSupabaseClient } from "@/app/commerce/checkout-types"
import { registerError } from "./validation"

const id = z.string().uuid()
const money = z.number().finite().min(0).max(999999999).refine(
  (value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.00001,
)
const paymentsSchema = z.array(z.object({
  paymentId: id, method: z.enum(["cash", "credit_card", "debit_card", "transfer", "on_account", "other"]),
  amount: money.refine((value) => value > 0), tendered: money.optional(), change: money.optional(),
}).strict()).min(1).max(50).refine((payments) => new Set(payments.map((p) => p.paymentId)).size === payments.length)
  .refine((payments) => payments.every((payment) => payment.method !== "cash" ||
    Math.abs((payment.tendered ?? payment.amount) - (payment.change ?? 0) - payment.amount) < 0.00001))

export async function assertRegisterCheckout(
  supabase: CheckoutSupabaseClient, params: CheckoutCartParams, authenticatedUserId: string | null,
) {
  if (params.source !== "pos" || !params.payments?.length) return
  if (!authenticatedUserId) throw new Error("Authentication is required for POS payment.")
  if (params.quotationId) throw new Error("Accept the quotation first, then collect its payment through the POS order.")
  if (!id.safeParse(params.registerSessionId).success || !paymentsSchema.safeParse(params.payments).success) {
    throw new Error("This payment is not linked to a valid register shift. Open Cash Register in Options before collecting payment.")
  }
  const { data: role, error: roleError } = await supabase.rpc("current_user_site_role", { p_site_id: params.siteId })
  if (roleError || !["owner", "admin", "collaborator"].includes(role)) throw new Error("Forbidden POS payment.")
  const result = await supabase.from("pos_register_sessions").select("id,site_id,location_id,currency,status,opened_by")
    .eq("id", params.registerSessionId).eq("site_id", params.siteId).maybeSingle()
  if (result.error) throw new Error(registerError(result.error))
  if (!result.data || result.data.status !== "open") throw new Error("The register shift is closed or unavailable. Refresh before collecting payment.")
  if (result.data.location_id !== params.originLocationId) throw new Error("Payment location does not match the register.")
  if (result.data.opened_by !== authenticatedUserId && !["owner", "admin"].includes(role)) {
    throw new Error("This register shift belongs to another cashier.")
  }
}