import type { ReactNode } from 'react'
import { render, screen, within } from '@testing-library/react'
import { usePathname, useRouter } from 'next/navigation'
import HomePage from '@/app/home/page'
import { BuyerShell } from '@/app/buyer/components/BuyerShell'
import { BuyerHomeView } from '@/app/buyer/components/BuyerHomeView'
import { AccountSearch } from '@/app/buyer/components/AccountSearch'

let mockDraftsState: { data?: { drafts: { publication_id: string }[] }; isLoading: boolean; error?: Error }
let mockOpportunitiesState: { data: { opportunities: { directly_invited?: boolean }[] }; isLoading: boolean }
let mockSubmissionsState: { data?: { submissions: { id: string }[] }; isLoading: boolean; error?: Error }
let mockUser: { id: string; email: string } | null

beforeEach(() => {
  jest.clearAllMocks()
  mockUser = { id: 'account', email: 'account@example.com' }
  mockDraftsState = { data: { drafts: [] }, isLoading: false }
  mockOpportunitiesState = { data: { opportunities: [] }, isLoading: false }
  mockSubmissionsState = { data: { submissions: [{ id: 'submission' }] }, isLoading: false }
})

jest.mock('@/app/context/LocalizationContext', () => ({
  useLocalization: () => ({ t: (key: string) => key, locale: 'en', setLocale: jest.fn() }),
}))
jest.mock('@/app/context/ThemeContext', () => ({ useTheme: () => ({ setTheme: jest.fn() }) }))
jest.mock('@/app/components/auth/auth-provider', () => ({
  useAuthContext: () => ({ user: mockUser, isLoading: false }),
}))

it.each([
  '/home/submissions?publication=abc&applicant=business%3A123&submit=1',
  '/buyer/orders?status=open&status=paid&q=two%20words',
])('retains the current internal path and query when the session expires: %s', path => {
  window.history.replaceState({}, '', path)
  jest.mocked(usePathname).mockReturnValue(path.split('?')[0])
  const router = useRouter()
  jest.mocked(useRouter).mockReturnValue(router)
  const view = render(<BuyerShell><p>Account content</p></BuyerShell>)
  expect(router.push).not.toHaveBeenCalled()
  mockUser = null
  view.rerender(<BuyerShell><p>Account content</p></BuyerShell>)
  expect(router.push).toHaveBeenCalledWith(`/auth?returnTo=${encodeURIComponent(path)}`)
  window.history.replaceState({}, '', '/')
})

it('does not use a protocol-relative return path on session expiry', () => {
  window.history.replaceState({}, '', '/buyer')
  // Browser pathname remains an internal path; a double-slash pathname is rejected.
  window.history.replaceState({}, '', '/buyer/..//external.example/path?submit=1')
  mockUser = null
  const router = useRouter()
  jest.mocked(useRouter).mockReturnValue(router)
  render(<BuyerShell><p>Account content</p></BuyerShell>)
  expect(router.push).toHaveBeenCalledWith('/auth?returnTo=%2Fbuyer')
  window.history.replaceState({}, '', '/')
})
jest.mock('@/app/buyer/actions', () => ({ getBuyerPortalSummary: jest.fn() }))
jest.mock('@/app/buyer/identity-qr-actions', () => ({ getBuyerIdentityQr: jest.fn() }))
jest.mock('swr', () => ({
  __esModule: true,
  default: (key: unknown) => Array.isArray(key) && key[0] === 'supplier-submissions'
    ? mockSubmissionsState
    : Array.isArray(key) && key[0] === 'supplier-drafts' ? mockDraftsState
    : Array.isArray(key) && key[0] === 'supplier-opportunities' ? mockOpportunitiesState
    : ({ data: { counts: { orders: 0, sites: 0 }, user: { email: 'account@example.com' } }, isLoading: false }),
}))
jest.mock('@/app/components/navigation/topbar-primary-actions', () => ({ TopBarPrimaryActionsSlot: () => null }))
jest.mock('@/app/components/commerce/CartButton', () => ({ CartButton: () => null }))
jest.mock('@/app/components/commerce/CommerceShellHeader', () => ({
  CommerceShellHeader: ({ brand, center, actions }: { brand: ReactNode; center?: ReactNode; actions: ReactNode }) => (
    <header>{brand}{center}<div data-testid="header-actions">{actions}</div></header>
  ),
  shellClasses: { navItem: 'nav-item', navItemActive: 'active', navItemInactive: 'inactive', iconButton: 'icon-button' },
}))

it('appends product search and account shortcuts to the existing grid with matching card styling', () => {
  render(<HomePage />)
  expect(screen.queryByRole('heading', { name: /Your account/i })).not.toBeInTheDocument()
  expect(screen.queryByText(/No workspace required/i)).not.toBeInTheDocument()
  const credentials = screen.getByRole('link', { name: /Credentials/ })
  const products = screen.getByRole('link', { name: /Search products/ })
  const activity = screen.getByRole('link', { name: /Supplier activity/ })
  const tenders = screen.getByRole('link', { name: /Discover tenders/ })
  const grid = credentials.parentElement!
  expect(Array.from(grid.children).slice(-4)).toEqual([products, credentials, activity, tenders])
  expect(products).toHaveAttribute('href', '/marketplace')
  expect(credentials).toHaveAttribute('href', '/home/profile')
  expect(activity).toHaveAttribute('href', '/home/submissions')
  expect(tenders).toHaveAttribute('href', '/tenders')
  const profile = screen.getByRole('link', { name: /buyer.home.cards.profile.title/ })
  expect(credentials.firstElementChild?.className).toBe(profile.firstElementChild?.className)
  expect(products.firstElementChild?.className).toBe(profile.firstElementChild?.className)
  expect(profile).toHaveAttribute('href', '/home/profile')
  expect(within(credentials).queryByRole('button')).not.toBeInTheDocument()
})

