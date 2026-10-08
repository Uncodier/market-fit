import { buildPerformanceSeries } from "@/lib/dashboard/performance-series"
import { isRecognizedRevenueSale } from "@/lib/sales/recognized-sale"
import { mapSaleToActivity, mapTaskToActivity, mergeActivities, type Activity } from "@/app/api/recent-activity/format"
import { demoMetric, demoReportContext, type DemoReportContext, type DemoRow } from "./report-context"

export function buildDemoOutcomes(context: DemoReportContext) {
  const { scoped, rows, inRange, period } = context
  const leads = scoped("leads")
  const conversations = scoped("conversations")
  const tasks = scoped("tasks")
  const meetings = tasks.filter(row => ["call", "meeting", "website_visit", "demo", "onboarding"].includes(row.type || "") || row.stage === "consideration")
  const sales = scoped("sales")
  const engagement = leads.map(lead => ({
    conversations: conversations.filter(row => row.lead_id === lead.id).map(conversation => ({
      messages: rows("messages").filter(row => row.conversation_id === conversation.id && row.role === "user")
        .map(row => ({ created_at: String(row.created_at) })),
    })),
  }))
  const dated = (items: DemoRow[]) => items.map(row => ({ created_at: String(row.created_at) }))
  const chartData = buildPerformanceSeries({
    start: new Date(`${period.start}T00:00:00Z`), end: new Date(`${period.end}T23:59:59.999Z`), timeZone: "UTC",
    leads: dated(leads), conversations: dated(conversations), tasks: dated(tasks), sales: dated(sales), engagement,
    meetings: meetings.map(row => ({ scheduled_date: String(row.scheduled_date) })),
  })
  const count = (items: DemoRow[], previous = false, field = "created_at") => items.filter(row =>
    typeof row[field] === "string" && inRange(row[field], previous)).length
  const engaged = (previous = false) => engagement.filter(lead => lead.conversations.some(conversation =>
    conversation.messages.some(message => inRange(message.created_at, previous)))).length
  const breakdown = (previous = false) => ({
    leadsCreated: count(leads, previous), conversations: count(conversations, previous), engagement: engaged(previous),
    tasks: count(tasks, previous), meetings: count(meetings, previous, "scheduled_date"), sales: count(sales, previous),
  })
  const current = breakdown()
  const previous = breakdown(true)
  return {
    "metrics-overview": {
      ...demoMetric(Object.values(current).reduce((a, b) => a + b, 0), Object.values(previous).reduce((a, b) => a + b, 0)),
      chartData, breakdown: current,
    },
    "leads-contacted": demoMetric(count(tasks.filter(row => row.lead_id)), count(tasks.filter(row => row.lead_id), true)),
    "leads-in-conversation": demoMetric(current.engagement, previous.engagement),
    meetings: demoMetric(current.meetings, previous.meetings),
    sales: demoMetric(current.sales, previous.sales),
  }
}

export async function loadDemoRecentActivity(params: URLSearchParams): Promise<{ activities: Activity[] }> {
  const { rows, leadMap, inRange } = await demoReportContext(params)
  const activities: Activity[] = []
  for (const task of rows("tasks")) {
    const lead = leadMap.get(task.lead_id || "")
    if (!lead || !inRange(task.completed_date || task.created_at)) continue
    const segment = rows("segments").find(row => row.id === lead.segment_id)
    activities.push(mapTaskToActivity({ ...task, id: task.id, created_at: task.created_at },
      { ...lead, id: lead.id }, segment?.name))
  }
  for (const sale of rows("sales")) {
    const orders = rows("sale_orders").filter(row => row.sale_id === sale.id)
    if (!inRange(sale.created_at) || !isRecognizedRevenueSale({ status: sale.status, order_statuses: orders.map(row => row.status || "") })) continue
    const order = orders[0]
    activities.push(mapSaleToActivity({
      ...sale, id: sale.id, created_at: sale.created_at,
      leads: leadMap.get(sale.lead_id || ""),
      sale_orders: order ? { ...order, id: order.id, sale_order_items: rows("sale_order_items").filter(row => row.sale_order_id === order.id) } : null,
    }, rows("campaigns").find(row => row.id === sale.campaign_id)?.title))
  }
  return { activities: mergeActivities(activities, Number(params.get("limit") || 6)) }
}