import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'
import { requireStripeSiteAccess } from '@/lib/auth/api-stripe-access'
import { resolveCheckoutUrls } from '@/app/api/stripe/checkout/checkout-url-security'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil', // Using the same version as in subscription route
})

export async function POST(request: NextRequest) {
  try {
    const { siteId, returnUrl } = await request.json()

    if (!siteId || !returnUrl) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const access = await requireStripeSiteAccess(request, siteId)
    if (access.error) return access.error

    const checkoutUrls = resolveCheckoutUrls(request, returnUrl, undefined, {})
    if (checkoutUrls.error) {
      return NextResponse.json({ error: checkoutUrls.error }, { status: 400 })
    }

    // Get Stripe customer ID from billing record
    const supabase = await createClient()
    
    const { data: billing } = await supabase
      .from('billing')
      .select('stripe_customer_id')
      .eq('site_id', siteId)
      .single()

    const customerId = billing?.stripe_customer_id

    if (!customerId) {
      return NextResponse.json(
        { error: 'No billing account found for this site' },
        { status: 404 }
      )
    }

    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: checkoutUrls.successUrl,
    })

    return NextResponse.json({ 
      url: session.url 
    })

  } catch (error: any) {
    console.error('Stripe portal error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create portal session' },
      { status: 500 }
    )
  }
}
