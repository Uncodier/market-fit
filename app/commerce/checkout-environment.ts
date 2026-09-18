import { toPriceListChannel } from "@/app/price-lists/price-list-channels"
import {
  commerceLeadCreateFields,
  isCommerceLeadSource,
} from "./ensure-commerce-lead-converted"
import { isStaffReservationCheckout } from "./checkout-reservations"
import {
  CheckoutCartParams,
  CheckoutLine,
  CheckoutSource,
  CheckoutSupabaseClient,
} from "./checkout-types"

type PrepareCheckoutEnvironmentParams = {
  supabase: CheckoutSupabaseClient
  supabaseAdmin: CheckoutSupabaseClient
  siteId: string
  lines: CheckoutLine[]
  source: CheckoutSource
  inputSource: CheckoutSource
  userId?: string
  buyerUserId?: string | null
  leadId?: string
  priceListId?: string
  customerEmail?: string
  customerName?: string
  fulfillment: CheckoutCartParams["fulfillment"]
  shippingAddress?: any
  originLocationId?: string
  scheduledFor?: string
  isStaffMutation?: boolean
}

export async function prepareCheckoutEnvironment(
  params: PrepareCheckoutEnvironmentParams
) {
  const {
    supabase,
    supabaseAdmin,
    siteId,
    lines,
    source,
    inputSource,
    buyerUserId,
    customerEmail,
    customerName,
    fulfillment,
    shippingAddress,
    originLocationId,
    isStaffMutation,
  } = params
  const isAdmin = ["shop", "marketplace", "quote"].includes(source)
  const isStaffCheckout = isStaffReservationCheckout({
    source: inputSource,
    isStaffMutation,
  })
  const queryClient = isAdmin ? supabaseAdmin : supabase
  let resolvedUserId = params.userId

  const { data: settingsRow } = await supabaseAdmin
    .from("settings")
    .select("*")
    .eq("site_id", siteId)
    .maybeSingle()
  const siteSettings: any = settingsRow || {}

  if (isAdmin) {
    const { data: site } = await supabaseAdmin
      .from("sites")
      .select("user_id")
      .eq("id", siteId)
      .single()
    if (site) resolvedUserId = resolvedUserId || site.user_id
  }

  let resolvedScheduledFor = params.scheduledFor
  const { evaluateLocationRestrictions } = await import("./location-restrictions")
  if (fulfillment === "ship" && shippingAddress?.city && shippingAddress?.zip) {
    const result = evaluateLocationRestrictions(
      siteSettings.locations || [],
      shippingAddress
    )
    if (!result.available) {
      throw new Error(
        "Service is not available in the provided shipping address area."
      )
    }
  }

  const { resolveCheckoutScheduledFor } = await import("./checkout-schedule")
  resolvedScheduledFor = resolveCheckoutScheduledFor({
    source,
    scheduledFor: resolvedScheduledFor,
    businessHours: siteSettings.business_hours || [],
  })

  if (!lines.length) throw new Error("Cart is empty")
  const lineCatalogItemIds = lines.map((line) => line.catalogItemId)
  const { data: catItemsForCheck, error: itemsError } = await queryClient
    .from("catalog_items")
    .select("id, kind, is_recurring, metadata")
    .in("id", lineCatalogItemIds)
  if (itemsError) throw new Error(itemsError.message)
  if (!catItemsForCheck?.length) throw new Error("No items found")

  const hasDigitalOrRecurring = catItemsForCheck.some(
    (item: any) => item.kind === "digital_asset" || item.is_recurring
  )
  if (hasDigitalOrRecurring && !buyerUserId) {
    if (source === "pos") {
      throw new Error("Digital items require a buyer account.")
    }
    if (["shop", "marketplace", "quote"].includes(source)) {
      throw new Error(
        "You must be logged in to purchase digital assets or subscriptions."
      )
    }
  }

  const {
    getItemDeliveryOptions,
    isFulfillmentAllowed,
    intersectPickupLocationIds,
    POS_ALWAYS_ALLOWED_FULFILLMENTS,
  } = await import("./delivery-options")
  const itemsWithOptions = catItemsForCheck.map((item: any) => ({
    allowed: getItemDeliveryOptions(
      item,
      siteSettings?.shop?.default_delivery_options
    ),
  }))
  if (
    !isFulfillmentAllowed(
      fulfillment,
      itemsWithOptions,
      source === "pos" ? POS_ALWAYS_ALLOWED_FULFILLMENTS : []
    )
  ) {
    throw new Error(
      `Fulfillment method '${fulfillment}' is not allowed for the items in this cart.`
    )
  }

  const pickupLocationRestriction =
    fulfillment === "pickup"
      ? intersectPickupLocationIds(catItemsForCheck)
      : null
  if (
    fulfillment === "pickup" &&
    pickupLocationRestriction &&
    pickupLocationRestriction.length === 0
  ) {
    throw new Error("No compatible pickup locations for the items in this cart.")
  }
  if (
    fulfillment === "pickup" &&
    originLocationId &&
    pickupLocationRestriction &&
    !pickupLocationRestriction.includes(originLocationId)
  ) {
    throw new Error(
      "Selected pickup location is not available for the items in this cart."
    )
  }

  let finalOriginLocationId = originLocationId
  if (
    !finalOriginLocationId &&
    ["ship", "pickup", "dine_in"].includes(fulfillment)
  ) {
    let locationQuery = queryClient
      .from("locations")
      .select("id")
      .eq("site_id", siteId)
      .eq("is_active", true)
      .limit(1)
    if (
      fulfillment === "pickup" &&
      pickupLocationRestriction?.length
    ) {
      locationQuery = locationQuery.in("id", pickupLocationRestriction)
    }
    const { data: locations } = await locationQuery
    finalOriginLocationId = locations?.[0]?.id
  }

  let finalLeadId = params.leadId
  if (!finalLeadId && customerEmail && customerName) {
    const { data: existing } = await queryClient
      .from("leads")
      .select("id, buyer_user_id")
      .eq("site_id", siteId)
      .eq("email", customerEmail)
      .single()
    if (existing) {
      finalLeadId = existing.id
      if (buyerUserId && !existing.buyer_user_id) {
        await supabaseAdmin
          .from("leads")
          .update({ buyer_user_id: buyerUserId })
          .eq("id", existing.id)
      }
    } else {
      const createFields = isCommerceLeadSource(source)
        ? commerceLeadCreateFields(source, false)
        : { status: "new" as const }
      const { data: newLead } = await queryClient
        .from("leads")
        .insert({
          site_id: siteId,
          name: customerName,
          email: customerEmail,
          user_id: resolvedUserId,
          buyer_user_id: buyerUserId || null,
          ...createFields,
        })
        .select("id")
        .single()
      if (newLead) finalLeadId = newLead.id
    }
  }

  const priceListChannel = toPriceListChannel(source)
  let finalPriceListId = params.priceListId
  let leadCampaignId = null
  let leadSegmentId = null
  let leadCompanyId = null
  if (finalLeadId) {
    const { data: lead } = await queryClient
      .from("leads")
      .select("default_price_list_id, campaign_id, segment_id, company_id")
      .eq("id", finalLeadId)
      .single()
    if (lead) {
      if (
        !finalPriceListId &&
        lead.default_price_list_id &&
        (priceListChannel === null || priceListChannel === "pos")
      ) {
        finalPriceListId = lead.default_price_list_id
      }
      leadCampaignId = lead.campaign_id
      leadSegmentId = lead.segment_id
      leadCompanyId = lead.company_id
    }
  }

  return {
    isAdmin,
    isStaffCheckout,
    queryClient,
    siteSettings,
    resolvedUserId,
    resolvedScheduledFor,
    finalOriginLocationId,
    finalLeadId,
    finalPriceListId,
    leadCampaignId,
    leadSegmentId,
    leadCompanyId,
    priceListChannel,
  }
}
