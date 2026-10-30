import { orderPaymentState, stripeCheckoutUrl } from '@/app/buyer/order-payment'
import type { BuyerOrderDetail } from '@/app/buyer/order-detail-display'

const order: BuyerOrderDetail = {
  id: 'order', created_at: '', status: 'pending', public_access_token: 'test-payment-token-123456789',
  sales: { status: 'pending', amount_due: 40 },
}

it('uses the outstanding balance, including partially paid completed orders', () => {
  expect(orderPaymentState(order)?.due).toBe(40)
  expect(orderPaymentState({ ...order, status: 'completed', sales: [{ status: 'completed', amount_due: '12.50' }] })?.due).toBe(12.5)
})

it.each(['cancelled', 'refunded', 'failed', 'paid'])('rejects nonpayable sale state %s', status => {
  expect(orderPaymentState({ ...order, sales: { status, amount_due: 40 } })).toBeNull()
})

it.each([0, -1, null, undefined, 'invalid', Infinity])('rejects absent or nonpositive balances %s', amount_due => {
  expect(orderPaymentState({ ...order, sales: { status: 'pending', amount_due } })).toBeNull()
})

it('rejects cancelled orders and ambiguous multiple sales', () => {
  expect(orderPaymentState({ ...order, status: 'cancelled' })).toBeNull()
  expect(orderPaymentState({ ...order, sales: [{ status: 'pending', amount_due: 1 }, { status: 'pending', amount_due: 2 }] })).toBeNull()
})

it.each([
  { public_access_token: null }, { public_access_token: 'invalid' },
  { public_access_token_revoked_at: '2026-01-01' },
  { public_access_token_expires_at: '2020-01-01' }, { public_access_token_expires_at: 'invalid' },
])('keeps the balance visible but disables unavailable links %p', changes => {
  expect(orderPaymentState({ ...order, ...changes })).toEqual({ due: 40, token: null })
})

it('allows only Stripe-hosted HTTPS checkout URLs', () => {
  expect(stripeCheckoutUrl('https://checkout.stripe.com/c/pay/test')).toBe('https://checkout.stripe.com/c/pay/test')
  for (const value of ['javascript:alert(1)', 'https://evil.test', 'https://checkout.stripe.com.evil.test/', 'https://user@checkout.stripe.com/', 'http://checkout.stripe.com/', null]) {
    expect(stripeCheckoutUrl(value)).toBeNull()
  }
})