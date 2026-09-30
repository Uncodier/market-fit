import type { SupabaseClient } from "@supabase/supabase-js"
import {
  CohortInputError, CohortLimitError, CohortQueryError,
  type CohortEvent, type CohortLead, type CohortMessage, type CohortSale, type CohortScope,
} from "./types"

export const COHORT_MAX_ROWS = 50_000
const PAGE_SIZE = 500
const ID_BATCH_SIZE = 100
type Client = Pick<SupabaseClient, "from">
type PageResult<T> = { data: T[] | null; error: { code?: string } | null }

/** Probe past the cap and after short pages: a server row limit is not end-of-data. */
export async function readCohortPages<T extends { id: string }>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
  maxRows = COHORT_MAX_ROWS,
): Promise<T[]> {
  const rows: T[] = []
  const seen = new Set<string>()
  while (true) {
    const { data, error } = await page(rows.length, Math.min(rows.length + PAGE_SIZE - 1, maxRows))
    if (error) throw new CohortQueryError(error.code)
    if (!Array.isArray(data)) throw new CohortQueryError()
    if (!data.length) return rows
    for (const row of data) {
      if (!row.id || seen.has(row.id)) throw new CohortQueryError()
      seen.add(row.id)
    }
    rows.push(...data)
    if (rows.length > maxRows) throw new CohortLimitError("Too many cohort records. Select a shorter period or a segment.")
  }
}

export async function validateCohortSegment(client: Client, scope: CohortScope) {
  if (scope.segmentId === "all") return
  const { data, error } = await client.from("segments").select("id")
    .eq("site_id", scope.siteId).eq("id", scope.segmentId).maybeSingle()
  if (error) throw new CohortQueryError(error.code)
  if (!data) throw new CohortInputError("Invalid segment for this site")
}

export function readCohortSales(client: Client, scope: CohortScope) {
  return readCohortPages<CohortSale>((from, to) => {
    let query = client.from("sales").select("id, lead_id, created_at, status")
      .eq("site_id", scope.siteId).in("status", ["pending", "completed"])
      .gte("created_at", scope.startDate).lte("created_at", scope.observationEnd)
    if (scope.segmentId !== "all") query = query.eq("segment_id", scope.segmentId)
    return query.order("created_at", { ascending: true }).order("id", { ascending: true }).range(from, to)
  })
}

export function readCohortLeads(client: Client, scope: CohortScope) {
  return readCohortPages<CohortLead>((from, to) => {
    let query = client.from("leads").select("id, created_at")
      .eq("site_id", scope.siteId)
      .gte("created_at", scope.startDate).lte("created_at", scope.observationEnd)
    if (scope.segmentId !== "all") query = query.eq("segment_id", scope.segmentId)
    return query.order("created_at", { ascending: true }).order("id", { ascending: true }).range(from, to)
  })
}

const MISSING_ACTIVITY_SCHEMA = new Set(["42P01", "42703", "PGRST200", "PGRST204", "PGRST205"])

/** Messages lack site_id: scope through their established conversation relationship.
 * Segment membership comes from the already-filtered cohort lead IDs, not message metadata.
 * Schema: types/supabase.ts; existing inbound roles: dashboard/social-actions.ts.
 */
export async function readCohortActivity(client: Client, scope: CohortScope, leadIds: string[]) {
  const events: CohortEvent[] = []
  let rowCount = 0
  try {
    for (let i = 0; i < leadIds.length; i += ID_BATCH_SIZE) {
      const ids = leadIds.slice(i, i + ID_BATCH_SIZE)
      const messages = await readCohortPages<CohortMessage>((from, to) => client.from("messages")
        .select("id, created_at, role, lead_id, conversations!inner(site_id, lead_id)")
        .eq("conversations.site_id", scope.siteId).in("conversations.lead_id", ids)
        .in("role", ["user", "visitor"])
        .gte("created_at", scope.startDate).lte("created_at", scope.observationEnd)
        .order("created_at", { ascending: true }).order("id", { ascending: true }).range(from, to),
      COHORT_MAX_ROWS - rowCount)
      rowCount += messages.length
      const allowed = new Set(ids)
      for (const message of messages) {
        const conversation = Array.isArray(message.conversations) ? message.conversations[0] : message.conversations
        const leadId = conversation?.lead_id
        if (conversation?.site_id !== scope.siteId || !leadId || !allowed.has(leadId)) continue
        if (message.role !== "user" && message.role !== "visitor") continue
        // Never attribute a message whose explicit lead conflicts with its conversation.
        if (message.lead_id && message.lead_id !== leadId) continue
        events.push({ leadId, at: message.created_at })
      }
    }
    return { events, available: true as const }
  } catch (error) {
    if (!(error instanceof CohortQueryError) || !MISSING_ACTIVITY_SCHEMA.has(error.code ?? "")) throw error
    return {
      events: null,
      available: false as const,
      reason: "Recorded user/visitor message activity is unavailable in the current schema; retention is not inferred.",
    }
  }
}