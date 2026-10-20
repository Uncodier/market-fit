import { makeLinkedOrder } from "./factories"
import type { DemoReportRow } from "./report-types"

/** Repeat purchases and inbound engagement are source records, not retention fixtures. */
export function attachDemoAnalytics(input: Record<string, unknown>, now = new Date()) {
  const data = input as Record<string, DemoReportRow[]>
  const siteId = data.sites?.[0]?.id
  const item = data.catalog_items?.find(row => row.site_id === siteId && !row.parent_id && Number(row.target_sale_price) > 0)
  if (!siteId || !item) return data
  const prefix = `${siteId}-analytics-`
  const result = { ...data }
  for (const table of ["leads", "campaigns", "sales", "sale_orders", "sale_order_items", "conversations", "messages"]) {
    result[table] = (data[table] || []).filter(row => !row.id.includes(prefix))
  }
  const stamp = (daysAgo: number) => {
    const date = new Date(now.getTime() - daysAgo * 86_400_000)
    // Today's purchases precede the latest walkthroughs in the shared activity feed.
    if (daysAgo === 0) date.setUTCHours(0, 0, 0, 0)
    return date.toISOString()
  }
  const currency = item.currency || "USD"

  for (const [segmentIndex, segment] of (data.segments || []).filter(row => row.site_id === siteId).entries()) {
    const campaignId = `${prefix}campaign-${segmentIndex}`
    result.campaigns.push({
      id: campaignId, site_id: siteId, segment_id: segment.id,
      title: `Sample retention campaign ${segmentIndex + 1}`, type: "email", status: "active",
      created_at: stamp(90), updated_at: stamp(0), budget: { allocated: 800, currency },
    })
    // Four personas per baseline: loyal, returning, one-time, and an unconverted lead.
    for (const [week, daysAgo] of [0, 2, 9, 16, 23, 30, 37, 44, 51, 58, 65, 72, 79, 86].entries()) {
      for (let persona = 0; persona < 4; persona++) {
        const id = `${prefix}${segmentIndex}-${week}-${persona}`
        const leadId = `${id}-lead`
        const conversationId = `${id}-conversation`
        result.leads.push({
          id: leadId, site_id: siteId, segment_id: segment.id, campaign_id: campaignId,
          name: `Sample cohort member ${segmentIndex + 1}-${week + 1}-${persona + 1}`,
          email: `cohort-${segmentIndex}-${week}-${persona}@example.com`,
          status: persona === 3 ? "qualified" : "converted", created_at: stamp(daysAgo), updated_at: stamp(0),
        })
        result.conversations.push({
          id: conversationId, site_id: siteId, lead_id: leadId, created_at: stamp(daysAgo),
        })
        for (let followup = 0; followup <= 3 - persona; followup++) {
          const at = daysAgo - followup * 7
          if (at < 0) continue
          result.messages.push({
            id: `${id}-message-${followup}`, conversation_id: conversationId, lead_id: leadId,
            role: followup % 2 ? "visitor" : "user", content: "I would like to continue the product discussion.",
            created_at: stamp(at),
          })
        }
        if (persona === 3) continue
        for (let purchase = 0; purchase <= 2 - persona; purchase++) {
          const at = daysAgo - purchase * 7
          if (at < 0) continue
          const created = stamp(at)
          const amount = Math.round(Number(item.target_sale_price) * (1 + segmentIndex * 0.2 + purchase * 0.1) * 100) / 100
          const order = makeLinkedOrder({
            siteId, prefix: `${id}-purchase-${purchase}`, leadId, daysAgo: at, currency,
            status: "completed", fulfillment: "none", source: "online", paymentStatus: "paid",
            items: [{ catalogItemId: item.id, name: item.name || "Sample product", qty: 1, unitPrice: amount }],
          })
          result.sales.push({
            ...order.sale, segment_id: segment.id, campaign_id: campaignId,
            created_at: created, updated_at: created, sale_date: created.slice(0, 10),
            payments: [{ amount, currency, method: "card", status: "completed", paid_at: created, date: created }],
          })
          result.sale_orders.push({ ...order.order, created_at: created, updated_at: created })
          result.sale_order_items.push(...order.items.map(row => ({ ...row, created_at: created })))
        }
      }
    }
  }
  return result
}