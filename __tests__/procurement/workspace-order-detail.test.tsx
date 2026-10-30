import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { getBuyerOrder } from '@/app/buyer/actions'
import { WorkspaceOrderDetailView } from '@/app/purchases/orders/WorkspaceOrderDetailView'
import { type WorkspaceOrder } from '@/app/purchases/orders/order-document-data'

jest.mock('@/app/buyer/actions', () => ({ getBuyerOrder: jest.fn() }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: () => '' }) }))
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: { id: 'buyer-site', name: 'Buyer Company' } }) }))
jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))

const order: WorkspaceOrder = {
  id: 'order-a', order_number: 'PO-42', owner_site_id: 'buyer-site',
  site: { id: 'seller-site', name: 'Real Vendor' }, status: 'completed',
  created_at: '2026-10-01T12:00:00Z', currency: 'EUR', subtotal: 25, discount_total: 2, tax_total: 3, total: 26,
  notes: 'Handle carefully', fulfillment_method: 'ship',
  shipping_address: { line1: '12 Buyer Street', line2: 'Floor 2', city: 'Paris', country: 'France' },
  sale_order_items: [
    { id: 'main', name: 'Coffee -> Large', quantity: 2, unit_price: 10, subtotal: 20, catalog_item_id: 'coffee' },
    { id: 'extra', name: 'Oat milk', quantity: 1, unit_price: 5, subtotal: 5, parent_sale_order_item_id: 'main' },
  ],
  shipments: [{ id: 'shipment', status: 'shipped', carrier: 'Carrier One', tracking_number: 'TRACK42', estimated_delivery_at: '2026-10-05' }],
  sales: [{ status: 'paid', amount: 26, amount_due: 0, payment_method: 'cash', payments: [
    { date: '2026-10-02', method: 'bank_transfer' }, { date: '2026-10-01', method: 'cash' },
  ] }],
  entitlements: [{ id: 'course', status: 'active', catalog_item: { name: 'Training', kind: 'digital_asset', digital_subtype: 'course' } }],
  reservations: [{ id: 'booking', status: 'confirmed', catalog_item: { name: 'Consultation' } }],
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(getBuyerOrder).mockResolvedValue({ data: order })
})

it('renders the document shell with backend parties, lines, totals and read-only actions', async () => {
  const breadcrumb = jest.fn()
  window.addEventListener('breadcrumb:update', breadcrumb)
  render(<WorkspaceOrderDetailView orderId="order-a" />)
  expect(screen.getByRole('status', { name: 'Loading order' })).toBeInTheDocument()
  const document = await screen.findByRole('article', { name: 'Purchase order document' })
  expect(getBuyerOrder).toHaveBeenCalledWith('order-a')
  expect(screen.getByText('Buyer Company')).toBeInTheDocument()
  expect(screen.getByText('Real Vendor')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'PO-42' })).toBeInTheDocument()
  expect(document.parentElement).toHaveClass('max-w-[800px]', 'mx-auto')
  expect(document.closest('.bg-muted\\/30')).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'Details' })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByRole('tab', { name: 'Shipments' }).closest('[data-toolbar-font]')).toHaveClass('sticky')
  expect(screen.getByText('Read-only').closest('[data-toolbar-font]')).toHaveClass('sticky')
  const table = screen.getByRole('table', { name: 'Order line items' })
  expect(within(table).getByText('Coffee')).toBeInTheDocument()
  expect(within(table).getByText('Large')).toBeInTheDocument()
  expect(within(table).getByText('+ Oat milk')).toBeInTheDocument()
  expect(within(document).getAllByText('€26.00').length).toBeGreaterThan(0)
  expect(screen.getByText('-€2.00')).toBeInTheDocument()
  expect(screen.getByText('€3.00')).toBeInTheDocument()
  expect(screen.getByText('Handle carefully')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Back to orders' })).toHaveAttribute('href', '/purchases/orders')
  expect(screen.getByRole('link', { name: 'Buy Again' })).toHaveAttribute('href', '/shop/seller-site')
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /edit|delete|publish/i })).not.toBeInTheDocument()
  const print = jest.spyOn(window, 'print').mockImplementation(() => {})
  fireEvent.click(screen.getByRole('button', { name: 'Print' }))
  expect(print).toHaveBeenCalledTimes(1)
  print.mockRestore()
  expect(breadcrumb).toHaveBeenCalledWith(expect.objectContaining({ detail: expect.objectContaining({ path: '/purchases/orders/order-a', title: 'PO-42' }) }))
  window.removeEventListener('breadcrumb:update', breadcrumb)
})

