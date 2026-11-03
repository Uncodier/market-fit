import { consolidatePayables, type PayableInvoice, type PayableOrderFilter } from "@/app/accounts-payable/summary"

type DemoCompany = { id: string; name: string; email?: string | null }
type DemoBill = Omit<PayableInvoice, "vendor"> & {
  amount: number
  payments: { id: string; amount: number; date: string; method: string }[]
  accounting_state: string
  stock_received: boolean
}

/** Shared fictional bills for Bills and Accounts Payable; never written to a database. */
export function attachDemoPayables<T extends Record<string, unknown>>(data: T, now = new Date()) {
  const siteId = (data.sites as { id: string }[] | undefined)?.[0]?.id
  const companies = (data.companies as DemoCompany[] | undefined)?.slice(0, 3) || []
  if (!siteId?.startsWith("demo-") || companies.length < 3) return data
  const currency = (data.catalog_items as { currency?: string }[] | undefined)?.[0]?.currency || "USD"
  const day = (offset: number) => {
    const date = new Date(now)
    date.setDate(date.getDate() + offset)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
  }
  const definitions = [
    { vendor: 0, title: "Monthly operating supplies", amount: 1800, due: 1200, date: -12, status: "completed" },
    { vendor: 0, title: "Equipment maintenance", amount: 450, due: 450, date: 15, status: "pending" },
    { vendor: 1, title: "Professional services", amount: 2400, due: 2400, date: 10, status: "completed" },
    { vendor: 1, title: "Service renewal", amount: 650, due: 650, date: 25, status: "pending", currency: currency === "EUR" ? "USD" : "EUR" },
    { vendor: 2, title: "Office supplies", amount: 875, due: 875, date: null, status: "pending" },
    { vendor: 2, title: "Cancelled equipment order", amount: 320, due: 320, date: -5, status: "cancelled" },
    { vendor: 1, title: "Draft service estimate", amount: 900, due: 900, date: 20, status: "draft" },
    { vendor: 0, title: "Settled supplies invoice", amount: 500, due: 0, date: -20, status: "completed" },
  ]
  const bills: DemoBill[] = definitions.map((bill, index) => {
    const id = `demo-payable-${siteId}-${index + 1}`
    const paid = bill.amount - bill.due
    return {
      id, site_id: siteId, vendor_company_id: companies[bill.vendor].id, title: bill.title,
      amount: bill.amount, amount_due: bill.due, currency: bill.currency || currency, status: bill.status,
      purchase_date: day(-40 + index), due_date: bill.date === null ? null : day(bill.date),
      created_at: `${day(-40 + index)}T12:00:00Z`, updated_at: `${day(-index)}T12:00:00Z`,
      payments: paid > 0 ? [{ id: `${id}-payment`, amount: paid, date: day(-2), method: "bank_transfer" }] : [],
      accounting_state: bill.status === "draft" ? "draft" : "posted", stock_received: false,
    }
  })
  const existing = (data.purchases as { id: string }[] | undefined) || []
  const ids = new Set(bills.map(bill => bill.id))
  return { ...data, purchases: [...existing.filter(bill => !ids.has(bill.id)), ...bills] }
}

export async function loadDemoAccountsPayable(siteId: string, orderFilter: PayableOrderFilter = "active") {
  const { getDemoData, isKnownDemoSite } = await import("./index")
  if (!isKnownDemoSite(siteId) || !["active", "cancelled"].includes(orderFilter)) {
    return { data: [], error: "Invalid accounts payable request" }
  }
  const data = await getDemoData(siteId)
  if (!data) return { data: [], error: "Failed to load accounts payable" }
  const companies = new Map((data.companies as DemoCompany[]).map(company => [company.id, company]))
  const invoices = ((data.purchases || []) as DemoBill[]).map(bill => {
    const vendor = companies.get(bill.vendor_company_id || "")
    return { ...bill, vendor: vendor ? { ...vendor, email: vendor.email || null } : null }
  })
  return { data: consolidatePayables(invoices, siteId, orderFilter) }
}