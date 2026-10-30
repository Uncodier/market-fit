import React from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { BuyerOrderDetailView } from '@/app/buyer/components/BuyerOrderDetailView'
import { getBuyerOrder } from '@/app/buyer/actions'
import { LocalizationProvider } from '@/app/context/LocalizationContext'
import type { BuyerOrderDetail } from '@/app/buyer/order-detail-display'

jest.mock('@/app/buyer/actions', () => ({ getBuyerOrder: jest.fn() }))
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }) => {
    const imageProps = { ...props }
    delete imageProps.unoptimized
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...imageProps} alt={props.alt || ''} />
  }
}))

const order: BuyerOrderDetail = {
  id: 'order', order_number: 'TEST-1001', status: 'pending', created_at: '2026-10-20T04:00:00Z',
  site: { id: 'seller', name: 'Test seller' }, currency: 'USD', subtotal: 120, shipping_cost: 10, total: 130,
  fulfillment_method: 'ship', shipping_address: { line1: '123 Test Street', city: 'Test City' },
  sale_order_items: [{ id: 'item', name: 'Keyboard', quantity: 1, unit_price: 120, subtotal: 120, catalog_item_id: 'keyboard' }],
  sales: [{ status: 'pending', amount: 130, amount_due: 100, payments: [{ date: '2026-10-20T05:00:00Z', amount: 30, method: 'card' }] }],
  shipments: [
    { id: 'shipment-a', status: 'in_transit', carrier: 'Carrier A', tracking_number: 'TRACK-A', estimated_delivery_at: '2026-10-30T12:00:00Z', shipped_at: '2026-10-22T12:00:00Z' },
    { id: 'shipment-b', status: 'delivered', carrier: 'Carrier B', tracking_number: 'TRACK-B', delivered_at: '2026-10-23T12:00:00Z' }
  ]
}

const renderOrder = (locale = 'en') => render(<LocalizationProvider preferredLocale={locale}>
  <BuyerOrderDetailView orderId="order" />
</LocalizationProvider>)

beforeEach(() => {
  jest.clearAllMocks()
  ;(getBuyerOrder as jest.Mock).mockResolvedValue({ data: order })
})

it('shows status before items, every shipment, shipping cost and the actual paid balance', async () => {
  renderOrder()
  await screen.findByRole('heading', { name: 'Purchase TEST-1001' })
  const status = screen.getByRole('heading', { name: 'Order status' })
  const items = screen.getByRole('heading', { name: 'Items' })
  expect(status.compareDocumentPosition(items) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.getByText('TRACK-A')).toBeVisible()
  expect(screen.getByText('TRACK-B')).toBeVisible()
  expect(screen.getByText('Shipping').parentElement).toHaveTextContent('$10.00')
  expect(screen.getByText('Paid Amount').parentElement).toHaveTextContent('$30.00')
  expect(screen.getByText('Amount due').parentElement).toHaveTextContent('$100.00')
  fireEvent.click(screen.getByText('Payment history'))
  expect(screen.getAllByText('Card').length).toBeGreaterThan(0)
  expect(screen.getAllByText('View delivery details')).toHaveLength(2)
})

it('translates payment, shipment, fulfillment and date labels in Spanish', async () => {
  renderOrder('es')
  await screen.findByRole('heading', { name: 'Compra TEST-1001' })
  expect(screen.getByText('Estado del pago')).toBeVisible()
  expect(screen.getAllByText('En tránsito')).toHaveLength(2)
  expect(screen.getAllByText('Tarjeta')[0]).toBeVisible()
  expect(screen.queryByText('Pending')).not.toBeInTheDocument()
  expect(screen.queryByText('Ship')).not.toBeInTheDocument()
  expect(screen.getByText(/Fecha de compra/).textContent).not.toContain('October')
})

