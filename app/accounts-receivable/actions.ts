"use server"

import { z } from "zod"
import { requireAccountingAccess } from "@/app/accounting/access"
import { consolidateReceivables, type ReceivableAccount, type ReceivableInvoice, type ReceivableOrderFilter } from "./summary"

export async function getAccountsReceivable(siteId: string, orderFilter: ReceivableOrderFilter = "active"):
  Promise<{ data: ReceivableAccount[]; error?: string }> {
  if (!z.string().uuid().safeParse(siteId).success || !z.enum(["active", "cancelled"]).safeParse(orderFilter).success) {
    return { data: [], error: "Invalid accounts receivable request" }
  }
  try {
    const supabase = await requireAccountingAccess(siteId)
    const invoices: ReceivableInvoice[] = []
    let cursor: string | null = null
    // Read every visible invoice, not only Supabase's first response page.
    // Keyset pagination also avoids shifting offsets when invoices are settled.
    while (true) {
      let query = supabase.from("sales")
        .select("id, site_id, lead_id, amount_due, currency, status, sale_date, due_date, created_at, updated_at, lead:leads!inner(id, site_id, name, email, phone), orders:sale_orders!sale_orders_sale_id_fkey(site_id, status)")
        .eq("site_id", siteId).eq("lead.site_id", siteId).eq("orders.site_id", siteId)
        .in("status", ["pending", "completed"]).gt("amount_due", 0)
        .order("id", { ascending: true }).range(0, 499)
      if (cursor) query = query.gt("id", cursor)
      const { data, error } = await query
      if (error) return { data: [], error: "Failed to load accounts receivable" }
      const page = (data || []) as unknown as ReceivableInvoice[]
      if (page.length === 0) break
      invoices.push(...page)
      const nextCursor = page[page.length - 1].id
      if (cursor && nextCursor <= cursor) return { data: [], error: "Unable to load all open invoices. Please retry." }
      cursor = nextCursor
    }
    return { data: consolidateReceivables(invoices, siteId, orderFilter) }
  } catch {
    return { data: [], error: "Unable to access accounts receivable" }
  }
}