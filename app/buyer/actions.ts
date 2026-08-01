"use server"

import { createClient, createServiceClient } from "@/lib/supabase/server"

async function verifySiteMembership(supabase: any, userId: string, siteId: string) {
  const { data, error } = await supabase
    .from('sites')
    .select(`
      id,
      user_id,
      site_members (user_id, status)
    `)
    .eq('id', siteId)
    .single()
    
  if (error || !data) return false
  if (data.user_id === userId) return true
  
  const isMember = data.site_members?.some((m: any) => m.user_id === userId && m.status === 'active')
  return !!isMember
}

export async function getBuyerPortalSummary({
  scope = 'personal',
  ownerSiteId
}: {
  scope?: 'personal' | 'site'
  ownerSiteId?: string
} = {}) {
  const supabase = await createClient()
  
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return { error: "Not authenticated" }

  if (scope === 'site' && ownerSiteId) {
    const isMember = await verifySiteMembership(supabase, session.user.id, ownerSiteId)
    if (!isMember) return { error: "Not authorized for this site" }
  }

  const { completePastBuyerReservations } = await import('./reservation-actions')
  await completePastBuyerReservations(supabase, {
    buyerUserId: session.user.id,
    ownerSiteId: scope === 'site' ? ownerSiteId : undefined
  })

  const supabaseService = await createServiceClient(true)

  let ordersQ = supabaseService.from('sale_orders').select('created_at', { count: 'exact' })
  let subsQ = supabaseService.from('subscriptions').select('created_at', { count: 'exact' })
  let quotesQ = supabaseService.from('quotations').select('created_at', { count: 'exact' })
  let libQ = supabaseService.from('entitlements').select('granted_at, catalog_item:catalog_items(digital_subtype)').eq('status', 'active')
  let recentQ = supabaseService.from('sale_orders').select('id, order_number, total, status, created_at, site:site_id(name, logo_url)').order('created_at', { ascending: false }).limit(3)
  let reservationsQ = supabaseService.from('reservations')
    .select('id, start_time, end_time, status, entitlement_id, site:site_id(name), catalog_item:catalog_items(name, image_url), entitlement:entitlements(id, catalog_item:catalog_items(name, image_url))')
    .in('status', ['pending', 'confirmed'])
    .gte('end_time', new Date().toISOString())
    .order('start_time', { ascending: true })
    .limit(5)
    
  let recentReservationsQ = supabaseService.from('reservations')
    .select('id, start_time, end_time, status, entitlement_id, site:site_id(name), catalog_item:catalog_items(name, image_url), entitlement:entitlements(id, catalog_item:catalog_items(name, image_url))')
    .eq('status', 'completed')
    .order('end_time', { ascending: false })
    .limit(5)

  if (scope === 'site' && ownerSiteId) {
    ordersQ = ordersQ.eq('owner_site_id', ownerSiteId)
    subsQ = subsQ.eq('owner_site_id', ownerSiteId)
    libQ = libQ.eq('owner_site_id', ownerSiteId)
    recentQ = recentQ.eq('owner_site_id', ownerSiteId)
    reservationsQ = reservationsQ.eq('owner_site_id', ownerSiteId)
    recentReservationsQ = recentReservationsQ.eq('owner_site_id', ownerSiteId)
    // Quotes do not have owner_site_id, fallback to buyer_user_id
    quotesQ = quotesQ.eq('buyer_user_id', session.user.id)
  } else {
    ordersQ = ordersQ.eq('buyer_user_id', session.user.id)
    subsQ = subsQ.eq('buyer_user_id', session.user.id)
    quotesQ = quotesQ.eq('buyer_user_id', session.user.id)
    libQ = libQ.eq('buyer_user_id', session.user.id)
    recentQ = recentQ.eq('buyer_user_id', session.user.id)
    reservationsQ = reservationsQ.eq('buyer_user_id', session.user.id)
    recentReservationsQ = recentReservationsQ.eq('buyer_user_id', session.user.id)
  }

  const [ordersRes, subsRes, quotesRes, libraryRes, recentRes, reservationsRes, recentReservationsRes] = await Promise.all([
    ordersQ,
    subsQ,
    quotesQ,
    libQ,
    recentQ,
    reservationsQ,
    recentReservationsQ
  ])

  // Aggregate library counts by subtype
  const libraryData = libraryRes.data || []
  let courses = 0
  let tickets = 0
  let files = 0
  let passes = 0

  let newCourses = 0
  let newTickets = 0
  let newFiles = 0
  let newPasses = 0

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  libraryData.forEach(item => {
    const subtype = item.catalog_item?.digital_subtype
    const isNew = item.granted_at && new Date(item.granted_at) > sevenDaysAgo
    
    if (subtype === 'course') {
      courses++
      if (isNew) newCourses++
    }
    else if (subtype === 'ticket') {
      tickets++
      if (isNew) newTickets++
    }
    else if (subtype === 'file') {
      files++
      if (isNew) newFiles++
    }
    else if (subtype === 'pass') {
      passes++
      if (isNew) newPasses++
    }
  })

  // Check recent orders/quotes for "new" flags
  const newOrders = (ordersRes.data || []).filter((o: any) => o.created_at && new Date(o.created_at) > sevenDaysAgo).length
  const newSubs = (subsRes.data || []).filter((s: any) => s.created_at && new Date(s.created_at) > sevenDaysAgo).length
  const newQuotes = (quotesRes.data || []).filter((q: any) => q.created_at && new Date(q.created_at) > sevenDaysAgo).length

  return {
    counts: {
      orders: ordersRes.count || 0,
      subscriptions: subsRes.count || 0,
      quotes: quotesRes.count || 0,
      library: libraryData.length,
      courses,
      tickets,
      files,
      passes
    },
    newCounts: {
      orders: newOrders,
      subscriptions: newSubs,
      quotes: newQuotes,
      courses: newCourses,
      tickets: newTickets,
      files: newFiles,
      passes: newPasses
    },
    recentOrders: recentRes.data || [],
    activeReservations: reservationsRes.data || [],
    recentReservations: recentReservationsRes.data || [],
    user: session.user
  }
}

