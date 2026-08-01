"use server"

import { createClient } from "@/lib/supabase/server"
import { createClient as createClientAdmin } from "@supabase/supabase-js"
import { findOrCreateLeadForBuyer } from "./resolve-buyer-lead"

function adminClient() {
  return createClientAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const QR_PREFIX = "mf:user:"

export async function parseBuyerIdentityQr(code: string): Promise<string | null> {
  if (!code || !code.startsWith(QR_PREFIX)) return null
  return code.slice(QR_PREFIX.length).trim()
}

export type BuyerIdentityResolution = {
  user: { id: string; email: string; name: string }
  lead: { id: string; name: string; email: string; [key: string]: any }
  reservations: any[]
  tickets: any[]
  orders: any[]
}

export async function resolveBuyerIdentityForSite({
  code,
  siteId,
}: {
  code: string
  siteId: string
}): Promise<{ data: BuyerIdentityResolution | null; error: string | null }> {
  try {
    const supabase = await createClient()

    // 1. Verify active site membership
    const { data: { user: staffUser } } = await supabase.auth.getUser()
    if (!staffUser) {
      return { data: null, error: "Not authenticated" }
    }

    const { data: member, error: memberError } = await supabase
      .from("site_members")
      .select("id, role")
      .eq("site_id", siteId)
      .eq("user_id", staffUser.id)
      .eq("status", "active")
      .single()

    if (memberError || !member) {
      return { data: null, error: "You do not have permission to view this customer." }
    }

    // 2. Load auth buyer via admin client
    const buyerUserId = await parseBuyerIdentityQr(code)
    if (!buyerUserId) {
      return { data: null, error: "Invalid QR code format." }
    }

    const supabaseAdmin = adminClient()
    const { data: buyerData, error: buyerError } = await supabaseAdmin.auth.admin.getUserById(buyerUserId)
    
    if (buyerError || !buyerData?.user) {
      return { data: null, error: "Buyer account not found." }
    }

    const buyerEmail = buyerData.user.email
    if (!buyerEmail) {
      return { data: null, error: "Buyer account does not have an email." }
    }

    const buyerName = 
      buyerData.user.user_metadata?.full_name || 
      buyerData.user.user_metadata?.name || 
      buyerEmail

    // 3. Required lead step
    const { lead, error: leadError } = await findOrCreateLeadForBuyer({
      siteId,
      email: buyerEmail,
      name: buyerName,
      buyerUserId
    })

    if (leadError || !lead) {
      return { data: null, error: leadError || "Failed to find or create customer record." }
    }

    // 4. Query seller data with site_id = siteId + buyer_user_id
    // Upcoming reservations
    const { data: reservations } = await supabase
      .from("reservations")
      .select("*, catalog_item:catalog_items(id, name, image_url), entitlement:entitlements(catalog_item:catalog_items(image_url))")
      .eq("site_id", siteId)
      .eq("buyer_user_id", buyerUserId)
      .in("status", ["pending", "confirmed"])
      .gte("end_time", new Date().toISOString())
      .order("start_time", { ascending: true })

    // Active tickets/passes
    const { data: tickets } = await supabase
      .from("entitlements")
      .select("*, catalog_item:catalog_items(id, name, image_url)")
      .eq("site_id", siteId)
      .eq("buyer_user_id", buyerUserId)
      .in("type", ["ticket", "pass", "service"]) // Including service/pass/ticket
      .eq("is_active", true)

    // Recent sale orders
    const { data: orders } = await supabase
      .from("sale_orders")
      .select("*")
      .eq("site_id", siteId)
      .eq("buyer_user_id", buyerUserId)
      .order("created_at", { ascending: false })
      .limit(10)

    return {
      data: {
        user: {
          id: buyerUserId,
          email: buyerEmail,
          name: buyerName,
        },
        lead,
        reservations: reservations || [],
        tickets: tickets || [],
        orders: orders || [],
      },
      error: null
    }
  } catch (err: any) {
    console.error("resolveBuyerIdentityForSite exception:", err)
    return { data: null, error: err.message || "An unexpected error occurred." }
  }
}
