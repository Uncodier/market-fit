import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import {
  isPublicAccessTokenActive,
  isValidPublicAccessToken,
} from '@/app/documents/public-token'
import { resolveCheckoutUrls } from '@/app/api/stripe/checkout/checkout-url-security'
import {
  checkoutIdempotencyKey,
  existingCheckoutResult,
  linkCheckoutSession,
  outstandingBalanceLineItem,
  payableAmount,
  reserveCheckoutAttempt,
  toStripeMinorAmount,
} from '@/app/api/stripe/checkout/checkout-payment-guard'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
})

export async function POST(req: Request) {
  try {
    const { orderId, publicAccessToken, returnUrl, successUrl } = await req.json()
    if (!orderId || !isValidPublicAccessToken(publicAccessToken)) {
      return NextResponse.json({ error: 'Unauthorized checkout request' }, { status: 401 })
    }

    const checkoutUrls = resolveCheckoutUrls(
      req,
      returnUrl,
      successUrl,
      { success: 'true', order_id: orderId }
    )
    if (checkoutUrls.error) {
      return NextResponse.json({ error: checkoutUrls.error }, { status: 400 })
    }

    const supabase = await createServiceClient(true)
    
    // 1. Fetch order details (include catalog image for Stripe Checkout summary)
    const { data: order, error: orderError } = await supabase
      .from('sale_orders')
      .select('id, order_number, status, currency, site_id, owner_site_id, buyer_user_id, sale_id, public_access_token_expires_at, public_access_token_revoked_at')
      .eq('id', orderId)
      .eq('public_access_token', publicAccessToken)
      .single()
      
    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    if (!isPublicAccessTokenActive(order)) {
      return NextResponse.json({ error: 'Order link is no longer available' }, { status: 410 })
    }
    if (order.status !== 'pending' && order.status !== 'completed') {
      return NextResponse.json({ error: 'Order is no longer payable' }, { status: 409 })
    }
    if (!order.sale_id) {
      return NextResponse.json({ error: 'Order payment is not configured' }, { status: 409 })
    }

    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select('id, status, amount_due, currency, stripe_checkout_session_id, lead_id')
      .eq('id', order.sale_id)
      .single()
    if (saleError || !sale) {
      return NextResponse.json({ error: 'Order payment is not configured' }, { status: 409 })
    }

    const payable = payableAmount(sale)
    if ("error" in payable) {
      return NextResponse.json({ error: payable.error }, { status: 409 })
    }

    const siteId = order.site_id || order.owner_site_id
    if (!siteId) {
      return NextResponse.json({ error: 'Order payment is not configured' }, { status: 409 })
    }

    const orderCurrency = (order.currency || 'USD').trim().toLowerCase()
    const saleCurrency = (sale.currency || 'USD').trim().toLowerCase()
    if (orderCurrency !== saleCurrency) {
      return NextResponse.json({
        error: 'Order currency does not match the authoritative sale currency',
      }, { status: 409 })
    }

    let amountMinor: number
    try {
      amountMinor = toStripeMinorAmount(payable.amount, saleCurrency)
    } catch (error) {
      return NextResponse.json({
        error: error instanceof Error ? error.message : 'Invalid payment amount',
      }, { status: 409 })
    }

    let expectedSessionId = sale.stripe_checkout_session_id as string | null
    let checkoutAttempt: number | null = null
    for (let retry = 0; retry < 2 && checkoutAttempt === null; retry += 1) {
      const existing = await existingCheckoutResult(
        stripe,
        expectedSessionId,
        { amountMinor, currency: saleCurrency, saleId: sale.id }
      )
      if (existing?.url) return NextResponse.json({ url: existing.url })
      if (existing?.error) {
        return NextResponse.json({ error: existing.error }, { status: 409 })
      }

      const reservation = await reserveCheckoutAttempt(supabase, {
        saleId: sale.id,
        amountMinor,
        currency: saleCurrency,
        expectedSessionId,
      })
      if (reservation.status === 'rejected') {
        return NextResponse.json({ error: reservation.error }, { status: 409 })
      }
      if (reservation.status === 'checkout_changed') {
        expectedSessionId = reservation.sessionId
        continue
      }
      checkoutAttempt = reservation.attempt
    }

    if (checkoutAttempt === null) {
      return NextResponse.json({
        error: 'Checkout changed while the payment was being prepared',
      }, { status: 409 })
    }

    let customerEmail = undefined
    if (sale?.lead_id) {
      const { data: lead } = await supabase.from('leads').select('email').eq('id', sale.lead_id).single()
      customerEmail = lead?.email
    }

    const lineItems = [outstandingBalanceLineItem({
      amount: payable.amount,
      currency: saleCurrency,
      name: `Order ${order.order_number || order.id.slice(0, 8)}`,
    })]

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: checkoutUrls.successUrl,
      cancel_url: checkoutUrls.cancelUrl,
      customer_email: customerEmail || undefined,
      metadata: {
        type: 'sale_order',
        site_id: siteId,
        order_id: orderId,
        sale_id: order.sale_id,
        checkout_attempt: String(checkoutAttempt),
        ...(order.buyer_user_id ? { buyer_user_id: order.buyer_user_id } : {}),
        ...(sale?.lead_id ? { lead_id: sale.lead_id } : {})
      }
    }, {
      idempotencyKey: checkoutIdempotencyKey({
        saleId: sale.id,
        amountMinor,
        currency: saleCurrency,
        attempt: checkoutAttempt,
      }),
    })

    if (session.status !== 'open' || !session.url) {
      await stripe.checkout.sessions.expire(session.id).catch(() => undefined)
      return NextResponse.json({ error: 'Payment provider returned no checkout URL' }, { status: 502 })
    }

    let linked = false
    try {
      linked = await linkCheckoutSession(supabase, {
        saleId: sale.id,
        attempt: checkoutAttempt,
        sessionId: session.id,
        amountMinor,
        currency: saleCurrency,
      })
    } catch (error) {
      console.error('Failed to persist Stripe order checkout session:', error)
    }

    if (!linked) {
      await stripe.checkout.sessions.expire(session.id).catch(() => undefined)
      return NextResponse.json({ error: 'Failed to persist checkout session' }, { status: 500 })
    }

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Stripe order checkout error:', err)
    return NextResponse.json({ error: 'Failed to initiate checkout' }, { status: 500 })
  }
}
