import { act, fireEvent, render, screen } from '@testing-library/react'
import { SWRConfig } from 'swr'
import SalesPage from '@/app/sales/page'
import { getSales } from '@/app/sales/actions'
import { listLocations } from '@/app/inventory/actions'
import { getSegments } from '@/app/segments/actions'

const firstSite = '11111111-1111-4111-8111-111111111111'
let mockSite = firstSite
let mockActor = 'actor-a'
let mockSiteLoading = false
jest.mock('@/app/sales/actions', () => ({ getSales: jest.fn(), updateSale: jest.fn() }))
jest.mock('@/app/inventory/actions', () => ({ listLocations: jest.fn() }))
jest.mock('@/app/segments/actions', () => ({ getSegments: jest.fn() }))
jest.mock('@/app/hooks/use-auth', () => ({ useAuth: () => ({ user: { id: mockActor }, isLoading: false }) }))
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: { id: mockSite }, isLoading: mockSiteLoading,
  requestScope: { siteId: mockSite, actorId: mockActor } }) }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: () => '', locale: 'en' }) }))
jest.mock('@/app/components/dashboard/campaign-revenue-donut', () => ({ formatCurrency: (amount: number) => `$${amount}` }))
jest.mock('@/app/components/ui/sticky-header', () => ({ StickyHeader: ({ children }: React.PropsWithChildren) => children }))
jest.mock('@/app/components/ui/date-range-picker', () => ({ CalendarDateRangePicker: () => null }))
jest.mock('@/app/sales/components/CreateSaleDialog', () => ({ CreateSaleDialog: ({ open }: { open: boolean }) => open ? <div>Create sale</div> : null }))

function sale(title: string, locationId: string) {
  return { id: title, title, productName: title, locationId, leadName: 'Customer', saleDate: new Date().toISOString(),
    source: 'retail', status: 'completed', amount: 14, amount_due: 0,
    segmentId: 'regular', segmentName: 'Regular customers', siteId: mockSite } as const
}
const ui = () => <SWRConfig value={{ provider: () => new Map(), keepPreviousData: true, shouldRetryOnError: false }}><SalesPage /></SWRConfig>
function openLocations() { fireEvent.keyDown(screen.getByRole('combobox', { name: 'Location' }), { key: 'ArrowDown' }) }

beforeAll(() => { Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: jest.fn() }) })
afterAll(() => { Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView') })
beforeEach(() => {
  mockSite = firstSite; mockActor = 'actor-a'; mockSiteLoading = false
  jest.clearAllMocks()
  jest.mocked(getSales).mockResolvedValue({ sales: [sale('Delivery', 'depot'), sale('Walk-in', 'store')] } as never)
  jest.mocked(listLocations).mockResolvedValue({ data: [{ id: 'depot', name: 'Depot' }, { id: 'store', name: 'Store' }] } as never)
  jest.mocked(getSegments).mockResolvedValue({ segments: [{ id: 'regular', name: 'Regular customers' }] } as never)
})

it('loads rows and their labels with the sales read alone; location options load on first open', async () => {
  render(ui())
  expect(await screen.findByText('Delivery · Regular customers')).toBeVisible()
  expect(screen.getByText('Walk-in · Regular customers')).toBeVisible()
  expect([getSales, listLocations, getSegments].map(read => jest.mocked(read).mock.calls.length)).toEqual([1, 0, 0])
  openLocations()
  fireEvent.keyDown(await screen.findByRole('option', { name: 'Depot' }), { key: 'Enter' })
  expect(screen.queryByText(/Walk-in/)).not.toBeInTheDocument()
  expect(screen.getByText('Delivery · Regular customers')).toBeVisible()
  expect(listLocations).toHaveBeenCalledTimes(1)
  expect(listLocations).toHaveBeenCalledWith(mockSite)
  expect(getSales).toHaveBeenCalledTimes(1)
})

it('does not present failed locations as an empty list or reload sales to retry them', async () => {
  jest.mocked(listLocations).mockResolvedValueOnce({ data: [], error: 'Unavailable' })
  render(ui())
  await screen.findByText('Delivery · Regular customers')
  openLocations()
  fireEvent.click(await screen.findByRole('button', { name: /retry location/i }))
  await screen.findByRole('combobox', { name: 'Location' })
  openLocations()
  expect(await screen.findByRole('option', { name: 'Depot' })).toBeVisible()
  expect(listLocations).toHaveBeenCalledTimes(2)
  expect(getSales).toHaveBeenCalledTimes(1)
})

it.each(['site', 'account'])('retires options, dialogs and results on %s change', async change => {
  let finish!: (value: Awaited<ReturnType<typeof listLocations>>) => void
  jest.mocked(listLocations).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = render(ui())
  await screen.findByText('Delivery · Regular customers')
  openLocations()
  expect(listLocations).toHaveBeenCalledTimes(1)
  act(() => window.dispatchEvent(new Event('sales:create')))
  expect(screen.getByText('Create sale')).toBeInTheDocument()
  if (change === 'site') mockSite = '22222222-2222-4222-8222-222222222222'
  else mockActor = 'actor-b'
  jest.mocked(getSales).mockResolvedValue({ sales: [] })
  view.rerender(ui())
  await act(async () => finish({ data: [{ id: 'old', name: 'Old Depot' }] } as never))
  expect(screen.queryByText(/Delivery|Old Depot|Create sale/)).not.toBeInTheDocument()
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  expect(getSales).toHaveBeenCalledTimes(2)
  expect(listLocations).toHaveBeenCalledTimes(1)
})

it('waits for the hydrated site and distinguishes a failed list from no sales', async () => {
  mockSiteLoading = true
  jest.mocked(getSales).mockResolvedValueOnce({ error: 'Unavailable' })
  const view = render(ui())
  expect(getSales).not.toHaveBeenCalled()
  mockSiteLoading = false; view.rerender(ui())
  fireEvent.click(await screen.findByRole('button', { name: /retry sales/i }))
  expect(await screen.findByText('Delivery · Regular customers')).toBeVisible()
  expect(getSales).toHaveBeenCalledTimes(2)
  expect(listLocations).not.toHaveBeenCalled()
})