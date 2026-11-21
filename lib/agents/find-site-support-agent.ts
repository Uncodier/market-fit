import type { SupabaseClient } from "@supabase/supabase-js"
import { TEMPLATE_AGENT_FILTER } from "./agent-origin"

/** Direct support shortcuts address the site's original role agent, not a new
 * independent profile that happens to use the same role or display name. */
export function findSiteSupportAgent(client: SupabaseClient, siteId: string) {
  return client.from("agents").select("id, name").eq("site_id", siteId).eq("role", "Customer Support")
    .or(TEMPLATE_AGENT_FILTER).single()
}