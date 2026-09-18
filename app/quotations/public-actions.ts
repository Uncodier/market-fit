"use server"

import { createClient, createServiceClient } from "@/lib/supabase/server"
import {
  assertQuotationRejectable,
  isQuotationExpired,
} from "@/app/quotations/quote-checkout"
import {
  isValidQuotationPublicToken,
} from "@/app/quotations/public-token"
import { isPublicAccessTokenActive } from "@/app/documents/public-token"
import {
  ensurePublicAccessTokenForRecord,
  revokePublicAccessTokenForRecord,
} from "@/app/documents/public-token-store"

const PUBLIC_QUOTE_SELECT = `
  id,
  site_id,
  title,
  status,
  valid_until,
  currency,
  notes,
  subtotal,
  discount_total,
  tax_total,
  total,
  created_at,
  public_access_token_expires_at,
  public_access_token_revoked_at,
  items:quotation_items(
    catalog_item_id,
    name,
    quantity,
    unit_price,
    subtotal,
    catalog_item:catalog_items(
      name, image_url, kind, digital_subtype, currency,
      is_recurring, is_reservation, is_dynamic_price, metadata
    )
  ),
  lead:leads(name, email),
  site:sites(id, name, logo_url, url)
`

function publicTokenSchemaError(message?: string | null) {
  if (!message) return null
  if (/public_access_token/i.test(message) && /does not exist|schema cache|PGRST204|42703/i.test(message)) {
    return "Public quote links are not set up yet. Apply migration 20260810210000_quotation_public_access_token.sql"
  }
  return null
}

/** Ensure a quotation has a public_access_token; returns the token. Seller-auth required. */
export async function ensureQuotationPublicAccessToken(quotationId: string) {
  const supabase = await createClient()
  const result = await ensurePublicAccessTokenForRecord(
    supabase,
    "quotations",
    quotationId
  )
  if ("error" in result) {
    return {
      error:
        publicTokenSchemaError(result.error) ||
        result.error ||
        "Quotation not found",
    }
  }
  return result
}

export async function rotateQuotationPublicAccessToken(quotationId: string) {
  const supabase = await createClient()
  const result = await ensurePublicAccessTokenForRecord(
    supabase,
    "quotations",
    quotationId,
    { rotate: true }
  )
  if ("error" in result) {
    return {
      error:
        publicTokenSchemaError(result.error) || result.error,
    }
  }
  return result
}

export async function revokeQuotationPublicAccessToken(quotationId: string) {
  const supabase = await createClient()
  const result = await revokePublicAccessTokenForRecord(
    supabase,
    "quotations",
    quotationId
  )
  if ("error" in result) {
    return {
      error:
        publicTokenSchemaError(result.error) || result.error,
    }
  }
  return result
}