export async function getBuyerOrder(orderId: string) {
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return { error: "Not authenticated" }

  const supabaseService = await createServiceClient(true)

  const { data: order, error } = await supabaseService
    .from('sale_orders')
    .select(`
      *,
      site:site_id(id, name, logo_url),
      sale_order_items(*, catalog_item:catalog_item_id(id, name, description, image_url, kind, digital_subtype)),
      sales(status, source, amount, amount_due, payment_method, payments),
      shipments(id, status, tracking_number, carrier, estimated_delivery_at, shipped_at, delivered_at, shipping_address)
    `)
    .eq('id', orderId)
    .single()

  if (error || !order) {
    console.error("Order fetch error:", error)
    return { error: "Order not found" }
  }

  // Fetch related entitlements and reservations
  if (order.sale_order_items && order.sale_order_items.length > 0) {
    const itemIds = order.sale_order_items.map((i: any) => i.id)
    const [entRes, resRes] = await Promise.all([
      supabaseService
        .from('entitlements')
        .select('id, status, catalog_item_id, catalog_item:catalog_item_id(id, name, kind, digital_subtype)')
        .in('source_id', itemIds),
      supabaseService
        .from('reservations')
        .select('id, status, catalog_item:catalog_items(id, name)')
        .in('sale_order_item_id', itemIds)
    ])
    
    if (entRes.data) order.entitlements = entRes.data
    if (resRes.data) order.reservations = resRes.data
  }

  // Authorization check
  if (order.buyer_user_id === session.user.id) {
    // Authorized as personal buyer
    return { data: order }
  }

  if (order.owner_site_id) {
    const isMember = await verifySiteMembership(supabase, session.user.id, order.owner_site_id)
    if (isMember) {
      return { data: order }
    }
  }

  return { error: "Not authorized for this order" }
}

export async function listBuyerOrders({
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
    .from('sale_orders')
    .select('*, site:site_id(id, name, logo_url), sale_order_items(*, catalog_item:catalog_item_id(id, name, description, image_url, kind, digital_subtype, currency))', { count: 'exact' })

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

  if (q) {
    query = query.ilike('order_number', `%${q}%`)
  }

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  query = query.range(from, to).order('created_at', { ascending: false })

  const { data, count, error } = await query

  if (error) {
    console.error("Orders fetch error:", error)
    return { error: error.message }
  }
  return { data: data || [], count: count || 0 }
}

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
    const subIds = data.map(s => s.id)
    const { data: entitlements } = await supabaseService
      .from('entitlements')
      .select('*, catalog_item:catalog_items(id, name, digital_subtype, image_url)')
      .in('source_id', subIds)
      .eq('source_type', 'subscription')
    
    if (entitlements) {
      data.forEach((sub: any) => {
        sub.entitlements = entitlements.filter(e => e.source_id === sub.id)
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

export async function listBuyerQuotes({
  scope = 'personal',
  status,
  page = 1,
  pageSize = 50
}: {
  scope?: 'personal' | 'site'
  status?: string
  page?: number
  pageSize?: number
}) {
  const supabase = await createClient()
  
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return { error: "Not authenticated" }

  let query = supabase
    .from('quotations')
    .select('*, site:site_id(id, name)', { count: 'exact' })
    .eq('buyer_user_id', session.user.id)

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  query = query.range(from, to).order('created_at', { ascending: false })

  const { data, count, error } = await query

  if (error) {
    console.error("Quotes fetch error:", error)
    return { error: error.message }
  }
  return { data: data || [], count: count || 0 }
}

export async function listBuyerLibrary({
  scope = 'personal',
  ownerSiteId,
  subtype,
  page = 1,
  pageSize = 50
}: {
  scope?: 'personal' | 'site'
  ownerSiteId?: string | 'personal'
  subtype?: string
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

  let selectStr = '*, catalog_item:catalog_items(id, name, description, digital_subtype, image_url, is_marketplace_listed), site:site_id(id, name)'
  
  if (subtype && subtype !== 'all') {
    selectStr = '*, catalog_item:catalog_items!inner(id, name, description, digital_subtype, image_url, is_marketplace_listed), site:site_id(id, name)'
  }

  let query = supabase
    .from('entitlements')
    .select(selectStr, { count: 'exact' })
    .eq('status', 'active')

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

  if (subtype && subtype !== 'all') {
    query = query.eq('catalog_item.digital_subtype', subtype)
  }

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  query = query.range(from, to).order('granted_at', { ascending: false })

  const { data, count, error } = await query

  if (error) {
    console.error("Library fetch error:", error)
    return { error: error.message }
  }
  return { data: data || [], count: count || 0 }
}

export async function getUserSites() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return { error: "Not authenticated" }

  const { data, error } = await supabase
    .from('sites')
    .select(`
      id,
      name,
      site_members!inner (user_id, status)
    `)
    .eq('site_members.user_id', session.user.id)
    .eq('site_members.status', 'active')
    
  if (error) return { error: error.message }
  
  const { data: ownedSites, error: ownedError } = await supabase
    .from('sites')
    .select('id, name')
    .eq('user_id', session.user.id)
    
  let combined = [...(data || [])]
  if (ownedSites) {
    ownedSites.forEach((os: any) => {
      if (!combined.some(s => s.id === os.id)) {
        combined.push(os as any)
      }
    })
  }
  
  return { data: combined }
}
