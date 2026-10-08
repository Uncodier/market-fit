import { makeLinkedOrder } from "./factories"
import type { DemoReportRow } from "./report-types"

/** Linked sample records, not precomputed KPIs. Regenerated relative to today. */
export function attachDemoOverview(input: Record<string, unknown>, now = new Date()) {
  const data = input as Record<string, DemoReportRow[]>
  const siteId = data.sites?.[0]?.id
  const item = data.catalog_items?.find(row => !row.parent_id && Number(row.target_sale_price) > 0)
  if (!siteId || !item || !data.segments?.length) return data

  const tables = ["sales", "sale_orders", "sale_order_items", "leads", "tasks", "conversations", "messages", "transactions", "campaigns"]
  const result = { ...data }
  const prefix = `${siteId}-overview-`
  for (const table of tables) {
    result[table] = (data[table] || []).filter(row => !String(row.id).includes(prefix))
  }
  result.segments = data.segments.map(segment => ({ ...segment, is_active: segment.is_active ?? true }))
  const stamp = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86_400_000).toISOString()
  const currency = item.currency || "USD"

  result.segments.forEach((segment, segmentIndex) => {
    const campaignId = `${prefix}campaign-${segmentIndex}`
    result.campaigns.push({
      id: campaignId, site_id: siteId, segment_id: segment.id,
      title: `${segment.name} sample campaign`, status: "active",
      created_at: stamp(60), updated_at: stamp(0),
      budget: { allocated: 1200, currency },
    })
    for (const [index, daysAgo] of [0, 2, 5, 9, 14, 21, 28, 35, 42, 49, 56].entries()) {
      const id = `${prefix}${segmentIndex}-${index}`
      const created = stamp(daysAgo)
      const leadId = `${id}-lead`
      const conversationId = `${id}-conversation`
      const amount = Math.round(Number(item.target_sale_price) * (1 + segmentIndex + index % 3) * 100) / 100
      const pending = index % 4 === 3
      const order = makeLinkedOrder({
        siteId, prefix: id, leadId, daysAgo, currency,
        status: pending ? "pending" : "completed", fulfillment: "none",
        source: index % 2 === 0 ? "online" : "retail", paymentStatus: pending ? "unpaid" : "paid",
        items: [{ catalogItemId: item.id, name: item.name || "Sample product", qty: 1, unitPrice: amount }],
      })
      result.leads.push({
        id: leadId, site_id: siteId, segment_id: segment.id,
        name: `Sample customer ${segmentIndex + 1}-${index + 1}`,
        email: `sample-${segmentIndex}-${index}@example.com`,
        status: pending ? "qualified" : "converted", created_at: created, updated_at: created,
      })
      result.sales.push({
        ...order.sale, segment_id: segment.id, campaign_id: campaignId,
        created_at: created, updated_at: created, sale_date: created.slice(0, 10),
        payments: pending ? [] : [{ id: `${id}-payment`, amount, currency, method: "card", status: "completed", date: created }],
      })
      result.sale_orders.push({ ...order.order, created_at: created, updated_at: created })
      result.sale_order_items.push(...order.items.map(row => ({ ...row, created_at: created })))
      result.tasks.push({
        id: `${id}-task`, site_id: siteId, lead_id: leadId, user_id: data.sites[0].user_id,
        title: `Product walkthrough with sample customer ${index + 1}`,
        type: "meeting", stage: "consideration", status: "completed",
        created_at: created, scheduled_date: created, completed_date: created,
      })
      result.conversations.push({ id: conversationId, site_id: siteId, lead_id: leadId, created_at: created })
      result.messages.push({
        id: `${id}-message`, site_id: siteId, conversation_id: conversationId,
        role: "user", content: "Thank you for the product walkthrough.", created_at: created,
      })
      result.transactions.push({
        id: `${id}-cost`, site_id: siteId, segment_id: segment.id, campaign_id: campaignId,
        description: "Sample campaign acquisition cost", type: "expense", status: "completed",
        amount: Math.round(amount * 0.2 * 100) / 100, currency,
        date: created.slice(0, 10), created_at: created, updated_at: created,
      })
    }
  })
  return result
}