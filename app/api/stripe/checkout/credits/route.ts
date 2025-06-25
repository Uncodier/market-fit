import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
})

export async function POST(request: NextRequest) {
  try {
    const { credits, amount, siteId, userEmail, successUrl, cancelUrl } = await request.json()

    if (!credits || !amount || !siteId || !userEmail) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate credits packages
    const validPackages = [
      { credits: 20, price: 20 },
      { credits: 52, price: 49.25 },
      { credits: 515, price: 500 }
    ]
    
    const validPackage = validPackages.find(pkg => pkg.credits === credits && pkg.price === amount)
    if (!validPackage) {
      return NextResponse.json(
        { error: 'Invalid credit package' },
        { status: 400 }
      )
    }

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
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: {
          site_id: siteId
        }
      })
      customerId = customer.id

      // Update billing record with customer ID
      await supabase.rpc('upsert_billing', {
        p_site_id: siteId,
        p_stripe_customer_id: customerId,
        p_plan: 'commission', // Default plan
        p_auto_renew: true,
        p_credits_available: 0
      })
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${credits} Credits Package`,
              description: `Purchase ${credits} credits for your Uncodie account`,
              images: []
            },
            unit_amount: Math.round(amount * 100) // Convert to cents
          },
          quantity: 1
        }
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        site_id: siteId,
        credits: credits.toString(),
        type: 'credits_purchase'
      },
      payment_intent_data: {
        metadata: {
          site_id: siteId,
          credits: credits.toString(),
          type: 'credits_purchase'
        }
      }
    })

    return NextResponse.json({ 
      url: session.url,
      sessionId: session.id 
    })

  } catch (error: any) {
    console.error('Stripe checkout error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    )
  }
} 