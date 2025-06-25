import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { 
  validateWebhookConfig, 
  validateEventSource, 
  validateEventTimestamp, 
  logSecurityEvent
} from './security'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
})
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(request: NextRequest) {
  const body = await request.text()
  const headersList = await headers()
  const sig = headersList.get('stripe-signature')
  // Get client IP for rate limiting (fallback to 'unknown' if not available)
  const forwardedFor = headersList.get('x-forwarded-for')
  const realIP = headersList.get('x-real-ip')
  const clientIP = forwardedFor || realIP || 'unknown'

  // 🔒 Security Layer 1: Validate configuration
  const configValidation = validateWebhookConfig()
  if (!configValidation.valid) {
    logSecurityEvent('failure', null, { 
      reason: 'Invalid configuration', 
      error: configValidation.error 
    })
    return NextResponse.json(
      { error: 'Webhook endpoint not properly configured' },
      { status: 500 }
    )
  }

  // 🔒 Security Layer 2: Rate limiting (optional - can be enabled later)
  // if (!checkRateLimit(clientIP)) {
  //   logSecurityEvent('failure', null, { 
  //     reason: 'Rate limit exceeded', 
  //     clientIP 
  //   })
  //   return NextResponse.json(
  //     { error: 'Rate limit exceeded' },
  //     { status: 429 }
  //   )
  // }

  // Validate Stripe signature
  if (!sig) {
    console.error('Missing Stripe signature in request headers')
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    )
  }

  let event: Stripe.Event

  try {
    // This is the critical security check - verifies the webhook came from Stripe
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret)
    
    // Log successful verification (only in debug mode)
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Stripe webhook signature verified successfully')
      console.log(`📝 Event type: ${event.type}`)
      console.log(`🆔 Event ID: ${event.id}`)
    }
    
  } catch (err: any) {
    // This catches signature verification failures
    console.error('❌ Stripe webhook signature verification failed:', err.message)
    console.error('🔍 Received signature:', sig)
    console.error('🔑 Using endpoint secret:', endpointSecret ? '***configured***' : 'NOT SET')
    
    // Return 400 to tell Stripe this webhook failed
    return NextResponse.json(
      { 
        error: 'Webhook signature verification failed',
        details: err.message,
        timestamp: new Date().toISOString()
      },
      { status: 400 }
    )
  }

  // 🔒 Security Layer 3: Validate event source
  if (!validateEventSource(event)) {
    logSecurityEvent('failure', event, { 
      reason: 'Invalid event source',
      eventId: event.id,
      eventType: event.type
    })
    return NextResponse.json(
      { error: 'Invalid event source' },
      { status: 400 }
    )
  }

  // 🔒 Security Layer 4: Verify event is recent (within 5 minutes)
  if (!validateEventTimestamp(event, 5)) {
    logSecurityEvent('failure', event, { 
      reason: 'Event too old',
      eventAge: (Date.now() - (event.created * 1000)) / (60 * 1000),
      maxAgeMinutes: 5
    })
    return NextResponse.json(
      { error: 'Webhook event is too old' },
      { status: 400 }
    )
  }

  // Log successful verification
  logSecurityEvent('success', event, { 
    reason: 'All security checks passed',
    clientIP: clientIP 
  })

  const supabase = await createClient()

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object as any
      
      // Check if this is a credits purchase
      if (session.metadata?.type === 'credits_purchase') {
        try {
          const siteId = session.metadata.site_id
          const credits = parseInt(session.metadata.credits)
          const amount = (session.amount_total || 0) / 100 // Convert from cents
          
          // Add credits to the site's account
          const { error: creditsError } = await supabase.rpc('add_credits', {
            p_site_id: siteId,
            p_credits: credits
          })
          
          if (creditsError) {
            console.error('Error adding credits:', creditsError)
            return NextResponse.json(
              { error: 'Failed to add credits' },
              { status: 500 }
            )
          }

          // Record the payment in the database
          const { error: paymentError } = await supabase
            .from('payments')
            .insert({
              site_id: siteId,
              transaction_id: `stripe_${session.id}`,
              transaction_type: 'credits_purchase',
              amount: amount,
              currency: session.currency?.toUpperCase() || 'USD',
              status: 'completed',
              payment_method: 'stripe',
              details: {
                stripe_payment_intent_id: session.payment_intent,
                stripe_session_id: session.id,
                credits_purchased: credits
              },
              credits: credits
            })

          if (paymentError) {
            console.error('Error recording payment:', paymentError)
            // Don't fail the webhook if we can't record the payment,
            // but log it for manual investigation
          }

          console.log(`Successfully added ${credits} credits to site ${siteId}`)
          
        } catch (error) {
          console.error('Error processing credits purchase:', error)
          return NextResponse.json(
            { error: 'Failed to process credits purchase' },
            { status: 500 }
          )
        }
      }
      // Check if this is a subscription signup
      else if (session.metadata?.type === 'subscription') {
        try {
          const siteId = session.metadata.site_id
          const plan = session.metadata.plan
          const amount = (session.amount_total || 0) / 100 // Convert from cents
          
          if (!siteId || !plan) {
            console.error('Missing site_id or plan in subscription metadata')
            break
          }

          // Update billing table with plan information
          console.log(`Processing subscription signup: site=${siteId}, plan=${plan}, customer=${session.customer}, subscription=${session.subscription}`)
          
          const { data: billingResult, error: billingError } = await supabase.rpc('upsert_billing', {
            p_site_id: siteId,
            p_plan: plan,
            p_stripe_customer_id: session.customer,
            p_stripe_subscription_id: session.subscription,
            p_subscription_status: 'active',
            p_auto_renew: true
          })
          
          console.log('Billing upsert result:', billingResult)
          
          if (billingError) {
            console.error('Error updating billing for subscription:', billingError)
            return NextResponse.json(
              { error: 'Failed to update billing for subscription' },
              { status: 500 }
            )
          }

          // Record the initial subscription payment
          const { error: paymentError } = await supabase
            .from('payments')
            .insert({
              site_id: siteId,
              transaction_id: `stripe_${session.id}`,
              transaction_type: 'subscription',
              amount: amount,
              currency: session.currency?.toUpperCase() || 'USD',
              status: 'completed',
              payment_method: 'stripe',
              details: {
                stripe_payment_intent_id: session.payment_intent,
                stripe_session_id: session.id,
                stripe_subscription_id: session.subscription,
                plan: plan
              }
            })

          if (paymentError) {
            console.error('Error recording subscription payment:', paymentError)
            // Don't fail the webhook if we can't record the payment,
            // but log it for manual investigation
          }

          console.log(`Successfully activated ${plan} subscription for site ${siteId}`)
          
        } catch (error) {
          console.error('Error processing subscription signup:', error)
          return NextResponse.json(
            { error: 'Failed to process subscription signup' },
            { status: 500 }
          )
        }
      }
      break

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      const subscription = event.data.object as any
      
      try {
        // Get the customer to find the associated site
        const customer = await stripe.customers.retrieve(subscription.customer as string) as any
        const siteId = customer.metadata?.site_id
        
        if (!siteId) {
          console.error('No site_id found in customer metadata')
          break
        }

        // Update subscription status in billing table
        const subscriptionStatus = subscription.status
        const currentPeriodEnd = new Date((subscription.current_period_end || 0) * 1000).toISOString()
        
        // Determine plan from subscription metadata or price ID
        let plan = subscription.metadata?.plan
        if (!plan) {
          // Try to determine plan from price ID
          const priceId = subscription.items?.data?.[0]?.price?.id
          if (priceId === process.env.STRIPE_STARTUP_PRICE_ID) {
            plan = 'startup'
          } else if (priceId === process.env.STRIPE_ENTERPRISE_PRICE_ID) {
            plan = 'enterprise'
          }
        }
        
        const updateData: any = {
          stripe_subscription_id: subscription.id,
          subscription_status: subscriptionStatus,
          subscription_current_period_end: currentPeriodEnd,
          updated_at: new Date().toISOString()
        }
        
        // Include plan if we have it
        if (plan) {
          updateData.plan = plan
        }
        
        console.log(`Updating billing for subscription event: site=${siteId}, updateData=`, updateData)
        
        const { data: updateResult, error } = await supabase
          .from('billing')
          .update(updateData)
          .eq('site_id', siteId)
          .select()
        
        console.log('Billing update result:', updateResult)

        if (error) {
          console.error('Error updating subscription:', error)
          return NextResponse.json(
            { error: 'Failed to update subscription' },
            { status: 500 }
          )
        }

        console.log(`Updated subscription ${subscription.id} for site ${siteId}: ${subscriptionStatus} ${plan ? `(${plan})` : ''}`)
        
      } catch (error) {
        console.error('Error processing subscription event:', error)
        return NextResponse.json(
          { error: 'Failed to process subscription event' },
          { status: 500 }
        )
      }
      break

    case 'invoice.payment_succeeded':
      const invoice = event.data.object as any
      
      if (invoice.subscription) {
        try {
          // Get the customer to find the associated site
          const customer = await stripe.customers.retrieve(invoice.customer as string) as any
          const siteId = customer.metadata?.site_id
          
          if (!siteId) {
            console.error('No site_id found in customer metadata')
            break
          }

          // Record the payment
          const { error: paymentError } = await supabase
            .from('payments')
            .insert({
              site_id: siteId,
              transaction_id: `stripe_invoice_${invoice.id}`,
              transaction_type: 'subscription',
              amount: (invoice.amount_paid || 0) / 100,
              currency: invoice.currency?.toUpperCase() || 'USD',
              status: 'completed',
              payment_method: 'stripe',
              details: {
                stripe_payment_intent_id: invoice.payment_intent,
                stripe_invoice_id: invoice.id
              }
            })

          if (paymentError) {
            console.error('Error recording subscription payment:', paymentError)
          }

          console.log(`Recorded subscription payment for site ${siteId}: $${(invoice.amount_paid || 0) / 100}`)
          
        } catch (error) {
          console.error('Error processing invoice payment:', error)
        }
      }
      break

    case 'invoice.created':
    case 'invoice.finalized':
    case 'invoice.paid':
    case 'customer.updated':
      // These are informational events that we don't need to process
      console.log(`Received informational event: ${event.type}`)
      break

    default:
      console.log(`Unhandled event type ${event.type}`)
  }

  // Return success response to acknowledge webhook receipt
  return NextResponse.json({ 
    received: true,
    eventId: event.id,
    eventType: event.type,
    processed: true,
    timestamp: new Date().toISOString()
  })
} 