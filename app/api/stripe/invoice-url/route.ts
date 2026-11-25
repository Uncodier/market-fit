import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { z } from 'zod'
import { requireStripeSiteAccess } from '@/lib/auth/api-stripe-access'

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY

const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2025-05-28.basil' })
  : null

const stripeInvoiceIdSchema = z.string().regex(/^in_[A-Za-z0-9]+$/)
const downloadSchema = z.object({
  purpose: z.literal('download').optional(),
  siteId: z.string().uuid(),
  stripe_invoice_id: stripeInvoiceIdSchema.optional(),
  stripe_payment_intent_id: z.string().regex(/^pi_[A-Za-z0-9]+$/).optional(),
}).refine(
  (value) => value.stripe_invoice_id || value.stripe_payment_intent_id,
  { message: 'A Stripe invoice or payment intent ID is required' }
)
const requestSchema = z.union([
  z.object({ purpose: z.literal('pay'), siteId: z.string().uuid(), paymentId: z.string().uuid() }),
  downloadSchema,
])
const privateHeaders = { 'Cache-Control': 'private, no-store' }

export async function POST(request: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe not configured' },
        { status: 500 }
      )
    }

    const parsed = requestSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
    const { siteId } = parsed.data

    const access = await requireStripeSiteAccess(request, siteId)
    if (access.error) return access.error

    if (parsed.data.purpose === 'pay') {
      return await resolvePayableInvoice(stripe, access.supabase, siteId, parsed.data.paymentId)
    }

    const { stripe_invoice_id, stripe_payment_intent_id } = parsed.data
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

async function resolvePayableInvoice(
  client: Stripe,
  supabase: NonNullable<Awaited<ReturnType<typeof requireStripeSiteAccess>>['supabase']>,
  siteId: string,
  paymentId: string,
) {
  const { data: payment, error } = await supabase.from('payments')
    .select('status, details').eq('site_id', siteId).eq('id', paymentId).maybeSingle()
  if (error || !payment) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404, headers: privateHeaders })
  }

  const unavailable = () => NextResponse.json(
    { error: 'Invoice is not payable' }, { status: 409, headers: privateHeaders },
  )
  const reference = stripeInvoiceIdSchema.safeParse(payment.details?.stripe_invoice_id)
  if (!reference.success || !['failed', 'pending'].includes(payment.status)) return unavailable()

  const { data: billing, error: billingError } = await supabase.from('billing')
    .select('stripe_customer_id').eq('site_id', siteId).maybeSingle()
  if (billingError) throw new Error('Billing lookup unavailable')
  if (!billing?.stripe_customer_id) return unavailable()

  const invoice = await client.invoices.retrieve(reference.data)
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
  if (invoice.id !== reference.data || customerId !== billing.stripe_customer_id ||
      invoice.status !== 'open' || !(invoice.amount_remaining > 0)) return unavailable()

  const url = URL.parse(invoice.hosted_invoice_url ?? '')
  if (!url || url.origin !== 'https://invoice.stripe.com' || url.username || url.password) return unavailable()
  return NextResponse.json({ url: url.href }, { headers: privateHeaders })
}


