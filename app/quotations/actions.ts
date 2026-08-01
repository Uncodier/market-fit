"use server"

import { createClient } from "@/lib/supabase/server"
import { getTaxesByCatalogItemIds } from "@/app/catalog/tax-actions"
import { calculateOrderTaxTotal, roundMoney } from "@/app/commerce/taxes"

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
    .select('*, items:quotation_items(*), lead:leads(id, name, email, buyer_user_id), site:sites(id, name, logo_url)')
    .eq('id', id)
    .single()
    
  if (error) return { error: error.message }
  return { data }
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
  return updateQuotationStatus(id, 'sent')
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
