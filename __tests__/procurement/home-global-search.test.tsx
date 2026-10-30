import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { useRouter } from 'next/navigation'
import { AccountSearchActionsSlot, AccountSearchSlot } from '@/app/buyer/components/AccountSearch'
import { GlobalSearchInput } from '@/app/home/search/global-search-input'
import { SearchView } from '@/app/home/search/search-view'
import { PortalDemoProvider } from '@/app/home/demo-context'
import { filterSearchRows, searchCollections, searchHref } from '@/app/home/search/types'
import { demoSearchSources } from '@/app/home/search/demo-sources'
import { normalizeSearchRows } from '@/app/home/search/normalize'
import { loadSearchSources, readSearchPages } from '@/app/home/search/load-sources'

jest.mock('@/app/components/auth/auth-provider', () => ({ useAuthContext: () => ({ user: { id: 'account' } }) }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key, locale: 'en' }) }))
jest.mock('@/app/buyer/actions', () => ({ getUserSites: jest.fn(), listBuyerLibrary: jest.fn(), listBuyerOrders: jest.fn(),
  listBuyerQuotes: jest.fn(), listBuyerSubscriptions: jest.fn() }))
jest.mock('@/app/home/search/actions', () => ({ listSearchReservations: jest.fn(), listSearchTenders: jest.fn() }))
jest.mock('@/app/home/search/load-sources', () => ({
  ...jest.requireActual('@/app/home/search/load-sources'), loadSearchSources: jest.fn(),
}))

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(useRouter).mockReturnValue({ push: jest.fn(), replace: jest.fn() } as never)
})

test('Home header enters URL-backed search mode and encodes the term', () => {
  const push = jest.fn()
  jest.mocked(useRouter).mockReturnValue({ push } as never)
  render(<><AccountSearchSlot /><AccountSearchActionsSlot /><GlobalSearchInput /></>)
  fireEvent.change(screen.getByRole('textbox', { name: 'Search all collections...' }), { target: { value: 'Acme & kit' } })
  expect(push).toHaveBeenCalledWith('/home/search?q=Acme+%26+kit', { scroll: false })
  expect(searchHref('a/b')).toBe('/home/search?q=a%2Fb')
})

test('indexes all demo collections and supports multiword, case-insensitive and collection filters', () => {
  const sources = demoSearchSources()
  expect(sources.map(source => source.collection).sort()).toEqual([...searchCollections].sort())
  const rows = filterSearchRows(sources, 'WORKSPACE Acme', 'orders')
  expect(rows.length).toBeGreaterThan(0)
  expect(rows.every(row => row.collection === 'orders' && row.href.startsWith('/home/preview/orders/'))).toBe(true)
  expect(filterSearchRows(sources, 'no-such-record')).toEqual([])
})

test('search mode replaces home cards with the shared document table without live demo requests', async () => {
  render(<SWRConfig value={{ provider: () => new Map() }}><PortalDemoProvider demo>
    <AccountSearchSlot /><SearchView initialQuery="Product design" />
  </PortalDemoProvider></SWRConfig>)
  expect(screen.getByRole('heading', { name: 'Search results' })).toBeInTheDocument()
  expect(screen.getByRole('table')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Product design foundations 1' })).toHaveAttribute('href', '/home/preview/library/demo-course-1')
  expect(screen.getByRole('combobox', { name: 'Collection' })).toBeInTheDocument()
  expect(loadSearchSources).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
  await waitFor(() => expect(screen.queryByRole('table')).not.toBeInTheDocument())
  expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/home')
})

test('shows failed collections separately from successful matches', async () => {
  jest.mocked(loadSearchSources).mockResolvedValue([
    { collection: 'orders', rows: normalizeSearchRows('orders', [{ id: 'one', order_number: 'ACME-1' }]) },
    { collection: 'credentials', rows: [], error: true },
  ])
  render(<SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}><PortalDemoProvider demo={false}>
    <AccountSearchSlot /><SearchView initialQuery="ACME" />
  </PortalDemoProvider></SWRConfig>)
  expect(await screen.findByRole('link', { name: 'ACME-1' })).toHaveAttribute('href', '/buyer/orders/one')
  expect(screen.getByRole('alert')).toHaveTextContent('Credentials')
})

test('collects records beyond the first page and fails visibly on a later-page error', async () => {
  const load = jest.fn().mockResolvedValueOnce({ data: [{ id: 'one' }], count: 2 })
    .mockResolvedValueOnce({ data: [{ id: 'two' }], count: 2 })
  expect(await readSearchPages(load, 1)).toEqual([{ id: 'one' }, { id: 'two' }])
  expect(load).toHaveBeenNthCalledWith(2, 2)
  await expect(readSearchPages(jest.fn().mockResolvedValueOnce({ data: [{ id: 'one' }], count: 2 })
    .mockResolvedValueOnce({ error: 'Denied' }), 1)).rejects.toThrow('Collection unavailable')
})