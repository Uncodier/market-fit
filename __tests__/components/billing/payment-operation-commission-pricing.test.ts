import { paymentOperationDescription } from '@/app/payments/payment-operation-description'
import type { PaymentOperationRow } from '@/app/payments/payment-dashboard-types'

const operation: PaymentOperationRow = {
  id: 'commission-fixture', status: 'completed', created_at: '2026-10-15T00:00:00Z',
  transaction_type: 'commission', amount: 7,
}

it.each([0.045, 0.055, 0.06, 0.07])('shows the recorded total fee %s without floating-point artifacts', rate => {
  expect(paymentOperationDescription({ ...operation, details: { commission_basis: 'processing_included', commission_rate: rate } })).toBe(
    `Total Card Payment Fee (${Number((rate * 100).toFixed(2))}% · processing included)`,
  )
})

it('uses stored historical rates rather than the current subscription schedule', () => {
  expect(paymentOperationDescription({ ...operation, details: { commission_rate: 0.02 } })).toBe('Platform Commission')
  expect(paymentOperationDescription({ ...operation, details: { commission_basis: 'processing_included', commission_rate: '0.055' } })).toBe('Total Card Payment Fee (5.5% · processing included)')
})

it.each([undefined, 'invalid', 0, 1])('does not invent a percentage for invalid or absent rate %s', rate => {
  expect(paymentOperationDescription({ ...operation, details: { commission_basis: 'processing_included', commission_rate: rate } })).toBe('Total Card Payment Fee (processing included)')
})

it.each([['USD', 'Sale Revenue'], ['usd', 'Sale Revenue'], ['mxn', 'Sale Revenue (Paid in MXN)']])('preserves sale revenue currency %s', (currency, expected) => {
  expect(paymentOperationDescription({ ...operation, transaction_type: 'sale', details: { original_currency: currency } })).toBe(expected)
})