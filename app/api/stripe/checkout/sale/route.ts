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
    const { saleId, publicAccessToken, returnUrl, successUrl } = await req.json()
    if (!saleId || !isValidPublicAccessToken(publicAccessToken)) {
      return NextResponse.json({ error: 'Unauthorized checkout request' }, { status: 401 })
    }

    const checkoutUrls = resolveCheckoutUrls(
      req,
      returnUrl,
      successUrl,
      { success: 'true', sale_id: saleId }
    )
    if (checkoutUrls.error) {
      return NextResponse.json({ error: checkoutUrls.error }, { status: 400 })
    }

    const supabase = await createServiceClient(true)
    
    // 1. Fetch sale details
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select('*, leads(id, name, email)')
      .eq('id', saleId)
      .eq('public_access_token', publicAccessToken)
      .single()
      
    if (saleError || !sale) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 })
    }
    if (!isPublicAccessTokenActive(sale)) {
      return NextResponse.json({ error: 'Invoice link is no longer available' }, { status: 410 })
    }

    const payable = payableAmount(sale)
    if ("error" in payable) {
      return NextResponse.json({ error: payable.error }, { status: 409 })
    }
    if (!sale.site_id) {
      return NextResponse.json({ error: 'Invoice payment is not configured' }, { status: 409 })
    }

    const currency = (sale.currency || 'USD').trim().toLowerCase()
    const { data: order, error: orderError } = await supabase
      .from("sale_orders")
      .select("id, buyer_user_id, status, currency")
      .eq("sale_id", saleId)
      .maybeSingle()
    if (orderError) {
      return NextResponse.json({ error: 'Invoice payment is not configured' }, { status: 409 })
    }
    if (
      order &&
      order.status !== 'pending' &&
      order.status !== 'completed'
    ) {
      return NextResponse.json({ error: 'Order is no longer payable' }, { status: 409 })
    }
    if (
      order?.currency &&
      order.currency.trim().toLowerCase() !== currency
    ) {
      return NextResponse.json({
        error: 'Order currency does not match the authoritative sale currency',
      }, { status: 409 })
    }

    let amountMinor: number
    try {
      amountMinor = toStripeMinorAmount(payable.amount, currency)
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
        { amountMinor, currency, saleId: sale.id }
      )
      if (existing?.url) return NextResponse.json({ url: existing.url })
      if (existing?.error) {
        return NextResponse.json({ error: existing.error }, { status: 409 })
      }

      const reservation = await reserveCheckoutAttempt(supabase, {
        saleId: sale.id,
        amountMinor,
        currency,
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

    const customerEmail = (sale.leads as any)?.email || sale.lead_email

    const lineItems = [outstandingBalanceLineItem({
      amount: payable.amount,
      currency,
      name: sale.title || sale.product_name || `Invoice ${sale.id.slice(0, 8)}`,
    })]

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: checkoutUrls.successUrl,
      cancel_url: checkoutUrls.cancelUrl,
      customer_email: customerEmail || undefined,
      metadata: {
        type: order ? 'sale_order' : 'sale',
        site_id: sale.site_id,
        sale_id: saleId,
        checkout_attempt: String(checkoutAttempt),
        ...(order ? { order_id: order.id } : {}),
        ...(order?.buyer_user_id ? { buyer_user_id: order.buyer_user_id } : {}),
        ...(sale.lead_id ? { lead_id: sale.lead_id } : {})
      }
    }, {
      idempotencyKey: checkoutIdempotencyKey({
        saleId: sale.id,
        amountMinor,
        currency,
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
        currency,
      })
    } catch (error) {
      console.error('Failed to persist Stripe invoice checkout session:', error)
    }

    if (!linked) {
      await stripe.checkout.sessions.expire(session.id).catch(() => undefined)
      return NextResponse.json({ error: 'Failed to persist checkout session' }, { status: 500 })
    }

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Stripe sale checkout error:', err)
    return NextResponse.json({ error: 'Failed to initiate checkout' }, { status: 500 })
  }
}
