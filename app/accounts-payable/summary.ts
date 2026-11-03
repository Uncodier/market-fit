import {
  consolidateReceivables, filterReceivables, receivableStatus, receivableTotals,
  type ReceivableAccount, type ReceivableBalance, type ReceivableFilter,
  type ReceivableOrderFilter, type ReceivableSort,
} from "@/app/accounts-receivable/summary"

export { localToday } from "@/app/accounts-receivable/summary"
export type PayableBalance = ReceivableBalance
export type PayableFilter = ReceivableFilter
export type PayableOrderFilter = ReceivableOrderFilter
export type PayableSort = ReceivableSort

export interface PayableInvoice {
  id: string
  site_id: string
  vendor_company_id: string | null
  title: string
  amount_due: number | string
  currency: string | null
  status: string
  purchase_date: string | null
  due_date: string | null
  created_at: string
  updated_at: string | null
  vendor: { id: string; name: string; email: string | null } | null
}

export interface PayableAccount extends Omit<ReceivableAccount, "leadId"> {
  vendorId: string
  bills: { id: string; title: string }[]
}

function asReceivable(account: PayableAccount): ReceivableAccount {
  return { ...account, leadId: account.vendorId }
}

export function consolidatePayables(invoices: PayableInvoice[], siteId: string,
  orderFilter: PayableOrderFilter = "active"): PayableAccount[] {
  // Companies are global. Tenant ownership comes from the purchase, not the vendor.
  const visible = invoices.filter(invoice => invoice.site_id === siteId && invoice.vendor &&
    invoice.vendor.id === invoice.vendor_company_id &&
    (orderFilter === "cancelled" ? invoice.status === "cancelled"
      : invoice.status === "pending" || invoice.status === "completed") &&
    Number.isFinite(Number(invoice.amount_due)) && Number(invoice.amount_due) > 0)
  const accounts = consolidateReceivables(visible.map(invoice => ({
    ...invoice,
    lead_id: invoice.vendor_company_id!,
    lead: { ...invoice.vendor!, site_id: siteId, phone: null },
    sale_date: invoice.purchase_date,
    // Cancelled bills are explicitly requested, never mixed with active liabilities.
    status: orderFilter === "cancelled" ? "pending" : invoice.status,
    orders: [],
  })), siteId)
  return accounts.map(({ leadId, ...account }) => ({
    ...account, name: account.name === "Unknown customer" ? "Unknown supplier" : account.name, vendorId: leadId,
    bills: Array.from(new Map(visible.filter(invoice => invoice.vendor_company_id === leadId)
      .map(invoice => [invoice.id, { id: invoice.id, title: invoice.title }])).values()),
  }))
}

export function payableStatus(account: PayableAccount, today: string) {
  return receivableStatus(asReceivable(account), today)
}

export function payableTotals(accounts: PayableAccount[]): PayableBalance[] {
  return receivableTotals(accounts.map(asReceivable))
}

export function filterPayables(accounts: PayableAccount[], filter: PayableFilter,
  query: string, sort: PayableSort, today: string): PayableAccount[] {
  const byId = new Map(accounts.map(account => [account.vendorId, account]))
  return filterReceivables(accounts.map(asReceivable), filter, query, sort, today)
    .map(account => byId.get(account.leadId)!)
}