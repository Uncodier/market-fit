import { act, render, screen, waitFor } from '@testing-library/react'
import { ProcurementListLoading, ProcurementListSkeleton } from '@/app/purchases/procurement/ui/list-loading'
import { TenderEditor } from '@/app/purchases/tenders/tender-editor'
import { RequestDetail } from '@/app/purchases/requests/request-detail'
import { SuppliersWorkspace } from '@/app/suppliers/components/workspace'
import { WorkspaceOrderDetailView } from '@/app/purchases/orders/WorkspaceOrderDetailView'
import { getBuyerOrder } from '@/app/buyer/actions'
import RequestLoading from '@/app/purchases/requests/[id]/loading'
import SupplierLoading from '@/app/suppliers/[id]/loading'
import OrderLoading from '@/app/purchases/orders/[id]/loading'
import QuoteLoading from '@/app/purchases/quotes/[id]/loading'
import EditTenderLoading from '@/app/purchases/tenders/[id]/edit/loading'
import NewTenderLoading from '@/app/purchases/tenders/new/loading'
import NewRequestLoading from '@/app/purchases/requests/new/loading'
import PublicLoading from '@/app/tenders/loading'
import SiteLoading from '@/app/tenders/[siteSlug]/loading'
import PublicDetailLoading from '@/app/tenders/[siteSlug]/[tenderSlug]/loading'
import { tenderDetailClasses } from '@/app/tenders/detail-presentation'

const siteId = '00000000-0000-4000-8000-000000000001'
let mockSite: { id: string; name: string } | null = null
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: mockSite }) }))
jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ locale: 'en', t: (key: string) => key }) }))
jest.mock('@/app/components/auth/auth-provider', () => ({ useAuthContext: () => ({ user: null, isLoading: true }) }))
jest.mock('@/app/buyer/actions', () => ({ getBuyerOrder: jest.fn() }))
jest.mock('@/app/tenders/public-header', () => ({ TenderHeader: () => <div data-testid="public-header" />, TenderFooter: () => <div data-testid="public-footer" /> }))

beforeEach(() => {
  mockSite = null
  jest.clearAllMocks()
  jest.mocked(fetch).mockImplementation(() => new Promise(() => {}))
  jest.mocked(getBuyerOrder).mockImplementation(() => new Promise(() => {}))
  Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: () => '00000000-0000-4000-8000-000000000002' })
})

