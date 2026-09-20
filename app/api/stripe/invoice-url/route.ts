import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { z } from 'zod'
import { requireStripeSiteAccess } from '@/lib/auth/api-stripe-access'

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY

const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2025-05-28.basil' })
  : null

const requestSchema = z.object({
  siteId: z.string().uuid(),
  stripe_invoice_id: z.string().regex(/^in_[A-Za-z0-9]+$/).optional(),
  stripe_payment_intent_id: z.string().regex(/^pi_[A-Za-z0-9]+$/).optional(),
}).refine(
  (value) => value.stripe_invoice_id || value.stripe_payment_intent_id,
  { message: 'A Stripe invoice or payment intent ID is required' }
)

export async function POST(request: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe not configured' },
        { status: 500 }
      )
    }

    const parsed = requestSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
    const { siteId, stripe_invoice_id, stripe_payment_intent_id } = parsed.data

    const access = await requireStripeSiteAccess(request, siteId)
    if (access.error) return access.error

    let paymentQuery = access.supabase
      .from('payments')
      .select('id')
      .eq('site_id', siteId)
    paymentQuery = stripe_invoice_id
      ? paymentQuery.eq('details->>stripe_invoice_id', stripe_invoice_id)
      : paymentQuery.eq(
          'details->>stripe_payment_intent_id',
          stripe_payment_intent_id!
        )
    const { data: payment, error: paymentError } = await paymentQuery.maybeSingle()
    if (paymentError || !payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
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
  } catch {
    return NextResponse.json(
      { error: 'Failed to resolve invoice URL' },
      { status: 500 }
    )
  }
}


