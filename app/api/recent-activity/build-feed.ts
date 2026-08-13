import { createServiceApiClient } from "@/lib/supabase/server-client"
import {
  mapSaleToActivity,
  mapTaskToActivity,
  mergeActivities,
  unwrapMany,
  unwrapOne,
  type Activity,
  type SaleInput,
  type TaskInput,
  type TaskLeadInput,
} from "./format"

type ServiceClient = ReturnType<typeof createServiceApiClient>

export interface BuildFeedOptions {
  siteId: string
  limit?: number
  startDate?: string | null
  endDate?: string | null
}

function toStartIso(value: string): string {
  return value.includes("T") ? new Date(value).toISOString() : `${value}T00:00:00.000Z`
}

function toEndIso(value: string): string {
  return value.includes("T") ? new Date(value).toISOString() : `${value}T23:59:59.999Z`
}

function applyDateRange(query: any, startIso?: string, endIso?: string) {
  if (startIso) query = query.gte("created_at", startIso)
  if (endIso) query = query.lte("created_at", endIso)
  return query
}

async function fetchTaskActivities(
  supabase: ServiceClient,
  siteId: string,
  limit: number,
  startIso?: string,
  endIso?: string,
): Promise<Activity[]> {
  let query = supabase
    .from("tasks")
    .select("id, title, description, type, status, completed_date, created_at, lead_id, user_id, stage")
    .eq("site_id", siteId)
    .order("created_at", { ascending: false })
    .limit(limit)

  query = applyDateRange(query, startIso, endIso)

  const { data: tasksData, error } = await query
  if (error) {
    console.error("[recent-activity] Failed to fetch tasks:", error.message)
    return []
  }

  const tasks = (tasksData || []) as TaskInput[]
  if (tasks.length === 0) return []

  const leadIds = [...new Set(tasks.map((task) => task.lead_id).filter(Boolean))] as string[]
  const [leadsResult, segmentsResult] = await Promise.all([
    leadIds.length > 0
      ? supabase.from("leads").select("id, name, email, segment_id").in("id", leadIds)
      : Promise.resolve({ data: [] as TaskLeadInput[], error: null }),
    supabase.from("segments").select("id, name").eq("site_id", siteId),
  ])

  if (leadsResult.error) {
    console.error("[recent-activity] Failed to fetch task leads:", leadsResult.error.message)
  }
  if (segmentsResult.error) {
    console.error("[recent-activity] Failed to fetch segments:", segmentsResult.error.message)
  }

  const leadMap = new Map<string, TaskLeadInput>()
  for (const lead of (leadsResult.data || []) as TaskLeadInput[]) {
    leadMap.set(lead.id, lead)
  }

  const segmentMap = new Map<string, string>()
  for (const segment of segmentsResult.data || []) {
    if (segment?.id && segment?.name) segmentMap.set(segment.id, segment.name)
  }

  const activities: Activity[] = []
  for (const task of tasks) {
    const lead = task.lead_id ? leadMap.get(task.lead_id) : undefined
    if (!lead) continue
    const segmentName = lead.segment_id ? segmentMap.get(lead.segment_id) || null : null
    activities.push(mapTaskToActivity(task, lead, segmentName))
  }
  return activities
}

