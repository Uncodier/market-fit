/** @jest-environment node */
import type Stripe from 'stripe'
import { billingCardSummary, resolveBillingPaymentMethod } from '@/lib/billing/payment-method.server'
const customerId = 'cus_synthetic', site = 'site-synthetic'
const customer = jest.fn(), method = jest.fn(), list = jest.fn(), subscription = jest.fn()
const card = { id: 'pm_primary', customer: customerId, type: 'card', card: { brand: 'visa', last4: '1234', exp_month: 12, exp_year: 2099 } } as unknown as Stripe.PaymentMethod
const stripe = { customers: { retrieve: customer }, paymentMethods: { retrieve: method, list }, subscriptions: { retrieve: subscription } } as unknown as Stripe
beforeEach(() => {
  jest.clearAllMocks(); customer.mockResolvedValue({ id: customerId, metadata: { site_id: site }, invoice_settings: { default_payment_method: card.id } })
  method.mockResolvedValue(card); list.mockResolvedValue({ data: [card], has_more: false })
  subscription.mockResolvedValue({ customer: customerId, status: 'active', default_payment_method: card.id })
})
it('uses the exact principal Billing card without arbitrary list selection', async () => {
  expect((await resolveBillingPaymentMethod(stripe,customerId,site,'sub_synthetic'))?.id).toBe(card.id)
  expect(list).not.toHaveBeenCalled(); expect(subscription).not.toHaveBeenCalled()
})
it('uses current subscription card only when the customer has no default', async () => {
  customer.mockResolvedValue({ id: customerId, metadata: { site_id: site }, invoice_settings: {} })
  expect(await resolveBillingPaymentMethod(stripe,customerId,site,'sub_synthetic')).toBe(card)
  expect(subscription).toHaveBeenCalledWith('sub_synthetic')
})
it('uses a sole attached card but never chooses arbitrarily among several', async () => {
  customer.mockResolvedValue({ id: customerId, metadata: { site_id: site }, invoice_settings: {} })
  expect(await resolveBillingPaymentMethod(stripe,customerId,site)).toBe(card)
  list.mockResolvedValueOnce({ data: [card, {...card,id:'pm_other'}], has_more:false })
  expect(await resolveBillingPaymentMethod(stripe,customerId,site)).toBeNull()
})
it('rejects cross-site customer and subscription identity', async () => {
  customer.mockResolvedValueOnce({ id: customerId, metadata: { site_id: 'other' }, invoice_settings: {} })
  await expect(resolveBillingPaymentMethod(stripe,customerId,site)).rejects.toThrow('mismatch')
  customer.mockResolvedValue({ id: customerId, metadata: { site_id: site }, invoice_settings: {} })
  subscription.mockResolvedValueOnce({ customer:'cus_other' })
  await expect(resolveBillingPaymentMethod(stripe,customerId,site,'sub_other')).rejects.toThrow('mismatch')
})
it('does not reuse detached, wrong-customer, non-card or expired methods', async () => {
  for (const override of [{customer:null}, {customer:'cus_other'}, {type:'sepa_debit'}, {card:{...card.card,exp_year:2000}}]) {
    method.mockResolvedValueOnce({...card,...override})
    expect(await resolveBillingPaymentMethod(stripe,customerId,site)).toBeNull()
  }
})
it('returns only a public card summary, never the Stripe identifier', () => {
  expect(billingCardSummary(card,customerId)).toEqual({brand:'visa',last4:'1234',expMonth:12,expYear:2099})
  expect(JSON.stringify(billingCardSummary(card,customerId))).not.toContain(card.id)
})
