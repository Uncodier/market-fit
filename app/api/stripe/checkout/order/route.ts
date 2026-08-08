import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
})

export async function POST(req: Request) {
  try {
    const { orderId, siteId, returnUrl } = await req.json()
    const supabase = await createServiceClient(true)
    
    // 1. Fetch order details
    const { data: order, error: orderError } = await supabase
      .from('sale_orders')
      .select('*, items:sale_order_items(*)')
      .eq('id', orderId)
      .single()
      
    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    
    const { data: site } = await supabase.from('sites').select('name').eq('id', siteId).single()
    const { data: sale } = await supabase.from('sales').select('id, lead_id').eq('id', order.sale_id).single()
    let customerEmail = undefined
    if (sale?.lead_id) {
      const { data: lead } = await supabase.from('leads').select('email').eq('id', sale.lead_id).single()
      customerEmail = lead?.email
    }

    // 2. Create Stripe Session
    const orderCurrency = (order.currency || 'USD').toLowerCase()
    
    // Check if currency is a zero-decimal currency in Stripe
    const zeroDecimalCurrencies = ['jpy', 'bif', 'clp', 'djf', 'gnf', 'krw', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf'];
    const isZeroDecimal = zeroDecimalCurrencies.includes(orderCurrency);

    const lineItems = order.items.map((item: any) => ({
      price_data: {
        currency: orderCurrency,
        product_data: {
          name: item.name,
          description: item.description || undefined,
        },
        unit_amount: isZeroDecimal 
          ? Math.round(item.unit_price ?? item.unitPrice ?? 0)
          : Math.round((item.unit_price ?? item.unitPrice ?? 0) * 100),
      },
      quantity: item.quantity,
    }))

    // Add Shipping Cost as a line item if > 0
    if (order.shipping_cost && order.shipping_cost > 0) {
      lineItems.push({
        price_data: {
          currency: orderCurrency,
          product_data: {
            name: 'Shipping',
          },
          unit_amount: isZeroDecimal 
            ? Math.round(order.shipping_cost)
            : Math.round(order.shipping_cost * 100),
        },
        quantity: 1,
      })
    }

    // Add Tax as a line item if > 0 (to ensure total matches order.total)
    if (order.tax_total && order.tax_total > 0) {
      lineItems.push({
        price_data: {
          currency: orderCurrency,
          product_data: {
            name: 'Tax',
          },
          unit_amount: isZeroDecimal 
            ? Math.round(order.tax_total)
            : Math.round(order.tax_total * 100),
        },
        quantity: 1,
      })
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${returnUrl}?success=true&order_id=${orderId}`,
      cancel_url: `${returnUrl}?canceled=true`,
      customer_email: customerEmail || undefined,
      metadata: {
        type: 'sale_order',
        site_id: siteId,
        order_id: orderId,
        sale_id: order.sale_id,
        ...(order.buyer_user_id ? { buyer_user_id: order.buyer_user_id } : {}),
        ...(sale?.lead_id ? { lead_id: sale.lead_id } : {})
      }
    })

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    console.error('Stripe order checkout error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
