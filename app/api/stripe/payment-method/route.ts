import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
})

type CardSummary = {
  brand: string
  last4: string
  expMonth: number
  expYear: number
}

function asId(value: unknown): string | null {
  if (typeof value === 'string' && value) return value
  if (value && typeof value === 'object' && 'id' in value) {
    return String((value as { id: string }).id)
  }
  return null
}

function fromPaymentMethod(pm: Stripe.PaymentMethod | null | undefined): CardSummary | null {
  if (!pm?.card) return null
  return {
    brand: pm.card.brand,
    last4: pm.card.last4,
    expMonth: pm.card.exp_month,
    expYear: pm.card.exp_year,
  }
}

async function retrieveCard(id: string | null): Promise<CardSummary | null> {
  if (!id) return null
  try {
    return fromPaymentMethod(await stripe.paymentMethods.retrieve(id))
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Payment service is not configured' }, { status: 500 })
    }

    const siteId = request.nextUrl.searchParams.get('siteId')
    if (!siteId) {
      return NextResponse.json({ error: 'Missing siteId' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: billing } = await supabase
      .from('billing')
      .select('stripe_customer_id')
      .eq('site_id', siteId)
      .single()

    const customerId = billing?.stripe_customer_id
    if (!customerId) {
      return NextResponse.json({ paymentMethod: null })
    }

    const customer = await stripe.customers.retrieve(customerId, {
      expand: ['invoice_settings.default_payment_method'],
    })

    if (customer.deleted) {
      return NextResponse.json({ paymentMethod: null })
    }

    const defaultPm = customer.invoice_settings?.default_payment_method
    let card = fromPaymentMethod(
      typeof defaultPm === 'object' && defaultPm && !('deleted' in defaultPm)
        ? (defaultPm as Stripe.PaymentMethod)
        : null
    )

    if (!card) {
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 5,
      })
      const active = subscriptions.data.find((sub) =>
        ['active', 'trialing', 'past_due'].includes(sub.status)
      )
      card = await retrieveCard(asId(active?.default_payment_method || active?.default_source))
    }

    if (!card) {
      const listed = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
        limit: 1,
      })
      card = fromPaymentMethod(listed.data[0])
    }

    return NextResponse.json({ paymentMethod: card })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load payment method'
    console.error('Stripe payment method error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
