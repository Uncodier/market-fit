"use server"

import { createClient } from "@/lib/supabase/server"
import { checkoutCart } from "@/app/commerce/checkout"

export async function acceptQuotation(quotationId: string, ownerSiteId: string | null = null) {
  const supabase = await createClient()
  
  // 1. Get Quotation
  const { data: quote, error: quoteError } = await supabase
    .from('quotations')
    .select('*, items:quotation_items(*)')
    .eq('id', quotationId)
    .single()
    
  if (quoteError || !quote) return { error: "Quotation not found" }
  if (quote.status !== 'sent') return { error: "Quotation is not in sent status" }

  const { data: { session } } = await supabase.auth.getSession()
  
  // 3. Checkout - Note: Quote checkout sets source='quote' which triggers service role 
  // bypassing RLS since the buyer is acting on behalf of the quotation
  const result = await checkoutCart({
    siteId: quote.site_id,
    lines: quote.items.map((i: any) => ({
      catalogItemId: i.catalog_item_id,
      quantity: i.quantity,
      unitPriceOverride: i.unit_price // Pass the quoted price
    })),
    priceListId: quote.price_list_id,
    leadId: quote.lead_id,
    buyerUserId: session?.user?.id || quote.buyer_user_id,
    ownerSiteId: ownerSiteId,
    fulfillment: 'none',
    source: 'quote'
  })

  if (result.error) return { error: result.error }

  // 4. Update status to accepted and link to deal
  await supabase
    .from('quotations')
    .update({ status: 'accepted' })
    .eq('id', quotationId)
    
  if (quote.deal_id) {
    await supabase.from('deals').update({ 
      stage: 'closed_won', 
      status: 'won',
      accepted_quotation_id: quote.id,
      amount: quote.total,
      sales_order_id: result.saleId
    }).eq('id', quote.deal_id)
  }

  return { success: true, orderId: result.orderId }
}
