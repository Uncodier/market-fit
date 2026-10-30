import { render, screen } from '@testing-library/react'
import { usePathname, useSearchParams } from 'next/navigation'
import { ProcurementLoading } from '@/app/purchases/procurement/ui/loading'
import { ProcurementWorkspace } from '@/app/purchases/procurement/ui/workspace'
import PurchasesLoading from '@/app/purchases/loading'
import SuppliersLoading from '@/app/suppliers/loading'
import HomeLoading from '@/app/home/loading'
import { TenderList } from '@/app/purchases/tenders/tender-list'
import Approvals from '@/app/purchases/procurement/approvals/page'
import { RequestList } from '@/app/purchases/requests/request-list'
import { RequestDetail } from '@/app/purchases/requests/request-detail'
import { SuppliersWorkspace } from '@/app/suppliers/components/workspace'
import Orders from '@/app/purchases/orders/page'
import Quotes from '@/app/purchases/quotes/page'
import Library from '@/app/purchases/library/page'
import Subscriptions from '@/app/purchases/subscriptions/page'
import RulesLoading from '@/app/purchases/rules/loading'
import MinimumsLoading from '@/app/inventory/minimums/loading'

jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ locale: 'en', t: (key: string) => key }) }))
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: null, isLoading: true }) }))
jest.mock('@/app/components/auth/auth-provider', () => ({ useAuthContext: () => ({ user: null, isLoading: true }) }))
jest.mock('@/app/hooks/use-command-k', () => ({ useCommandK: jest.fn() }))

beforeEach(() => {
  jest.mocked(fetch).mockClear()
  jest.mocked(usePathname).mockReturnValue('/purchases/tenders')
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as ReturnType<typeof useSearchParams>)
})

test.each([
  ['purchases route', <PurchasesLoading key="purchases" />],
  ['suppliers route', <SuppliersLoading key="suppliers" />],
  ['tender list', <TenderList key="list" />],
  ['approvals', <Approvals key="approvals" />],
  ['request list', <RequestList key="requests" />],
  ['request detail', <RequestDetail key="request-detail" id="request-one" />],
  ['supplier list', <SuppliersWorkspace key="supplier-list" />],
  ['orders', <Orders key="orders" />],
  ['quotes', <Quotes key="quotes" />],
  ['subscriptions', <Subscriptions key="subscriptions" />],
])('%s reserves the same workspace geometry before context is ready', (_name, component) => {
  const ready = render(<ProcurementWorkspace title="Tenders" toolbar={<span>Ready toolbar</span>}><span>Ready content</span></ProcurementWorkspace>)
  const readyRootClass = ready.container.firstElementChild!.className
  const readyHeaderClass = ready.container.querySelector('[data-toolbar-font]')!.className
  const readyContentClass = ready.container.firstElementChild!.lastElementChild!.className
  ready.unmount()

  const { container } = render(component)
  const root = screen.getByRole('status', { name: 'Loading content' })
  const header = root.firstElementChild!
  expect(root).toHaveAttribute('aria-busy', 'true')
  expect(root.className).toBe(readyRootClass)
  expect(container.querySelectorAll('[data-toolbar-font]')).toHaveLength(1)
  expect(header).toHaveAttribute('data-toolbar-font')
  expect(header.className).toBe(readyHeaderClass)
  expect(header).toHaveClass('sticky', 'shrink-0', 'top-[var(--topbar-height,64px)]', 'min-h-[71px]')
  expect(header.nextElementSibling!.className).toBe(readyContentClass)
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  expect(fetch).not.toHaveBeenCalled()
})

test('library preserves its asset-card grid and site-scoped subheader during context hydration', () => {
  const { container } = render(<Library />)
  expect(screen.getByRole('status', { name: 'Loading' })).toHaveAttribute('data-buyer-list-skeleton', 'library')
  expect(container.querySelectorAll('[data-toolbar-font]')).toHaveLength(1)
  expect(container.querySelector('.grid')).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3', 'gap-6')
  expect(container.querySelectorAll('.aspect-video')).toHaveLength(6)
  expect(fetch).not.toHaveBeenCalled()
})

test('the procurement toolbar reserves mobile filters and separate desktop filters/actions', () => {
  const { container } = render(<Approvals />)
  const header = container.querySelector('[data-toolbar-font]')!
  const toolbar = header.querySelector('[aria-hidden="true"]')!
  expect(toolbar).toHaveClass('py-3', 'justify-between', 'min-w-0')
  expect(toolbar.querySelector('.md\\:hidden')).toHaveClass('h-8', 'w-8', 'rounded-full')
  expect(toolbar.querySelector('.md\\:flex')).toHaveClass('hidden', 'overflow-hidden')
  expect(toolbar.lastElementChild).toHaveClass('ml-auto', 'shrink-0')
})

test.each([
  ['rules', <RulesLoading key="rules" />],
  ['minimums', <MinimumsLoading key="minimums" />],
])('%s keeps the form toolbar above its scrollable loading content', (_name, component) => {
  const { container } = render(component)
  const root = container.firstElementChild!
  const header = root.firstElementChild!
  expect(header).toHaveClass('sticky', 'shrink-0', 'top-[var(--topbar-height,64px)]', 'min-h-[71px]')
  expect(header.nextElementSibling).toHaveClass('overflow-auto', 'min-h-0')
  expect(header.querySelector('[aria-hidden="true"]')).toHaveClass('flex-wrap', 'min-w-0')
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

test.each([
  ['embedded content', <ProcurementLoading key="compact" compact />],
  ['account portal', <HomeLoading key="home" />],
])('%s does not insert a second workspace toolbar', (_name, component) => {
  const { container } = render(component)
  expect(screen.getByRole('status', { name: 'Loading content' })).toHaveAttribute('aria-busy', 'true')
  expect(container.querySelector('[data-toolbar-font]')).toBeNull()
  expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
})

test('artifact loading omits the workspace toolbar', () => {
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams('artifact=true') as ReturnType<typeof useSearchParams>)
  const { container } = render(<ProcurementLoading />)
  expect(container.querySelector('[data-toolbar-font]')).toBeNull()
  expect(screen.getByRole('status', { name: 'Loading content' })).toBeInTheDocument()
})