it('retains delivery, tracking, payment, and the existing buyer access destinations', async () => {
  render(<WorkspaceOrderDetailView orderId="order-a" />)
  await screen.findByText('TRACK42')
  expect(screen.getByText(/12 Buyer Street/)).toHaveTextContent('Floor 2')
  expect(screen.getByText('Carrier One')).toBeInTheDocument()
  expect(screen.getByText(/Estimated delivery:/)).toBeInTheDocument()
  expect(screen.getByText('bank transfer', { exact: false })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'View Course' })).toHaveAttribute('href', '/buyer/course/course')
  expect(screen.getByRole('link', { name: 'View Reservation' })).toHaveAttribute('href', '/buyer/reservations/booking')
})

it('switches to shipment details and returns to the document without reloading the order', async () => {
  render(<WorkspaceOrderDetailView orderId="order-a" />)
  await screen.findByRole('article', { name: 'Purchase order document' })
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Shipments' }), { button: 0, ctrlKey: false })
  expect(screen.getByRole('tab', { name: 'Shipments' })).toHaveAttribute('aria-selected', 'true')
  expect(screen.queryByRole('article')).not.toBeInTheDocument()
  expect(screen.getByText('TRACK42')).toBeInTheDocument()
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Details' }), { button: 0, ctrlKey: false })
  expect(screen.getByRole('article', { name: 'Purchase order document' })).toBeInTheDocument()
  expect(getBuyerOrder).toHaveBeenCalledTimes(1)
})


it.each(['Not authenticated', 'Not authorized for this order', 'This order requires unrestricted location access', 'Order not found'])('shows backend failure: %s, without successful content', async error => {
  jest.mocked(getBuyerOrder).mockResolvedValue({ error })
  render(<WorkspaceOrderDetailView orderId="denied" />)
  expect(await screen.findByRole('alert')).toHaveTextContent(error)
  expect(screen.queryByRole('article')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Print' })).not.toBeInTheDocument()
})

it('recovers from a thrown request through Retry', async () => {
  jest.mocked(getBuyerOrder).mockRejectedValueOnce(new Error('Network'))
  render(<WorkspaceOrderDetailView orderId="order-a" />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load this order')
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(await screen.findByRole('heading', { name: 'PO-42' })).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(getBuyerOrder).toHaveBeenCalledTimes(2)
})

it('does not let a late response overwrite a new route', async () => {
  let resolveOld!: (result: { data: WorkspaceOrder }) => void
  jest.mocked(getBuyerOrder).mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
  const view = render(<WorkspaceOrderDetailView orderId="old" />)
  view.rerender(<WorkspaceOrderDetailView orderId="new" />)
  await screen.findByRole('heading', { name: 'PO-42' })
  await act(async () => resolveOld({ data: { ...order, id: 'old', order_number: 'STALE' } }))
  expect(screen.queryByText('STALE')).not.toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'PO-42' })).toBeInTheDocument()
})

it('uses legacy JSON lines without mislabeling a different owner as the current workspace', async () => {
  jest.mocked(getBuyerOrder).mockResolvedValue({ data: {
    id: 'legacy', owner_site_id: 'other-buyer', items: [{ name: 'Legacy service', quantity: 1, unitPrice: 12, subtotal: 12 }], total: 12,
  } })
  render(<WorkspaceOrderDetailView orderId="legacy" />)
  await screen.findByText('Legacy service')
  expect(screen.getByText('Workspace buyer')).toBeInTheDocument()
  expect(screen.queryByText('Buyer Company')).not.toBeInTheDocument()
  expect(screen.getByText('No delivery information for this order.')).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Buy Again' })).not.toBeInTheDocument()
})


it('clears an already loaded order when navigating to a denied order', async () => {
  const view = render(<WorkspaceOrderDetailView orderId="order-a" />)
  await screen.findByRole('heading', { name: 'PO-42' })
  jest.mocked(getBuyerOrder).mockResolvedValue({ error: 'Not authorized for this order' })
  view.rerender(<WorkspaceOrderDetailView orderId="denied" />)
  expect(screen.queryByRole('article')).not.toBeInTheDocument()
  expect(await screen.findByRole('alert')).toHaveTextContent('Not authorized')
  expect(screen.queryByText('Real Vendor')).not.toBeInTheDocument()
})
