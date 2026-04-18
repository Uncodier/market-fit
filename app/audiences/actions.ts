import { createClient } from "@/lib/supabase/client"

export type AudienceLeadRow = {
  idx?: number | null
  id: string
  audience_id: string
  /** May be missing in embedded JSON. */
  lead_id?: string | null
  page_number?: number | null
  send_status?: string | null
  sent_at?: string | null
  error?: string | null
  created_at?: string | null
}

/**
 * Paginated rows from `audience_leads` (not `leads.segment_id`).
 * DB table has no `idx` column — order by `created_at` (embedded JSON may still include `idx`).
 */
export async function getAudienceLeadsByAudienceIdPage(
  audienceId: string,
  page: number,
  pageSize: number = 1
): Promise<{ rows: AudienceLeadRow[]; total: number; error?: string }> {
  try {
    const supabase = await createClient()
    const size = Math.max(1, Math.min(50, pageSize))
    const safePage = Math.max(0, page)
    const from = safePage * size
    const to = from + size - 1

    const { data, error, count } = await supabase
      .from("audience_leads")
      .select(
        "id, audience_id, lead_id, page_number, send_status, sent_at, error, created_at",
        { count: "exact" }
      )
      .eq("audience_id", audienceId)
      .order("created_at", { ascending: true })
      .range(from, to)

    if (error) throw error

    return { rows: (data as AudienceLeadRow[]) ?? [], total: count ?? 0 }
  } catch (e) {
    console.error("getAudienceLeadsByAudienceIdPage", e)
    return {
      rows: [],
      total: 0,
      error: e instanceof Error ? e.message : "Failed to load audience_leads",
    }
  }
}
