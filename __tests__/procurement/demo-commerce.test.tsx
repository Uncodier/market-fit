jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key, locale: 'en' }) }))
jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock('@/app/components/auth/auth-provider', () => ({ useAuthContext: () => ({ user: { id: 'demo-user' } }) }))
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: { id: 'demo-saas-en-123', name: 'Demo workspace' } }) }))

import { render, screen, fireEvent, within } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import { ProcurementQuotesPanel } from '@/app/purchases/procurement/commerce/ProcurementQuotesPanel'
import { ProcurementOrdersPanel } from '@/app/purchases/procurement/commerce/ProcurementOrdersPanel'
import Approvals from '@/app/purchases/procurement/approvals/page'
import { demoProcurementQuotes, demoProcurementOrders, demoOrderDocument } from '@/lib/demo-data/procurement-commerce'
import { ProcurementTab } from '@/app/catalog/procurement/ProcurementTab'
import { ReplenishmentRules } from '@/app/purchases/procurement/replenishment/rules'

beforeEach(() => { jest.clearAllMocks(); document.cookie = 'market_fit_demo_site_id=; max-age=0; path=/'; localStorage.clear() })

it('opens the formal received quotation detail without contacting APIs', async () => {
  const push = jest.fn()
  jest.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>)
  render(<ProcurementQuotesPanel siteId="demo-saas-en-123" embedded />)
  fireEvent.click(await screen.findByText('NS-2026-1042'))
  expect(push).toHaveBeenCalledWith('/purchases/quotes/demo-quote-northstar')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(fetch).not.toHaveBeenCalled()
})

it('filters embedded demo proposals by tender and resets them when workspace changes', async () => {
  const view = render(<ProcurementQuotesPanel siteId="demo-saas-en-123" tenderId="demo-tender-awarded" embedded />)
  expect(await screen.findByText('CED-2026-087')).toBeInTheDocument()
  expect(screen.queryByText('NS-2026-1042')).not.toBeInTheDocument()
  jest.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ data: [] }) } as Response)
  view.rerender(<ProcurementQuotesPanel siteId="real-workspace" embedded />)
  await screen.findByText('No procurement quotations recorded.')
  expect(screen.queryByText('CED-2026-087')).not.toBeInTheDocument()
  expect(fetch).toHaveBeenCalled()
})

it('shows order acceptance fields but cannot create a real receipt', async () => {
  render(<ProcurementOrdersPanel siteId="demo-ecom-es-456" />)
  expect(await screen.findByRole('link', { name: 'PO-DEMO-2026-001' })).toHaveAttribute('href', '/purchases/orders/demo-order-workplace')
  fireEvent.click(screen.getByRole('button', { name: 'Items and acceptance' }))
  fireEvent.change(screen.getByLabelText('Acceptance note'), { target: { value: 'Demo review' } })
  expect(screen.getByRole('button', { name: 'Record non-stock acceptance' })).toBeDisabled()
  expect(fetch).not.toHaveBeenCalled()
})

it('opens a pending award in the approval inbox without allowing real decisions', async () => {
  render(<Approvals />)
  fireEvent.click(await screen.findByRole('button', { name: 'Review' }))
  const dialog = within(screen.getByRole('dialog'))
  expect(await dialog.findByText('Procurement compliance')).toBeInTheDocument()
  fireEvent.change(dialog.getByRole('textbox'), { target: { value: 'Reviewed in demo' } })
  expect(dialog.getByRole('button', { name: 'Approve' })).toBeDisabled()
  expect(dialog.getByRole('button', { name: 'Reject' })).toBeDisabled()
  expect(fetch).not.toHaveBeenCalled()
})

it('keeps demo monetary totals and award/order links consistent', () => {
  for (const quote of demoProcurementQuotes) {
    expect(quote.lines.reduce((total, line) => total + line.quantity * line.unit_net_minor, 0)).toBe(quote.net_amount_minor)
    expect(quote.lines.reduce((total, line) => total + (line.tax_amount_minor ?? 0), 0)).toBe(quote.tax_amount_minor)
  }
  for (const order of demoProcurementOrders) {
    const quote = demoProcurementQuotes.find(item => item.id === order.quotation_id)
    expect(quote?.award_id).toBe(order.award_id)
    expect(quote?.net_amount_minor).toBe(order.net_amount_minor)
  }
  expect(demoOrderDocument('demo-saas-en-123', 'missing')).toBeNull()
})

it('does not fetch a stale real workspace while a demo cookie is active', () => {
  document.cookie = 'market_fit_demo_site_id=demo-saas-en-123; path=/'
  render(<ProcurementQuotesPanel siteId="real-workspace" embedded />)
  expect(screen.getByText('NS-2026-1042')).toBeInTheDocument()
  expect(fetch).not.toHaveBeenCalled()
})

it('shows catalog supplier offers without enabling real capability changes', () => {
  render(<ProcurementTab itemId="demo-product" siteId="demo-saas-en-123" />)
  expect(screen.getByRole('switch')).toBeDisabled()
  expect(screen.getByRole('link', { name: 'Northstar Technology' })).toHaveAttribute('href', '/suppliers/demo-supplier-northstar')
  expect(fetch).not.toHaveBeenCalled()
})

it('shows inventory minimum rules and a shortage case without fetching inventory', () => {
  render(<ReplenishmentRules siteId="demo-saas-en-123" />)
  expect(screen.getAllByText('USB-C adapters · Main office').length).toBeGreaterThan(0)
  expect(screen.getByText('Network cables · Service desk')).toBeInTheDocument()
  expect(fetch).not.toHaveBeenCalled()
})

it('shows sealed proposal counts without revealing quotation prices', () => {
  render(<ProcurementQuotesPanel siteId="demo-saas-en-123" tenderId="demo-tender-sealed" embedded />)
  expect(screen.getByRole('link', { name: 'Office connectivity upgrade' })).toHaveAttribute('href', '/purchases/tenders/demo-tender-sealed')
  expect(screen.queryByText('NS-2026-1042')).not.toBeInTheDocument()
  expect(screen.queryByText('$6,480.00')).not.toBeInTheDocument()
  expect(fetch).not.toHaveBeenCalled()
})