it.each([
  { data: { submissions: [] }, isLoading: false },
  { isLoading: true },
  { data: { submissions: [{ id: 'stale' }] }, isLoading: false, error: new Error('Unavailable') },
])('hides the submissions shortcut when no confirmed submissions are available: %j', state => {
  mockSubmissionsState = state
  render(<HomePage />)
  expect(screen.queryByRole('link', { name: /Supplier activity/ })).not.toBeInTheDocument()
  expect(document.querySelector('a[href="/home/submissions"]')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Search products/ })).toHaveAttribute('href', '/marketplace')
})

it.each(['/home', '/home/orders', '/home/submissions'])('omits purchases from the unified account header on %s', (path) => {
  jest.mocked(usePathname).mockReturnValue(path)
  render(<BuyerShell><p>Account content</p></BuyerShell>)
  const actions = screen.getByTestId('header-actions')
  expect(within(actions).queryByRole('navigation')).not.toBeInTheDocument()
  expect(within(actions).queryByRole('link', { name: 'buyer.layout.purchases' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'commerce.language.change' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'buyer.layout.footer.toggleTheme' })).toBeInTheDocument()
  expect(actions.querySelector('a[href="/home/profile"]')).toBeInTheDocument()
})

it.each(['/buyer/orders'])('places purchases before language, theme and profile on %s', (path) => {
  jest.mocked(usePathname).mockReturnValue(path)
  render(<BuyerShell><p>Account content</p></BuyerShell>)
  const nav = screen.getByRole('navigation')
  expect(within(nav).getAllByRole('link')).toHaveLength(1)
  expect(within(nav).getByRole('link')).toHaveAttribute('href', path)
  expect(within(nav).getByRole('link')).toHaveAttribute('aria-current', 'page')
  expect(screen.getByTestId('header-actions')).toContainElement(nav)
  expect(nav).toHaveClass('-order-1')
  const controls = [
    screen.getByRole('button', { name: 'commerce.language.change' }),
    screen.getByRole('button', { name: 'buyer.layout.footer.toggleTheme' }),
    nav.parentElement!.querySelector<HTMLAnchorElement>(`a[href="${path.replace('/orders', '/profile')}"]`)!,
  ]
  for (const control of controls) {
    expect(nav.parentElement).toContainElement(control)
    expect(control.parentElement).not.toHaveClass('-order-1')
  }
})

it.each([true, false])('renders home search in the actual shell main bar (requireAuth: %s)', requireAuth => {
  jest.mocked(usePathname).mockReturnValue('/home/quotes')
  render(<BuyerShell requireAuth={requireAuth}>
    <AccountSearch value="" onChange={jest.fn()} placeholder="Search quotations" />
  </BuyerShell>)
  const header = document.querySelector('header')!
  expect(within(header).getByRole('textbox', { name: 'Search quotations' })).toBeInTheDocument()
  expect(within(screen.getByRole('main')).queryByRole('textbox')).not.toBeInTheDocument()
  expect(header.querySelector('[data-account-search]')).toHaveClass('w-2/5', 'absolute', 'md:block')
  expect(within(header).getByRole('button', { name: 'Search quotations' })).toBeInTheDocument()
})

it('does not add unified account shortcuts to legacy or workspace views by default', () => {
  render(<BuyerHomeView />)
  expect(screen.queryByRole('link', { name: /Discover tenders/ })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: /buyer.home.cards.profile.title/ })).toHaveAttribute('href', '/buyer/profile')
})
it('shows supplier activity for a persisted draft even without submissions or invitations', () => {
  mockSubmissionsState = { data: { submissions: [] }, isLoading: false }
  mockDraftsState = { data: { drafts: [{ publication_id: 'saved' }] }, isLoading: false }
  render(<HomePage />)
  expect(screen.getByRole('link', { name: /Supplier activity/ })).toHaveAttribute('href', '/home/submissions')
})

it.each([true, false, undefined])('only direct invitations enable the activity shortcut: %s', directlyInvited => {
  mockSubmissionsState = { data: { submissions: [] }, isLoading: false }
  mockOpportunitiesState = { data: { opportunities: [{ directly_invited: directlyInvited }] }, isLoading: false }
  render(<HomePage />)
  expect(!!screen.queryByRole('link', { name: /Supplier activity/ })).toBe(directlyInvited === true)
})

it.each([
  { data: { drafts: [] }, isLoading: false },
  { data: { drafts: [{ publication_id: 'stale' }] }, isLoading: true },
  { data: { drafts: [{ publication_id: 'stale' }] }, isLoading: false, error: new Error('Unavailable') },
])('unconfirmed draft state does not enable the activity shortcut: %j', state => {
  mockSubmissionsState = { data: { submissions: [] }, isLoading: false }
  mockDraftsState = state
  render(<HomePage />)
  expect(screen.queryByRole('link', { name: /Supplier activity/ })).not.toBeInTheDocument()
})
