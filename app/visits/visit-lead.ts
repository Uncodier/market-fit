import type { createClient } from "@/lib/supabase/server"

type VisitLeadFields = {
  site_id: string
  name: string
  email: string | null
  phone?: string | null
  buyer_user_id?: string
  status: "new"
  origin?: string
}

/** Called after visit authentication; all reads and writes remain subject to RLS. */
export async function createVisitLead(
  supabase: Awaited<ReturnType<typeof createClient>>,
  fields: VisitLeadFields,
) {
  // Lead ownership belongs to the host site, not the visitor or kiosk operator.
  const { data: site, error: siteError } = await supabase
    .from("sites")
    .select("user_id")
    .eq("id", fields.site_id)
    .maybeSingle()

  if (siteError || !site?.user_id) return { error: "Could not resolve visit site owner" }

  const { data: lead, error } = await supabase
    .from("leads")
    .insert({ ...fields, user_id: site.user_id })
    .select("id, buyer_user_id, site_id")
    .single()

  if (error || !lead) return { error: "Could not create visitor record" }
  return { lead }
}