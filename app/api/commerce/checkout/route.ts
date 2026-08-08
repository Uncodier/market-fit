import { NextResponse } from 'next/server'
import { checkoutCart, type CheckoutCartParams } from '@/app/commerce/checkout'

/**
 * HTTP entrypoint for cart checkout.
 * Used by www-proxied shop pages so payment does not depend on Server Actions
 * CSRF (Origin www vs x-forwarded-host app).
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CheckoutCartParams

    if (!body?.siteId || !body?.lines?.length || !body?.fulfillment || !body?.source) {
      return NextResponse.json(
        { error: 'Missing required checkout fields' },
        { status: 400 }
      )
    }

    // Public storefronts only — POS/sales keep using the server action in-app.
    if (!['shop', 'marketplace', 'quote'].includes(body.source)) {
      return NextResponse.json({ error: 'Unsupported checkout source' }, { status: 400 })
    }

    const result = await checkoutCart(body)

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('Commerce checkout API error:', err)
    return NextResponse.json(
      { error: err?.message || 'Checkout failed' },
      { status: 500 }
    )
  }
}
