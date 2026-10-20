import type { DemoReportRow } from "./report-types"

/** Recorded demo cash movements and operating costs; never applied to real records. */
export function attachDemoFinancial(input: Record<string, unknown>, now = new Date()) {
  const data = input as Record<string, DemoReportRow[]>
  const siteId = data.sites?.[0]?.id
  if (!siteId || !data.segments?.length) return data
  const prefix = `${siteId}-financial-`
  const transactions = (data.transactions || []).filter(row => !row.id.startsWith(prefix))
  const sales: DemoReportRow[] = (data.sales || []).filter(row => !row.id.startsWith(prefix)).map(row => {
    const amount = Number(row.amount || 0)
    const due = row.amount_due == null ? row.status === "completed" ? 0 : amount : Number(row.amount_due)
    const paid = Math.max(0, Math.round((amount - due) * 100) / 100)
    const date = row.sale_date || row.created_at?.slice(0, 10)
    return { ...row, amount_due: due, payments: paid > 0 && date ? [{
      id: `${row.id}-sample-receipt`, amount: paid, currency: row.currency,
      status: "completed", method: "card", date,
    }] : [] }
  })
  const refunds = (data.accounting_sale_refunds || []).filter(row => !row.id.startsWith(prefix))
  const orders = (data.sale_orders || []).filter(row => !row.id.startsWith(prefix))
  const items = (data.sale_order_items || []).filter(row => !row.id.startsWith(prefix))
  const currency = data.settings?.[0]?.currency || data.catalog_items?.[0]?.currency || "USD"
  const categories = ["advertising", "software", "rent", "salaries"]
  data.segments.forEach((segment, segmentIndex) => {
    const campaign = data.campaigns?.find(row => row.segment_id === segment.id)
    const lead = data.leads?.find(row => row.segment_id === segment.id)
    const item = data.catalog_items?.find(row => !row.parent_id && Number(row.target_sale_price) > 0)
    for (const daysAgo of [3, 38]) {
      const created = new Date(now.getTime() - daysAgo * 86_400_000).toISOString()
      for (const status of ["partial", "cancelled", "refunded"]) {
        const saleId = `${prefix}${segmentIndex}-${daysAgo}-${status}`
        const amount = (segmentIndex + 1) * 100
        const partial = status === "partial"
        const paid = partial ? amount / 2 : amount
        sales.push({
          id: saleId, site_id: siteId, segment_id: segment.id, lead_id: lead?.id,
          campaign_id: campaign?.id, product_name: "Sample product order", currency: String(currency),
          amount, amount_due: partial ? amount - paid : 0,
          status: partial ? "pending" : status, source: "online", sale_date: created.slice(0, 10),
          created_at: created, updated_at: created,
          payments: [{ id: `${saleId}-receipt`, amount: paid, currency, status: "completed", method: "card", date: created }],
        })
        const orderId = `${saleId}-order`
        orders.push({
          id: orderId, site_id: siteId, sale_id: saleId, currency: String(currency),
          status: status === "cancelled" ? "cancelled" : partial ? "pending" : "completed",
          total: amount, created_at: created,
        })
        if (item) items.push({
          id: `${saleId}-item`, site_id: siteId, sale_order_id: orderId,
          catalog_item_id: item.id, name: item.name, quantity: 1, unit_price: amount,
          subtotal: amount, status: partial ? "new" : "completed", created_at: created,
        })
        if (!partial) refunds.push({
          id: `${saleId}-refund`, site_id: siteId, sale_id: saleId, amount, currency: String(currency),
          refunded_at: created, created_at: created,
        })
      }
    }
    for (const daysAgo of [1, 7, 14, 21, 35, 42, 49, 56]) {
      const created = new Date(now.getTime() - daysAgo * 86_400_000).toISOString()
      categories.forEach((category, categoryIndex) => transactions.push({
        id: `${prefix}${segmentIndex}-${daysAgo}-${category}`, site_id: siteId,
        segment_id: segment.id, campaign_id: campaign?.id, currency: String(currency),
        description: `Sample ${category} expense`, category,
        amount: (segmentIndex + 1) * (categoryIndex + 1) * 25,
        type: categoryIndex > 1 ? "fixed" : "variable", status: "completed",
        date: created.slice(0, 10), created_at: created, updated_at: created,
      }))
    }
  })
  return { ...data, transactions, sales, sale_orders: orders, sale_order_items: items, accounting_sale_refunds: refunds }
}