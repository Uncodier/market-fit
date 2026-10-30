"use server"

import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUserSiteRole } from "@/lib/auth/api-site-access"
import { userCanOnSite } from "@/lib/permissions/site-access"
import {
  LEAD_COMMERCE_PAGE_SIZE,
  type LeadCommerceResult,
  type LeadCommerceRow,
} from "./commerce-types"

const scopeSchema = z.object({
  siteId: z.string().min(1).max(200),
  leadId: z.string().min(1).max(200),
  kind: z.enum(["quotations", "purchases", "payments"]),
  page: z.number().int().min(1).max(10000),
})

const paymentSchema = z.object({
  id: z.string().optional(),
  date: z.string(),
  amount: z.coerce.number().finite(),
  currency: z.string().optional(),
  method: z.string().optional(),
})

interface InvoiceRow {
  id: string
  title: string | null
  invoice_number: string | null
  currency: string | null
  payments: unknown
}

interface QuoteRow {
  id: string
  status: string
  total: number | string
  currency: string | null
  created_at: string
}

interface CustomerOrderRow extends QuoteRow {
  order_number: string | null
  sales: { amount_due: number | string | null } | { amount_due: number | string | null }[] | null
}

function withDeadline<T>(query: T, signal: AbortSignal): T {
  const abortable = query as T & { abortSignal?: (signal: AbortSignal) => T }
  return abortable.abortSignal ? abortable.abortSignal(signal) : query
}

/** Purchases here are customer orders, not the workspace's vendor bills. */
export async function getLeadCommerce(input: {
  siteId: string
  leadId: string
  kind: "quotations" | "purchases" | "payments"
  page: number
}): Promise<LeadCommerceResult> {
  const parsed = scopeSchema.safeParse(input)
  if (!parsed.success) return { error: "Invalid commerce request." }
  const { siteId, leadId, kind, page } = parsed.data
  const signal = AbortSignal.timeout(15000)
  try {
    const isDemo = siteId.startsWith("demo-")
    if (!isDemo && (!z.string().uuid().safeParse(siteId).success || !z.string().uuid().safeParse(leadId).success)) {
      return { error: "Invalid site or lead." }
    }
    const supabase = await createClient(!isDemo)
    if (isDemo) {
      if (!supabase._isDemo) return { error: "Demo commerce is unavailable." }
    } else {
      if (supabase._isDemo) return { error: "Not authorized to view commerce." }
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) return { error: "Authentication required." }
      if (!await getCurrentUserSiteRole(supabase, siteId) || !await userCanOnSite(supabase, siteId, "select")) {
        return { error: "Not authorized to view commerce." }
      }
    }
    const lead = await withDeadline(supabase.from("leads").select("id")
      .eq("site_id", siteId).eq("id", leadId), signal).maybeSingle()
    if (lead.error || !lead.data) return { error: "Lead not found or access denied." }

    const from = (page - 1) * LEAD_COMMERCE_PAGE_SIZE
    if (kind === "quotations") {
      const { data, error, count } = await withDeadline(supabase.from("quotations")
        .select("id, status, total, currency, created_at", { count: "exact" })
        .eq("site_id", siteId).eq("lead_id", leadId)
        .order("created_at", { ascending: false }).order("id", { ascending: true })
        .range(from, from + LEAD_COMMERCE_PAGE_SIZE - 1), signal)
      if (error) return { error: "Unable to load quotations. Please retry." }
      return { count: count || 0, rows: ((data || []) as QuoteRow[]).map(row => ({
        id: row.id, title: `Quote ${row.id.slice(0, 8)}`, href: `/quotations/${row.id}`,
        date: row.created_at, amount: Number(row.total), currency: row.currency || "USD", status: row.status,
      })) }
    }
    if (kind === "purchases") {
      const { data, error, count } = await withDeadline(supabase.from("sale_orders")
        .select("id, order_number, status, total, currency, created_at, sales!inner(lead_id, site_id, amount_due)", { count: "exact" })
        .eq("site_id", siteId).eq("sales.site_id", siteId).eq("sales.lead_id", leadId)
        .order("created_at", { ascending: false }).order("id", { ascending: true })
        .range(from, from + LEAD_COMMERCE_PAGE_SIZE - 1), signal)
      if (error) return { error: "Unable to load purchases. Please retry." }
      return { count: count || 0, rows: ((data || []) as CustomerOrderRow[]).map(row => {
        const invoice = Array.isArray(row.sales) ? row.sales[0] : row.sales
        return {
          id: row.id, title: row.order_number || `Order ${row.id.slice(0, 8)}`, href: `/orders/${row.id}`,
          date: row.created_at, amount: Number(row.total), currency: row.currency || "USD",
          status: row.status, amountDue: Number(invoice?.amount_due || 0),
        }
      }) }
    }

    // Read recorded allocations, not amount-minus-balance estimates. Batch all
    // visible invoices before sorting/paging receipts so older invoices are included.
    const rows: LeadCommerceRow[] = []
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await withDeadline(supabase.from("sales")
        .select("id, title, invoice_number, currency, payments")
        .eq("site_id", siteId).eq("lead_id", leadId)
        .order("id", { ascending: true }).range(offset, offset + 499), signal)
      if (error) return { error: "Unable to load payments. Please retry." }
      for (const invoice of (data || []) as InvoiceRow[]) {
        if (!Array.isArray(invoice.payments)) continue
        invoice.payments.forEach((value, index) => {
          const payment = paymentSchema.safeParse(value)
          if (!payment.success) return
          const receipt = payment.data
          rows.push({
            id: `${invoice.id}:${receipt.id || index}`,
            title: invoice.invoice_number || invoice.title || `Invoice ${invoice.id.slice(0, 8)}`,
            href: `/sales/${invoice.id}`, date: receipt.date, amount: receipt.amount,
            currency: receipt.currency || invoice.currency || "USD", status: "recorded", method: receipt.method,
          })
        })
      }
      if (!data || data.length < 500) break
    }
    rows.sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0) || a.id.localeCompare(b.id))
    return { rows: rows.slice(from, from + LEAD_COMMERCE_PAGE_SIZE), count: rows.length }
  } catch {
    return { error: signal.aborted ? "Commerce loading timed out. Please retry." : "Unable to load commerce. Please retry." }
  }
}