import { createClient } from "@/lib/supabase/client"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"

export type BadgeResource = "chats" | "leads" | "tasks" | "content" | "requirements" | "campaigns"

const countFilters = {
  chats: { table: "conversations", status: "pending" },
  tasks: { table: "tasks", status: "pending" },
  content: { table: "content", status: "review" },
  requirements: { table: "requirements", status: "on-review" },
  campaigns: { table: "campaigns", status: "pending" },
} as const

function withSignal<T extends PromiseLike<unknown>>(
  query: T & { abortSignal?: (signal: AbortSignal) => T },
  signal: AbortSignal,
  isMock: boolean,
): T {
  // Installed PostgrestTransformBuilder forwards this signal to fetch. Legacy
  // demo/mock builders do not implement it; do not invent SDK cancellation there.
  return !isMock && typeof query.abortSignal === "function" ? query.abortSignal(signal) : query
}

export async function fetchBadgeCount(resource: BadgeResource, siteId: string, signal: AbortSignal): Promise<number> {
  const client = createClient() as SupabaseClient<Database> & { _isMock?: boolean }
  if (resource === "leads") {
    const query = client.from("leads").select("id, company_id").eq("site_id", siteId).eq("status", "new")
    const { data, error } = await withSignal(query, signal, !!client._isMock)
    if (error) throw error
    // Preserve distinct-company semantics on returned rows, including the existing
    // server row cap. A HEAD count of lead rows is NOT a count of unique companies.
    return new Set((data ?? []).map(lead => lead.company_id ? String(lead.company_id) : `lead_${lead.id}`)).size
  }

  if (resource === "chats") {
    // Keep the concrete table type: an SDK builder over a union of tables only
    // permits their shared columns, and is_archived belongs to conversations.
    const query = client.from("conversations").select("id", { count: "exact", head: true })
      .eq("site_id", siteId).eq("status", "pending").eq("is_archived", false)
    const { count, error } = await withSignal(query, signal, !!client._isMock)
    if (error) throw error
    return count ?? 0
  }

  const { table, status } = countFilters[resource]
  const query = client.from(table).select("id", { count: "exact", head: true }).eq("site_id", siteId).eq("status", status)
  const { count, error } = await withSignal(query, signal, !!client._isMock)
  if (error) throw error
  // These badges mean matching-row totals, not lengths of server-capped pages.
  // Exact HEAD counts intentionally fix the old truncation without downloading rows.
  return count ?? 0
}