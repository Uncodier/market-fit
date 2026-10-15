import { isOutstandingInvoice } from "@/app/subscriptions/invoice-summary"
import { isDateOnly } from "@/lib/finance/due-date"

export interface ReceivableInvoice {
  id: string
  site_id: string
  lead_id: string
  amount_due: number | string
  currency: string | null
  status: string
  sale_date: string | null
  due_date: string | null
  created_at: string
  updated_at: string | null
  lead: { id: string; site_id: string; name: string; email: string | null; phone: string | null } | null
  orders: { site_id: string; status: string }[]
}

export interface ReceivableBalance {
  currency: string
  amount: number
}

export interface ReceivableAccount {
  leadId: string
  name: string
  email: string | null
  phone: string | null
  invoiceCount: number
  balances: ReceivableBalance[]
  earliestDueDate: string | null
  oldestInvoiceDate: string | null
  createdAt: string
  updatedAt: string
}

export type ReceivableStatus = "overdue" | "current" | "no_due_date"
export type ReceivableFilter = "all" | ReceivableStatus | "cancelled_orders"
export type ReceivableOrderFilter = "active" | "cancelled"
export type ReceivableSort = "newest" | "oldest" | "updated_at"

export function consolidateReceivables(invoices: ReceivableInvoice[], siteId: string,
  orderFilter: ReceivableOrderFilter = "active"): ReceivableAccount[] {
  const accounts = new Map<string, ReceivableAccount>()
  const seen = new Set<string>()
  for (const invoice of invoices) {
    const amount = Number(invoice.amount_due)
    if (seen.has(invoice.id) || invoice.site_id !== siteId || !invoice.lead ||
      invoice.lead.site_id !== siteId || invoice.lead.id !== invoice.lead_id ||
      !isOutstandingInvoice({ status: invoice.status, amountDue: amount })) continue
    const hasCancelledOrder = invoice.orders.some(order => order.site_id === siteId && order.status === "cancelled")
    if (hasCancelledOrder !== (orderFilter === "cancelled")) continue
    seen.add(invoice.id)
    const account = accounts.get(invoice.lead_id) || {
      leadId: invoice.lead_id, name: invoice.lead.name || "Unknown customer",
      email: invoice.lead.email, phone: invoice.lead.phone, invoiceCount: 0,
      balances: [], earliestDueDate: null, oldestInvoiceDate: null,
      createdAt: invoice.created_at, updatedAt: invoice.updated_at || invoice.created_at,
    }
    // Never label missing or malformed currencies as USD or combine them with a known currency.
    const currency = invoice.currency && /^[A-Z]{3}$/.test(invoice.currency) ? invoice.currency : "Unknown"
    const balance = account.balances.find(item => item.currency === currency)
    if (balance) balance.amount += amount
    else account.balances.push({ currency, amount })
    account.invoiceCount += 1
    if (isDateOnly(invoice.due_date) && (!account.earliestDueDate || invoice.due_date < account.earliestDueDate)) {
      account.earliestDueDate = invoice.due_date
    }
    const saleDate = invoice.sale_date?.slice(0, 10)
    if (isDateOnly(saleDate) && (!account.oldestInvoiceDate || saleDate < account.oldestInvoiceDate)) {
      account.oldestInvoiceDate = saleDate
    }
    if (invoice.created_at > account.createdAt) account.createdAt = invoice.created_at
    const updatedAt = invoice.updated_at || invoice.created_at
    if (updatedAt > account.updatedAt) account.updatedAt = updatedAt
    accounts.set(account.leadId, account)
  }
  return Array.from(accounts.values())
}

export function receivableStatus(account: ReceivableAccount, today: string): ReceivableStatus {
  if (!account.earliestDueDate) return "no_due_date"
  return account.earliestDueDate < today ? "overdue" : "current"
}

export function receivableTotals(accounts: ReceivableAccount[]): ReceivableBalance[] {
  const totals = new Map<string, number>()
  for (const account of accounts) {
    for (const balance of account.balances) {
      totals.set(balance.currency, (totals.get(balance.currency) || 0) + balance.amount)
    }
  }
  return Array.from(totals, ([currency, amount]) => ({ currency, amount }))
}

export function filterReceivables(accounts: ReceivableAccount[], filter: ReceivableFilter,
  query: string, sort: ReceivableSort, today: string): ReceivableAccount[] {
  const search = query.trim().toLowerCase()
  return accounts.filter(account => {
    if (filter !== "all" && filter !== "cancelled_orders" && receivableStatus(account, today) !== filter) return false
    return !search || [account.name, account.email, account.phone].filter(Boolean).join(" ").toLowerCase().includes(search)
  }).sort((a, b) => {
    const field = sort === "updated_at" ? "updatedAt" : "createdAt"
    const order = a[field].localeCompare(b[field]) || a.leadId.localeCompare(b.leadId)
    return sort === "oldest" ? order : -order
  })
}

export function localToday(): string {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}