async function fetchCompletedSales(
  supabase: ServiceClient,
  siteId: string,
  limit: number,
  startIso?: string,
  endIso?: string,
): Promise<SaleInput[]> {
  const nestedSelect = `
      id, amount, currency, created_at, source, campaign_id, product_name, lead_id,
      leads ( id, name, email ),
      sale_orders (
        id, order_number,
        sale_order_items ( name, quantity, parent_sale_order_item_id )
      )
    `

  let nestedQuery = supabase
    .from("sales")
    .select(nestedSelect)
    .eq("site_id", siteId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(limit)
  nestedQuery = applyDateRange(nestedQuery, startIso, endIso)

  const nested = await nestedQuery
  if (!nested.error) return (nested.data || []) as SaleInput[]

  console.error("[recent-activity] Nested sales query failed, falling back:", nested.error.message)

  let flatQuery = supabase
    .from("sales")
    .select("id, amount, currency, created_at, source, campaign_id, product_name, lead_id")
    .eq("site_id", siteId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(limit)
  flatQuery = applyDateRange(flatQuery, startIso, endIso)

  const { data: salesData, error } = await flatQuery
  if (error) {
    console.error("[recent-activity] Failed to fetch sales:", error.message)
    return []
  }

  const sales = (salesData || []) as SaleInput[]
  if (sales.length === 0) return []

  const saleIds = sales.map((sale) => sale.id)
  const leadIds = [...new Set(sales.map((sale) => sale.lead_id).filter(Boolean))] as string[]

  const [ordersResult, leadsResult] = await Promise.all([
    supabase
      .from("sale_orders")
      .select("id, sale_id, order_number, sale_order_items ( name, quantity, parent_sale_order_item_id )")
      .in("sale_id", saleIds),
    leadIds.length > 0
      ? supabase.from("leads").select("id, name, email").in("id", leadIds)
      : Promise.resolve({ data: [] as { id: string; name?: string; email?: string | null }[], error: null }),
  ])

  if (ordersResult.error) {
    console.error("[recent-activity] Failed to fetch sale orders:", ordersResult.error.message)
  }
  if (leadsResult.error) {
    console.error("[recent-activity] Failed to fetch sale leads:", leadsResult.error.message)
  }

  const ordersBySale = new Map<string, SaleInput["sale_orders"]>()
  for (const order of ordersResult.data || []) {
    if (order?.sale_id) ordersBySale.set(order.sale_id, order)
  }
  const leadById = new Map<string, { id: string; name?: string; email?: string | null }>()
  for (const lead of leadsResult.data || []) {
    if (lead?.id) leadById.set(lead.id, lead)
  }

  return sales.map((sale) => ({
    ...sale,
    leads: sale.lead_id ? leadById.get(sale.lead_id) || null : null,
    sale_orders: ordersBySale.get(sale.id) || null,
  }))
}

async function fetchSaleActivities(
  supabase: ServiceClient,
  siteId: string,
  limit: number,
  startIso?: string,
  endIso?: string,
): Promise<Activity[]> {
  const sales = await fetchCompletedSales(supabase, siteId, limit, startIso, endIso)
  if (sales.length === 0) return []

  const campaignIds = [
    ...new Set(sales.map((sale) => sale.campaign_id).filter(Boolean)),
  ] as string[]

  const campaignTitles = new Map<string, string>()
  if (campaignIds.length > 0) {
    const { data: campaigns, error: campaignError } = await supabase
      .from("campaigns")
      .select("id, title")
      .in("id", campaignIds)

    if (campaignError) {
      console.error("[recent-activity] Failed to fetch campaigns:", campaignError.message)
    } else {
      for (const campaign of campaigns || []) {
        if (campaign?.id && campaign?.title) campaignTitles.set(campaign.id, campaign.title)
      }
    }
  }

  return sales.map((sale) => {
    const nestedCampaign = unwrapOne(sale.campaigns)?.title
    const title = (sale.campaign_id && campaignTitles.get(sale.campaign_id)) || nestedCampaign || null
    return mapSaleToActivity(
      {
        ...sale,
        leads: unwrapOne(sale.leads),
        sale_orders: unwrapOne(sale.sale_orders) ?? unwrapMany(sale.sale_orders)[0] ?? null,
      },
      title,
    )
  })
}

export async function buildRecentActivityFeed(
  supabase: ServiceClient,
  options: BuildFeedOptions,
): Promise<Activity[]> {
  const limit = options.limit && options.limit > 0 ? options.limit : 6
  const startIso = options.startDate ? toStartIso(options.startDate) : undefined
  const endIso = options.endDate ? toEndIso(options.endDate) : undefined

  const [tasks, sales] = await Promise.all([
    fetchTaskActivities(supabase, options.siteId, limit, startIso, endIso),
    fetchSaleActivities(supabase, options.siteId, limit, startIso, endIso),
  ])

  return mergeActivities([...tasks, ...sales], limit)
}
