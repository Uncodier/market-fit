import { NextResponse, type NextRequest } from "next/server"
import Stripe from "stripe"
import { createServiceClient } from "@/lib/supabase/server"
import { handleBillingStripeEvent } from "./billing-event-handlers"
import { handleCheckoutSessionCompleted } from "./checkout-session-handler"
import {
  claimStripeWebhookDelivery,
  completeStripeWebhookDelivery,
  failStripeWebhookDelivery,
} from "./webhook-delivery"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-05-28.basil",
})
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!
const MAX_EVENT_AGE_SECONDS = 3 * 24 * 60 * 60
const MAX_REFUND_EVENT_AGE_SECONDS = 90 * 24 * 60 * 60
const LATE_STRIPE_EVENTS = new Set([
  "charge.refunded",
  "charge.dispute.created",
])

async function rejectOldEvent(params: {
  supabase: Awaited<ReturnType<typeof createServiceClient>>
  event: Stripe.Event
  claimToken: string
  eventAge: number
  maxAge: number
}): Promise<NextResponse> {
  try {
    await failStripeWebhookDelivery(
      params.supabase,
      params.event.id,
      params.claimToken,
      new Error("Webhook event is too old"),
    )
  } catch (error) {
    console.error("Failed to release old Stripe webhook claim", error)
    return NextResponse.json(
      {
        error: "Failed to reject old webhook event safely",
        eventId: params.event.id,
      },
      { status: 500 },
    )
  }
  return NextResponse.json(
    {
      error: "Webhook event is too old",
      eventAge: params.eventAge,
      maxAge: params.maxAge,
    },
    { status: 400 },
  )
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get("stripe-signature")
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, endpointSecret)
  } catch (error) {
    console.error("Stripe webhook signature verification failed", error)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  const supabase = await createServiceClient()
  const eventAge = Math.floor(Date.now() / 1000) - event.created
  const maxAge = LATE_STRIPE_EVENTS.has(event.type)
    ? MAX_REFUND_EVENT_AGE_SECONDS
    : MAX_EVENT_AGE_SECONDS

  let deliveryClaim
  try {
    deliveryClaim = await claimStripeWebhookDelivery(supabase, event)
  } catch (error) {
    console.error("Failed to claim Stripe webhook delivery", error)
    return NextResponse.json(
      { error: "Failed to claim webhook event", eventId: event.id },
      { status: 500 },
    )
  }

  if (deliveryClaim.outcome === "processed") {
    return NextResponse.json({
      received: true,
      message: "Event already processed",
      eventId: event.id,
    })
  }
  if (deliveryClaim.outcome === "in_progress") {
    return NextResponse.json(
      {
        error: "Event is already being processed",
        eventId: event.id,
      },
      { status: 409 },
    )
  }

  const claimToken = deliveryClaim.claimToken
  if (!claimToken) {
    return NextResponse.json(
      { error: "Invalid webhook claim state", eventId: event.id },
      { status: 500 },
    )
  }
  if (eventAge > maxAge) {
    return rejectOldEvent({
      supabase,
      event,
      claimToken,
      eventAge,
      maxAge,
    })
  }

  try {
    if (event.type === "checkout.session.completed") {
      await handleCheckoutSessionCompleted({ event, stripe, supabase })
    } else {
      const handled = await handleBillingStripeEvent({
        event,
        stripe,
        supabase,
      })
      if (!handled) {
        console.log(`Unhandled Stripe event type: ${event.type}`)
      }
    }

    await completeStripeWebhookDelivery(supabase, event.id, claimToken)
    return NextResponse.json({ received: true, eventId: event.id })
  } catch (processingError) {
    console.error("Failed to process Stripe webhook event", processingError)
    try {
      await failStripeWebhookDelivery(
        supabase,
        event.id,
        claimToken,
        processingError,
      )
    } catch (claimError) {
      console.error("Failed to release Stripe webhook claim", claimError)
    }
    return NextResponse.json(
      {
        error: "Failed to process webhook event",
        eventId: event.id,
        message:
          processingError instanceof Error
            ? processingError.message
            : String(processingError),
      },
      { status: 500 },
    )
  }
}
