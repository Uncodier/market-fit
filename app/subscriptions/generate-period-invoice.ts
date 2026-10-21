"use server"

import { revalidatePath } from "next/cache"
import { v5 as uuidv5 } from "uuid"
import { z } from "zod"
import { requireAccountingAccess } from "@/app/accounting/access"
import { getSubscriptionInvoiceDueDate, isDateOnly } from "@/lib/finance/due-date"
import { getSubscriptionBillingDate, getSubscriptionInvoicePeriod } from "./billing-period"

const inputSchema = z.object({
  siteId: z.string().uuid(),
  subscriptionId: z.string().uuid(),
  billingDate: z.string().refine(isDateOnly),
})

export async function generateSubscriptionPeriodInvoice(input: z.input<typeof inputSchema>): Promise<{
  data?: { id: string }
  existing?: boolean
  error?: string
}> {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) return { error: "Invalid subscription period request" }
  const { siteId, subscriptionId, billingDate } = parsed.data

  let supabase: Awaited<ReturnType<typeof requireAccountingAccess>>
  try {
    supabase = await requireAccountingAccess(siteId, "insert")
  } catch {
    return { error: "Not authorized to generate invoices in this site" }
  }

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { error: "Authentication required" }

    const { data: subscription, error: readError } = await supabase.from("subscriptions")
      .select("*, catalog_item:catalog_items(name, kind, currency)")
      .eq("site_id", siteId).eq("id", subscriptionId).maybeSingle()
    if (readError || !subscription) return { error: "Subscription not found" }
    if (subscription.status !== "active") return { error: "Only active subscriptions can generate period invoices" }
    if (getSubscriptionBillingDate(subscription.next_billing_date) !== billingDate) {
      return { error: "The billing period changed. Reload and retry." }
    }

    const period = getSubscriptionInvoicePeriod(subscription.id, subscription.next_billing_date)
    if (!period) return { error: "The subscription must have a valid next billing date" }
    // Share the Workflows renewal identity so concurrent writers converge through the sales primary key.
    const invoiceId = uuidv5(JSON.stringify([
      "subscription-renewal-v1", "sale", siteId, subscription.id, period.billing_cycle,
    ]), uuidv5.URL)
    const findExisting = async () => {
      const query = () => supabase.from("sales").select("id, status")
        .eq("site_id", siteId).eq("subscription_id", subscription.id)
      const candidates = [
        () => query().eq("product_details->>billing_period_start", period.billing_period_start),
        () => query().is("product_details->>billing_period_start", null)
          .like("product_details->>billing_cycle", `${period.billing_period_start}%`),
        () => query().is("product_details->>billing_period_start", null)
          .is("product_details->>billing_cycle", null)
          .gte("sale_date", period.billing_period_start).lt("sale_date", period.billing_period_end),
      ]
      for (const candidate of candidates) {
        const result = await candidate().order("created_at", { ascending: true }).limit(1).maybeSingle()
        if (result.error || result.data) return result
      }
      return { data: null, error: null }
    }
    const existingResult = (invoice: { id: string; status: string }) =>
      ["cancelled", "refunded"].includes(invoice.status)
        ? { error: "This period already has a cancelled or refunded invoice. Use New invoice for a replacement." }
        : { data: { id: invoice.id }, existing: true }
    const { data: existing, error: existingError } = await findExisting()
    if (existingError) return { error: "Unable to verify invoices for this period" }
    if (existing) return existingResult(existing)

    const amount = Number(subscription.amount)
    if (!Number.isFinite(amount) || amount <= 0 || amount > 999999999999) {
      return { error: "The subscription must have a valid billing amount greater than zero" }
    }
    const catalogItem = Array.isArray(subscription.catalog_item) ? subscription.catalog_item[0] : subscription.catalog_item
    const currency = catalogItem?.currency || "USD"
    if (!/^[A-Z]{3}$/.test(currency)) return { error: "The subscription plan has an invalid currency" }
    const planName = catalogItem?.name || "Subscription"
    const dueDate = getSubscriptionInvoiceDueDate(subscription.due_date, subscription.next_billing_date, billingDate)
    const { data: invoice, error: insertError } = await supabase.from("sales").insert({
      id: invoiceId,
      title: `${planName} invoice · ${billingDate}`,
      product_name: planName,
      product_type: catalogItem?.kind || "subscription",
      product_details: period,
      amount,
      amount_due: amount,
      currency,
      status: "pending",
      lead_id: subscription.lead_id,
      buyer_user_id: subscription.buyer_user_id || null,
      sale_date: billingDate,
      due_date: dueDate,
      payment_method: null,
      source: "retail",
      channel: "manual",
      site_id: siteId,
      user_id: user.id,
      subscription_id: subscriptionId,
      ...(subscription.location_id !== undefined ? { location_id: subscription.location_id } : {}),
    }).select("id").single()

    if (insertError || !invoice) {
      // An insert response can be lost after persistence; never retry with a new identity.
      const { data: recovered, error: recoveryError } = await findExisting()
      if (!recoveryError && recovered) return existingResult(recovered)
      return { error: "Unable to confirm the period invoice. Retry to check the same period." }
    }
    revalidatePath("/subscriptions")
    revalidatePath(`/subscriptions/${subscriptionId}`)
    revalidatePath("/sales")
    return { data: { id: invoice.id } }
  } catch {
    return { error: "Unable to generate the period invoice. Retry to check the same period." }
  }
}