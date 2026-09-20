import type { CheckoutCartParams } from '@/app/commerce/checkout'
import { resolveAppApiUrl } from '@/app/commerce/app-api-url'

import type { KitchenDelta } from "@/lib/printer/core/types"

const MAX_PENDING_MUTATIONS = 100
const pendingMutationIds = new Map<string, string>()

function checkoutMutation(params: CheckoutCartParams): {
  fingerprint: string
  id: string
} {
  const fingerprint = JSON.stringify(params)
  const existing = pendingMutationIds.get(fingerprint)
  if (existing) return { fingerprint, id: existing }

  if (pendingMutationIds.size >= MAX_PENDING_MUTATIONS) {
    const oldest = pendingMutationIds.keys().next().value
    if (oldest) pendingMutationIds.delete(oldest)
  }

  const id = crypto.randomUUID()
  pendingMutationIds.set(fingerprint, id)
  return { fingerprint, id }
}

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
  const mutation = checkoutMutation(params)
  const payload = {
    ...params,
    clientMutationId: params.clientMutationId || mutation.id,
  }
  const res = await fetch(resolveAppApiUrl('/api/commerce/checkout'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    credentials: 'include',
  })

  let data: CheckoutCartResult
  try {
    data = await res.json()
  } catch {
    return { error: 'Checkout failed. Please try again.' }
  }

  if (res.ok || (res.status >= 400 && res.status < 500)) {
    pendingMutationIds.delete(mutation.fingerprint)
  }

  if (!res.ok) {
    return { error: data?.error || 'Checkout failed. Please try again.' }
  }

  return data
}

export async function createStripeOrderCheckout(params: {
  orderId: string
  publicAccessToken: string
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
