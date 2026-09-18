import type {
  CheckoutSource,
  CheckoutSupabaseClient,
} from "./checkout-types"

type ResolveCheckoutAttributionParams = {
  supabaseAdmin: CheckoutSupabaseClient
  siteId: string
  source: CheckoutSource
  authenticatedUserId: string | null
  sellerUserId?: string | null
  requestedByLeadId?: string | null
}

export type CheckoutAttribution = {
  createdByUserId: string | null
  sellerUserId: string | null
  requestedByLeadId: string | null
}

async function isActiveSiteEmployee(
  supabaseAdmin: CheckoutSupabaseClient,
  siteId: string,
  userId: string,
) {
  const [{ data: site }, { data: membership }] = await Promise.all([
    supabaseAdmin
      .from("sites")
      .select("user_id")
      .eq("id", siteId)
      .maybeSingle(),
    supabaseAdmin
      .from("site_members")
      .select("id")
      .eq("site_id", siteId)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle(),
  ])

  return site?.user_id === userId || Boolean(membership)
}

export async function resolveCheckoutAttribution(
  params: ResolveCheckoutAttributionParams,
): Promise<CheckoutAttribution> {
  const {
    supabaseAdmin,
    siteId,
    source,
    authenticatedUserId,
    requestedByLeadId,
  } = params

  if (source !== "pos") {
    return {
      createdByUserId: authenticatedUserId,
      sellerUserId: null,
      requestedByLeadId: requestedByLeadId || null,
    }
  }

  if (!authenticatedUserId) {
    throw new Error("Authentication is required for POS checkout")
  }
  if (
    !(await isActiveSiteEmployee(
      supabaseAdmin,
      siteId,
      authenticatedUserId,
    ))
  ) {
    throw new Error("You do not have access to this point of sale")
  }

  const selectedSellerUserId =
    params.sellerUserId?.trim() || authenticatedUserId
  if (
    !(await isActiveSiteEmployee(
      supabaseAdmin,
      siteId,
      selectedSellerUserId,
    ))
  ) {
    throw new Error("Selected seller is not an active site member")
  }

  return {
    createdByUserId: authenticatedUserId,
    sellerUserId: selectedSellerUserId,
    requestedByLeadId: requestedByLeadId || null,
  }
}
