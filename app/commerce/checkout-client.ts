import type { CheckoutCartParams } from '@/app/commerce/checkout'
import { resolveAppApiUrl } from '@/app/commerce/app-api-url'

export type CheckoutCartResult =
  | { success: true; saleId: string; orderId: string; error?: undefined }
  | { error: string; success?: undefined; saleId?: undefined; orderId?: undefined }

/**
 * Call checkout over HTTP so www → app proxy does not trip Server Actions CSRF.
 * On www, APIs are not proxied — requests go to app.makinari.com.
 */
export async function checkoutCartRequest(
  params: CheckoutCartParams
): Promise<CheckoutCartResult> {
  const res = await fetch(resolveAppApiUrl('/api/commerce/checkout'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    credentials: 'include',
  })

  let data: CheckoutCartResult
  try {
    data = await res.json()
  } catch {
    return { error: 'Checkout failed. Please try again.' }
  }

  if (!res.ok) {
    return { error: data?.error || 'Checkout failed. Please try again.' }
  }

  return data
}

export async function createStripeOrderCheckout(params: {
  orderId: string
  siteId: string
  returnUrl: string
}): Promise<{ url?: string; error?: string }> {
  const res = await fetch(resolveAppApiUrl('/api/stripe/checkout/order'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    credentials: 'include',
  })

  try {
    return await res.json()
  } catch {
    return { error: 'Failed to connect to payment gateway' }
  }
}
