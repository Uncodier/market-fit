import type { CheckoutCartParams } from '@/app/commerce/checkout'

export type CheckoutCartResult =
  | { success: true; saleId: string; orderId: string; error?: undefined }
  | { error: string; success?: undefined; saleId?: undefined; orderId?: undefined }

/**
 * Call checkout over HTTP so www → app proxy does not trip Server Actions CSRF.
 */
export async function checkoutCartRequest(
  params: CheckoutCartParams
): Promise<CheckoutCartResult> {
  const res = await fetch('/api/commerce/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
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
