import { getOrderSales, recordedAmount, type BuyerOrderDetail } from './order-detail-display'

/** Display eligibility only. The existing checkout route rechecks the authoritative balance and token. */
export function orderPaymentState(order: BuyerOrderDetail, now = Date.now()) {
  const sales = getOrderSales(order)
  if (!['pending', 'completed'].includes(order.status || '') || sales.length !== 1) return null
  const sale = sales[0]
  if (!['pending', 'completed'].includes(sale.status || '')) return null
  const due = recordedAmount(sale.amount_due)
  if (due === null || due <= 0) return null
  const token = order.public_access_token
  const expiry = order.public_access_token_expires_at
  const available = typeof token === 'string' && /^[A-Za-z0-9_-]{20,64}$/.test(token)
    && !order.public_access_token_revoked_at
    && (!expiry || Date.parse(expiry) > now)
  return { due, token: available ? token : null }
}

/** Never navigate to arbitrary URLs returned by a failed or malformed checkout response. */
export function stripeCheckoutUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === 'checkout.stripe.com'
      && !url.username && !url.password && !url.port ? url.href : null
  } catch {
    return null
  }
}