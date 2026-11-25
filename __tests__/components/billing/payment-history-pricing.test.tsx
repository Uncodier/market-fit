import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { PaymentHistory } from '@/app/components/billing/payment-history'
import { useSite } from '@/app/context/SiteContext'
import { useOptionalPermissions } from '@/app/context/PermissionContext'
import { billingInvoiceMessages } from '@/app/context/locales/billing/invoice'
import { createClient } from '@/lib/supabase/client'

jest.mock('@/app/context/SiteContext', () => ({ useSite: jest.fn() }))
jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))
jest.mock('@/app/context/PermissionContext', () => ({ useOptionalPermissions: jest.fn() }))
jest.mock('@/app/context/LocalizationContext', () => ({
  useLocalization: () => ({ t: (key: keyof typeof billingInvoiceMessages.es) => billingInvoiceMessages.es[key] ?? '' }),
}))

it('renders monthly payments without a stray zero and retains purchased-credit quantities', async () => {
  jest.mocked(useSite).mockReturnValue({ currentSite: { id: 'site-history' } } as never)
  const row = { amount: 99, status: 'completed', transaction_type: 'subscription', created_at: '2026-09-25T12:00:00Z' }
  const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), order: jest.fn().mockResolvedValue({
    data: [
      { ...row, id: 'payment-monthly', credits: 0 },
      { ...row, id: 'payment-purchase', transaction_type: 'credit_purchase', amount: 0, credits: 100 },
    ], error: null,
  }) }
  jest.mocked(createClient).mockReturnValue({ from: jest.fn().mockReturnValue(query) } as never)
  render(<PaymentHistory />)
  expect(await screen.findByText('Subscription Payment')).toBeInTheDocument()
  expect(screen.queryByText('Subscription Payment0')).not.toBeInTheDocument()
  expect(screen.getByText('Credit Purchase (100 credits)')).toBeInTheDocument()
  expect(screen.getByText('$99.00')).toBeInTheDocument()
  expect(query.eq).toHaveBeenCalledWith('site_id', 'site-history')
})

const siteId = 'site-history'
const invoiceRow = {
  amount: 99, transaction_type: 'subscription', created_at: '2026-09-25T12:00:00Z',
  details: { stripe_invoice_id: 'in_synthetic' },
}

function renderInvoiceHistory(role: string) {
  jest.mocked(useSite).mockReturnValue({ currentSite: { id: siteId } } as never)
  jest.mocked(useOptionalPermissions).mockReturnValue({ siteId, capabilities: { role }, can: () => true } as never)
  const data = [
    { ...invoiceRow, id: 'failed-invoice', status: 'failed' },
    { ...invoiceRow, id: 'pending-invoice', status: 'pending' },
    { ...invoiceRow, id: 'paid-invoice', status: 'completed' },
    { ...invoiceRow, id: 'failed-without-invoice', status: 'failed', details: {} },
  ]
  const query = {
    select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue({ data, error: null }),
  }
  jest.mocked(createClient).mockReturnValue({ from: jest.fn().mockReturnValue(query) } as never)
  return render(<PaymentHistory />)
}

it('shows a labeled payment action only for failed or pending Stripe invoices and preserves downloads', async () => {
  renderInvoiceHistory('owner')
  const [, failed, pending, paid, noInvoice] = await screen.findAllByRole('row')
  for (const row of [failed, pending]) {
    expect(within(row).getByRole('button', { name: 'Pagar ahora' })).toBeEnabled()
    expect(within(row).getByRole('button', { name: 'Download Invoice' })).toBeEnabled()
  }
  for (const row of [paid, noInvoice]) {
    expect(within(row).queryByRole('button', { name: 'Pagar ahora' })).not.toBeInTheDocument()
  }
})

it('does not offer payment to a non-manager', async () => {
  renderInvoiceHistory('collaborator')
  await screen.findByText('Pending')
  expect(screen.queryByRole('button', { name: 'Pagar ahora' })).not.toBeInTheDocument()
})

it('checks the selected invoice on demand, prevents repeat clicks and announces non-payable invoices', async () => {
  const originalFetch = global.fetch
  let finish!: (response: Response) => void
  const fetchMock = jest.fn(() => new Promise<Response>(resolve => { finish = resolve }))
  global.fetch = fetchMock
  try {
    renderInvoiceHistory('admin')
    const [button] = await screen.findAllByRole('button', { name: 'Pagar ahora' })
    expect(fetchMock).not.toHaveBeenCalled()
    button.focus()
    fireEvent.click(button)
    fireEvent.click(button)
    expect(button).toHaveFocus()
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).toHaveAccessibleDescription('Abriendo Stripe…')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/stripe/invoice-url', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ purpose: 'pay', siteId, paymentId: 'failed-invoice' }),
    }))
    finish({ status: 409 } as Response)
    await waitFor(() => expect(button).toHaveAccessibleDescription('Esta factura ya no tiene un enlace de pago disponible.'))
    fireEvent.click(button)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  } finally {
    global.fetch = originalFetch
  }
})