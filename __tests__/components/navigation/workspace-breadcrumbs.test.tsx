import { act, fireEvent, render, screen } from '@testing-library/react'
import { usePathname, useSearchParams } from 'next/navigation'
import { TopBarTitle } from '@/app/components/navigation/TopBarTitle'
import { NAVIGATION_AREAS, getNavItemTitle } from '@/app/config/navigation-areas'
import { localeMessages } from '@/app/context/locale-catalog'
import { workspaceScreenTitle } from '@/lib/navigation/workspace-screen'
import { getSection, hasId, reduceBreadcrumb } from '@/lib/navigation/breadcrumb-engine'

let mockLocale: 'en' | 'es' = 'en'
const mockNavigate = jest.fn()
let mockItems = [{ path: '/purchases', label: 'Compras', timestamp: 1 }]

jest.mock('@/app/hooks/use-breadcrumb-history', () => ({
  useNavigationHistory: () => ({ items: mockItems, hasHistory: true, navigateTo: mockNavigate }),
}))
jest.mock('@/app/context/LocalizationContext', () => ({
  useLocalization: () => ({ t: (key: string) => localeMessages[mockLocale][key] ?? key }),
}))
jest.mock('@/app/components/ui/help-button', () => ({ HelpButton: () => null }))
jest.mock('@/app/components/navigation/NavigationLink', () => ({ NavigationLink: () => null }))

const items = Object.values(NAVIGATION_AREAS).flatMap(area => area.items)
  .filter(item => !item.dashboardTab)
const translate = (key: string) => localeMessages[mockLocale][key] ?? key

function setRoute(path: string) {
  const [pathname, query] = path.split('?')
  jest.mocked(usePathname).mockReturnValue(pathname)
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams(query) as ReturnType<typeof useSearchParams>)
}

beforeEach(() => {
  mockLocale = 'en'
  mockNavigate.mockClear()
  mockItems = [{ path: '/purchases', label: 'Compras', timestamp: 1 }]
})

test.each(items)('renders $key as its own root in English and Spanish with stale history', item => {
  const tab = item.settingsTab
  const path = `${item.href}${tab ? `?tab=${tab}` : item.robotsMode ? `?mode=${item.robotsMode}` : ''}`
  setRoute(path)
  const view = render(<TopBarTitle title="Previous screen" isCollapsed={false} onCollapse={() => {}} />)
  for (const locale of ['en', 'es'] as const) {
    mockLocale = locale
    view.rerender(<TopBarTitle title="Previous screen" isCollapsed={false} onCollapse={() => {}} />)
    const expected = item.href === '/settings/procurement'
      ? translate('procurement.navigation.settings') : getNavItemTitle(item, translate)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(expected)
    expect(screen.queryByText('Compras')).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).not.toBeInTheDocument()
  }
  expect(getSection(path)).toBe(item.href)
  expect(hasId(path)).toBe(false)
  const state = reduceBreadcrumb(mockItems, { type: 'navigate', path, label: workspaceScreenTitle(path)!, timestamp: 2 })
  expect(state).toHaveLength(1)
  expect(state[0].path).toBe(path)
})

