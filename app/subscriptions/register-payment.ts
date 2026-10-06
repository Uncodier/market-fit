"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import type { Payment } from "@/app/types"
import { requireAccountingAccess } from "@/app/accounting/access"
import { tryUpsertPolizaForSale } from "@/app/accounting/ensure"
import { fulfillLinkedOrderAfterPayment, shouldFulfillPaidSale } from "@/app/commerce/order-fulfillment-sync"
import { isOutstandingInvoice } from "./invoice-summary"
import { SUBSCRIPTION_PAYMENT_METHODS } from "./payment-methods"

const paymentSchema = z.object({
  siteId: z.string().uuid(),
  subscriptionId: z.string().uuid(),
  invoiceId: z.string().uuid(),
  requestId: z.string().uuid(),
  amount: z.number().finite().positive().refine((amount) =>
    Number.isSafeInteger(Math.round(amount * 100)) &&
    Math.abs(amount * 100 - Math.round(amount * 100)) < 0.000001,
  ),
  method: z.string().refine((method) => SUBSCRIPTION_PAYMENT_METHODS.some((item) => item.value === method)),
  notes: z.string().trim().max(2000).optional(),
})

export async function registerSubscriptionPayment(input: z.input<typeof paymentSchema>): Promise<{
  success?: boolean
  error?: string
  warning?: string
  uncertain?: boolean
}> {
  const parsed = paymentSchema.safeParse(input)
  if (!parsed.success) return { error: "Enter valid payment details" }
  const { siteId, subscriptionId, invoiceId, requestId, amount, method, notes } = parsed.data

  let supabase: Awaited<ReturnType<typeof requireAccountingAccess>>
  try {
    supabase = await requireAccountingAccess(siteId, "update")
  } catch {
    return { error: "Not authorized to register payments in this site" }
  }

  try {
    const { data: subscription, error: subscriptionError } = await supabase.from("subscriptions")
      .select("id").eq("site_id", siteId).eq("id", subscriptionId).maybeSingle()
    if (subscriptionError || !subscription) return { error: "Subscription not found" }

    const { data: invoice, error: invoiceError } = await supabase.from("sales")
      .select("id, status, amount_due, payments, updated_at, accounting_state, lead_id, user_id")
      .eq("site_id", siteId).eq("subscription_id", subscriptionId).eq("id", invoiceId).maybeSingle()
    if (invoiceError || !invoice) return { error: "Invoice not found for this subscription" }

    const payments: Payment[] = Array.isArray(invoice.payments) ? invoice.payments : []
    const paymentId = `subscription-payment-${requestId}`
    const recorded = payments.find((payment) => payment.id === paymentId)
    if (recorded) {
      if (Number(recorded.amount) !== amount || recorded.method !== method || (recorded.notes || "") !== (notes || "")) {
        return { error: "This payment request has already been used" }
      }
    }

    const amountDue = Number(invoice.amount_due)
    if (!recorded && !isOutstandingInvoice({ status: invoice.status, amountDue })) {
      return { error: "This invoice has no outstanding balance" }
    }
    const remainingCents = Math.round(amountDue * 100) - (recorded ? 0 : Math.round(amount * 100))
    if (remainingCents < 0) return { error: "Payment amount cannot exceed the amount due" }
    const invoiceRevision = new Date(invoice.updated_at).getTime()
    if (!invoice.updated_at || !Number.isFinite(invoiceRevision)) {
      return { error: "Unable to verify the current invoice. Reload and retry." }
    }

    const nextAmountDue = remainingCents / 100
    const status = nextAmountDue === 0 ? "completed" : invoice.status
    const payment: Payment = {
      id: paymentId, date: new Date().toISOString(), amount, method,
      ...(notes ? { notes } : {}),
    }
    if (!recorded) {
      const { data: saved, error: saveError } = await supabase.from("sales").update({
        amount_due: nextAmountDue,
        status,
        payments: [...payments, payment],
        payment_method: method,
        accounting_state: invoice.accounting_state === "unpublished" ? "unpublished" : "pending",
        updated_at: new Date(Math.max(Date.now(), invoiceRevision + 1)).toISOString(),
      }).eq("site_id", siteId).eq("subscription_id", subscriptionId).eq("id", invoiceId)
        .eq("updated_at", invoice.updated_at).eq("status", invoice.status).eq("amount_due", invoice.amount_due)
        .select("id").maybeSingle()
      if (saveError) return { error: "Unable to confirm payment. Retry with the same details.", uncertain: true }
      if (!saved) return { error: "Invoice changed while registering the payment. Reload and retry." }
    }

    const warnings: string[] = []
    if (shouldFulfillPaidSale(recorded ? "pending" : invoice.status, status, nextAmountDue)) {
      try {
        await fulfillLinkedOrderAfterPayment({
          supabase, siteId, saleId: invoiceId, leadId: invoice.lead_id, userId: invoice.user_id,
        })
      } catch {
        // The payment is persisted; a fulfillment failure must not prompt a second payment.
        console.error("Subscription invoice payment saved; linked order fulfillment needs recovery")
        warnings.push("Payment saved, but linked order fulfillment needs review.")
      }
    }
    try {
      await tryUpsertPolizaForSale(invoiceId, siteId)
      const { data: accounting, error: accountingError } = await supabase.from("sales")
        .select("accounting_state").eq("site_id", siteId).eq("id", invoiceId).maybeSingle()
      if (accountingError || !accounting || accounting.accounting_state === "pending") {
        warnings.push("Payment saved, but accounting synchronization needs review.")
      }
    } catch {
      warnings.push("Payment saved, but accounting synchronization needs review.")
    }
    revalidatePath("/sales")
    revalidatePath(`/sales/${invoiceId}`)
    revalidatePath("/subscriptions")
    revalidatePath(`/subscriptions/${subscriptionId}`)
    revalidatePath("/orders")
    return { success: true, ...(warnings.length > 0 ? { warning: warnings.join(" ") } : {}) }
  } catch {
    return { error: "Unable to confirm payment. Retry with the same details.", uncertain: true }
  }
}