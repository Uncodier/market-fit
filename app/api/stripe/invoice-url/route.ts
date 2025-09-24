import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY

const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2025-05-28.basil' })
  : null

export async function POST(request: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe not configured' },
        { status: 500 }
      )
    }

    const { stripe_invoice_id, stripe_payment_intent_id } = await request.json()

    if (!stripe_invoice_id && !stripe_payment_intent_id) {
      return NextResponse.json(
        { error: 'Missing stripe_invoice_id or stripe_payment_intent_id' },
        { status: 400 }
      )
    }

    // If we have an invoice id, fetch hosted invoice URL (preferred)
    if (stripe_invoice_id) {
      const invoice = await stripe.invoices.retrieve(stripe_invoice_id)
      const url = invoice.hosted_invoice_url || invoice.invoice_pdf || null
      if (!url) {
        return NextResponse.json(
          { error: 'Invoice URL not available yet' },
          { status: 404 }
        )
      }
      return NextResponse.json({ url })
    }

    // Otherwise resolve receipt URL from the payment intent's latest charge
    if (stripe_payment_intent_id) {
      const pi = await stripe.paymentIntents.retrieve(stripe_payment_intent_id, {
        expand: ['latest_charge'],
      }) as any

      const charge = pi.latest_charge || (pi.charges?.data?.[0] ?? null)
      const url = charge?.receipt_url || null
      if (!url) {
        return NextResponse.json(
          { error: 'Receipt URL not available' },
          { status: 404 }
        )
      }
      return NextResponse.json({ url })
    }

    return NextResponse.json({ error: 'Unable to resolve URL' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to resolve invoice URL' },
      { status: 500 }
    )
  }
}


