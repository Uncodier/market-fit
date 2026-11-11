import type { SupabaseClient } from "@supabase/supabase-js"

/** Shared companies are eligible only through a readable association in this site. */
export async function getSiteCompanyIds(
  supabase: Pick<SupabaseClient, "from">,
  siteId: string,
  ids?: string[],
): Promise<string[]> {
  if (ids?.length === 0) return []
  const eligible = new Set<string>()
  for (const table of ["leads", "deals", "suppliers"]) {
    for (let offset = 0; ; offset += 200) {
      if (offset >= 10_000) throw new Error("Company association search is too large")
      let query = supabase.from(table).select("id, company_id")
        .eq("site_id", siteId).not("company_id", "is", null)
        .order("id").range(offset, offset + 199)
      if (ids) query = query.in("company_id", ids)
      const { data, error } = await query
      if (error) throw new Error("Unable to verify company association")
      for (const row of data || []) {
        if (typeof row.company_id === "string") eligible.add(row.company_id)
      }
      if (!data || data.length < 200) break
    }
  }
  return [...eligible]
}