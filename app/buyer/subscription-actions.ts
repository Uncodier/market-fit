"use server"

import { createClient, createServiceClient } from "@/lib/supabase/server"
import { verifySiteMembership } from "./verify-site-membership"

export async function listBuyerSubscriptions({
  scope = 'personal',
  ownerSiteId,
  status,
  q,
  page = 1,
  pageSize = 50
}: {
  scope?: 'personal' | 'site'
  ownerSiteId?: string | 'personal'
  status?: string
  q?: string
  page?: number
  pageSize?: number
}) {
  const supabase = await createClient()
  
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return { error: "Not authenticated" }

  if (scope === 'site' && ownerSiteId) {
    const isMember = await verifySiteMembership(supabase, session.user.id, ownerSiteId)
    if (!isMember) return { error: "Not authorized for this site" }
  }

  // Use service client to bypass RLS on catalog_items (so non-marketplace items still render for buyers)
  const supabaseService = await createServiceClient(true)

  let query = supabaseService
    .from('subscriptions')
    .select('*, catalog_item:catalog_items(id, name, description, image_url, currency), site:site_id(id, name)', { count: 'exact' })

  if (scope === 'site' && ownerSiteId) {
    query = query.eq('owner_site_id', ownerSiteId)
  } else {
    query = query.eq('buyer_user_id', session.user.id)
    if (ownerSiteId) {
      if (ownerSiteId === 'personal') {
        query = query.is('owner_site_id', null)
      } else if (ownerSiteId !== 'all') {
        query = query.eq('owner_site_id', ownerSiteId)
      }
    }
  }

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  query = query.range(from, to).order('created_at', { ascending: false })

  const { data, count, error } = await query

  if (error) {
    console.error("Subscriptions fetch error:", error)
    return { error: error.message }
  }

  if (data && data.length > 0) {
    const subIds = data.map((s: { id: string }) => s.id)
    const { data: entitlements } = await supabaseService
      .from('entitlements')
      .select('*, catalog_item:catalog_items(id, name, digital_subtype, image_url)')
      .in('source_id', subIds)
      .eq('source_type', 'subscription')
    
    if (entitlements) {
      data.forEach((sub: { id: string; entitlements?: Array<{ source_id: string }> }) => {
        sub.entitlements = entitlements.filter((e: { source_id: string }) => e.source_id === sub.id)
      })
    }
  }

  return { data: data || [], count: count || 0 }
}

export async function cancelBuyerSubscription(subscriptionId: string) {
  const supabase = await createClient()
  
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return { error: "Not authenticated" }

  const { data: subscription, error: fetchError } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('id', subscriptionId)
    .single()

  if (fetchError || !subscription) {
    return { error: "Subscription not found" }
  }

  // Authorize
  const isOwner = subscription.buyer_user_id === session.user.id
  let isSiteMember = false
  if (!isOwner && subscription.owner_site_id) {
    isSiteMember = await verifySiteMembership(supabase, session.user.id, subscription.owner_site_id)
  }

  if (!isOwner && !isSiteMember) {
    return { error: "Not authorized to cancel this subscription" }
  }

  // Rule check
  const { canCancelSubscription } = await import('./subscription-utils')
  if (!canCancelSubscription(subscription)) {
    return { error: "Subscription cannot be cancelled at this time" }
  }

  // Cancel
  const { error: cancelError } = await supabase
    .from('subscriptions')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', subscriptionId)

  if (cancelError) {
    return { error: cancelError.message }
  }

  // Revoke entitlements
  const { revokeForSubscription } = await import('@/app/commerce/entitlements')
  await revokeForSubscription(subscriptionId, true)

  return { success: true }
}

