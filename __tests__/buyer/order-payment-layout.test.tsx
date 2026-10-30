import { render, screen, within } from '@testing-library/react'
import { BuyerOrderPayment } from '@/app/buyer/components/BuyerOrderPayment'
import { BuyerOrderDetailView } from '@/app/buyer/components/BuyerOrderDetailView'
import { LocalizationProvider } from '@/app/context/LocalizationContext'
import { getBuyerOrder } from '@/app/buyer/actions'
import type { BuyerOrderDetail } from '@/app/buyer/order-detail-display'

jest.mock('@/app/buyer/actions', () => ({ getBuyerOrder: jest.fn() }))

const order: BuyerOrderDetail = {
  id: 'order', order_number: 'ORDER-1', created_at: '2026-10-20', status: 'pending', currency: 'USD',
  public_access_token: 'test-payment-token-123456789', sales: { status: 'pending', amount: 120, amount_due: 40 },
}
const currency = (value: unknown) => `$${Number(value).toFixed(2)}`

it('places the only pay action inside the existing payment card in the full detail', async () => {
  jest.mocked(getBuyerOrder).mockResolvedValue({ data: order })
  render(<LocalizationProvider preferredLocale="en"><BuyerOrderDetailView orderId="order" /></LocalizationProvider>)
  const heading = await screen.findByRole('heading', { name: 'Payment' })
  const card = heading.closest('.bg-card') as HTMLElement
  expect(screen.getAllByRole('button', { name: 'Pay now' })).toHaveLength(1)
  expect(within(card).getByRole('button', { name: 'Pay now' })).toBeVisible()
  expect(within(card).getAllByText('Amount due')).toHaveLength(1)
  expect(within(card).getAllByText('$40.00')).toHaveLength(1)
  expect(screen.queryByRole('heading', { name: 'Payment pending' })).not.toBeInTheDocument()
})

it('updates actions dynamically after payment and removes the action footer', () => {
  const view = render(<LocalizationProvider preferredLocale="en"><BuyerOrderPayment order={order} formatCurrency={currency} /></LocalizationProvider>)
  expect(screen.getByRole('button', { name: 'Pay now' })).toBeEnabled()
  view.rerender(<LocalizationProvider preferredLocale="en"><BuyerOrderPayment order={{ ...order, sales: { status: 'completed', amount: 120, amount_due: 0 } }} formatCurrency={currency} /></LocalizationProvider>)
  expect(screen.queryByRole('button', { name: 'Pay now' })).not.toBeInTheDocument()
  expect(screen.getByText('Paid Amount').parentElement).toHaveTextContent('$120.00')
})

it.each(['cancelled', 'refunded'])('does not display payment actions for %s sales', status => {
  render(<LocalizationProvider preferredLocale="en"><BuyerOrderPayment order={{ ...order, sales: { status, amount_due: 40 } }} formatCurrency={currency} /></LocalizationProvider>)
  expect(screen.queryByRole('button', { name: 'Pay now' })).not.toBeInTheDocument()
})

it('uses the checkout full-width button styling without demo messaging', () => {
  render(<LocalizationProvider preferredLocale="es"><BuyerOrderPayment order={order} formatCurrency={currency} demo /></LocalizationProvider>)
  const card = screen.getByRole('heading', { name: 'Pago' }).closest('.bg-card') as HTMLElement
  expect(within(card).getByRole('button', { name: 'Pagar ahora' })).toBeDisabled()
  expect(within(card).queryByText('Vista demo: los pagos están deshabilitados.')).not.toBeInTheDocument()
  const button = within(card).getByRole('button', { name: 'Pagar ahora' })
  expect(button).toHaveClass('w-full', 'h-12', 'rounded-lg', 'text-base')
  expect(button).not.toHaveClass('rounded-full')
  expect(button.parentElement).toHaveClass('w-full', 'h-12', 'rounded-lg')
  expect(button.parentElement?.parentElement).toHaveClass('w-full')
  expect(button.parentElement?.parentElement).not.toHaveClass('sm:w-auto')
})