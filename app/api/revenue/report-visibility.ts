import type { createClient } from "@/lib/supabase/server"

export class SalesReportVisibilityError extends Error {
  constructor() {
    super("This report requires access to all linked sales and orders. Ask a site manager to review your record visibility.")
  }
}

/** RLS may hide another assignee's cancelled order even when its sale is visible. */
export async function requireSalesReportVisibility(
  client: Pick<Awaited<ReturnType<typeof createClient>>, "from">, siteId: string, userId: string,
) {
  const [owner, ownership] = await Promise.all([
    client.from("sites").select("id").eq("id", siteId).eq("user_id", userId).maybeSingle(),
    client.from("site_ownership").select("site_id").eq("site_id", siteId).eq("user_id", userId).maybeSingle(),
  ])
  if ((!owner.error && owner.data) || (!ownership.error && ownership.data)) return
  if (owner.error || ownership.error) throw new Error("Unable to verify sales report visibility")
  const member = await client.from("site_members").select("restrict_to_assigned_only")
    .eq("site_id", siteId).eq("user_id", userId).eq("status", "active").maybeSingle()
  if (member.error) throw new Error("Unable to verify sales report visibility")
  if (!member.data || member.data.restrict_to_assigned_only !== false) throw new SalesReportVisibilityError()
}