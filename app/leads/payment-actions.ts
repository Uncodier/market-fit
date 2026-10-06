"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireAccountingAccess } from "@/app/accounting/access"
import { tryUpsertPolizaForSale } from "@/app/accounting/ensure"
import { fulfillLinkedOrderAfterPayment } from "@/app/commerce/order-fulfillment-sync"
import {
  leadInvoicePaymentSchema,
  leadPaymentScopeSchema,
  type LeadInvoicePayment,
  type LeadInvoicePaymentInput,
  type LeadOpenInvoice,
} from "./payment-allocation"

const snapshotSchema = z.object({
  version: z.string().regex(/^[a-f0-9]{32}$/),
  invoices: z.array(z.object({
    id: z.string().uuid(), title: z.string(), invoiceNumber: z.string().nullable(),
    amountDue: z.number().finite().positive().refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 0.0001),
    currency: z.string().regex(/^[A-Z]{3}$/),
    saleDate: z.string(), createdAt: z.string(), updatedAt: z.string(), status: z.enum(["pending", "completed"]),
  })),
})

function paymentError(code?: string): string {
  if (code === "40001") return "Invoice balances changed. Reload the invoices and review the payment before confirming."
  if (code === "23514" || code === "22023") return "The payment or invoice history requires review. Reload the invoices and check the amount and currency."
  if (code === "42501") return "You are not authorized to record payments for this lead."
  if (code === "PGRST202" || code === "42883") return "Lead payments are not available until the database migration is installed."
  return "Unable to confirm the payment. Retry with the same payment details to avoid recording it twice."
}

export async function getLeadOpenInvoices(siteId: string, leadId: string): Promise<{
  snapshot?: { invoices: LeadOpenInvoice[]; version: string }
  error?: string
}> {
  if (!leadPaymentScopeSchema.safeParse({ siteId, leadId }).success) return { error: "Invalid site or lead" }
  try {
    const supabase = await requireAccountingAccess(siteId, "update")
    const { data, error } = await supabase.rpc("lead_open_invoice_snapshot", { p_site_id: siteId, p_lead_id: leadId })
    if (error) return { error: paymentError(error.code) }
    const snapshot = snapshotSchema.safeParse(data)
    if (!snapshot.success) return { error: "The invoice balances, dates or currencies require review before recording a payment." }
    return { snapshot: snapshot.data }
  } catch {
    return { error: "Authentication and permission to update this site's invoices are required." }
  }
}

export async function registerLeadInvoicePayment(input: LeadInvoicePaymentInput): Promise<{
  payment?: LeadInvoicePayment
  warning?: string
  error?: string
}> {
  const parsed = leadInvoicePaymentSchema.safeParse(input)
  if (!parsed.success) return { error: "Enter valid payment details, IDs, currency and an amount with at most two decimals." }
  const value = parsed.data
  let supabase: Awaited<ReturnType<typeof requireAccountingAccess>>
  try {
    supabase = await requireAccountingAccess(value.siteId, "update")
  } catch {
    return { error: "Authentication and permission to update this site's invoices are required." }
  }
  let payment: LeadInvoicePayment
  try {
    const { data, error } = await supabase.rpc("record_lead_invoice_payment", {
      p_site_id: value.siteId,
      p_lead_id: value.leadId,
      p_request_id: value.requestId,
      p_version: value.version,
      p_currency: value.currency,
      p_mode: value.mode,
      p_amount: value.mode === "partial" ? value.amount : null,
      p_method: value.method,
      p_notes: value.notes,
    })
    if (error) return { error: paymentError(error.code) }
    payment = data as LeadInvoicePayment
  } catch {
    return { error: paymentError() }
  }

  // Receipt persistence has committed. Secondary failures must never suggest that
  // the cash was not recorded; replaying the same request retries these effects.
  let needsReview = false
  for (const allocation of payment.allocations) {
    try {
      if (allocation.status === "completed" && allocation.previousStatus === "pending") {
        const { data: sale, error } = await supabase.from("sales").select("user_id, status, amount_due")
          .eq("site_id", value.siteId).eq("id", allocation.invoiceId).single()
        if (error || !sale) throw new Error("Paid invoice unavailable")
        if (sale.status === "completed" && Number(sale.amount_due) === 0) {
          await fulfillLinkedOrderAfterPayment({ supabase, siteId: value.siteId, saleId: allocation.invoiceId, leadId: value.leadId, userId: sale.user_id })
        }
      }
      await tryUpsertPolizaForSale(allocation.invoiceId, value.siteId)
    } catch {
      needsReview = true
    }
  }
  try {
    revalidatePath("/sales")
    revalidatePath("/leads")
    revalidatePath(`/leads/${value.leadId}`)
    revalidatePath("/subscriptions")
    for (const allocation of payment.allocations) revalidatePath(`/sales/${allocation.invoiceId}`)
  } catch {
    needsReview = true
  }
  return { payment, ...(needsReview ? { warning: "Payment recorded. Some accounting or order updates need review; do not enter this payment again." } : {}) }
}