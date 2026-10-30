import { render, screen, waitFor } from '@testing-library/react'
import AccountPreview from '@/app/home/preview/[kind]/[id]/page'
import { BuyerOrderDetailView } from '@/app/buyer/components/BuyerOrderDetailView'
import { getBuyerOrder } from '@/app/buyer/actions'
import { demoAccountOrders } from '@/app/home/demo-commerce'
import { isProcurementPortalDemo } from '@/app/tenders/demo-mode'

jest.mock('@/app/buyer/actions', () => ({ getBuyerOrder: jest.fn() }))
jest.mock('@/app/home/demo-service-details', () => ({ DemoReservationDetail: () => null, DemoSubscriptionDetail: () => null }))
jest.mock('@/app/home/demo-library-detail', () => ({ DemoLibraryDetail: () => null }))
jest.mock('@/app/home/demo-quote-detail', () => ({ DemoQuoteDetail: () => null }))
jest.mock('@/app/tenders/demo-mode', () => ({ isProcurementPortalDemo: jest.fn() }))
jest.mock('@/app/context/LocalizationContext', () => ({
  useLocalization: () => {
    const { localeMessages } = jest.requireActual('@/app/context/locale-catalog')
    return { locale: 'en', t: (key: string) => localeMessages.en[key] || key }
  },
}))
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  notFound: () => { throw new Error('Not found') },
}))

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(isProcurementPortalDemo).mockResolvedValue(true)
})

it('renders the real buyer detail layout with fictional prices, delivery and unpaid status', async () => {
  render(await AccountPreview({ params: Promise.resolve({ kind: 'orders', id: 'demo-order-1' }) }))
  expect(screen.getByRole('heading', { name: 'Purchase DEMO-1001' })).toBeInTheDocument()
  expect(screen.getByText('Ergonomic keyboard')).toBeInTheDocument()
  expect(screen.getByText('Acme Workplace')).toBeInTheDocument()
  expect(screen.getAllByText('$120.00').length).toBeGreaterThan(1)
  expect(screen.getByRole('heading', { name: 'Delivery' })).toBeInTheDocument()
  expect(screen.getByText(/123 Demo Street/)).toBeInTheDocument()
  expect(screen.getByText('Payment')).toBeInTheDocument()
  // This legacy preview records a zero charge with a positive balance; do not infer paid amount.
  expect(screen.queryByText('Paid Amount')).not.toBeInTheDocument()
  expect(screen.getByText('Amount due').parentElement).toHaveTextContent('$120.00')
  expect(screen.getByRole('link', { name: 'Back to orders' })).toHaveAttribute('href', '/home/orders')
  expect(screen.getByRole('button', { name: 'Buy Again' })).toBeDisabled()
  expect(getBuyerOrder).not.toHaveBeenCalled()
})

it('shows a completed fictional order without calling the live action', async () => {
  render(await AccountPreview({ params: Promise.resolve({ kind: 'orders', id: 'demo-order-3' }) }))
  expect(screen.getByText('Demo Delivery')).toBeInTheDocument()
  expect(screen.getByText('DEMO-TRACK-1003')).toBeInTheDocument()
  expect(screen.getByText('Paid')).toBeInTheDocument()
  expect(getBuyerOrder).not.toHaveBeenCalled()
})

it('updates preview data on navigation without a live request', () => {
  const view = render(<BuyerOrderDetailView orderId="demo-order-1" previewOrder={demoAccountOrders[0]} />)
  view.rerender(<BuyerOrderDetailView orderId="demo-order-3" previewOrder={demoAccountOrders[2]} />)
  expect(screen.getByRole('heading', { name: 'Purchase DEMO-1003' })).toBeInTheDocument()
  expect(screen.queryByText('Ergonomic keyboard')).not.toBeInTheDocument()
  expect(getBuyerOrder).not.toHaveBeenCalled()
})

it('retains live loading and buy-again navigation outside previews', async () => {
  jest.mocked(getBuyerOrder).mockResolvedValue({ data: demoAccountOrders[0] })
  render(<BuyerOrderDetailView orderId="live-order" />)
  await screen.findByRole('heading', { name: 'Purchase DEMO-1001' })
  expect(getBuyerOrder).toHaveBeenCalledWith('live-order')
  expect(screen.getByRole('button', { name: 'Buy Again' })).toBeEnabled()
})

it('handles a rejected live request rather than leaving a permanent loading screen', async () => {
  jest.mocked(getBuyerOrder).mockRejectedValue(new Error('Network'))
  render(<BuyerOrderDetailView orderId="live-order" />)
  await waitFor(() => expect(screen.getByText('Order not found')).toBeInTheDocument())
})

it('rejects unknown order IDs', async () => {
  await expect(AccountPreview({ params: Promise.resolve({ kind: 'orders', id: 'missing' }) })).rejects.toThrow('Not found')
  expect(getBuyerOrder).not.toHaveBeenCalled()
})

it('requires demo mode before rendering fictional details', async () => {
  jest.mocked(isProcurementPortalDemo).mockResolvedValue(false)
  await expect(AccountPreview({ params: Promise.resolve({ kind: 'orders', id: 'demo-order-1' }) })).rejects.toThrow('Not found')
  expect(getBuyerOrder).not.toHaveBeenCalled()
})