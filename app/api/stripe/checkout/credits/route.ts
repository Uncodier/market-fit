import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'
import { requireStripeSiteAccess } from '@/lib/auth/api-stripe-access'
import { resolveCheckoutUrls } from '@/app/api/stripe/checkout/checkout-url-security'
import { getCreditPackage } from '@/lib/credit-packages'
import { creditsCheckoutInput } from './input'
import { resolveCreditsProduct } from './product'
import { createCreditsIdempotencyKey } from './idempotency'

export async function POST(request: NextRequest) {
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid checkout request' }, { status: 400 })
    }
    const input = creditsCheckoutInput.safeParse(body)
    if (!input.success) {
      return NextResponse.json({ error: 'Invalid checkout request' }, { status: 400 })
    }
    const { credits, amount, siteId, successUrl, cancelUrl } = input.data

    const access = await requireStripeSiteAccess(request, siteId)
    if (access.error) return access.error

    const checkoutUrls = resolveCheckoutUrls(
      request,
      cancelUrl,
      successUrl,
      {}
    )
    if (checkoutUrls.error) {
      return NextResponse.json({ error: checkoutUrls.error }, { status: 400 })
    }

    const creditPackage = getCreditPackage(credits)
    if (!creditPackage || creditPackage.unitAmount / 100 !== amount) {
      return NextResponse.json(
        { error: 'Invalid credit package' },
        { status: 400 }
      )
    }

    const secretKey = process.env.STRIPE_SECRET_KEY
    if (!secretKey || !/^sk_(test|live)_/.test(secretKey)) {
      return NextResponse.json(
        { error: 'Payment service configuration error. Please contact support.' },
        { status: 500 }
      )
    }
    // No SDK initialization or Product provisioning occurs at module load.
    const stripe = new Stripe(secretKey, { apiVersion: '2025-05-28.basil' })
    const productId = await resolveCreditsProduct(stripe, creditPackage)

    // Get or create Stripe customer
    const supabase = await createClient()
    
    // Check if site has existing billing info with Stripe customer
    const { data: billing } = await supabase
      .from('billing')
      .select('stripe_customer_id')
      .eq('site_id', siteId)
      .single()

    let customerId = billing?.stripe_customer_id

    if (!customerId) {
      // Create new Stripe customer
      const customerParams: Stripe.CustomerCreateParams = {
        email: access.userEmail || undefined,
        metadata: {
          site_id: siteId
        }
      }
      const customer = await stripe.customers.create(customerParams, {
        idempotencyKey: createCreditsIdempotencyKey('customer', customerParams),
      })
      customerId = customer.id

      // Persist only the Stripe customer. Do not reset plan or credits before payment.
      await supabase.rpc('upsert_billing', {
        p_site_id: siteId,
        p_stripe_customer_id: customerId,
        p_auto_renew: true
      })
    }

    // Create checkout session
    const requestWindow = Math.floor(Date.now() / (10 * 60 * 1000))
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: creditPackage.currency,
            product: productId,
            unit_amount: creditPackage.unitAmount
          },
          quantity: 1
        }
      ],
      mode: 'payment',
      allow_promotion_codes: true,
      success_url: checkoutUrls.successUrl,
      cancel_url: checkoutUrls.cancelUrl,
      metadata: {
        site_id: siteId,
        credits: credits.toString(),
        product_id: productId,
        type: 'credits_purchase'
      },
      payment_intent_data: {
        metadata: {
          site_id: siteId,
          credits: credits.toString(),
          product_id: productId,
          type: 'credits_purchase'
        }
      }
    }
    const idempotencyKey = createCreditsIdempotencyKey('checkout', sessionParams, {
      userId: access.userId, siteId, requestWindow,
    })
    const session = await stripe.checkout.sessions.create(sessionParams, { idempotencyKey })

    return NextResponse.json({ 
      url: session.url,
      sessionId: session.id 
    })

  } catch {
    console.error('Credit checkout could not be created')
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
} 