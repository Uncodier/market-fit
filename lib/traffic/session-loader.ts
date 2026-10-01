import type { TrafficSession } from "./types"

export const MAX_TRAFFIC_SESSIONS = 50_000
const PAGE_SIZE = 1_000

export const ENTRY_FIELDS = "referrer,landing_url,utm_source,utm_medium,utm_campaign"
const MEMBERSHIP_FIELDS = [
  "lead:leads!visitor_sessions_lead_id_fkey(site_id,segment:segments!leads_segment_id_fkey(id,name,site_id))",
  "visitor:visitors!visitor_sessions_visitor_id_fkey(segment:segments!visitors_segment_id_fkey(id,name,site_id))",
].join(",")

type QueryResult = { data: unknown; error: unknown }

// A narrow PostgREST boundary also lets tests model server-imposed page sizes.
export interface TrafficQuery extends PromiseLike<QueryResult> {
  select(fields: string): TrafficQuery
  eq(column: string, value: string): TrafficQuery
  gte(column: string, value: string): TrafficQuery
  lte(column: string, value: string): TrafficQuery
  gt(column: string, value: string): TrafficQuery
  order(column: string, options: { ascending: boolean }): TrafficQuery
  limit(count: number): TrafficQuery
}

export type TrafficDatabase = { from(table: "visitor_sessions"): TrafficQuery }
export type TrafficScope = { siteId: string; startDate: Date; endDate: Date }

export class TrafficSessionLimitError extends Error {
  constructor() {
    super("This report exceeds 50,000 sessions. Select a shorter date range.")
    this.name = "TrafficSessionLimitError"
  }
}

/** Load the complete authorized range, or fail; never return a capped sample. */
export async function loadTrafficSessions(
  database: TrafficDatabase,
  scope: TrafficScope,
  fields: string,
  includeMembership = false
): Promise<TrafficSession[]> {
  const sessions: TrafficSession[] = []
  let cursor: string | undefined
  const selection = `id,${fields}${includeMembership ? `,${MEMBERSHIP_FIELDS}` : ""}`

  for (;;) {
    let query = database.from("visitor_sessions")
      .select(selection)
      .eq("site_id", scope.siteId)
      .gte("created_at", scope.startDate.toISOString())
      .lte("created_at", scope.endDate.toISOString())
      .order("id", { ascending: true })
      .limit(Math.min(PAGE_SIZE, MAX_TRAFFIC_SESSIONS - sessions.length + 1))

    if (includeMembership) {
      // These are nullable to-one embeds, NOT inner joins: an unassigned or
      // cross-site relation must not remove the session from the denominator.
      // Visitors have no site_id; only their same-site segment is selected.
      query = query.eq("lead.site_id", scope.siteId)
        .eq("lead.segment.site_id", scope.siteId)
        .eq("visitor.segment.site_id", scope.siteId)
    }
    if (cursor) query = query.gt("id", cursor)

    const { data, error } = await query
    if (error || !Array.isArray(data)) throw new Error("Unable to load traffic sessions")
    if (data.length === 0) return sessions
    if (sessions.length + data.length > MAX_TRAFFIC_SESSIONS) {
      throw new TrafficSessionLimitError()
    }

    for (const row of data) {
      if (!row || typeof row.id !== "string" || !row.id || (cursor && row.id <= cursor)) {
        throw new Error("Invalid traffic session cursor")
      }
      cursor = row.id
      sessions.push(row as TrafficSession)
    }
    // A short page can be a server-side cap. Only an empty page proves EOF.
  }
}