it('integrates the summary into the items card instead of a narrow side column', async () => {
  renderOrder()
  const heading = await screen.findByRole('heading', { name: 'Items' })
  const summary = screen.getByRole('region', { name: 'Order summary' })
  expect(heading.closest('.bg-card')).toContainElement(summary)
  const priceCells = heading.closest('.bg-card')?.querySelectorAll('.tabular-nums')
  expect(priceCells?.length).toBeGreaterThan(0)
})

it('keeps unshipped order status in a compact header without an empty card body', async () => {
  ;(getBuyerOrder as jest.Mock).mockResolvedValue({ data: { ...order, shipments: [] } })
  renderOrder()
  const heading = await screen.findByRole('heading', { name: 'Order status' })
  const card = heading.closest('.bg-card')
  expect(card?.children).toHaveLength(1)
  expect(card).toHaveTextContent('No shipment has been recorded yet.')
})

it('keeps a zero line subtotal and does not fabricate payment or delivery data', async () => {
  ;(getBuyerOrder as jest.Mock).mockResolvedValue({ data: {
    ...order, sales: null, shipments: [], fulfillment_method: 'none', shipping_address: null,
    sale_order_items: [{ id: 'free', name: 'Included item', quantity: 1, unit_price: 120, subtotal: 0 }]
  } })
  renderOrder()
  const item = await screen.findByText('Included item')
  expect(within(item.closest('.p-4') as HTMLElement).getAllByText('$0.00').length).toBeGreaterThan(0)
  expect(screen.getByText('No payment information has been recorded.')).toBeVisible()
  expect(screen.queryByText('Estimated delivery')).not.toBeInTheDocument()
  expect(screen.queryByText('Paid Amount')).not.toBeInTheDocument()
})

it('retains digital access and reservation destinations', async () => {
  ;(getBuyerOrder as jest.Mock).mockResolvedValue({ data: { ...order,
    entitlements: [{ id: 'course', status: 'active', catalog_item: { name: 'Test course', kind: 'digital_asset', digital_subtype: 'course' } }],
    reservations: [{ id: 'reservation', status: 'confirmed', catalog_item: { name: 'Test booking' } }]
  } })
  renderOrder()
  expect(await screen.findByRole('button', { name: 'View Course' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'View Reservation' })).toBeVisible()
})

it('does not advertise an upcoming delivery for terminal shipments or render invalid dates', async () => {
  ;(getBuyerOrder as jest.Mock).mockResolvedValue({ data: { ...order,
    shipments: ['delivered', 'cancelled', 'failed'].map((status, index) => ({
      id: `terminal-${index}`, status, estimated_delivery_at: '2026-10-30T12:00:00Z', shipped_at: 'invalid'
    }))
  } })
  renderOrder()
  await screen.findByRole('heading', { name: 'Purchase TEST-1001' })
  expect(screen.queryByText('Estimated delivery')).not.toBeInTheDocument()
  expect(screen.queryByText('Invalid Date')).not.toBeInTheDocument()
})

it('handles rejected reads without leaking backend details or staying in loading', async () => {
  ;(getBuyerOrder as jest.Mock).mockRejectedValue(new Error('Private backend details'))
  renderOrder()
  expect(await screen.findByText('Order not found')).toBeVisible()
  expect(screen.queryByText('Private backend details')).not.toBeInTheDocument()
})

it('ignores stale responses after navigating to another order', async () => {
  let resolveOld!: (value: { data: BuyerOrderDetail }) => void
  ;(getBuyerOrder as jest.Mock).mockImplementation((id: string) => id === 'order'
    ? new Promise(resolve => { resolveOld = resolve }) : Promise.resolve({ data: { ...order, order_number: 'NEW' } }))
  const view = renderOrder()
  view.rerender(<LocalizationProvider preferredLocale="en"><BuyerOrderDetailView orderId="new" /></LocalizationProvider>)
  await screen.findByRole('heading', { name: 'Purchase NEW' })
  await act(async () => { resolveOld({ data: order }) })
  expect(screen.queryByRole('heading', { name: 'Purchase TEST-1001' })).not.toBeInTheDocument()
})