import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
})

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!

// Maximum age for webhook events
const MAX_EVENT_AGE_SECONDS = 24 * 60 * 60 // 24 hours for new events
const MAX_FAILED_EVENT_AGE_SECONDS = 3 * 24 * 60 * 60 // 3 days for retried events

export async function POST(request: NextRequest) {
  console.log('🚀 WEBHOOK STARTED - Stripe webhook received')
  console.log('📧 Headers:', Object.fromEntries(request.headers.entries()))
  
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')!

  console.log('🔑 Signature check:', {
    hasSignature: !!sig,
    hasEndpointSecret: !!endpointSecret,
    bodyLength: body.length
  })

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret)
    console.log('✅ Webhook signature verified successfully')
    console.log('📝 Event details:', {
      id: event.id,
      type: event.type,
      created: event.created,
      livemode: event.livemode
    })
  } catch (err: any) {
    console.error('❌ Webhook signature verification failed:', err.message)
    console.error('🔍 Debug info:', {
      signatureReceived: sig,
      endpointSecretConfigured: !!endpointSecret,
      bodyPreview: body.substring(0, 100)
    })
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = await createClient()
  console.log('🗄️ Supabase client created')

  // Check if this event has already been processed (idempotency)
  console.log('🔍 Checking event status:', event.id)
  const { data: existingEventRecords, error: checkError } = await supabase
    .from('webhook_events')
    .select('*')
    .eq('stripe_event_id', event.id)

  if (checkError) {
    console.error('❌ Error checking event status:', checkError)
  }

  const existingEvent = existingEventRecords?.[0]

  // If event was already processed successfully, return success
  if (existingEvent?.status === 'processed') {
    console.log('✅ Event already processed successfully, returning success:', event.id)
    return NextResponse.json({ 
      received: true, 
      message: 'Event already processed',
      eventId: event.id 
    })
  }

  // Check event age with different limits based on event status
  const eventAge = Math.floor(Date.now() / 1000) - event.created
  const isRetryOfFailedEvent = existingEvent?.status === 'failed'
  const maxAge = isRetryOfFailedEvent ? MAX_FAILED_EVENT_AGE_SECONDS : MAX_EVENT_AGE_SECONDS
  const ageDescription = isRetryOfFailedEvent ? '3 days (retry)' : '24 hours (new)'

  if (eventAge > maxAge) {
    console.error('❌ Webhook event is too old:', {
      eventId: event.id,
      eventAge: `${eventAge}s`,
      maxAge: `${maxAge}s (${ageDescription})`,
      eventCreated: new Date(event.created * 1000).toISOString(),
      isRetry: isRetryOfFailedEvent,
      existingStatus: existingEvent?.status || 'none'
    })
    return NextResponse.json({ 
      error: 'Webhook event is too old',
      eventAge: eventAge,
      maxAge: maxAge,
      isRetry: isRetryOfFailedEvent
    }, { status: 400 })
  }

  // Log retry information
  if (isRetryOfFailedEvent) {
    console.log('🔄 Processing retry of previously failed event:', {
      eventId: event.id,
      originalFailure: existingEvent.error_message,
      failedAt: existingEvent.processed_at,
      eventAge: `${eventAge}s`
    })
  }

  console.log('🆕 Processing new event:', event.id)

  // Wrap event processing in try-catch for error handling
  try {
    // Handle the event
    switch (event.type) {
    case 'checkout.session.completed':
      console.log('🛒 Processing checkout.session.completed')
      const session = event.data.object as any
      
      console.log('🛒 Session details:', {
        sessionId: session.id,
        metadata: session.metadata,
        amount_total: session.amount_total,
        currency: session.currency,
        customer: session.customer,
        payment_intent: session.payment_intent,
        subscription: session.subscription,
        payment_status: session.payment_status
      })
      
      // Check if this is a credits purchase
      if (session.metadata?.type === 'credits_purchase') {
        console.log('💳 Processing credits purchase')
        try {
          const siteId = session.metadata.site_id
          const credits = parseInt(session.metadata.credits)
          const amount = (session.amount_total || 0) / 100 // Convert from cents
          
          console.log(`💳 Credits purchase details: site=${siteId}, credits=${credits}, amount=${amount}`)
          
          if (!siteId || !credits) {
            console.error('❌ Missing site_id or credits in metadata:', {
              siteId,
              credits,
              metadata: session.metadata
            })
            break
          }

          // Use a transaction to ensure consistency
          console.log('💳 Starting credits purchase transaction...')
          
          // First, check for duplicate transaction_id to prevent double processing
          const transactionId = `stripe_${session.id}`
          const { data: existingPayment, error: duplicateCheckError } = await supabase
            .from('payments')
            .select('id, transaction_id')
            .eq('transaction_id', transactionId)
            .single()
          
          if (duplicateCheckError && duplicateCheckError.code !== 'PGRST116') {
            console.error('❌ Error checking for duplicate payment:', duplicateCheckError)
            throw new Error('Failed to check for duplicate payment')
          }
          
          if (existingPayment) {
            console.log('⚠️ Payment already exists, skipping processing:', transactionId)
            break
          }

          // Add credits to the site's account
          console.log('💰 Adding credits via RPC...')
          const { data: creditsResult, error: creditsError } = await supabase.rpc('add_credits', {
            p_site_id: siteId,
            p_credits: credits
          })
          
          console.log('💰 Credits add result:', { creditsResult, creditsError })

          if (creditsError) {
            console.error('❌ Error adding credits:', creditsError)
            throw new Error(`Failed to add credits: ${creditsError.message}`)
          }

          // Record the payment in the database
          console.log('💾 Recording payment in database...')
          const paymentData = {
            site_id: siteId,
            transaction_id: transactionId,
            transaction_type: 'credits_purchase',
            amount: amount,
            currency: session.currency?.toUpperCase() || 'USD',
            status: 'completed',
            payment_method: 'stripe',
            details: {
              stripe_payment_intent_id: session.payment_intent,
              stripe_session_id: session.id,
              credits_purchased: credits,
              stripe_customer_id: session.customer
            },
            credits: credits
          }

          console.log('💾 Payment data to insert:', paymentData)

          const { data: paymentInsert, error: paymentError } = await supabase
            .from('payments')
            .insert(paymentData)
            .select()
            .single()

          if (paymentError) {
            console.error('❌ Error recording payment:', paymentError)
            console.error('❌ Payment error details:', {
              message: paymentError.message,
              details: paymentError.details,
              hint: paymentError.hint,
              code: paymentError.code
            })
            throw new Error(`Failed to record payment: ${paymentError.message}`)
          } else {
            console.log('✅ Payment recorded successfully:', paymentInsert)
          }

          console.log(`✅ Successfully processed credits purchase: ${credits} credits for site ${siteId}`)
          
        } catch (error) {
          console.error('❌ Error processing credits purchase:', error)
          throw error // Re-throw to be caught by main error handler
        }
      }
      // Check if this is a subscription signup
      else if (session.metadata?.type === 'subscription') {
        console.log('📋 Processing subscription signup')
        try {
          const siteId = session.metadata.site_id
          const plan = session.metadata.plan
          const amount = (session.amount_total || 0) / 100 // Convert from cents
          
          console.log(`📋 Subscription details: site=${siteId}, plan=${plan}, amount=${amount}`)
          
          if (!siteId || !plan) {
            console.error('❌ Missing site_id or plan in subscription metadata:', {
              siteId,
              plan,
              metadata: session.metadata
            })
            break
          }

          // Check for duplicate subscription payment
          const subscriptionTransactionId = `stripe_${session.id}`
          const { data: existingSubscriptionPayment, error: duplicateSubCheckError } = await supabase
            .from('payments')
            .select('id, transaction_id')
            .eq('transaction_id', subscriptionTransactionId)
            .single()
          
          if (duplicateSubCheckError && duplicateSubCheckError.code !== 'PGRST116') {
            console.error('❌ Error checking for duplicate subscription payment:', duplicateSubCheckError)
            throw new Error('Failed to check for duplicate subscription payment')
          }
          
          if (existingSubscriptionPayment) {
            console.log('⚠️ Subscription payment already exists, skipping processing:', subscriptionTransactionId)
            break
          }

          // Update billing table with plan information
          console.log(`🏢 Updating billing for subscription...`)
          
          const { data: billingResult, error: billingError } = await supabase.rpc('upsert_billing', {
            p_site_id: siteId,
            p_plan: plan,
            p_stripe_customer_id: session.customer,
            p_stripe_subscription_id: session.subscription,
            p_subscription_status: 'active',
            p_auto_renew: true
          })
          
          console.log('🏢 Billing upsert result:', { billingResult, billingError })
          
          if (billingError) {
            console.error('❌ Error updating billing for subscription:', billingError)
            throw new Error(`Failed to update billing for subscription: ${billingError.message}`)
          }

          // Record the initial subscription payment
          console.log('💾 Recording subscription payment in database...')
          const subscriptionPaymentData = {
            site_id: siteId,
            transaction_id: subscriptionTransactionId,
            transaction_type: 'subscription',
            amount: amount,
            currency: session.currency?.toUpperCase() || 'USD',
            status: 'completed',
            payment_method: 'stripe',
            details: {
              stripe_payment_intent_id: session.payment_intent,
              stripe_session_id: session.id,
              stripe_subscription_id: session.subscription,
              stripe_customer_id: session.customer,
              plan: plan
            }
          }

          console.log('💾 Subscription payment data to insert:', subscriptionPaymentData)

          const { data: paymentInsert, error: paymentError } = await supabase
            .from('payments')
            .insert(subscriptionPaymentData)
            .select()
            .single()

          if (paymentError) {
            console.error('❌ Error recording subscription payment:', paymentError)
            console.error('❌ Subscription payment error details:', {
              message: paymentError.message,
              details: paymentError.details,
              hint: paymentError.hint,
              code: paymentError.code
            })
            throw new Error(`Failed to record subscription payment: ${paymentError.message}`)
          } else {
            console.log('✅ Subscription payment recorded successfully:', paymentInsert)
          }

          console.log(`✅ Successfully activated ${plan} subscription for site ${siteId}`)
          
        } catch (error) {
          console.error('❌ Error processing subscription signup:', error)
          throw error // Re-throw to be caught by main error handler
        }
      } else {
        console.log('❓ Checkout session completed but no recognized type in metadata:', session.metadata)
      }
      break

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      console.log(`📋 Processing subscription event: ${event.type}`)
      const subscription = event.data.object as any
      
      try {
        // Get the customer to find the associated site
        const customer = await stripe.customers.retrieve(subscription.customer) as any
        const siteId = customer.metadata?.site_id
        
        if (!siteId) {
          console.error('❌ No site_id found in customer metadata for subscription event')
          break
        }

        const subscriptionStatus = subscription.status
        const plan = subscription.metadata?.plan || 'startup' // Default to startup if no plan specified
        
        console.log(`📋 Processing subscription ${event.type}: ${subscription.id} for site ${siteId}, status: ${subscriptionStatus}, plan: ${plan}`)

        // Update billing record
        const { data: billingResult, error } = await supabase.rpc('upsert_billing', {
          p_site_id: siteId,
          p_plan: plan,
          p_stripe_customer_id: subscription.customer,
          p_stripe_subscription_id: subscription.id,
          p_subscription_status: subscriptionStatus,
          p_subscription_current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          p_auto_renew: true
        })

        if (error) {
          console.error('❌ Error updating subscription:', error)
          throw new Error(`Failed to update subscription: ${error.message}`)
        }

        console.log(`✅ Updated subscription ${subscription.id} for site ${siteId}: ${subscriptionStatus} ${plan ? `(${plan})` : ''}`)
        
      } catch (error) {
        console.error('❌ Error processing subscription event:', error)
        throw error // Re-throw to be caught by main error handler
      }
      break

    case 'invoice.payment_succeeded':
      console.log('💰 Processing invoice.payment_succeeded')
      const invoice = event.data.object as any
      
      if (invoice.subscription) {
        try {
          // Get the customer to find the associated site
          const customer = await stripe.customers.retrieve(invoice.customer as string) as any
          const siteId = customer.metadata?.site_id
          
          if (!siteId) {
            console.error('❌ No site_id found in customer metadata for invoice payment')
            break
          }

          const amount = (invoice.amount_paid || 0) / 100

          console.log(`💰 Processing recurring subscription payment: site=${siteId}, amount=${amount}, invoice=${invoice.id}`)

          // Check for duplicate invoice payment
          const invoiceTransactionId = `stripe_invoice_${invoice.id}`
          const { data: existingInvoicePayment, error: duplicateInvoiceCheckError } = await supabase
            .from('payments')
            .select('id, transaction_id')
            .eq('transaction_id', invoiceTransactionId)
            .single()
          
          if (duplicateInvoiceCheckError && duplicateInvoiceCheckError.code !== 'PGRST116') {
            console.error('❌ Error checking for duplicate invoice payment:', duplicateInvoiceCheckError)
            throw new Error('Failed to check for duplicate invoice payment')
          }
          
          if (existingInvoicePayment) {
            console.log('⚠️ Invoice payment already exists, skipping processing:', invoiceTransactionId)
            break
          }

          // Record the payment
          const recurringPaymentData = {
            site_id: siteId,
            transaction_id: invoiceTransactionId,
            transaction_type: 'subscription',
            amount: amount,
            currency: invoice.currency?.toUpperCase() || 'USD',
            status: 'completed',
            payment_method: 'stripe',
            details: {
              stripe_payment_intent_id: invoice.payment_intent,
              stripe_invoice_id: invoice.id,
              stripe_subscription_id: invoice.subscription,
              stripe_customer_id: invoice.customer,
              billing_reason: invoice.billing_reason
            }
          }

          console.log('💰 Recurring payment data to insert:', recurringPaymentData)

          const { data: paymentInsert, error: paymentError } = await supabase
            .from('payments')
            .insert(recurringPaymentData)
            .select()
            .single()

          if (paymentError) {
            console.error('❌ Error recording subscription payment:', paymentError)
            console.error('❌ Recurring payment error details:', {
              message: paymentError.message,
              details: paymentError.details,
              hint: paymentError.hint,
              code: paymentError.code
            })
            throw new Error(`Failed to record recurring payment: ${paymentError.message}`)
          } else {
            console.log('✅ Recurring subscription payment recorded successfully:', paymentInsert)
          }

          console.log(`✅ Recorded subscription payment for site ${siteId}: $${amount}`)
          
        } catch (error) {
          console.error('❌ Error processing invoice payment:', error)
          throw error // Re-throw to be caught by main error handler
        }
      }
      break

    default:
      console.log(`❓ Unhandled event type: ${event.type}`)
    }

    // Mark event as processed
    try {
      const { error: markError } = await supabase
        .rpc('mark_webhook_event_processed', {
          event_id: event.id,
          event_type_param: event.type,
          event_data_param: {
            livemode: event.livemode,
            created: event.created,
            api_version: event.api_version
          }
        })
      
      if (markError) {
        console.error('❌ Error marking event as processed:', markError)
        // Don't fail the webhook if we can't mark it as processed
      } else {
        console.log('✅ Event marked as processed successfully:', event.id)
      }
    } catch (error) {
      console.error('❌ Error in event marking process:', error)
    }

    console.log('✅ Webhook processing completed successfully')
    return NextResponse.json({ received: true, eventId: event.id })

  } catch (processingError: any) {
    console.error('❌ Error processing webhook event:', processingError)
    
    // Mark event as failed
    try {
      await supabase.rpc('mark_webhook_event_failed', {
        event_id: event.id,
        event_type_param: event.type,
        error_msg: processingError.message || String(processingError),
        event_data_param: {
          livemode: event.livemode,
          created: event.created,
          api_version: event.api_version,
          error_stack: processingError.stack
        }
      })
      console.log('🔴 Event marked as failed:', event.id)
    } catch (markFailedError) {
      console.error('❌ Could not mark event as failed:', markFailedError)
    }

    // Return error response
    return NextResponse.json({
      error: 'Failed to process webhook event',
      eventId: event.id,
      message: processingError.message
    }, { status: 500 })
  }
} 