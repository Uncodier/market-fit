"use server"

import { createClient, createServiceClient } from "@/lib/supabase/server"
import {
  assertQuotationRejectable,
  isQuotationExpired,
} from "@/app/quotations/quote-checkout"
import {
  generateQuotationPublicToken,
  isValidQuotationPublicToken,
} from "@/app/quotations/public-token"

const QUOTE_SELECT = `
  *,
  items:quotation_items(
    *,
    catalog_item:catalog_items(
      id, site_id, name, image_url, kind, digital_subtype, currency,
      is_recurring, is_reservation, is_dynamic_price, metadata
    )
  ),
  lead:leads(id, name, email, buyer_user_id),
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
  const { data: quote, error } = await supabase
    .from("quotations")
    .select("id, public_access_token")
    .eq("id", quotationId)
    .single()

  if (error || !quote) {
    return {
      error:
        publicTokenSchemaError(error?.message) ||
        error?.message ||
        "Quotation not found",
    }
  }

  if (quote.public_access_token && isValidQuotationPublicToken(quote.public_access_token)) {
    return { token: quote.public_access_token as string }
  }

  const token = generateQuotationPublicToken()
  const { data: updated, error: updateError } = await supabase
    .from("quotations")
    .update({ public_access_token: token })
    .eq("id", quotationId)
    .select("public_access_token")
    .single()

  if (updateError || !updated?.public_access_token) {
    return {
      error:
        publicTokenSchemaError(updateError?.message) ||
        updateError?.message ||
        "Failed to create public link",
    }
  }

  return { token: updated.public_access_token as string }
}

export async function getQuotationByPublicToken(token: string) {
  if (!isValidQuotationPublicToken(token)) {
    return { error: "Invalid quote link" }
  }

  const supabaseAdmin = await createServiceClient(true)
  const { data, error } = await supabaseAdmin
    .from("quotations")
    .select(QUOTE_SELECT)
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

  return { data }
}

export async function rejectQuotationByPublicToken(token: string) {
  if (!isValidQuotationPublicToken(token)) {
    return { error: "Invalid quote link" }
  }

  const supabaseAdmin = await createServiceClient(true)
  const { data: quote, error } = await supabaseAdmin
    .from("quotations")
    .select("id, status, valid_until, buyer_user_id, public_access_token")
    .eq("public_access_token", token)
    .single()

  if (error || !quote) {
    return {
      error:
        publicTokenSchemaError(error?.message) ||
        "Quotation not found",
    }
  }

  const gate = assertQuotationRejectable(quote, { publicAccess: true })
  if (!gate.ok) return { error: gate.error }

  const { error: updateError } = await supabaseAdmin
    .from("quotations")
    .update({ status: "rejected" })
    .eq("id", quote.id)

  if (updateError) return { error: updateError.message }
  return { success: true }
}

export async function isPublicQuoteLinkExpired(token: string) {
  const res = await getQuotationByPublicToken(token)
  if (res.error || !res.data) return { error: res.error || "Not found" }
  return { expired: isQuotationExpired(res.data.valid_until) }
}
