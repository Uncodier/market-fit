import type { CheckoutCartParams } from '@/app/commerce/checkout'
import { resolveAppApiUrl } from '@/app/commerce/app-api-url'

import type { KitchenDelta } from "@/lib/printer/core/types"

export type CheckoutCartSuccess = {
  success: true
  saleId: string
  orderId: string
  publicAccessToken: string
  orderNumber?: string | null
  status?: string | null
  total?: number | null
  currency?: string | null
  createdAt?: string | null
  kitchenDelta?: KitchenDelta | null
  notes?: string | null
  fulfillment?: string | null
  error?: undefined
}

export type CheckoutCartResult =
  | CheckoutCartSuccess
  | {
      error: string
      success?: undefined
      saleId?: undefined
      orderId?: undefined
      publicAccessToken?: undefined
    }

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
  /** When set, Stripe redirects here on success instead of returnUrl?success=true */
  successUrl?: string
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
