import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { z } from 'zod'
import { requireStripeSiteAccess } from '@/lib/auth/api-stripe-access'

const siteIdSchema = z.string().uuid()
const headers = { 'Cache-Control': 'private, no-store' }

export async function GET(request: Request) {
  const siteId = siteIdSchema.safeParse(new URL(request.url).searchParams.get('siteId'))
  if (!siteId.success) return NextResponse.json({ error: 'Invalid siteId' }, { status: 400, headers })

  try {
    const access = await requireStripeSiteAccess(request, siteId.data)
    if (access.error) return access.error
    if (access.role !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers })

    const { data: billing, error } = await access.supabase.from('billing')
      .select('stripe_customer_id').eq('site_id', siteId.data).maybeSingle()
    if (error) throw new Error('Billing lookup unavailable')
    const customerId = billing?.stripe_customer_id
    if (!customerId) return NextResponse.json({ hasPendingInvoice: false }, { headers })

    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error('Payment service is not configured')
    const stripe = new Stripe(key, { apiVersion: '2025-05-28.basil', timeout: 5000, maxNetworkRetries: 0 })
    const customer = await stripe.customers.retrieve(customerId)
    if (customer.deleted || customer.id !== customerId || customer.metadata?.site_id !== siteId.data) {
      throw new Error('Billing customer mismatch')
    }

    for await (const invoice of stripe.invoices.list({ customer: customerId, status: 'open', limit: 100 })) {
      if (invoice.status === 'open' && invoice.amount_remaining > 0) {
        return NextResponse.json({ hasPendingInvoice: true }, { headers })
      }
      if (request.signal.aborted) throw new Error('Invoice lookup canceled')
    }
    return NextResponse.json({ hasPendingInvoice: false }, { headers })
  } catch {
    return NextResponse.json({ error: 'Unable to check pending invoices' }, { status: 503, headers })
  }
}