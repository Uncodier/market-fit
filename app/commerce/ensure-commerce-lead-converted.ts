import type { AttributionData } from "@/app/leads/types"

export const COMMERCE_LEAD_SOURCES = ["pos", "shop", "marketplace"] as const
export type CommerceLeadSource = (typeof COMMERCE_LEAD_SOURCES)[number]

const SOURCE_LABELS: Record<CommerceLeadSource, string> = {
  pos: "POS",
  shop: "Shop",
  marketplace: "Marketplace",
}

type QueryClient = {
  from: (table: string) => any
}

export function isCommerceLeadSource(
  source: string | null | undefined
): source is CommerceLeadSource {
  return source === "pos" || source === "shop" || source === "marketplace"
}

export function shouldAssignCommerceOrigin(
  origin: string | null | undefined
): boolean {
  if (!origin || !origin.trim()) return true
  return origin.trim().toLowerCase() === "inbound"
}

export function commerceLeadCreateFields(
  source: CommerceLeadSource,
  paid: boolean
): { status: "converted" | "new"; origin: CommerceLeadSource } {
  return {
    status: paid ? "converted" : "new",
    origin: source,
  }
}

export function commerceConversionAttribution(
  source: CommerceLeadSource,
  userId: string,
  amount?: number | null
): AttributionData {
  return {
    user_id: userId,
    user_name: SOURCE_LABELS[source],
    date: new Date().toISOString(),
    ...(amount != null ? { final_amount: amount } : {}),
    is_market_fit_influenced: false,
    notes: `Auto-converted from ${source} purchase`,
  }
}

export type JourneyTaskSpec = {
  title: string
  description: string
  status: "completed"
  stage: "awareness" | "purchase"
  type: "website_visit" | "payment"
  scheduled_date: string
  completed_date: string
  lead_id: string
  site_id: string
  user_id: string
  amount?: number | null
}

export function journeyTaskSpecs(params: {
  source: CommerceLeadSource
  paid: boolean
  siteId: string
  leadId: string
  userId: string
  leadName: string
  amount?: number | null
  now?: string
}): JourneyTaskSpec[] {
  const {
    source,
    paid,
    siteId,
    leadId,
    userId,
    leadName,
    amount,
    now = new Date().toISOString(),
  } = params
  const label = SOURCE_LABELS[source]
  const tasks: JourneyTaskSpec[] = []

  if (source === "shop" || source === "marketplace") {
    tasks.push({
      title: `Website visit: ${leadName}`,
      description: `${leadName} visited the ${label.toLowerCase()} and started checkout.`,
      status: "completed",
      stage: "awareness",
      type: "website_visit",
      scheduled_date: now,
      completed_date: now,
      lead_id: leadId,
      site_id: siteId,
      user_id: userId,
    })
  }

  if (paid) {
    tasks.push({
      title: `Purchase: ${leadName}`,
      description: `Completed ${label} purchase.`,
      status: "completed",
      stage: "purchase",
      type: "payment",
      scheduled_date: now,
      completed_date: now,
      lead_id: leadId,
      site_id: siteId,
      user_id: userId,
      ...(amount != null ? { amount } : {}),
    })
  }

  return tasks
}

export async function ensureCommerceLeadConverted(params: {
  supabase: QueryClient
  siteId: string
  leadId: string
  source: string
  userId: string
  amount?: number | null
  leadName?: string | null
  paid: boolean
}): Promise<void> {
  const { supabase, siteId, leadId, source, userId, amount, paid } = params

  if (!leadId || !userId || !isCommerceLeadSource(source)) return
  if (!paid && source === "pos") return

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id, status, name, origin")
    .eq("id", leadId)
    .single()

  if (leadError || !lead) {
    console.error("ensureCommerceLeadConverted: lead not found", leadError)
    return
  }

  const leadName = params.leadName?.trim() || lead.name || SOURCE_LABELS[source]
  const specs = journeyTaskSpecs({
    source,
    paid,
    siteId,
    leadId,
    userId,
    leadName,
    amount,
  })

  if (paid) {
    const patch: Record<string, unknown> = {}
    if (lead.status !== "converted") {
      patch.status = "converted"
      patch.attribution = commerceConversionAttribution(source, userId, amount)
    }
    if (shouldAssignCommerceOrigin(lead.origin)) {
      patch.origin = source
    }
    if (Object.keys(patch).length > 0) {
      const { error: updateError } = await supabase
        .from("leads")
        .update(patch)
        .eq("id", leadId)

      if (updateError) {
        console.error("ensureCommerceLeadConverted: failed to convert lead", updateError)
      }
    }
  }

  if (specs.length === 0) return

  const neededTypes = [...new Set(specs.map((s) => s.type))]
  const { data: existingTasks, error: tasksError } = await supabase
    .from("tasks")
    .select("type")
    .eq("lead_id", leadId)
    .eq("site_id", siteId)
    .in("type", neededTypes)

  if (tasksError) {
    console.error("ensureCommerceLeadConverted: failed to load tasks", tasksError)
    return
  }

  const existingTypes = new Set(
    (existingTasks || []).map((task: { type: string }) => task.type)
  )
  const toInsert = specs.filter((spec) => !existingTypes.has(spec.type))

  if (toInsert.length === 0) return

  const { error: insertError } = await supabase.from("tasks").insert(toInsert)
  if (insertError) {
    console.error("ensureCommerceLeadConverted: failed to insert tasks", insertError)
  }
}
