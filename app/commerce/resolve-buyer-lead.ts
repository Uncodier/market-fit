"use server"

import { createClient as createClientAdmin } from "@supabase/supabase-js"
import { unstable_noStore as noStore } from "next/cache"
import { isPrivateResourceId, requirePrivateCommerceSiteAccess } from "./private-site-access"

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
 * Available only to verified, unrestricted staff for a specific site.
 */
export async function resolveBuyerUserByEmail(
  email: string,
  siteId: string,
): Promise<{ data: ResolvedBuyerUser | null; error: string | null }> {
  noStore()
  try {
    const access = await requirePrivateCommerceSiteAccess(siteId)
    if (access.error) return { data: null, error: access.error }
    const trimmedEmail = typeof email === "string" ? email.trim().toLowerCase() : ""
    if (!/^[^\s@%]+@[^\s@%]+\.[^\s@%]+$/.test(trimmedEmail) || trimmedEmail.length > 254) {
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
    return { data: null, error: "Failed to lookup user" }
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
    const access = await requirePrivateCommerceSiteAccess(siteId, ["select", "insert", "update"])
    if (access.error) return { lead: null, error: access.error }
    const supabase = access.supabase
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : ""
    if (!/^[^\s@%]+@[^\s@%]+\.[^\s@%]+$/.test(normalizedEmail) || normalizedEmail.length > 254) {
      return { lead: null, error: "Please enter a valid email address" }
    }
    // A caller-provided account ID is a lookup hint, never an identity assertion.
    let verifiedBuyerUserId: string | null = null
    if (buyerUserId) {
      if (!isPrivateResourceId(buyerUserId)) return { lead: null, error: "Invalid buyer account" }
      const { data, error } = await adminClient().auth.admin.getUserById(buyerUserId)
      if (error || !data.user?.email_confirmed_at || data.user.is_anonymous ||
          data.user.email?.toLowerCase() !== normalizedEmail) {
        return { lead: null, error: "Buyer account could not be verified" }
      }
      verifiedBuyerUserId = data.user.id
    }

    const { data: existing, error: searchError } = await supabase
      .from("leads")
      .select("id, name, email, buyer_user_id")
      .eq("site_id", siteId)
      .eq("email", normalizedEmail)
      .limit(1)
      .maybeSingle()

    if (searchError) {
      return { lead: null, error: "Unable to resolve buyer" }
    }

    if (existing) {
      if (verifiedBuyerUserId && existing.buyer_user_id && existing.buyer_user_id !== verifiedBuyerUserId) {
        return { lead: null, error: "Buyer account does not match customer record" }
      }
      if (!existing.buyer_user_id && verifiedBuyerUserId) {
        const { data: updated, error: updateError } = await supabase
          .from("leads")
          .update({ buyer_user_id: verifiedBuyerUserId })
          .eq("id", existing.id)
          .eq("site_id", siteId)
          .is("buyer_user_id", null)
          .select("id, name, email, buyer_user_id")
          .single()

        if (updateError || !updated) {
          return { lead: null, error: "Unable to link buyer account" }
        }

        return {
          lead: updated,
          error: null,
        }
      }
      return { lead: existing, error: null }
    }

    // leads.user_id is the site owner (seller), not the buyer
    const { data: site, error: siteError } = await supabase
      .from("sites")
      .select("user_id")
      .eq("id", siteId)
      .single()

    if (siteError || !site?.user_id) {
      return { lead: null, error: siteError?.message || "Site owner not found" }
    }

    const { data: lead, error } = await supabase
      .from("leads")
      .insert([
        {
          site_id: siteId,
          name: name?.trim() || normalizedEmail,
          email: normalizedEmail,
          status: "new",
          origin: "inbound",
          buyer_user_id: verifiedBuyerUserId,
          user_id: site.user_id,
        },
      ])
      .select("id, name, email, buyer_user_id")
      .single()

    if (error) {
      return { lead: null, error: "Unable to create buyer" }
    }

    return { lead, error: null }
  } catch (error: any) {
    console.error("Error finding or creating buyer lead:", error)
    return {
      lead: null,
      error: "Failed to find or create lead",
    }
  }
}
