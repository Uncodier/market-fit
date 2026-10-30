import { addressLines, displayValue, formatOrderDate, getOrderSales, paymentAmounts, recordedAmount } from '@/app/buyer/order-detail-display'

describe('buyer order display', () => {
  it('uses the sale balance, not the sale charge, as evidence of payment', () => {
    expect(paymentAmounts({ amount: 120, amount_due: 120 })).toEqual({ paid: 0, due: 120 })
    expect(paymentAmounts({ amount: '120', amount_due: '30' })).toEqual({ paid: 90, due: 30 })
    expect(paymentAmounts({ amount: 120, amount_due: 0 })).toEqual({ paid: 120, due: 0 })
    expect(paymentAmounts({ amount: 120, status: 'completed' }).paid).toBeNull()
    expect(paymentAmounts({ amount: 120, amount_due: 150 }).paid).toBeNull()
    expect(paymentAmounts({ amount: 120, amount_due: -10 }).paid).toBeNull()
  })

  it('preserves recorded zeroes and treats missing or invalid amounts as unknown', () => {
    expect(recordedAmount(0)).toBe(0)
    expect(recordedAmount('0')).toBe(0)
    for (const value of [null, undefined, '', 'invalid', Infinity]) expect(recordedAmount(value)).toBeNull()
  })

  it('localizes dates and safely omits absent or malformed dates', () => {
    const date = '2026-10-20T04:00:00Z'
    expect(formatOrderDate(date, 'es')).toBe(new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date)))
    expect(formatOrderDate(date, 'es')).not.toBe(formatOrderDate(date, 'en'))
    expect(formatOrderDate('invalid', 'es')).toBeNull()
    expect(formatOrderDate(null, 'en')).toBeNull()
  })

  it('formats partial addresses without undefined fields or dangling punctuation', () => {
    expect(addressLines({ line1: '123 Street', city: 'City', postal_code: '12345' })).toEqual(['123 Street', 'City 12345'])
    expect(addressLines({})).toEqual([])
  })

  it('uses translations and human-readable fallbacks rather than translation keys', () => {
    const t = (key: string) => key === 'buyer.orders.status.in_transit' ? 'En tránsito' : key
    expect(displayValue('in_transit', 'buyer.orders.status', t)).toBe('En tránsito')
    expect(displayValue('custom_method', 'buyer.orders.paymentMethod', t)).toBe('custom method')
  })

  it('supports both singular and array sale relations', () => {
    const base = { id: 'order', created_at: '2026-10-20' }
    expect(getOrderSales({ ...base, sales: { amount: 10 } })).toEqual([{ amount: 10 }])
    expect(getOrderSales({ ...base, sales: [{ amount: 10 }, { amount: 20 }] })).toHaveLength(2)
    expect(getOrderSales(base)).toEqual([])
  })
})