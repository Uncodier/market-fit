import "server-only"
import { cache } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient, createServiceClient } from "@/lib/supabase/server"

export type BuyerPriceContext = {
  userId: string
  verifiedEmail: string | null
  client: SupabaseClient
  assignments: Map<string, Promise<Map<string, string>>>
}

/** Request-local only. Never cache this identity or its prices in a shared cache. */
export const getBuyerPriceContext = cache(async (): Promise<BuyerPriceContext | null> => {
  const session = await createClient(true)
  if (session._isDemo) return null
  const { data: { user }, error } = await session.auth.getUser()
  if (error && error.name !== "AuthSessionMissingError") throw new Error("Unable to verify buyer pricing identity.")
  if (!user || user.is_anonymous) return null
  // Only server-verified identity can authorize the narrow buyer-owned CRM lookup.
  const client = await createServiceClient(true, { access: "public" })
  return {
    userId: user.id,
    verifiedEmail: user.email_confirmed_at && user.email ? user.email.trim().toLowerCase() : null,
    client,
    assignments: new Map(),
  }
})

type Assignment = { site_id: string; buyer_user_id: string | null; email: string | null; default_price_list_id: string | null }

function chunks<T>(values: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(values.length / size) }, (_, index) => values.slice(index * size, (index + 1) * size))
}

async function readAssignments(context: BuyerPriceContext, sites: string[]): Promise<Map<string, string>> {
  const rows: Assignment[] = []
  for (const group of chunks(sites, 200)) {
    const load = async (email: boolean) => {
      for (let offset = 0; ; offset += 500) {
        let query = context.client.from("leads")
          .select("id, site_id, buyer_user_id, email, default_price_list_id").in("site_id", group)
        query = email ? query.is("buyer_user_id", null).ilike("email", context.verifiedEmail!.replace(/[\\%_]/g, "\\$&"))
          : query.eq("buyer_user_id", context.userId)
        const { data, error } = await query.order("id").range(offset, offset + 499)
        if (error) throw new Error("Unable to resolve buyer price lists.")
        rows.push(...(data || []))
        if (!data || data.length < 500) break
      }
    }
    await Promise.all([load(false), context.verifiedEmail ? load(true) : undefined])
  }
  const assigned = new Map<string, string>()
  const linkedBySite = new Map<string, Assignment[]>()
  const emailBySite = new Map<string, Assignment[]>()
  for (const row of rows) {
    const bucket = row.buyer_user_id === context.userId ? linkedBySite
      : !row.buyer_user_id && context.verifiedEmail && row.email?.toLowerCase() === context.verifiedEmail ? emailBySite : null
    if (bucket) bucket.set(row.site_id, [...(bucket.get(row.site_id) || []), row])
  }
  for (const site of sites) {
    const candidates = linkedBySite.get(site) || emailBySite.get(site) || []
    // Ambiguous CRM identities must not arbitrarily grant another lead's discount.
    if (candidates.length === 1 && candidates[0].default_price_list_id) {
      assigned.set(site, candidates[0].default_price_list_id)
    }
  }
  return assigned
}

export function getBuyerAssignments(context: BuyerPriceContext, siteIds: string[]): Promise<Map<string, string>> {
  const sites = [...new Set(siteIds)].sort()
  const key = sites.join(",")
  let pending = context.assignments.get(key)
  if (!pending) {
    pending = readAssignments(context, sites)
    context.assignments.set(key, pending)
  }
  return pending
}