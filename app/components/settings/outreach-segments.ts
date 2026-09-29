import { createClient } from "@/lib/supabase/client"

export type OutreachSegment = { id: string; name: string }

/** Browser session + explicit site filter; RLS remains the authorization boundary. */
export async function fetchOutreachSegments(siteId: string): Promise<OutreachSegment[]> {
  const { data, error } = await createClient().from("segments")
    .select("id, name").eq("site_id", siteId).order("name", { ascending: true })
  if (error) throw new Error("Unable to load this site's segments. Please try again.")
  return data || []
}