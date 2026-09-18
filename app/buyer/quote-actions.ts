"use server"

import { createClient, createServiceClient } from "@/lib/supabase/server"
import { toBuyerQuoteDto } from "@/app/buyer/quote-dto"

const BUYER_QUOTE_SELECT = `
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
  items:quotation_items(
    id,
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

export async function getBuyerQuotation(quotationId: string) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return { error: "Not authenticated" }

  const serviceClient = await createServiceClient(true)
  const { data, error } = await serviceClient
    .from("quotations")
    .select(BUYER_QUOTE_SELECT)
    .eq("id", quotationId)
    .eq("buyer_user_id", user.id)
    .single()

  if (error || !data) return { error: "Quotation not found" }
  return { data: toBuyerQuoteDto(data) }
}
