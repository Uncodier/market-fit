export type ActivityKind = "task" | "sale"

export interface ActivityUser {
  id: string
  name: string
  email: string
  imageUrl: string | null
}

export interface ActivityLead {
  id: string
  name: string
}

export interface Activity {
  id: string
  kind: ActivityKind
  href: string
  user: ActivityUser
  action: string
  date: string
  lead: ActivityLead
  segment: string | null
  title: string
  journeyStage?: string | null
  status?: string
  description?: string | null
  campaign?: string | null
  amount?: string | null
  products?: string | null
  source?: string | null
}

export interface SaleLineInput {
  name?: string | null
  quantity?: number | null
  parent_sale_order_item_id?: string | null
}

export interface SaleOrderInput {
  id: string
  order_number?: string | null
  sale_order_items?: SaleLineInput[] | null
}

export interface SaleLeadInput {
  id: string
  name?: string | null
  email?: string | null
}

export interface SaleCampaignInput {
  id: string
  title?: string | null
}

export interface SaleInput {
  id: string
  amount?: number | string | null
  amount_due?: number | string | null
  status?: string | null
  currency?: string | null
  created_at: string
  product_name?: string | null
  source?: string | null
  campaign_id?: string | null
  lead_id?: string | null
  campaigns?: SaleCampaignInput | SaleCampaignInput[] | null
  leads?: SaleLeadInput | SaleLeadInput[] | null
  sale_orders?: SaleOrderInput | SaleOrderInput[] | null
}

export interface TaskInput {
  id: string
  title?: string | null
  description?: string | null
  type?: string | null
  status?: string | null
  completed_date?: string | null
  created_at: string
  lead_id?: string | null
  user_id?: string | null
  stage?: string | null
}

export interface TaskLeadInput {
  id: string
  name?: string | null
  email?: string | null
  segment_id?: string | null
}

const SOURCE_LABELS: Record<string, string> = {
  pos: "POS",
  shop: "Shop",
  retail: "Retail",
  online: "Online",
  marketplace: "Marketplace",
  quote: "Quote",
  sales: "Sales",
}

const JOURNEY_STAGES: Record<string, string> = {
  awareness: "Awareness",
  consideration: "Consideration",
  decision: "Decision",
  purchase: "Purchase",
  retention: "Retention",
  referral: "Referral",
}

const PRODUCT_PREVIEW_LIMIT = 2

export function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export function unwrapMany<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

export function formatAmount(amount: number | string | null | undefined, currency = "USD"): string {
  const numeric =
    typeof amount === "number" ? amount : parseFloat(String(amount ?? "").replace(/[^0-9.-]+/g, ""))
  if (amount == null || !Number.isFinite(numeric)) return "$0"
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 0,
    }).format(numeric)
  } catch {
    return `$${Math.round(numeric).toLocaleString("en-US")}`
  }
}

export function formatProductList(
  lines: SaleLineInput[] | null | undefined,
  fallbackName?: string | null,
): string | null {
  const products = (lines ?? []).filter((line) => !line.parent_sale_order_item_id && line.name)
  if (products.length === 0) {
    const fallback = fallbackName?.trim()
    return fallback || null
  }

  const labels = products.map((line) => {
    const qty = Number(line.quantity) || 1
    const name = String(line.name).trim()
    return qty > 1 ? `${name} ×${qty}` : name
  })

  if (labels.length <= PRODUCT_PREVIEW_LIMIT) return labels.join(", ")
  const extra = labels.length - PRODUCT_PREVIEW_LIMIT
  return `${labels.slice(0, PRODUCT_PREVIEW_LIMIT).join(", ")} +${extra} more`
}

export function sourceLabel(source?: string | null): string | null {
  if (!source) return null
  return SOURCE_LABELS[source.toLowerCase()] || source
}

export function mapSaleToActivity(
  sale: SaleInput,
  campaignTitle?: string | null,
): Activity {
  const lead = unwrapOne(sale.leads)
  const order = unwrapOne(sale.sale_orders)
  const lines = unwrapMany(order?.sale_order_items)
  const campaign = campaignTitle?.trim() || unwrapOne(sale.campaigns)?.title?.trim() || null
  const products = formatProductList(lines, sale.product_name)
  const amount = formatAmount(sale.amount, sale.currency || "USD")
  const source = sourceLabel(sale.source)
  const customer = lead?.name?.trim() || "A customer"

  let action: string
  let description: string
  if (campaign) {
    action = `${campaign} sold ${amount}`
    description = products ? `${customer} bought ${products}` : customer
  } else {
    action = products ? `${customer} bought ${products}` : `${customer} purchased ${amount}`
    description = source ? `${amount} · ${source}` : amount
  }

  const href = order?.id
    ? `/orders/${order.id}`
    : lead?.id
      ? `/leads/${lead.id}`
      : "/orders"

  return {
    id: `sale:${sale.id}`,
    kind: "sale",
    href,
    user: {
      id: lead?.id || sale.id,
      name: customer,
      email: lead?.email || "unknown@example.com",
      imageUrl: null,
    },
    action,
    date: sale.created_at,
    lead: {
      id: lead?.id || "",
      name: customer,
    },
    segment: null,
    title: action,
    status: "completed",
    description,
    campaign,
    amount,
    products,
    source,
  }
}

export function mapTaskToActivity(
  task: TaskInput,
  lead: TaskLeadInput,
  segmentName?: string | null,
): Activity {
  const leadName = lead.name?.trim() || "Unknown"
  const taskType = (task.type || "task").replace(/_/g, " ")
  const stage = task.stage ? JOURNEY_STAGES[task.stage] || task.stage : null

  return {
    id: `task:${task.id}`,
    kind: "task",
    href: `/control-center/${task.id}`,
    user: {
      id: task.user_id || lead.id,
      name: leadName,
      email: lead.email || "unknown@example.com",
      imageUrl: null,
    },
    action: `${taskType} task`,
    date: task.completed_date || task.created_at,
    lead: {
      id: lead.id,
      name: leadName,
    },
    segment: segmentName || null,
    title: task.title || `${taskType} task`,
    journeyStage: stage,
    status: task.status || undefined,
    description: task.description || null,
  }
}

export function mergeActivities(activities: Activity[], limit: number): Activity[] {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 6
  return [...activities]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, safeLimit)
}
