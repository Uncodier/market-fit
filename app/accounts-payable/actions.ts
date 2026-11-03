"use server"

import { z } from "zod"
import { requirePurchaseAccess } from "@/app/purchases/purchase-access"
import { mapPurchase } from "@/app/purchases/purchase-mappers"
import type { Purchase } from "@/app/types"
import { consolidatePayables, type PayableAccount, type PayableInvoice, type PayableOrderFilter } from "./summary"

const uuid = z.string().uuid()
const scope = z.enum(["active", "cancelled"])
const invoiceFields = "id, site_id, vendor_company_id, title, amount_due, currency, status, purchase_date, due_date, created_at, updated_at, vendor:companies!vendor_company_id!inner(id, name, email)"

export async function getAccountsPayable(siteId: string, orderFilter: PayableOrderFilter = "active"):
  Promise<{ data: PayableAccount[]; error?: string }> {
  if (!uuid.safeParse(siteId).success || !scope.safeParse(orderFilter).success) {
    return { data: [], error: "Invalid accounts payable request" }
  }
  try {
    const { supabase } = await requirePurchaseAccess(siteId, "select")
    const invoices: PayableInvoice[] = []
    let cursor: string | null = null
    while (true) {
      let query = supabase.from("purchases").select(invoiceFields)
        .eq("site_id", siteId)
        .in("status", orderFilter === "cancelled" ? ["cancelled"] : ["pending", "completed"])
        .gt("amount_due", 0).order("id", { ascending: true }).range(0, 499)
      if (cursor) query = query.gt("id", cursor)
      const { data, error } = await query
      if (error) return { data: [], error: "Failed to load accounts payable" }
      const page = (data || []) as unknown as PayableInvoice[]
      if (!page.length) break
      invoices.push(...page)
      const nextCursor = page[page.length - 1].id
      if (cursor && nextCursor <= cursor) {
        return { data: [], error: "Unable to load all open bills. Please retry." }
      }
      cursor = nextCursor
    }
    return { data: consolidatePayables(invoices, siteId, orderFilter) }
  } catch {
    return { data: [], error: "Unable to access accounts payable" }
  }
}

export async function getPayableBills(siteId: string, vendorId: string,
  orderFilter: PayableOrderFilter = "active"): Promise<{ data: Purchase[]; error?: string }> {
  if (!uuid.safeParse(siteId).success || !uuid.safeParse(vendorId).success || !scope.safeParse(orderFilter).success) {
    return { data: [], error: "Invalid accounts payable request" }
  }
  try {
    const { supabase } = await requirePurchaseAccess(siteId, "select")
    const bills: Purchase[] = []
    let cursor: string | null = null
    while (true) {
      let query = supabase.from("purchases")
        .select(`${invoiceFields}, amount, payments, accounting_state, stock_received`)
        .eq("site_id", siteId).eq("vendor_company_id", vendorId)
        .in("status", orderFilter === "cancelled" ? ["cancelled"] : ["pending", "completed"])
        .gt("amount_due", 0).order("id", { ascending: true }).range(0, 499)
      if (cursor) query = query.gt("id", cursor)
      const { data, error } = await query
      if (error) return { data: [], error: "Failed to load accounts payable" }
      const page = (data || []) as unknown as PayableInvoice[]
      if (!page.length) break
      const eligible = new Set(consolidatePayables(page, siteId, orderFilter)
        .filter(account => account.vendorId === vendorId).flatMap(account => account.bills.map(bill => bill.id)))
      bills.push(...page.filter(bill => eligible.has(bill.id)).map(bill => ({
        ...mapPurchase(bill), currency: bill.currency && /^[A-Z]{3}$/.test(bill.currency) ? bill.currency : "Unknown",
      })))
      const nextCursor = page[page.length - 1].id
      if (cursor && nextCursor <= cursor) {
        return { data: [], error: "Unable to load all open bills. Please retry." }
      }
      cursor = nextCursor
    }
    return { data: bills }
  } catch {
    return { data: [], error: "Unable to access accounts payable" }
  }
}