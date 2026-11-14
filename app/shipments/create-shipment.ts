import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import type { Shipment } from '@/app/types'
import { isUnassignedShipmentLine, type ShipmentCandidate } from './shipment-line-selection'

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
  let itemIds: string[] = []
  if (params.itemIds?.length) {
    const selected = await client.from('sale_order_items')
      .select('id, shipment_id, status, metadata').eq('site_id', params.siteId)
      .eq('sale_order_id', params.saleOrderId).in('id', params.itemIds)
    if (selected.error || !selected.data || selected.data.length !== new Set(params.itemIds).size) {
      return { error: 'Shipment lines could not be verified' }
    }
    itemIds = (selected.data as ShipmentCandidate[]).filter(isUnassignedShipmentLine).map(line => line.id)
    if (!itemIds.length) return { error: 'No unassigned shipment lines are available' }
  }
  const { data, error } = await client.from('shipments').insert({
    site_id: params.siteId, sale_order_id: params.saleOrderId, sale_id: params.saleId,
    lead_id: params.leadId || null, origin_location_id: params.originLocationId,
    shipping_address: params.shippingAddress, carrier: params.carrier,
    tracking_number: params.trackingNumber, assigned_to: params.assignedTo || null,
    stripe_checkout_session_id: params.stripeCheckoutSessionId || null,
    user_id: params.userId, status: 'pending',
  }).select().single()
  if (error || !data) return { error: 'Shipment could not be created' }

  if (itemIds.length) {
    const attached = await client.from('sale_order_items').update({ shipment_id: data.id })
      .eq('site_id', params.siteId).eq('sale_order_id', params.saleOrderId).in('id', itemIds)
      .is('shipment_id', null).select('id')
    if (attached.error || attached.data?.length !== itemIds.length) {
      return { error: 'Shipment was created but line assignment could not be confirmed' }
    }
  }
  revalidatePath('/shipments')
  if (params.saleId) revalidatePath(`/sales/${params.saleId}`)
  return { data: data as Shipment }
}