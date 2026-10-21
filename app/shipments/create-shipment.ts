import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import type { Shipment } from '@/app/types'

export type CreateShipmentInput = {
  siteId: string
  saleOrderId: string
  saleId?: string
  leadId?: string
  originLocationId: string
  shippingAddress?: unknown
  carrier?: string
  trackingNumber?: string
  assignedTo?: string
  itemIds?: string[]
  userId: string
  stripeCheckoutSessionId?: string
}

/** Internal fulfillment only. The caller must already authorize this order and supply its client. */
export async function createAuthorizedShipment(client: SupabaseClient, params: CreateShipmentInput) {
  const { data, error } = await client.from('shipments').insert({
    site_id: params.siteId, sale_order_id: params.saleOrderId, sale_id: params.saleId,
    lead_id: params.leadId || null, origin_location_id: params.originLocationId,
    shipping_address: params.shippingAddress, carrier: params.carrier,
    tracking_number: params.trackingNumber, assigned_to: params.assignedTo || null,
    stripe_checkout_session_id: params.stripeCheckoutSessionId || null,
    user_id: params.userId, status: 'pending',
  }).select().single()
  if (error || !data) return { error: 'Shipment could not be created' }

  if (params.itemIds?.length) {
    const attached = await client.from('sale_order_items').update({ shipment_id: data.id })
      .eq('site_id', params.siteId).eq('sale_order_id', params.saleOrderId).in('id', params.itemIds)
    if (attached.error) return { error: 'Shipment was created but line assignment could not be confirmed' }
  }
  revalidatePath('/shipments')
  if (params.saleId) revalidatePath(`/sales/${params.saleId}`)
  return { data: data as Shipment }
}