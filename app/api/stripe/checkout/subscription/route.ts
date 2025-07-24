import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
})

export async function POST(request: NextRequest) {
  try {
    const { plan, siteId, userEmail, successUrl, cancelUrl } = await request.json()

    if (!plan || !siteId || !userEmail) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate subscription plans
    const planPrices: Record<string, { priceId: string; amount: number }> = {
      startup: { 
        priceId: process.env.STRIPE_STARTUP_PRICE_ID || 'price_startup',
        amount: 99 
      },
      enterprise: { 
        priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || 'price_enterprise',
        amount: 500 
      }
    }
    
    const planConfig = planPrices[plan]
    if (!planConfig) {
      return NextResponse.json(
        { error: 'Invalid subscription plan' },
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
      console.log('Attempting to create/update billing record for siteId:', siteId)
      console.log('Customer ID:', customerId)
      console.log('Plan:', plan)
      
      const { data: billingResult, error: billingError } = await supabase.rpc('upsert_billing', {
        p_site_id: siteId,
        p_stripe_customer_id: customerId,
        p_plan: plan,
        p_auto_renew: true,
        p_credits_available: 0
      })

      console.log('Billing upsert result:', billingResult)
      
      if (billingError) {
        console.error('Error creating billing record:', billingError)
        return NextResponse.json(
          { error: `Failed to create billing record: ${billingError.message}` },
          { status: 500 }
        )
      }

      // Verify the billing record was created/updated
      const { data: verifyBilling, error: verifyError } = await supabase
        .from('billing')
        .select('*')
        .eq('site_id', siteId)
        .single()

      if (verifyError) {
        console.error('Error verifying billing record:', verifyError)
      } else {
        console.log('Billing record verified:', verifyBilling)
      }
    }

    // Create checkout session for subscription
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: planConfig.priceId,
          quantity: 1
        }
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        site_id: siteId,
        plan: plan,
        type: 'subscription'
      },
      subscription_data: {
        metadata: {
          site_id: siteId,
          plan: plan
        }
      }
    })

    return NextResponse.json({ 
      url: session.url,
      sessionId: session.id 
    })

  } catch (error: any) {
    console.error('Stripe subscription checkout error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create subscription checkout session' },
      { status: 500 }
    )
  }
} 