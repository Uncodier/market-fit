jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key, locale: 'en' }) }))
jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock('@/app/components/auth/auth-provider', () => ({ useAuthContext: () => ({ user: null }) }))

import { fireEvent, render, screen } from '@testing-library/react'
import { ProcurementOrdersPanel } from '@/app/purchases/procurement/commerce/ProcurementOrdersPanel'
import { acceptanceStatus } from '@/app/purchases/procurement/commerce/procurement-orders-list'
import { demoProcurementOrders } from '@/lib/demo-data/procurement-commerce'

beforeEach(() => jest.clearAllMocks())

it('puts the full-width sticky toolbar before the independently scrollable content', async () => {
  jest.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ data: demoProcurementOrders }) } as Response)
  const { container } = render(<ProcurementOrdersPanel siteId="buyer-a" navigation={<span>Order source</span>} />)
  await screen.findByText('Cedar Services')
  const toolbar = container.querySelector('[data-toolbar-font]')!
  const content = container.querySelector('.overflow-y-auto')!
  expect(toolbar).toHaveClass('sticky', 'shrink-0')
  expect(toolbar.parentElement).toHaveClass('contents')
  expect(content).toHaveClass('min-h-0', 'p-4', 'md:p-8')
  expect(content.contains(toolbar)).toBe(false)
  expect(screen.getByText('Order source')).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Procurement purchase orders' })).not.toBeInTheDocument()
})

it('switches between kanban and table without losing acceptance navigation', async () => {
  jest.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ data: demoProcurementOrders }) } as Response)
  render(<ProcurementOrdersPanel siteId="buyer-a" />)
  await screen.findByText('Cedar Services')
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('radio', { name: 'Toggle table view' }))
  expect(screen.getByRole('table')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Items and acceptance' }))
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})

it('filters orders by acceptance status and supplier search', async () => {
  jest.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ data: demoProcurementOrders }) } as Response)
  render(<ProcurementOrdersPanel siteId="buyer-a" />)
  await screen.findByText('Cedar Services')
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Completed' }), { button: 0, ctrlKey: false })
  await screen.findByText('No approved procurement orders.')
  expect(screen.queryByText('Cedar Services')).not.toBeInTheDocument()
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'All Orders' }), { button: 0, ctrlKey: false })
  await screen.findByText('Cedar Services')
  fireEvent.change(screen.getAllByPlaceholderText('Search documents…')[0], { target: { value: 'missing supplier' } })
  expect(screen.queryByText('Cedar Services')).not.toBeInTheDocument()
})

it('derives acceptance from received quantities without inventing payment or fulfillment states', () => {
  const order = demoProcurementOrders[0]
  expect(acceptanceStatus(order)).toBe('in_progress')
  expect(acceptanceStatus({ ...order, lines: order.lines.map(line => ({ ...line, received_quantity: 0 })) })).toBe('pending')
  expect(acceptanceStatus({ ...order, lines: order.lines.map(line => ({ ...line, received_quantity: line.quantity })) })).toBe('completed')
  expect(acceptanceStatus({ ...order, lines: [] })).toBe('pending')
})