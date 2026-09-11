import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
})

export async function POST(req: Request) {
  try {
    const { saleId, siteId, returnUrl, successUrl } = await req.json()
    const supabase = await createServiceClient(true)
    
    // 1. Fetch sale details
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select('*, leads(id, name, email)')
      .eq('id', saleId)
      .single()
      
    if (saleError || !sale) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 })
    }

    if (sale.stripe_checkout_session_id) {
       // if they already have an active checkout session that isn't paid, we might want to redirect them there. 
       // but for now, stripe.checkout.sessions.create creates a new one which is also fine.
    }
    
    const { data: site } = await supabase.from('sites').select('name').eq('id', siteId).single()
    const customerEmail = (sale.leads as any)?.email || sale.lead_email

    // See if there's an associated order to use its items
    const { data: order } = await supabase
      .from("sale_orders")
      .select("*, items:sale_order_items(*, catalog_item:catalog_items(image_url))")
      .eq("sale_id", saleId)
      .single()

    // 2. Create Stripe Session
    const currency = (sale.currency || 'USD').toLowerCase()
    
    const zeroDecimalCurrencies = ['jpy', 'bif', 'clp', 'djf', 'gnf', 'krw', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf'];
    const isZeroDecimal = zeroDecimalCurrencies.includes(currency);

    let lineItems = []
    if (order && order.items && order.items.length > 0) {
      lineItems = order.items.map((item: any) => {
        const imageUrl = item.catalog_item?.image_url
        const images = typeof imageUrl === 'string' && /^https?:\/\//i.test(imageUrl) ? [imageUrl] : undefined
        const rawDescription = typeof item.description === 'string' ? item.description.trim() : ''
        const description = rawDescription ? rawDescription.slice(0, 500) : undefined

        return {
          price_data: {
            currency,
            product_data: {
              name: item.name,
              ...(description ? { description } : {}),
              ...(images ? { images } : {}),
            },
            unit_amount: isZeroDecimal
              ? Math.round(item.unit_price ?? item.unitPrice ?? 0)
              : Math.round((item.unit_price ?? item.unitPrice ?? 0) * 100),
          },
          quantity: item.quantity,
        }
      })
      
      if (order.shipping_cost && order.shipping_cost > 0) {
        lineItems.push({
          price_data: {
            currency,
            product_data: { name: 'Shipping' },
            unit_amount: isZeroDecimal ? Math.round(order.shipping_cost) : Math.round(order.shipping_cost * 100),
          },
          quantity: 1,
        })
      }
      if (order.tax_total && order.tax_total > 0) {
        lineItems.push({
          price_data: {
            currency,
            product_data: { name: 'Tax' },
            unit_amount: isZeroDecimal ? Math.round(order.tax_total) : Math.round(order.tax_total * 100),
          },
          quantity: 1,
        })
      }
    } else {
      lineItems = [{
        price_data: {
          currency,
          product_data: { name: sale.product_name || sale.title || "Invoice Payment" },
          unit_amount: isZeroDecimal
            ? Math.round(sale.amount)
            : Math.round(sale.amount * 100),
        },
        quantity: 1,
      }]
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: successUrl || `${returnUrl}?success=true&sale_id=${saleId}`,
      cancel_url: `${returnUrl}?canceled=true`,
      customer_email: customerEmail || undefined,
      metadata: {
        type: order ? 'sale_order' : 'sale',
        site_id: siteId,
        sale_id: saleId,
        ...(order ? { order_id: order.id } : {}),
        ...(order?.buyer_user_id ? { buyer_user_id: order.buyer_user_id } : {}),
        ...(sale.lead_id ? { lead_id: sale.lead_id } : {})
      }
    })

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    console.error('Stripe sale checkout error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