export async function getQuotationByPublicToken(token: string) {
  if (!isValidQuotationPublicToken(token)) {
    return { error: "Invalid quote link" }
  }

  const supabaseAdmin = await createServiceClient(true)
  const { data, error } = await supabaseAdmin
    .from("quotations")
    .select(PUBLIC_QUOTE_SELECT)
    .eq("public_access_token", token)
    .single()

  if (error || !data) {
    return {
      error:
        publicTokenSchemaError(error?.message) ||
        "Quotation not found",
    }
  }

  // Guests should not see draft quotes via public link
  if (data.status === "draft") {
    return { error: "This quote is not available yet" }
  }
  if (!isPublicAccessTokenActive(data)) {
    return { error: "This quote link is no longer available" }
  }

  const lead = Array.isArray(data.lead) ? data.lead[0] : data.lead
  const site = Array.isArray(data.site) ? data.site[0] : data.site
  const items = (data.items || []).map((item: any) => {
    const catalog = Array.isArray(item.catalog_item)
      ? item.catalog_item[0]
      : item.catalog_item
    const rawMetadata =
      catalog?.metadata &&
      typeof catalog.metadata === "object" &&
      !Array.isArray(catalog.metadata)
        ? catalog.metadata
        : null
    const checkoutMetadata = rawMetadata
      ? Object.fromEntries(
          [
            [
              "delivery_options",
              Array.isArray(rawMetadata.delivery_options)
                ? rawMetadata.delivery_options.filter(
                    (value: unknown) => typeof value === "string"
                  )
                : undefined,
            ],
            [
              "pickup_location_ids",
              Array.isArray(rawMetadata.pickup_location_ids)
                ? rawMetadata.pickup_location_ids.filter(
                    (value: unknown) => typeof value === "string"
                  )
                : undefined,
            ],
            [
              "payment_options",
              Array.isArray(rawMetadata.payment_options)
                ? rawMetadata.payment_options.filter(
                    (value: unknown) => typeof value === "string"
                  )
                : undefined,
            ],
            [
              "shipping_cost",
              typeof rawMetadata.shipping_cost === "number" &&
              Number.isFinite(rawMetadata.shipping_cost)
                ? rawMetadata.shipping_cost
                : undefined,
            ],
            [
              "shipping_cost_mode",
              rawMetadata.shipping_cost_mode === "extra" ||
              rawMetadata.shipping_cost_mode === "covers_order"
                ? rawMetadata.shipping_cost_mode
                : undefined,
            ],
          ].filter(([, value]) => value !== undefined)
        )
      : null

    return {
      catalog_item_id: item.catalog_item_id,
      name: item.name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      subtotal: item.subtotal,
      catalog_item: catalog
        ? {
            name: catalog.name,
            image_url: catalog.image_url ?? null,
            kind: catalog.kind,
            digital_subtype: catalog.digital_subtype ?? null,
            currency: catalog.currency,
            is_recurring: Boolean(catalog.is_recurring),
            is_reservation: Boolean(catalog.is_reservation),
            is_dynamic_price: Boolean(catalog.is_dynamic_price),
            ...(checkoutMetadata && Object.keys(checkoutMetadata).length > 0
              ? { metadata: checkoutMetadata }
              : {}),
          }
        : null,
    }
  })

  return {
    data: {
      id: data.id,
      site_id: data.site_id,
      title: data.title,
      status: data.status,
      valid_until: data.valid_until,
      currency: data.currency,
      notes: data.notes,
      subtotal: data.subtotal,
      discount_total: data.discount_total,
      tax_total: data.tax_total,
      total: data.total,
      created_at: data.created_at,
      items,
      lead: lead
        ? { name: lead.name ?? null, email: lead.email ?? null }
        : null,
      site: site
        ? {
            id: site.id,
            name: site.name ?? null,
            logo_url: site.logo_url ?? null,
            url: site.url ?? null,
          }
        : null,
    },
  }
}

export async function rejectQuotationByPublicToken(token: string) {
  if (!isValidQuotationPublicToken(token)) {
    return { error: "Invalid quote link" }
  }

  const supabaseAdmin = await createServiceClient(true)
  const { data: quote, error } = await supabaseAdmin
    .from("quotations")
    .select("id, status, valid_until, buyer_user_id, public_access_token, public_access_token_expires_at, public_access_token_revoked_at")
    .eq("public_access_token", token)
    .single()

  if (error || !quote) {
    return {
      error:
        publicTokenSchemaError(error?.message) ||
        "Quotation not found",
    }
  }
  if (!isPublicAccessTokenActive(quote)) {
    return { error: "This quote link is no longer available" }
  }

  const gate = assertQuotationRejectable(quote, { publicAccess: true })
  if (!gate.ok) return { error: gate.error }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("quotations")
    .update({ status: "rejected" })
    .eq("id", quote.id)
    .eq("public_access_token", token)
    .eq("status", quote.status)
    .is("checkout_claim_id", null)
    .is("public_access_token_revoked_at", null)
    .or(
      `public_access_token_expires_at.is.null,public_access_token_expires_at.gt.${new Date().toISOString()}`
    )
    .select("id")
    .maybeSingle()

  if (updateError) return { error: updateError.message }
  if (!updated) return { error: "Quote is no longer available" }
  return { success: true }
}

export async function isPublicQuoteLinkExpired(token: string) {
  const res = await getQuotationByPublicToken(token)
  if (res.error || !res.data) return { error: res.error || "Not found" }
  return { expired: isQuotationExpired(res.data.valid_until) }
}
