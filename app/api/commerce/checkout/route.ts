import { NextResponse } from 'next/server'
import { checkoutCart, type CheckoutCartParams } from '@/app/commerce/checkout'
import { createClient } from '@/lib/supabase/server'
import {
  decodeRequestBody,
  readLimitedRequestBody,
  RequestBodyTooLargeError,
} from '@/lib/http/read-limited-request-body'

const MAX_CHECKOUT_BODY_BYTES = 64 * 1024
const MAX_LINES = 50
const MAX_MODIFIERS_PER_LINE = 25
const MAX_TOTAL_MODIFIERS = 200
const MAX_QUANTITY = 1000

function hasValidCheckoutBounds(body: CheckoutCartParams): boolean {
  if (
    typeof body.clientMutationId !== 'string' ||
    body.clientMutationId.length < 16 ||
    body.clientMutationId.length > 128 ||
    !Array.isArray(body.lines) ||
    body.lines.length > MAX_LINES
  ) {
    return false
  }

  let modifierCount = 0
  for (const line of body.lines) {
    if (
      !line.catalogItemId ||
      line.catalogItemId.length > 128 ||
      !Number.isSafeInteger(line.quantity) ||
      line.quantity <= 0 ||
      line.quantity > MAX_QUANTITY
    ) {
      return false
    }
    const modifiers = line.modifiers || []
    modifierCount += modifiers.length
    if (modifiers.length > MAX_MODIFIERS_PER_LINE) return false
    for (const modifier of modifiers) {
      if (
        !modifier.catalogItemId ||
        modifier.catalogItemId.length > 128 ||
        !Number.isSafeInteger(modifier.quantity) ||
        modifier.quantity <= 0 ||
        modifier.quantity > MAX_QUANTITY
      ) {
        return false
      }
    }
  }
  return modifierCount <= MAX_TOTAL_MODIFIERS
}

/**
 * HTTP entrypoint for cart checkout.
 * Used by www-proxied shop pages so payment does not depend on Server Actions
 * CSRF (Origin www vs x-forwarded-host app).
 */
export async function POST(req: Request) {
  try {
    const rawBody = decodeRequestBody(
      await readLimitedRequestBody(req, MAX_CHECKOUT_BODY_BYTES)
    )
    const body = JSON.parse(rawBody) as CheckoutCartParams

    if (
      !body?.siteId ||
      !body?.lines?.length ||
      !body?.fulfillment ||
      !body?.source ||
      !hasValidCheckoutBounds(body)
    ) {
      return NextResponse.json(
        { error: 'Missing required checkout fields' },
        { status: 400 }
      )
    }

    // Public storefronts only — POS/sales keep using the server action in-app.
    if (!['shop', 'marketplace', 'quote'].includes(body.source)) {
      return NextResponse.json({ error: 'Unsupported checkout source' }, { status: 400 })
    }

    // Strip internal/staff-only parameters that shouldn't be accessible via the public endpoint
    delete body.isStaffMutation;
    delete (body as any).userId;
    delete body.buyerUserId;

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user?.id) {
      body.buyerUserId = user.id
    }

    const result = await checkoutCart(body)

    if ("error" in result && result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (err: unknown) {
    if (err instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
    }
    console.error('Commerce checkout API error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Checkout failed' },
      { status: 500 }
    )
  }
}