test.each([4, 6])('list loading reserves %s actual document columns instead of a generic record block', columns => {
  const { container } = render(<ProcurementListLoading columns={columns} />)
  expect(screen.getByRole('status', { name: 'Loading content' })).toHaveAttribute('aria-busy', 'true')
  expect(container.querySelectorAll('thead th')).toHaveLength(columns)
  expect(container.querySelectorAll('tbody tr')).toHaveLength(6)
  expect(container.querySelectorAll('tbody tr:first-child td')).toHaveLength(columns)
  expect(container.querySelectorAll('[data-toolbar-font]')).toHaveLength(1)
  expect(container.querySelector('table')?.closest('[aria-hidden="true"]')).not.toBeNull()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

test('board retrieval uses horizontally scrollable stage columns without a second toolbar', () => {
  const { container } = render(<ProcurementListSkeleton board stages={6} />)
  expect(container.querySelectorAll('section')).toHaveLength(6)
  expect(container.querySelector('section')?.parentElement).toHaveClass('overflow-x-auto')
  expect(container.querySelector('table')).toBeNull()
  expect(container.querySelector('[data-toolbar-font]')).toBeNull()
})

test.each([
  ['request', RequestLoading, () => <RequestDetail id="request-one" />],
  ['supplier', SupplierLoading, () => <SuppliersWorkspace id="supplier-one" />],
])('%s route, site hydration and pending retrieval use the same dedicated document layout', async (_name, Loading, view) => {
  const route = render(<Loading />)
  const markup = screen.getByRole('status', { name: 'Loading content' }).outerHTML
  expect(route.container.querySelector('aside')).not.toBeNull()
  route.unmount()
  const { container, rerender } = render(view())
  expect(screen.getByRole('status', { name: 'Loading content' }).outerHTML).toBe(markup)
  expect(fetch).not.toHaveBeenCalled()
  mockSite = { id: siteId, name: 'Workspace' }
  await act(async () => { rerender(view()) })
  await waitFor(() => expect(fetch).toHaveBeenCalled())
  expect(screen.getByRole('status', { name: 'Loading content' }).outerHTML).toBe(markup)
  expect(container.querySelectorAll('[data-toolbar-font]')).toHaveLength(1)
})

test('purchase order initial retrieval preserves its centered 800px document, not two generic blocks', () => {
  const route = render(<OrderLoading />)
  const markup = screen.getByRole('status', { name: 'Loading content' }).outerHTML
  expect(route.container.querySelector('article')?.parentElement).toHaveClass('max-w-[800px]')
  route.unmount()
  mockSite = { id: siteId, name: 'Workspace' }
  render(<WorkspaceOrderDetailView orderId="order-one" />)
  expect(screen.getByRole('status', { name: 'Loading content' }).outerHTML).toBe(markup)
  expect(getBuyerOrder).toHaveBeenCalledWith('order-one')
})

test('quotation detail reserves the responsive information rail and three amount summaries', () => {
  const { container } = render(<QuoteLoading />)
  expect(container.querySelector('aside')).toHaveClass('lg:w-[340px]', 'xl:w-[380px]', 'lg:border-l', 'lg:border-t-0')
  expect(container.querySelector('main')).toHaveClass('lg:flex-1', 'lg:pr-8')
  expect(container.querySelector('main .sm\\:grid-cols-3')?.children).toHaveLength(3)
  expect(container.querySelector('header .h-11')).toHaveClass('shrink-0')
})

test.each([EditTenderLoading, NewTenderLoading, NewRequestLoading])('editor route overrides inherited detail/list fallback with the current modal geometry', Loading => {
  render(<Loading />)
  expect(screen.getByRole('dialog')).toHaveClass('max-h-[min(90dvh,720px)]')
  expect(screen.getByRole('status', { name: 'Loading content' })).toHaveAttribute('aria-busy', 'true')
  expect(document.querySelector('[data-toolbar-font]')).toBeNull()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  expect(fetch).not.toHaveBeenCalled()
})

test('tender editor hydration and pending edit retrieval both load inside a dialog', async () => {
  const { rerender } = render(<TenderEditor id="tender-one" />)
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(document.querySelector('[data-toolbar-font]')).toBeNull()
  mockSite = { id: siteId, name: 'Workspace' }
  await act(async () => { rerender(<TenderEditor id="tender-one" />) })
  expect(screen.getByRole('status', { name: 'Loading content' }).closest('[role="dialog"]')).toBe(screen.getByRole('dialog'))
  expect(fetch).toHaveBeenCalled()
})

test.each([PublicLoading, SiteLoading])('public directory skeleton reserves desktop facets and mobile chips/facets', Loading => {
  const { container } = render(<Loading />)
  expect(screen.getByTestId('public-header')).toBeInTheDocument()
  expect(screen.getByTestId('public-footer')).toBeInTheDocument()
  expect(container.querySelector('aside')).toHaveClass('md:w-64', 'md:sticky', 'md:overflow-y-auto')
  expect(container.querySelector('aside')).toHaveAttribute('aria-hidden', 'true')
  expect(container.querySelector('.top-\\[72px\\]')).toHaveClass('md:hidden', 'sticky')
  expect(container.querySelector('main')).toHaveAttribute('aria-busy', 'true')
})

test('public detail preserves the live reading column and sticky participation rail geometry', () => {
  const { container } = render(<PublicDetailLoading />)
  expect(container.querySelector('main')?.className).toBe(tenderDetailClasses.main)
  expect(container.querySelector(`.${'lg\\:grid-cols-\\[minmax\\(0\\,1fr\\)_24rem\\]'}`)?.className).toBe(tenderDetailClasses.grid)
  expect(container.querySelector('.lg\\:sticky')?.className).toBe(tenderDetailClasses.summary)
})