"use server"

import { createClient } from "@/lib/supabase/server"
import { getTaxesByCatalogItemIds } from "@/app/catalog/tax-actions"
import { calculateOrderTaxTotal, roundMoney } from "@/app/commerce/taxes"
import { buildQuotationPdf, uint8ToBase64 } from "@/app/quotations/quotation-pdf"
import {
  buildQuotationEmailSubject,
  getSendGridConfig,
  sendQuotationEmailViaSendGrid,
} from "@/app/quotations/send-quotation-email"
import {
  formatDocumentMoney,
  resolveDocumentLocale,
} from "@/app/lib/i18n/document-t"
import { ensureQuotationPublicAccessToken } from "@/app/quotations/public-actions"
import { buildPublicQuoteUrl } from "@/app/quotations/public-token"

export async function listQuotations({
  siteId,
  status,
  q,
  page = 1,
  pageSize = 50
}: {
  siteId: string
  status?: string
  q?: string
  page?: number
  pageSize?: number
}) {
  const supabase = await createClient()

  let query = supabase
    .from('quotations')
    .select('*, lead:leads(id, name, email)', { count: 'exact' })
    .eq('site_id', siteId)

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  query = query.range(from, to).order('created_at', { ascending: false })

  const { data, count, error } = await query

  if (error) return { error: error.message }
  return { data, count }
}

export async function getQuotation(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('quotations')
    .select(`
      *,
      items:quotation_items(
        *,
        catalog_item:catalog_items(
          id, site_id, name, image_url, kind, digital_subtype, currency,
          is_recurring, is_reservation, is_dynamic_price, metadata
        )
      ),
      lead:leads(id, name, email, buyer_user_id),
      deal:deals!quotations_deal_id_fkey(id, name, amount),
      site:sites(id, name, logo_url, url)
    `)
    .eq('id', id)
    .single()
    
  if (error) return { error: error.message }
  return { data }
}

export async function updateQuotationBasics(
  id: string,
  updates: {
    leadId: string
    buyerUserId?: string | null
    dealName: string
    dealAmount?: number
  }
) {
  const supabase = await createClient()
  const { data: quote, error: quoteError } = await supabase
    .from("quotations")
    .select("id, status, deal_id")
    .eq("id", id)
    .single()

  if (quoteError || !quote) return { error: "Quotation not found" }
  if (quote.status !== "draft") {
    return { error: "Only draft quotations can be edited" }
  }

  let buyerUserId = updates.buyerUserId
  if (buyerUserId === undefined || buyerUserId === null) {
    const { data: lead } = await supabase
      .from("leads")
      .select("buyer_user_id")
      .eq("id", updates.leadId)
      .single()
    buyerUserId = updates.buyerUserId ?? lead?.buyer_user_id ?? null
  }

  const { error } = await supabase
    .from("quotations")
    .update({
      lead_id: updates.leadId,
      buyer_user_id: buyerUserId,
    })
    .eq("id", id)

  if (error) return { error: error.message }

  if (quote.deal_id) {
    const dealUpdate: { name: string; amount?: number } = {
      name: updates.dealName,
    }
    if (updates.dealAmount !== undefined) {
      dealUpdate.amount = updates.dealAmount
    }
    const { error: dealError } = await supabase
      .from("deals")
      .update(dealUpdate)
      .eq("id", quote.deal_id)
    if (dealError) return { error: dealError.message }
  }

  return getQuotation(id)
}

export async function createQuotationFromDeal(siteId: string, dealId: string, leadId: string) {
  const supabase = await createClient()
  
  // Also get lead's buyer_user_id
  const { data: lead } = await supabase.from('leads').select('buyer_user_id').eq('id', leadId).single()
  
  const { data, error } = await supabase
    .from('quotations')
    .insert({
      site_id: siteId,
      deal_id: dealId,
      lead_id: leadId,
      buyer_user_id: lead?.buyer_user_id || null,
      status: 'draft',
      valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
    })
    .select()
    .single()
    
  if (error) return { error: error.message }
  return { data }
}

export async function updateQuotationStatus(id: string, status: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('quotations')
    .update({ status })
    .eq('id', id)
    .select()
    .single()
    
  if (error) return { error: error.message }
  
  // If accepted, update the deal stage to closed_won
  if (status === 'accepted' && data.deal_id) {
    await supabase.from('deals').update({ 
      stage: 'closed_won', 
      status: 'won',
      accepted_quotation_id: data.id,
      amount: data.total
    }).eq('id', data.deal_id)
  }
  
  return { data }
}

