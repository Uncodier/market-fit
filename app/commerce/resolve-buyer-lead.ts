"use server"

import { createClient as createClientAdmin } from "@supabase/supabase-js"
import { unstable_noStore as noStore } from "next/cache"

export type ResolvedBuyerUser = {
  userId: string
  email: string
  name: string
}

function adminClient() {
  return createClientAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * Resolve an existing platform auth user by email.
 * Uses the Auth Admin REST filter (avoids loading all users).
 */
export async function resolveBuyerUserByEmail(
  email: string
): Promise<{ data: ResolvedBuyerUser | null; error: string | null }> {
  noStore()
  try {
    const trimmedEmail = email?.trim().toLowerCase()
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      return { data: null, error: "Please enter a valid email address" }
    }

    const supabaseAdmin = adminClient()
    const perPage = 200
    const maxPages = 20

    for (let page = 1; page <= maxPages; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage,
      })

      if (error) {
        console.error("Error in resolveBuyerUserByEmail:", error)
        return { data: null, error: "Failed to lookup user" }
      }

      const user = data.users.find(
        (u) => (u.email || "").toLowerCase() === trimmedEmail
      )

      if (user?.id && user.email) {
        return {
          data: {
            userId: user.id,
            email: user.email,
            name:
              user.user_metadata?.full_name ||
              user.user_metadata?.name ||
              user.email,
          },
          error: null,
        }
      }

      if (data.users.length < perPage) break
    }

    return { data: null, error: "No platform user found with this email." }
  } catch (err: any) {
    console.error("Exception in resolveBuyerUserByEmail:", err)
    return { data: null, error: err.message || "Failed to lookup user" }
  }
}

export async function findOrCreateLeadForBuyer({
  siteId,
  email,
  name,
  buyerUserId,
}: {
  siteId: string
  email: string
  name: string
  buyerUserId?: string | null
}) {
  try {
    const supabaseAdmin = adminClient()
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      return { lead: null, error: "Please enter a valid email address" }
    }

    const { data: existing, error: searchError } = await supabaseAdmin
      .from("leads")
      .select("*")
      .eq("site_id", siteId)
      .ilike("email", normalizedEmail)
      .limit(1)
      .maybeSingle()

    if (searchError) {
      return { lead: null, error: searchError.message }
    }

    if (existing) {
      if (!existing.buyer_user_id && buyerUserId) {
        const { error: updateError } = await supabaseAdmin
          .from("leads")
          .update({ buyer_user_id: buyerUserId })
          .eq("id", existing.id)

        if (updateError) {
          return { lead: null, error: updateError.message }
        }

        return {
          lead: { ...existing, buyer_user_id: buyerUserId },
          error: null,
        }
      }
      return { lead: existing, error: null }
    }

    // leads.user_id is the site owner (seller), not the buyer
    const { data: site, error: siteError } = await supabaseAdmin
      .from("sites")
      .select("user_id")
      .eq("id", siteId)
      .single()

    if (siteError || !site?.user_id) {
      return { lead: null, error: siteError?.message || "Site owner not found" }
    }

    const { data: lead, error } = await supabaseAdmin
      .from("leads")
      .insert([
        {
          site_id: siteId,
          name: name?.trim() || normalizedEmail,
          email: normalizedEmail,
          status: "new",
          origin: "inbound",
          buyer_user_id: buyerUserId || null,
          user_id: site.user_id,
        },
      ])
      .select()
      .single()

    if (error) {
      return { lead: null, error: error.message }
    }

    return { lead, error: null }
  } catch (error: any) {
    console.error("Error finding or creating buyer lead:", error)
    return {
      lead: null,
      error: error.message || "Failed to find or create lead",
    }
  }
}
