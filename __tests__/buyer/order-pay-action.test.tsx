import { act, fireEvent, render, screen } from '@testing-library/react'
import { BuyerOrderPayAction } from '@/app/buyer/components/BuyerOrderPayAction'
import { LocalizationProvider } from '@/app/context/LocalizationContext'
import type { BuyerOrderDetail } from '@/app/buyer/order-detail-display'

const order: BuyerOrderDetail = {
  id: 'order', created_at: '', status: 'pending', currency: 'USD',
  public_access_token: 'test-payment-token-123456789', sales: { status: 'pending', amount_due: 40 },
}
const renderAction = (data = order, demo = false) => render(<LocalizationProvider preferredLocale="en">
  <BuyerOrderPayAction order={data} demo={demo} />
</LocalizationProvider>)

beforeEach(() => {
  jest.clearAllMocks()
  if (!AbortSignal.timeout) Object.defineProperty(AbortSignal, 'timeout', { configurable: true, value: () => new AbortController().signal })
})

it('renders an embedded action without duplicating the payment title or balance', () => {
  renderAction()
  expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  expect(screen.queryByText('$40.00')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Pay now' })).toBeEnabled()
})

it('keeps the balance in compact list actions and contains the primary button wrapper', () => {
  render(<LocalizationProvider preferredLocale="en"><BuyerOrderPayAction order={order} compact /></LocalizationProvider>)
  expect(screen.getByText('$40.00')).toBeVisible()
  const button = screen.getByRole('button', { name: 'Pay now' })
  expect(button.parentElement).toHaveClass('btn-primary-well', 'w-full')
  expect(button.parentElement?.parentElement).toHaveClass('w-full', 'min-w-0')
})

it('never makes payment requests for a demo', () => {
  renderAction(order, true)
  const button = screen.getByRole('button', { name: 'Pay now' })
  expect(button).toBeDisabled()
  fireEvent.click(button)
  expect(fetch).not.toHaveBeenCalled()
})

it('disables payment without a valid link while explaining why', () => {
  renderAction({ ...order, public_access_token: null })
  expect(screen.getByRole('button', { name: 'Pay now' })).toBeDisabled()
  expect(screen.getByText(/Ask the seller/)).toBeVisible()
})

it('blocks demo identifiers even without the preview prop', () => {
  renderAction({ ...order, id: 'demo-order-1' })
  expect(screen.getByRole('button', { name: 'Pay now' })).toBeDisabled()
  expect(fetch).not.toHaveBeenCalled()
})

it('rechecks token expiry when the buyer clicks', () => {
  const now = Date.now()
  const clock = jest.spyOn(Date, 'now').mockReturnValue(now)
  renderAction({ ...order, public_access_token_expires_at: new Date(now + 1000).toISOString() })
  clock.mockReturnValue(now + 2000)
  fireEvent.click(screen.getByRole('button', { name: 'Pay now' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Online payment is unavailable')
  expect(fetch).not.toHaveBeenCalled()
  clock.mockRestore()
})

it('sends only identity, token and return URL and prevents duplicate clicks', async () => {
  let finish!: (value: Response) => void
  jest.mocked(fetch).mockImplementation(() => new Promise<Response>(resolve => { finish = resolve }))
  renderAction()
  const button = screen.getByRole('button', { name: 'Pay now' })
  fireEvent.click(button)
  fireEvent.click(button)
  expect(fetch).toHaveBeenCalledTimes(1)
  const [url, request] = jest.mocked(fetch).mock.calls[0]
  expect(url).toBe('/api/stripe/checkout/order')
  expect(JSON.parse(String(request?.body))).toEqual({
    orderId: 'order', publicAccessToken: order.public_access_token, returnUrl: `${window.location.origin}${window.location.pathname}`,
  })
  await act(async () => { finish({ ok: false, status: 409, json: async () => ({ error: 'private provider details' }) } as Response) })
  expect(screen.getByRole('alert')).toHaveTextContent('The balance or checkout has changed')
  expect(screen.queryByText('private provider details')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Pay now' })).toBeEnabled()
})

it('rejects unsafe redirects and never marks a payment as successful', async () => {
  jest.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ url: 'https://evil.test/' }) } as Response)
  renderAction()
  fireEvent.click(screen.getByRole('button', { name: 'Pay now' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Checkout could not be opened')
  expect(screen.queryByText(/Payment successful/)).not.toBeInTheDocument()
})

it('handles network failures without automatic payment retries', async () => {
  jest.mocked(fetch).mockRejectedValue(new Error('Network error'))
  renderAction()
  fireEvent.click(screen.getByRole('button', { name: 'Pay now' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Checkout could not be opened')
  expect(fetch).toHaveBeenCalledTimes(1)
})