export async function sendQuotation(id: string) {
  const supabase = await createClient()
  const { data: quote, error: quoteError } = await supabase
    .from("quotations")
    .select(`
      *,
      items:quotation_items(*),
      lead:leads(id, name, email, buyer_user_id),
      site:sites(id, name, logo_url, url)
    `)
    .eq("id", id)
    .single()

  if (quoteError || !quote) return { error: "Quotation not found" }

  if (!["draft", "sent"].includes(quote.status)) {
    return { error: "Only draft or sent quotations can be emailed" }
  }

  const awaitingAuthorization = (quote.items || []).some(
    (item: any) => item.metadata?.dynamic_quote?.status === "awaiting_authorization"
  )
  const hasProcessing = (quote.items || []).some(
    (item: any) => item.metadata?.dynamic_quote?.status === "processing"
  )
  if (awaitingAuthorization || hasProcessing) {
    return { error: "Authorize dynamic quote items before sending" }
  }

  const toEmail = quote.lead?.email?.trim()
  if (!toEmail) {
    return { error: "Client email is required to send this quote" }
  }

  const mailConfig = getSendGridConfig()
  if (!mailConfig) {
    return { error: "Email is not configured (SENDGRID_API_KEY / SENDGRID_FROM_EMAIL)" }
  }

  const { data: siteSettings } = await supabase
    .from("settings")
    .select("default_locale, locations")
    .eq("site_id", quote.site_id)
    .maybeSingle()

  const locale = resolveDocumentLocale(
    (siteSettings as { default_locale?: string } | null)?.default_locale
  )
  const locations = (siteSettings as { locations?: any[] } | null)?.locations
  const primaryLocation =
    Array.isArray(locations) && locations.length > 0 ? locations[0] : null

  const tokenRes = await ensureQuotationPublicAccessToken(id)
  if (tokenRes.error || !tokenRes.token) {
    return { error: tokenRes.error || "Failed to create public quote link" }
  }

  const buyerLink = buildPublicQuoteUrl(tokenRes.token)
  const quoteRef = quote.id.substring(0, 8)
  const currency = quote.currency || "USD"
  const totalLabel = formatDocumentMoney(Number(quote.total) || 0, currency, locale)
  const siteName = quote.site?.name || "Quote"

  const pdfBytes = await buildQuotationPdf({
    id: quote.id,
    title: quote.title,
    status: quote.status,
    currency,
    created_at: quote.created_at,
    valid_until: quote.valid_until,
    subtotal: quote.subtotal,
    tax_total: quote.tax_total,
    discount_total: quote.discount_total,
    total: quote.total,
    items: quote.items || [],
    lead: quote.lead,
    site: quote.site,
    location: primaryLocation,
    locale,
    buyerLink,
  })

  const emailResult = await sendQuotationEmailViaSendGrid({
    toEmail,
    toName: quote.lead?.name,
    fromEmail: mailConfig.fromEmail,
    fromName: mailConfig.fromName || siteName,
    subject: buildQuotationEmailSubject({ siteName, quoteRef, locale }),
    siteName,
    quoteRef,
    totalLabel,
    buyerLink,
    pdfBase64: uint8ToBase64(pdfBytes),
    pdfFilename: `quote-${quoteRef}.pdf`,
    apiKey: mailConfig.apiKey,
    locale,
  })

  if ("error" in emailResult) {
    return { error: emailResult.error }
  }

  if (quote.status === "draft") {
    const statusRes = await updateQuotationStatus(id, "sent")
    if (statusRes.error) return { error: statusRes.error }
    return { success: true, data: statusRes.data, emailed: true }
  }

  return { success: true, data: quote, emailed: true }
}

export async function deleteQuotation(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('quotations').delete().eq('id', id)
  if (error) return { error: error.message }
  return { success: true }
}

async function recalculateQuotationTotals(quotationId: string, supabase: any) {
  const { data: quotation } = await supabase
    .from('quotations')
    .select('site_id, discount_total')
    .eq('id', quotationId)
    .single();

  const { data: items } = await supabase
    .from('quotation_items')
    .select('catalog_item_id, subtotal')
    .eq('quotation_id', quotationId);

  const subtotal = (items || []).reduce(
    (acc: number, item: any) => acc + (Number(item.subtotal) || 0),
    0
  );

  let taxTotal = 0
  if (quotation?.site_id) {
    const { data: taxesByItem } = await getTaxesByCatalogItemIds(
      quotation.site_id,
      (items || []).map((item: any) => item.catalog_item_id)
    )

    taxTotal = calculateOrderTaxTotal(
      (items || []).map((item: any) => ({
        catalogItemId: item.catalog_item_id,
        subtotal: Number(item.subtotal) || 0,
      })),
      taxesByItem || {}
    )
  }

  const discountTotal = Number(quotation?.discount_total) || 0;
  const total = roundMoney(Math.max(0, subtotal - discountTotal + taxTotal));

  await supabase.from('quotations').update({
    subtotal,
    tax_total: taxTotal,
    total,
  }).eq('id', quotationId);
}

export async function addQuotationItem({
  quotationId,
  catalogItemId,
  name,
  quantity,
  unitPrice,
  metadata
}: {
  quotationId: string,
  catalogItemId: string,
  name: string,
  quantity: number,
  unitPrice: number,
  metadata?: any
}) {
  const supabase = await createClient();
  const subtotal = quantity * unitPrice;
  
  const { data, error } = await supabase.from('quotation_items').insert({
    quotation_id: quotationId,
    catalog_item_id: catalogItemId,
    name,
    quantity,
    unit_price: unitPrice,
    subtotal,
    metadata
  }).select().single();
  
  if (error) return { error: error.message };
  
  await recalculateQuotationTotals(quotationId, supabase);
  return { data };
}

export async function updateQuotationItem(id: string, updates: { quantity?: number, unitPrice?: number }) {
  const supabase = await createClient();
  
  const { data: item } = await supabase.from('quotation_items').select('*').eq('id', id).single();
  if (!item) return { error: 'Item not found' };
  
  const quantity = updates.quantity ?? item.quantity;
  const unitPrice = updates.unitPrice ?? item.unit_price;
  const subtotal = quantity * unitPrice;
  
  const { data, error } = await supabase.from('quotation_items').update({
    quantity,
    unit_price: unitPrice,
    subtotal
  }).eq('id', id).select().single();
  
  if (error) return { error: error.message };
  
  await recalculateQuotationTotals(item.quotation_id, supabase);
  return { data };
}

export async function removeQuotationItem(id: string) {
  const supabase = await createClient();
  
  const { data: item } = await supabase.from('quotation_items').select('quotation_id').eq('id', id).single();
  if (!item) return { error: 'Item not found' };
  
  const { error } = await supabase.from('quotation_items').delete().eq('id', id);
  if (error) return { error: error.message };
  
  await recalculateQuotationTotals(item.quotation_id, supabase);
  return { success: true };
}