test.each(['/robots', '/skills?tab=manage', '/context'])(
  'keeps an accessible heading but only shows it on desktop for %s', path => {
    setRoute(path)
    render(<TopBarTitle title="Workspace" isCollapsed onCollapse={() => {}} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveClass('max-md:sr-only')
  },
)

test.each(['/robots?instance=one', '/connectors'])(
  'does not hide the heading on mobile for %s', path => {
    setRoute(path)
    render(<TopBarTitle title="Workspace" isCollapsed onCollapse={() => {}} />)
    expect(screen.getByRole('heading', { level: 1 })).not.toHaveClass('max-md:sr-only')
  },
)

test('does not flash the previous title when moving between buying screens', () => {
  setRoute('/purchases/rules')
  const view = render(<TopBarTitle title="Purchases" isCollapsed={false} onCollapse={() => {}} />)
  act(() => window.dispatchEvent(new CustomEvent('breadcrumb:update', { detail: { title: 'Old title' } })))
  setRoute('/purchases/procurement/approvals')
  view.rerender(<TopBarTitle title="Purchases" isCollapsed={false} onCollapse={() => {}} />)
  expect(screen.getByRole('heading')).toHaveTextContent(workspaceScreenTitle('/purchases/procurement/approvals')!)
  expect(screen.queryByText('Old title')).not.toBeInTheDocument()
})

test('details keep their entity title and navigate to the real translated parent', () => {
  mockLocale = 'es'
  mockItems = [
    { path: '/purchases', label: 'Compras', timestamp: 1 },
    { path: '/purchases/requests', label: 'Purchase Requests', timestamp: 2 },
    { path: '/purchases/requests/id', label: 'Office supplies', timestamp: 3 },
  ]
  setRoute('/purchases/requests/id')
  render(<TopBarTitle title="Purchases" isCollapsed={false} onCollapse={() => {}} />)
  expect(screen.queryByText('Compras')).not.toBeInTheDocument()
  expect(screen.getByRole('heading')).toHaveTextContent('Office supplies')
  fireEvent.click(screen.getByRole('button', { name: workspaceScreenTitle('/purchases/requests', translate)! }))
  expect(mockNavigate).toHaveBeenCalledWith(mockItems[1])
})

test.each(['/robots?instance=one', '/robots/one', '/robots?instance=one&mode=workflow', '/chat?conversationId=one', '/control-center/one'])(
  'shows a clickable breadcrumb at every viewport for %s', (path) => {
    mockItems = [
      { path: getSection(path), label: 'Parent', timestamp: 1 },
      { path, label: 'Current detail', timestamp: 2 },
    ]
    setRoute(path)
    render(<TopBarTitle title="AI Workspace" isCollapsed onCollapse={() => {}} />)
    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(breadcrumb).not.toHaveClass('md:hidden')
    expect(screen.getByRole('heading', { name: 'Current detail' })).toHaveAttribute('aria-current', 'page')
    const parent = breadcrumb.querySelector('button')!
    fireEvent.click(parent)
    expect(mockNavigate).toHaveBeenCalledWith(
      path.startsWith('/robots') && !path.includes('mode=workflow')
        ? { ...mockItems[0], label: 'Agents' }
        : mockItems[0],
    )
  },
)

test.each(['en', 'es'] as const)('keeps the Robots session title out of the parent crumb in %s', locale => {
  mockLocale = locale
  const path = '/robots?instance=one'
  mockItems = [
    { path: '/robots?instance=old', label: 'KPI report', timestamp: 1 },
    { path, label: 'KPI report', timestamp: 2 },
  ]
  setRoute(path)
  const view = render(<TopBarTitle title="AI Workspace" isCollapsed onCollapse={() => {}} />)
  expect(screen.getAllByText('KPI report')).toHaveLength(1)
  expect(screen.getByRole('heading', { name: 'KPI report' })).toHaveAttribute('aria-current', 'page')
  fireEvent.click(screen.getByRole('button', { name: translate('layout.nav.robots.title') }))
  expect(mockNavigate).toHaveBeenCalledWith({ path: '/robots', label: 'Agents', timestamp: 1 })

  setRoute('/robots?instance=new')
  view.rerender(<TopBarTitle title="AI Workspace" isCollapsed onCollapse={() => {}} />)
  expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).not.toBeInTheDocument()
  expect(screen.queryByText('KPI report')).not.toBeInTheDocument()
})

test('keeps breadcrumbs on desktop for non-Robots details', () => {
  mockItems = [
    { path: '/leads', label: 'Customers', timestamp: 1 },
    { path: '/leads/one', label: 'Customer one', timestamp: 2 },
  ]
  setRoute('/leads/one')
  render(<TopBarTitle title="Customers" isCollapsed onCollapse={() => {}} />)
  expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).not.toHaveClass('md:hidden')
})

test('shows the saved list after the localized people root and clears it on close', () => {
  setRoute('/people')
  mockLocale = 'es'
  render(<TopBarTitle title="People" isCollapsed onCollapse={() => {}} />)
  act(() => window.dispatchEvent(new CustomEvent('people:list-breadcrumb', { detail: 'Directivos Agencias' })))
  expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toHaveTextContent(workspaceScreenTitle('/people', translate)!)
  expect(screen.getByRole('heading', { name: 'Directivos Agencias' })).toHaveAttribute('aria-current', 'page')
  const onReturn = jest.fn()
  window.addEventListener('people:return-to-search', onReturn, { once: true })
  fireEvent.click(screen.getByRole('button', { name: workspaceScreenTitle('/people', translate)! }))
  expect(onReturn).toHaveBeenCalledTimes(1)
  act(() => window.dispatchEvent(new CustomEvent('people:list-breadcrumb', { detail: null })))
  expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).not.toBeInTheDocument()
})
